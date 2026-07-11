-- Solace Executive member portal schema.
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

-- One row per member, linked 1:1 to their auth account.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Members can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Members can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new member account is added,
-- so you only ever have to create the auth user itself.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Each member's concierge requests, shown on their dashboard.
-- status is one of: 'review', 'confirmed', 'done'.
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete cascade not null,
  service text not null,
  status text not null default 'review',
  notes text,
  created_at timestamptz default now()
);

alter table public.requests enable row level security;

create policy "Members can view their own requests"
  on public.requests for select
  using (auth.uid() = member_id);

-- Membership gating (AI Concierge is a paid-membership perk) and
-- first-login onboarding tour tracking.
alter table public.profiles
  add column is_member_active boolean not null default false,
  add column has_seen_tour boolean not null default false;

-- Members can update their own profile (name/company/has_seen_tour),
-- but must never be able to flip is_member_active themselves from the
-- browser. Direct edits via the Table Editor / SQL Editor, and calls
-- made with the service_role key (the concierge-chat edge function),
-- bypass this and go through unchanged.
create or replace function public.protect_membership_fields()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    new.is_member_active := old.is_member_active;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger protect_membership_fields_trigger
  before update on public.profiles
  for each row execute procedure public.protect_membership_fields();

-- Lets the stripe-webhook edge function (service role) look up which
-- member a Stripe customer email belongs to, so it can flip
-- is_member_active automatically on payment / cancellation.
create or replace function public.get_profile_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = lookup_email limit 1;
$$;

-- Phone number (shown on Account) and salutation preference ('dhr',
-- 'mevr', or null for no preference), used by the AI concierge to
-- address the member properly.
alter table public.profiles
  add column phone text,
  add column title text;

-- Track status changes on requests so members can be notified (email
-- + in-dashboard badge) when staff update their request.
alter table public.requests
  add column updated_at timestamptz not null default now(),
  add column seen_by_member boolean not null default true;

create or replace function public.mark_request_status_changed()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    new.updated_at = now();
    new.seen_by_member = false;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger requests_status_change_trigger
  before update on public.requests
  for each row execute procedure public.mark_request_status_changed();

-- Lets a member mark their own requests as seen (e.g. when they open
-- the Aanvragen tab) without granting them general UPDATE rights.
create or replace function public.mark_requests_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.requests set seen_by_member = true
  where member_id = auth.uid() and seen_by_member = false;
$$;

-- Lets the request-status-notify edge function (service role) look up
-- a member's email + name from their profile id, to send the "your
-- request was updated" email.
create or replace function public.get_member_contact(member_uuid uuid)
returns table(email text, full_name text)
language sql
security definer
set search_path = public, auth
as $$
  select u.email, p.full_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = member_uuid;
$$;

-- Generic flag for gating in-development features to specific accounts
-- (e.g. the owner) before a full rollout to all members.
alter table public.profiles
  add column beta_features boolean not null default false;

-- Solace Points: a ledger-based points/rewards system. points_balance
-- is spendable (goes up and down); points_lifetime only ever goes up
-- and is what member tier is calculated from, so redeeming a reward
-- never knocks a member back down a tier.
alter table public.profiles
  add column points_balance integer not null default 0,
  add column points_lifetime integer not null default 0;

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  reason text not null,
  created_at timestamptz default now()
);

alter table public.point_transactions enable row level security;

create policy "Members can view their own point transactions"
  on public.point_transactions for select
  using (auth.uid() = member_id);

create or replace function public.apply_point_transaction()
returns trigger as $$
begin
  update public.profiles
  set points_balance = points_balance + new.amount,
      points_lifetime = points_lifetime + greatest(new.amount, 0)
  where id = new.member_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger point_transactions_apply
  after insert on public.point_transactions
  for each row execute procedure public.apply_point_transaction();

-- Automatically award points when a request is marked done.
create or replace function public.award_points_on_completion()
returns trigger as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    insert into public.point_transactions (member_id, amount, reason)
    values (new.member_id, 150, 'Aanvraag voltooid: ' || new.service);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger award_points_on_completion_trigger
  after update on public.requests
  for each row execute procedure public.award_points_on_completion();

-- Rewards catalog, managed by staff via the Table Editor.
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cost_points integer not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

alter table public.rewards enable row level security;

create policy "Members can view active rewards"
  on public.rewards for select
  using (auth.role() = 'authenticated' and active = true);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete cascade not null,
  reward_id uuid references public.rewards(id) not null,
  points_spent integer not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.reward_redemptions enable row level security;

create policy "Members can view their own redemptions"
  on public.reward_redemptions for select
  using (auth.uid() = member_id);

-- Lets a member redeem a reward for themselves: checks their balance,
-- deducts the cost as a point_transaction, and logs the redemption for
-- staff to fulfill manually.
create or replace function public.redeem_reward(reward_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_balance integer;
begin
  select cost_points into v_cost from public.rewards where id = reward_uuid and active = true;
  if v_cost is null then
    raise exception 'Reward not found or inactive';
  end if;

  select points_balance into v_balance from public.profiles where id = auth.uid();
  if v_balance < v_cost then
    raise exception 'Insufficient points';
  end if;

  insert into public.point_transactions (member_id, amount, reason)
  values (auth.uid(), -v_cost, 'Beloning ingewisseld');

  insert into public.reward_redemptions (member_id, reward_id, points_spent)
  values (auth.uid(), reward_uuid, v_cost);
end;
$$;

-- One-time bonus for filling in a complete profile (phone, title and
-- company all set), to encourage members to give the concierge team
-- what they need. profile_complete_bonus_claimed prevents it firing
-- again if a field is later cleared and re-filled.
alter table public.profiles
  add column profile_complete_bonus_claimed boolean not null default false;

-- This runs AFTER update (not before) and issues its own explicit
-- UPDATE for the claimed flag, rather than mutating NEW directly: a
-- before-trigger here would get overwritten by the outer UPDATE,
-- silently discarding the points_balance change made by the
-- point_transactions insert below.
create or replace function public.award_points_on_profile_complete()
returns trigger as $$
begin
  if not new.profile_complete_bonus_claimed
     and coalesce(new.phone, '') <> ''
     and coalesce(new.title, '') <> ''
     and coalesce(new.company, '') <> '' then
    update public.profiles set profile_complete_bonus_claimed = true where id = new.id;
    insert into public.point_transactions (member_id, amount, reason)
    values (new.id, 100, 'Profiel compleet');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger award_points_on_profile_complete_trigger
  after update on public.profiles
  for each row execute procedure public.award_points_on_profile_complete();

-- English variants for the rewards catalog, so cards translate when a
-- member switches language. Optional: staff can leave these blank and
-- the dashboard falls back to the Dutch title/description.
alter table public.rewards
  add column title_en text,
  add column description_en text;

-- Welcome bonus: every new member starts with 200 Solace Points.
-- Re-defines handle_new_user() (only new signups get this; it does not
-- retroactively credit existing members).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  insert into public.point_transactions (member_id, amount, reason)
  values (new.id, 200, 'Welkomstbonus');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- AI Concierge chat history, so a page refresh doesn't lose the
-- conversation. Loaded on dashboard init, appended to as messages send.
create table public.concierge_messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete cascade not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.concierge_messages enable row level security;

create policy "Members can view their own concierge messages"
  on public.concierge_messages for select
  using (auth.uid() = member_id);

create policy "Members can insert their own concierge messages"
  on public.concierge_messages for insert
  with check (auth.uid() = member_id);
