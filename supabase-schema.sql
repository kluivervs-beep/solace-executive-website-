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
--
-- CRITICAL FIX (found in a full RLS audit): "Members can update their own
-- profile" has no `with check`, so Postgres never restricted which COLUMNS
-- a member can change on their own row -- only that it has to be their own
-- row. This function originally only pinned back is_member_active, leaving
-- every other sensitive column added since (is_admin, points_balance,
-- points_lifetime, priority_credits, priority_until,
-- profile_complete_bonus_claimed, birthday_bonus_year, beta_features) with
-- zero protection: any authenticated member could
-- `update profiles set is_admin = true where id = auth.uid()` and grant
-- themselves full admin access to every other member's data. Pinning all
-- of them back here, the same way is_member_active already was.
create or replace function public.protect_membership_fields()
returns trigger as $$
begin
  if auth.role() = 'authenticated' then
    new.is_member_active := old.is_member_active;
    new.is_admin := old.is_admin;
    new.points_balance := old.points_balance;
    new.points_lifetime := old.points_lifetime;
    new.priority_credits := old.priority_credits;
    new.priority_until := old.priority_until;
    new.profile_complete_bonus_claimed := old.profile_complete_bonus_claimed;
    new.birthday_bonus_year := old.birthday_bonus_year;
    new.beta_features := old.beta_features;
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

-- SECURITY FIX (found in a full RLS audit): this was meant to be
-- service_role-only (see comment above), like redeem_reward_for_member
-- below, but was missing the revoke/grant pair that actually enforces
-- that -- Postgres grants EXECUTE on new functions to PUBLIC by default,
-- so any authenticated (and likely anon) client could call
-- rpc/get_profile_id_by_email to check whether an email belongs to a
-- member at all, a privacy leak for a discreet concierge service.
revoke execute on function public.get_profile_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_profile_id_by_email(text) to service_role;

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

-- SECURITY FIX (same audit as get_profile_id_by_email above): this
-- security-definer function bypasses RLS by design, and was missing the
-- lockdown to match -- any authenticated client could call
-- rpc/get_member_contact with any uuid and get that member's email + full
-- name directly.
revoke execute on function public.get_member_contact(uuid) from public, anon, authenticated;
grant execute on function public.get_member_contact(uuid) to service_role;

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

-- Freeform notes the AI Concierge saves about a member's stated
-- preferences (home airport, recurring requests, etc.), so future
-- conversations already know them.
alter table public.profiles add column concierge_notes text;

-- Lets staff (and the notification email subject) spot time-sensitive
-- requests immediately, without reading every request in full.
alter table public.requests add column is_urgent boolean not null default false;

-- Same redemption logic as redeem_reward(), but takes the member id as
-- an explicit argument instead of relying on auth.uid() — used by the
-- concierge-chat edge function (which calls with the service role, so
-- there is no authenticated browser session / auth.uid() to read).
-- Locked down to service_role only: a member must never be able to
-- call this directly and redeem on someone else's behalf.
create or replace function public.redeem_reward_for_member(member_uuid uuid, reward_uuid uuid)
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

  select points_balance into v_balance from public.profiles where id = member_uuid;
  if v_balance < v_cost then
    raise exception 'Insufficient points';
  end if;

  insert into public.point_transactions (member_id, amount, reason)
  values (member_uuid, -v_cost, 'Beloning ingewisseld via AI Concierge');

  insert into public.reward_redemptions (member_id, reward_id, points_spent)
  values (member_uuid, reward_uuid, v_cost);
end;
$$;

revoke execute on function public.redeem_reward_for_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_reward_for_member(uuid, uuid) to service_role;

-- A couple more personal fields for the Account tab.
alter table public.profiles add column birthday date, add column city text;

-- "Member Playbook" opportunities: staff-curated exclusive items shown on
-- the app's Home screen (new partners, priority windows, early access).
-- Members only ever see active=true rows; admins manage the full set
-- (including inactive drafts) via the dashboard's Playbook tab.
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_en text,
  description text,
  description_en text,
  tag text not null default 'NEW',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.opportunities enable row level security;

create policy "Members can view active opportunities"
  on public.opportunities for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admins can read all opportunities"
  on public.opportunities for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can insert opportunities"
  on public.opportunities for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update opportunities"
  on public.opportunities for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete opportunities"
  on public.opportunities for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Booking detail fields staff fill in for confirmed requests, shown in the
-- app as a "Tonight's Setup"-style overview once a booking is locked in.
alter table public.requests
  add column if not exists arrival_info text,
  add column if not exists venue_info text,
  add column if not exists dress_code text;

create policy "admins can update requests"
  on public.requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Lets a member self-serve cancel their own request from the app instead of
-- always having to message the concierge. Scoped tightly: only their own
-- rows, only from a still-open status, and the only allowed resulting
-- status is 'cancelled' (can't be abused to edit anything else).
drop policy if exists "Members can cancel their own open requests" on public.requests;
create policy "Members can cancel their own open requests"
  on public.requests for update
  using (auth.uid() = member_id and status in ('review', 'confirmed'))
  with check (auth.uid() = member_id and status = 'cancelled');

-- Reference photos a member sends in the Concierge chat (e.g. "find me this
-- watch"), and staff replies also get an image_url when replying with one.
alter table public.concierge_messages add column if not exists image_url text;

-- The schema on file had drifted from what's actually deployed (staff
-- sends messages as role='staff' from the dashboard, which needs its own
-- policies that were never captured here). Added defensively so re-running
-- this file stays in sync with the live project.
drop policy if exists "admins can view all concierge messages" on public.concierge_messages;
create policy "admins can view all concierge messages"
  on public.concierge_messages for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins can insert concierge messages" on public.concierge_messages;
create policy "admins can insert concierge messages"
  on public.concierge_messages for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Public bucket for chat reference photos. Low-sensitivity (members choose
-- to share these with their own concierge team), so a public URL keeps the
-- app and dashboard simple rather than needing signed-URL plumbing.
insert into storage.buckets (id, name, public)
values ('concierge-attachments', 'concierge-attachments', true)
on conflict (id) do nothing;

-- SECURITY FIX (found in a full RLS audit): the SELECT policy had no role
-- check at all (fully open, even to anon, for LISTING/enumerating the
-- bucket via the API -- direct public-URL fetches of a known path are
-- unaffected either way, since the bucket itself is public by design, see
-- above), and INSERT had no per-member folder scoping, so any authenticated
-- member could write into another member's folder (the app itself always
-- uploads to `${member_id}/...`, see ConciergeScreen.tsx, but nothing
-- server-side enforced that). Restricting listing to authenticated users
-- and insert to the caller's own folder prefix closes both gaps.
drop policy if exists "Anyone can view concierge attachments" on storage.objects;
create policy "Anyone can view concierge attachments"
  on storage.objects for select
  using (bucket_id = 'concierge-attachments' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can upload concierge attachments" on storage.objects;
create policy "Authenticated users can upload concierge attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'concierge-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lightweight billing: staff record what a member owes for a fulfilled
-- request (no in-app payment collection, settled outside the app), and the
-- member can see status/history in the app.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete cascade not null,
  description text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'EUR',
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;

drop policy if exists "Members can view their own invoices" on public.invoices;
create policy "Members can view their own invoices"
  on public.invoices for select
  using (auth.uid() = member_id);

drop policy if exists "admins can read all invoices" on public.invoices;
create policy "admins can read all invoices"
  on public.invoices for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins can insert invoices" on public.invoices;
create policy "admins can insert invoices"
  on public.invoices for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins can update invoices" on public.invoices;
create policy "admins can update invoices"
  on public.invoices for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins can delete invoices" on public.invoices;
create policy "admins can delete invoices"
  on public.invoices for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Curated showcase photos shown on the app's Home screen (e.g. a villa a
-- member booked, a jet interior, a table setup), staff-uploaded from the
-- dashboard. Not tied to a specific member/request in v1: it's a shared
-- feed of "moments", not a personalized history.
create table public.member_experiences (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_en text,
  caption text,
  caption_en text,
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.member_experiences enable row level security;

create policy "Members can view active experiences"
  on public.member_experiences for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admins can read all experiences"
  on public.member_experiences for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can insert experiences"
  on public.member_experiences for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update experiences"
  on public.member_experiences for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete experiences"
  on public.member_experiences for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Photos are staff-curated (unlike concierge-attachments, which any member
-- can upload to), so only admins can write to this bucket.
insert into storage.buckets (id, name, public)
values ('member-experiences', 'member-experiences', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view member experience photos" on storage.objects;
create policy "Anyone can view member experience photos"
  on storage.objects for select
  using (bucket_id = 'member-experiences');

drop policy if exists "Admins can upload member experience photos" on storage.objects;
create policy "Admins can upload member experience photos"
  on storage.objects for insert
  with check (bucket_id = 'member-experiences' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete member experience photos" on storage.objects;
create policy "Admins can delete member experience photos"
  on storage.objects for delete
  using (bucket_id = 'member-experiences' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Optional photos on Playbook items and Rewards, so they can appear as a
-- full image card in the activity feed instead of always being text-only.
alter table public.opportunities add column if not exists image_url text;
alter table public.rewards add column if not exists image_url text;

-- Auto-generated activity feed: whenever staff adds a new member experience,
-- playbook item, reward, or news post from the dashboard, a row lands here
-- automatically via trigger. No separate "write a news post" step needed.
create table public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('experience', 'playbook', 'reward', 'news')),
  title text not null,
  title_en text,
  caption text,
  caption_en text,
  image_url text,
  source_table text not null,
  source_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.activity_feed enable row level security;

create policy "Members can view active activity"
  on public.activity_feed for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admins can read all activity"
  on public.activity_feed for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update activity"
  on public.activity_feed for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete activity"
  on public.activity_feed for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create function public.fn_activity_from_experience()
returns trigger as $$
begin
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('experience', new.title, new.title_en, new.caption, new.caption_en, new.image_url, 'member_experiences', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_activity_experience
after insert on public.member_experiences
for each row when (new.active)
execute function public.fn_activity_from_experience();

create function public.fn_activity_from_opportunity()
returns trigger as $$
begin
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('playbook', new.title, new.title_en, new.description, new.description_en, new.image_url, 'opportunities', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_activity_opportunity
after insert on public.opportunities
for each row when (new.active)
execute function public.fn_activity_from_opportunity();

create function public.fn_activity_from_reward()
returns trigger as $$
begin
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('reward', new.title, new.title_en, new.description, new.description_en, new.image_url, 'rewards', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_activity_reward
after insert on public.rewards
for each row when (new.active)
execute function public.fn_activity_from_reward();

-- news_posts predates this migration log (created directly in Supabase
-- Studio); columns are id, title, body, image_url, created_at.
create function public.fn_activity_from_news()
returns trigger as $$
begin
  insert into public.activity_feed (kind, title, caption, image_url, source_table, source_id)
  values ('news', new.title, new.body, new.image_url, 'news_posts', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_activity_news
after insert on public.news_posts
for each row
execute function public.fn_activity_from_news();
-- Keep the activity feed in sync when a source row is edited or removed,
-- not just when it's first created. Without this, deleting a reward or
-- unpublishing an experience would leave a dead card in the feed forever.
alter table public.activity_feed
  add constraint activity_feed_source_unique unique (source_table, source_id);

create or replace function public.fn_activity_from_experience()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    delete from public.activity_feed where source_table = 'member_experiences' and source_id = old.id;
    return old;
  end if;
  if not new.active then
    delete from public.activity_feed where source_table = 'member_experiences' and source_id = new.id;
    return new;
  end if;
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('experience', new.title, new.title_en, new.caption, new.caption_en, new.image_url, 'member_experiences', new.id)
  on conflict (source_table, source_id) do update set
    title = excluded.title, title_en = excluded.title_en, caption = excluded.caption,
    caption_en = excluded.caption_en, image_url = excluded.image_url;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_activity_experience on public.member_experiences;
create trigger trg_activity_experience
after insert or update or delete on public.member_experiences
for each row execute function public.fn_activity_from_experience();

create or replace function public.fn_activity_from_opportunity()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    delete from public.activity_feed where source_table = 'opportunities' and source_id = old.id;
    return old;
  end if;
  if not new.active then
    delete from public.activity_feed where source_table = 'opportunities' and source_id = new.id;
    return new;
  end if;
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('playbook', new.title, new.title_en, new.description, new.description_en, new.image_url, 'opportunities', new.id)
  on conflict (source_table, source_id) do update set
    title = excluded.title, title_en = excluded.title_en, caption = excluded.caption,
    caption_en = excluded.caption_en, image_url = excluded.image_url;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_activity_opportunity on public.opportunities;
create trigger trg_activity_opportunity
after insert or update or delete on public.opportunities
for each row execute function public.fn_activity_from_opportunity();

create or replace function public.fn_activity_from_reward()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    delete from public.activity_feed where source_table = 'rewards' and source_id = old.id;
    return old;
  end if;
  if not new.active then
    delete from public.activity_feed where source_table = 'rewards' and source_id = new.id;
    return new;
  end if;
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, source_table, source_id)
  values ('reward', new.title, new.title_en, new.description, new.description_en, new.image_url, 'rewards', new.id)
  on conflict (source_table, source_id) do update set
    title = excluded.title, title_en = excluded.title_en, caption = excluded.caption,
    caption_en = excluded.caption_en, image_url = excluded.image_url;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_activity_reward on public.rewards;
create trigger trg_activity_reward
after insert or update or delete on public.rewards
for each row execute function public.fn_activity_from_reward();

create or replace function public.fn_activity_from_news()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    delete from public.activity_feed where source_table = 'news_posts' and source_id = old.id;
    return old;
  end if;
  insert into public.activity_feed (kind, title, caption, image_url, source_table, source_id)
  values ('news', new.title, new.body, new.image_url, 'news_posts', new.id)
  on conflict (source_table, source_id) do update set
    title = excluded.title, caption = excluded.caption, image_url = excluded.image_url;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_activity_news on public.news_posts;
create trigger trg_activity_news
after insert or update or delete on public.news_posts
for each row execute function public.fn_activity_from_news();

-- Security hardening pass: several tables had policies open to the
-- `public` role (anon + authenticated, i.e. anyone on the internet with
-- the app's publishable key, which is not a secret) instead of being
-- scoped to the owning member or to admins. Found while auditing after
-- Kluiver asked to lock the app down.

-- favorites: any authenticated user could read/write/delete any OTHER
-- member's favorites (no owner scoping at all).
drop policy if exists "members manage their own favorites" on public.favorites;
create policy "members manage their own favorites"
  on public.favorites for all
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- leads: fully open CRUD to anyone (select/insert/update/delete, `true`
-- for all four, role `public`). Only consumer is the local lead-tracker
-- tool, now gated behind an admin login, so this can go admin-only.
drop policy if exists "leads_select" on public.leads;
drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;
drop policy if exists "leads_delete" on public.leads;

create policy "admins can select leads"
  on public.leads for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can insert leads"
  on public.leads for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can update leads"
  on public.leads for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can delete leads"
  on public.leads for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- access_requests: SELECT was open to anyone, exposing every prospect's
-- name/email/phone. INSERT stays public/anon on purpose (unauthenticated
-- prospects submit this before they have an account).
drop policy if exists "read access requests" on public.access_requests;
create policy "admins can read access requests"
  on public.access_requests for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- news_posts: INSERT (and SELECT) were open to anyone, meaning anyone
-- could inject arbitrary "news" that (via the activity_feed trigger)
-- would show up for every member. Nothing found reading/writing this
-- table directly anymore (superseded by activity_feed in the app), so
-- admin-only across the board.
drop policy if exists "insert news posts" on public.news_posts;
drop policy if exists "read news posts" on public.news_posts;
create policy "admins can read news posts"
  on public.news_posts for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can insert news posts"
  on public.news_posts for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can update news posts"
  on public.news_posts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can delete news posts"
  on public.news_posts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- referral_codes: serves two purposes (staff-issued invite codes with a
-- null owner_id, and a member's own shareable code with owner_id set).
-- SELECT/INSERT were both open to anyone, meaning anyone could scrape
-- every valid invite code directly (defeating the invite-only gate) or
-- mint their own with a huge max_uses. Members still need to read/create
-- their OWN code, and an unauthenticated prospect still needs to check
-- whether a code they were given is valid, so that check moves to a
-- SECURITY DEFINER function that only ever returns ok/invalid/used,
-- never the underlying rows.
drop policy if exists "read referral codes" on public.referral_codes;
drop policy if exists "insert referral codes" on public.referral_codes;

create policy "members can view their own referral code"
  on public.referral_codes for select
  using (auth.uid() = owner_id);
create policy "members can create their own referral code"
  on public.referral_codes for insert
  with check (auth.uid() = owner_id);
create policy "admins can read all referral codes"
  on public.referral_codes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can insert referral codes"
  on public.referral_codes for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can update referral codes"
  on public.referral_codes for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can delete referral codes"
  on public.referral_codes for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.check_referral_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_uses integer;
  v_use_count integer;
begin
  select max_uses, use_count into v_max_uses, v_use_count
  from public.referral_codes
  where code = p_code;

  if not found then
    return 'invalid';
  end if;
  if v_max_uses is not null and v_use_count >= v_max_uses then
    return 'used';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.check_referral_code(text) to anon, authenticated;
-- Optional video alongside the required photo (photo always acts as the
-- poster/thumbnail; video, when present, plays on tap). Both
-- member_experiences and activity_feed need the column, and the sync
-- triggers need to carry it through.
alter table public.member_experiences add column if not exists video_url text;
alter table public.activity_feed add column if not exists video_url text;

create or replace function public.fn_activity_from_experience()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    delete from public.activity_feed where source_table = 'member_experiences' and source_id = old.id;
    return old;
  end if;
  if not new.active then
    delete from public.activity_feed where source_table = 'member_experiences' and source_id = new.id;
    return new;
  end if;
  insert into public.activity_feed (kind, title, title_en, caption, caption_en, image_url, video_url, source_table, source_id)
  values ('experience', new.title, new.title_en, new.caption, new.caption_en, new.image_url, new.video_url, 'member_experiences', new.id)
  on conflict (source_table, source_id) do update set
    title = excluded.title, title_en = excluded.title_en, caption = excluded.caption,
    caption_en = excluded.caption_en, image_url = excluded.image_url, video_url = excluded.video_url;
  return new;
end;
$$ language plpgsql security definer set search_path = public;


-- Access requests were being captured correctly but nobody ever found
-- out: no dashboard view, no notification. This mirrors the concierge
-- request notification (same Formspree endpoint) via a DB trigger, since
-- the insert happens directly from the (unauthenticated) client rather
-- than through an edge function.
create or replace function public.notify_access_request()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://formspree.io/f/xgojjlzv',
    body := jsonb_build_object(
      '_subject', 'Nieuwe toegangsaanvraag: ' || new.full_name,
      'name', new.full_name,
      'email', new.email,
      'message', 'Telefoon: ' || coalesce(new.phone, '-') || E'\nUitnodigingscode: ' || coalesce(new.referral_code, '-')
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

drop trigger if exists notify_access_request_trigger on public.access_requests;
create trigger notify_access_request_trigger
  after insert on public.access_requests
  for each row execute function public.notify_access_request();

-- Empty legs: positioning flights offered by our jet partner at a reduced
-- rate. Staff enters our own marked-up price by hand (mirrors the fleet
-- car pricing), the partner's own rate/name is never shown to members.
create table public.empty_legs (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  departure_at timestamptz not null,
  aircraft text not null,
  max_passengers integer,
  price_from numeric not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.empty_legs enable row level security;

create policy "Members can view active empty legs"
  on public.empty_legs for select
  using (auth.role() = 'authenticated' and active = true);

create policy "admins can read all empty legs"
  on public.empty_legs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can insert empty legs"
  on public.empty_legs for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update empty legs"
  on public.empty_legs for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete empty legs"
  on public.empty_legs for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Automated empty-leg sync from our jet partner (see
-- supabase/functions/sync-empty-legs). Synced rows carry a source_ref so
-- re-syncing is an upsert, not duplicate inserts; staff-entered rows via
-- the dashboard leave source/source_ref null and are never touched by it.
alter table public.empty_legs add column if not exists source text;
alter table public.empty_legs add column if not exists source_ref text unique;

-- Empty legs are now also shown publicly on jets.html (content marketing
-- while the app is still ramping up), not just to logged-in members.
drop policy if exists "Members can view active empty legs" on public.empty_legs;
create policy "Public can view active empty legs"
  on public.empty_legs for select
  using (active = true);

-- Schedule the daily sync (run once in the Supabase SQL Editor — pg_cron
-- setup isn't something this migration log re-applies automatically).
-- Replace SYNC_SECRET_VALUE with the value stored in Edge Functions ->
-- Secrets -> SYNC_SECRET before running.
--
-- create extension if not exists pg_cron;
--
-- select cron.schedule(
--   'sync-empty-legs-daily',
--   '0 5 * * *',
--   $$
--   select net.http_post(
--     url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/sync-empty-legs',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
--       'x-sync-secret', 'SYNC_SECRET_VALUE'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Fix: the access-requests admin section in dashboard.html could read
-- but not approve/reject/delete requests -- only SELECT/INSERT policies
-- existed, so RLS silently no-op'd the update/delete (no error surfaced,
-- buttons just appeared to do nothing).
create policy "admins can update access requests"
  on public.access_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete access requests"
  on public.access_requests for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Approving an access request now actually onboards the person: a new
-- edge function (approve-access-request) creates their real login
-- account (or finds their existing one), emails them a branded link to
-- set a password, and only then marks the request approved. Wired into
-- dashboard.html's "Goedkeuren" button. Login currently only works on
-- the website, not the app (not shipped to the App Store yet).
--
-- sync-empty-legs also now deletes any empty_legs row whose departure
-- has already passed, on every scheduled run, so stale flights don't
-- linger in the dashboard's list (manually-added rows included, not
-- just synced ones).

-- Fix: admins could only read their OWN profile row (the "own profile"
-- policy), so any dashboard view joining another member's profile (the
-- Inbox member list, in particular) silently only ever showed the admin
-- themselves. New members with no concierge messages yet also never
-- appeared in Inbox at all, since it only listed distinct senders.
create policy "admins can read all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Fix: "admins can read all profiles" was self-referential (a policy ON
-- profiles that subqueries profiles), which put admins reading their OWN
-- profile at risk of RLS recursion depending on evaluation order. The
-- standard Supabase fix is a SECURITY DEFINER helper function, which
-- bypasses RLS internally instead of re-triggering it.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "admins can read all profiles" on public.profiles;
create policy "admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Account deletion now also removes uploaded concierge-attachment photos
-- from Storage, not just the DB rows (see supabase/functions/delete-account).
-- The rest of a member's data already cascades automatically from the
-- auth.users row (profiles.id -> auth.users is ON DELETE CASCADE, and
-- concierge_messages/requests/invoices/point_transactions/reward_redemptions
-- all cascade from profiles); favorites and referral_codes reference
-- auth.users directly with NO ACTION, so those still need an explicit
-- delete before deleteUser() or it errors.
--
-- Also raised the project's server-side password policy (Auth config,
-- not a SQL migration -- applied via the Management API): min length 8,
-- requiring lowercase + uppercase + digit + special character. Enforced
-- both there and client-side in login.html/reset-password.html, which
-- also gained a show/hide toggle on password fields.

-- Members can now hide their own requests from view (e.g. old cancelled
-- ones) without staff ever losing the record -- the row stays in place
-- with hidden_by_member=true, still fully visible in the admin Beheer
-- view, just filtered out of the member's own app queries.
alter table public.requests add column if not exists hidden_by_member boolean not null default false;

create or replace function public.hide_own_request(request_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.requests set hidden_by_member = true where id = request_id and member_id = auth.uid();
$$;

grant execute on function public.hide_own_request(uuid) to authenticated;

-- Birthday bonus: an edge function (birthday-check) finds members whose
-- birthday is today, awards 250 points via point_transactions (same
-- ledger the welcome bonus uses), and sends a push notification.
-- birthday_bonus_year guards against a double-award if it ever runs
-- twice on the same day.
alter table public.profiles add column if not exists birthday_bonus_year integer;

-- Scheduled daily at 06:00 UTC (pg_cron + pg_net, same pattern as the
-- empty-legs sync).
select cron.schedule(
  'birthday-check-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/birthday-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
      'x-sync-secret', '<SYNC_SECRET value from Edge Functions -> Secrets>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Fix: Beheer's auto-refresh (added earlier tonight) was wiping out
-- in-progress edits and the "Opgeslagen" save confirmation every 15s,
-- since it fully rebuilt the row DOM including live text inputs.
-- Removed Beheer from the auto-refresh loop; a save now patches the
-- in-memory row instead of reloading the whole list.
--
-- Also extended seen_by_member tracking: it only flagged status
-- changes before, so a member never got notified when staff added
-- arrival/venue/dress-code details without changing status. Wired this
-- into the app's notification bell for the first time (previously dead
-- infrastructure, unused by any client) and added a push notification
-- for detail-only updates.
create or replace function public.mark_request_status_changed()
returns trigger as $$
begin
  if new.status is distinct from old.status
     or new.arrival_info is distinct from old.arrival_info
     or new.venue_info is distinct from old.venue_info
     or new.dress_code is distinct from old.dress_code then
    new.updated_at = now();
    new.seen_by_member = false;
  end if;
  return new;
end;
$$ language plpgsql;

-- The app's live-update subscriptions on public.requests (RequestsScreen,
-- and now HomeScreen) were silently no-ops until now: postgres_changes
-- realtime only fires for tables added to the supabase_realtime
-- publication, and requests was never added. Members had to
-- pull-to-refresh or leave/return to a screen to see a staff approval
-- or added detail.
alter publication supabase_realtime add table public.requests;

-- Rewards catalog: "Voorrang bij uw volgende aanvraag" / "Voorrangsstatus,
-- 3 maanden" used to just deduct points and do nothing else -- a member
-- redeemed one for real tonight and staff never even found out. effect
-- now drives real behavior in redeem_reward_for_member() and the
-- log_request tool: a banked priority_credits or an active
-- priority_until window auto-marks the member's next request urgent
-- (same SPOED handling as a stated deadline), and every redemption now
-- notifies staff so nothing needs a human to notice on their own.
alter table public.rewards add column if not exists effect text;
alter table public.profiles add column if not exists priority_credits integer not null default 0;
alter table public.profiles add column if not exists priority_until timestamptz;

update public.rewards set effect = 'priority_single' where title = 'Voorrang bij uw volgende aanvraag';
update public.rewards set effect = 'priority_3mo' where title = 'Voorrangsstatus, 3 maanden';

create or replace function public.redeem_reward_for_member(member_uuid uuid, reward_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_balance integer;
  v_effect text;
begin
  select cost_points, effect into v_cost, v_effect from public.rewards where id = reward_uuid and active = true;
  if v_cost is null then
    raise exception 'Reward not found or inactive';
  end if;

  select points_balance into v_balance from public.profiles where id = member_uuid;
  if v_balance < v_cost then
    raise exception 'Insufficient points';
  end if;

  insert into public.point_transactions (member_id, amount, reason)
  values (member_uuid, -v_cost, 'Beloning ingewisseld via AI Concierge');

  insert into public.reward_redemptions (member_id, reward_id, points_spent)
  values (member_uuid, reward_uuid, v_cost);

  if v_effect = 'priority_single' then
    update public.profiles set priority_credits = priority_credits + 1 where id = member_uuid;
  elsif v_effect = 'priority_3mo' then
    update public.profiles
    set priority_until = greatest(coalesce(priority_until, now()), now()) + interval '3 months'
    where id = member_uuid;
  end if;
end;
$$;

-- Removed: rewards were auto-syncing into activity_feed as "news", but
-- the catalog barely changes, so every active reward just sat there
-- forever as stale "Yesterday" items cluttering the feed with no real
-- news value. Members already browse rewards directly via the Rewards
-- screen; the feed is for genuinely time-sensitive content (experiences,
-- playbook opportunities, manual news).
drop trigger if exists trg_activity_reward on public.rewards;
drop function if exists public.fn_activity_from_reward();
delete from public.activity_feed where source_table = 'rewards';

-- Found while reviewing RewardsScreen.tsx: the APP calls a completely
-- separate RPC (redeem_reward, authenticated-callable) from the one the
-- concierge-chat edge function uses (redeem_reward_for_member,
-- service_role-only). Tonight's priority-effect + staff-notification
-- fix only touched the chat path -- redeeming directly via the app's
-- Rewards screen button was still the old silent no-op. Brought this
-- one up to the same behavior (priority_credits/priority_until effect,
-- Formspree staff notification via pg_net directly since this path has
-- no edge function to call out from).
create or replace function public.redeem_reward(reward_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_cost integer;
  v_balance integer;
  v_effect text;
  v_title text;
  v_member_email text;
begin
  select cost_points, effect, title into v_cost, v_effect, v_title from public.rewards where id = reward_uuid and active = true;
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

  if v_effect = 'priority_single' then
    update public.profiles set priority_credits = priority_credits + 1 where id = auth.uid();
  elsif v_effect = 'priority_3mo' then
    update public.profiles
    set priority_until = greatest(coalesce(priority_until, now()), now()) + interval '3 months'
    where id = auth.uid();
  end if;

  v_member_email := auth.email();
  perform net.http_post(
    url := 'https://formspree.io/f/xgojjlzv',
    body := jsonb_build_object(
      '_subject', 'Beloning ingewisseld: ' || v_title,
      'name', coalesce(v_member_email, 'Lid'),
      'email', coalesce(v_member_email, ''),
      'message', coalesce(v_member_email, 'Een lid') || ' heeft "' || v_title || '" ingewisseld voor ' || v_cost || ' punten via de app.' ||
        case when v_effect in ('priority_single','priority_3mo') then ' Wordt automatisch toegepast op de eerstvolgende aanvraag van dit lid.' else ' Vereist actie van het team.' end
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
end;
$$;

-- Admins had UPDATE/SELECT on requests but no DELETE policy at all, so the
-- Beheer dashboard had no way to actually remove a test/junk request --
-- only cancel (status change) or member-side hide, both of which leave the
-- row in place. Added a straightforward is_admin()-gated DELETE policy.
create policy "admins can delete requests" on public.requests for delete using (public.is_admin());

-- Home screen's activity_feed query never filtered on `active`, relying only
-- on the fn_activity_from_experience trigger's own delete-on-inactive
-- behavior. That trigger is fine, but three leftover test rows in
-- member_experiences (two malformed titles, one duplicate) had already
-- upserted three near-identical "Personal shopping, Amsterdam" cards into
-- the shared, all-members activity feed. Cleaned up the source rows and
-- their activity_feed upserts; the app query now also filters active=true
-- defensively.

-- notify_access_request only emailed staff via Formspree on a new access
-- request; staff had no way to know one came in without checking email.
-- Extended it to also push-notify every admin device (looping profiles
-- where is_admin and push_token is set), reusing the existing send-push
-- edge function. send-push has verify_jwt=true, so the call carries the
-- publishable key as both apikey and Authorization headers rather than
-- flipping verify_jwt off (that classifier-sensitive path was avoided
-- deliberately -- the publishable key is already public client-side).

-- Instagram gallery: recent posts from @solace.executive, synced in by
-- supabase/functions/sync-instagram so the homepage updates itself
-- whenever a new photo goes up, same pattern as empty_legs.
create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  media_id text not null unique,
  media_type text not null,
  media_url text not null,
  permalink text not null,
  caption text,
  posted_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.instagram_posts enable row level security;

create policy "Public can view active instagram posts"
  on public.instagram_posts for select
  using (active = true);

-- Instagram profile + stories: the account's own avatar and any
-- currently-live stories (Instagram's 24h window), so the homepage can
-- show the same gradient "story ring" around the avatar that Instagram
-- itself shows, and let visitors view the stories in a lightbox.
create table public.instagram_profile (
  id text primary key default 'main',
  username text,
  profile_picture_url text,
  has_active_story boolean not null default false,
  updated_at timestamptz default now()
);

alter table public.instagram_profile enable row level security;

create policy "Public can view instagram profile"
  on public.instagram_profile for select
  using (true);

create table public.instagram_stories (
  id uuid primary key default gen_random_uuid(),
  media_id text not null unique,
  media_type text not null,
  media_url text not null,
  permalink text not null,
  posted_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.instagram_stories enable row level security;

create policy "Public can view instagram stories"
  on public.instagram_stories for select
  using (true);

-- Yacht charter listings from our Ibiza broker. Staff enters these by
-- hand (via SQL insert for now, one per PDF spec sheet the broker
-- sends) rather than a sync job, since these come in as one-off PDFs,
-- not a feed. price_from is our own marked-up rate (broker agreed a
-- flat 10%, same roundPrice() pattern as JetServiceNL empty legs) --
-- the broker's own raw rate/name is never stored or shown.
create table public.yachts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null,
  length_m numeric,
  guests_day integer,
  guests_night integer,
  cabins text,
  bathrooms integer,
  base_harbour text,
  price_from numeric,
  photo_path text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.yachts enable row level security;

create policy "Public can view active yachts"
  on public.yachts for select
  using (active = true);

-- Ibiza villa rentals from our villa-management partner. Same pattern as
-- yachts above: entered by hand from the partner's own PDF spec sheets,
-- price_from is our own marked-up rate (10%, same as yachts) and the
-- partner's own rate/name is never stored or shown. Unlike the PDFs the
-- partner also sends for yachts, these villa PDFs never state a price at
-- all (rates are quoted separately, per season) -- price_from stays null
-- until Kluiver has an actual rate to enter for a given villa.
-- area/description/amenities are Dutch; the _en columns are the English
-- versions shown when the site or app is switched to English (villa name
-- is a proper noun and is not translated).
create table public.villas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  area_en text,
  bedrooms integer,
  bathrooms integer,
  max_guests integer,
  has_pool boolean not null default true,
  living_area_m2 integer,
  plot_area_m2 integer,
  description text,
  description_en text,
  amenities text[] not null default '{}',
  amenities_en text[] not null default '{}',
  price_from numeric,
  photo_path text not null,
  photos text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.villas enable row level security;

create policy "Public can view active villas"
  on public.villas for select
  using (active = true);

-- Schedule the sync (run once in the Supabase SQL Editor). Replace
-- SYNC_SECRET_VALUE with the value stored in Edge Functions -> Secrets ->
-- SYNC_SECRET (same one sync-empty-legs uses) before running. Runs every
-- 30 minutes rather than daily like the other syncs, since stories are
-- only live for 24h and stale ones are much more noticeable than a
-- slightly-stale post grid would be.
--
-- select cron.schedule(
--   'sync-instagram-daily',
--   '*/30 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/sync-instagram',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
--       'x-sync-secret', 'SYNC_SECRET_VALUE'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Fix: some profiles.is_admin rows were NULL rather than false (the
-- column has never had a default), which made every ".eq('is_admin',
-- false)" member-listing query (Team Chats in the app, Inbox on the
-- website dashboard) silently skip those members entirely -- they just
-- never appeared in the list, no error anywhere. Both queries were
-- switched to ".not('is_admin', 'is', true)" (is_admin=false OR null
-- both count as "not an admin"), and this backfills the column itself
-- so new rows can't drift back into the same trap.
update public.profiles set is_admin = false where is_admin is null;
alter table public.profiles alter column is_admin set default false;
alter table public.profiles alter column is_admin set not null;

-- Fix: member_experiences.image_url was NOT NULL, but a video-only
-- moment (no photo) is a real use case -- an experience just needs a
-- photo, a video, or both, never neither.
alter table public.member_experiences alter column image_url drop not null;
alter table public.member_experiences add constraint member_experiences_has_media
  check (image_url is not null or video_url is not null);

-- Fix: a new access request only ever emailed staff via Formspree --
-- checked and confirmed the push-notify half described in an earlier
-- comment here was never actually applied to this function, staff had
-- no way to notice a new request without opening email. Loops every
-- admin's push_token (same send-push edge function the concierge inbox
-- reply flow already uses) so it shows up as a phone notification too.
create or replace function public.notify_access_request()
returns trigger as $$
declare
  admin_row record;
begin
  perform net.http_post(
    url := 'https://formspree.io/f/xgojjlzv',
    body := jsonb_build_object(
      '_subject', 'Nieuwe toegangsaanvraag: ' || new.full_name,
      'name', new.full_name,
      'email', new.email,
      'message', 'Telefoon: ' || coalesce(new.phone, '-') || E'\nUitnodigingscode: ' || coalesce(new.referral_code, '-')
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  for admin_row in select push_token from public.profiles where is_admin and push_token is not null loop
    perform net.http_post(
      url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
        'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr'
      ),
      body := jsonb_build_object(
        'push_token', admin_row.push_token,
        'title', 'Nieuwe toegangsaanvraag',
        'body', new.full_name || ' vraagt toegang aan',
        'data', jsonb_build_object('type', 'access_request')
      )
    );
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

-- Members had no way to know when staff added a new experience -- mirrors
-- notify_access_request's push-fan-out above, but to every member (not
-- admin) with a push_token, since this is member-facing content. Only
-- fires on a genuinely new experience (insert), not on edits or on
-- toggling one back on after being deactivated.
create or replace function public.notify_new_experience()
returns trigger as $$
declare
  member_row record;
begin
  for member_row in select push_token from public.profiles where not coalesce(is_admin, false) and push_token is not null loop
    perform net.http_post(
      url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
        'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr'
      ),
      body := jsonb_build_object(
        'push_token', member_row.push_token,
        'title', 'Nieuwe experience',
        'body', new.title,
        'data', jsonb_build_object('type', 'new_experience', 'id', new.id)
      )
    );
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

drop trigger if exists notify_new_experience_trigger on public.member_experiences;
create trigger notify_new_experience_trigger
  after insert on public.member_experiences
  for each row execute function public.notify_new_experience();

-- A member can self-cancel their own open request from the app (see the
-- "Members can cancel their own open requests" policy above), but staff
-- had zero visibility into it happening -- no email, no push, nothing --
-- unless someone happened to reopen the dashboard/app and notice the
-- status had changed. Scoped to auth.uid() = new.member_id specifically so
-- this only fires for a genuine member self-cancellation, not when staff
-- themselves sets a request to cancelled (which would just notify staff
-- about their own action).
create or replace function public.notify_member_cancelled()
returns trigger as $$
declare
  admin_row record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and auth.uid() = new.member_id then
    for admin_row in select push_token from public.profiles where is_admin and push_token is not null loop
      perform net.http_post(
        url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
          'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr'
        ),
        body := jsonb_build_object(
          'push_token', admin_row.push_token,
          'title', 'Aanvraag geannuleerd door lid',
          'body', new.service,
          'data', jsonb_build_object('type', 'booking', 'requestId', new.id)
        )
      );
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

drop trigger if exists notify_member_cancelled_trigger on public.requests;
create trigger notify_member_cancelled_trigger
  after update on public.requests
  for each row execute function public.notify_member_cancelled();

-- The only way a prospect learned their access request was approved was
-- an email (generateLink's invite/recovery link) -- easy to miss in spam,
-- and multiple steps to get from inbox to a working account. If they
-- already had the app installed when they applied (e.g. followed a
-- referral link) and notification permission was already granted, the
-- app can now attach a push_token to its own access_requests row at
-- submit time (covered by the existing public insert policy, no RLS
-- change needed -- it's a column on a row they're already allowed to
-- insert). approve-access-request then push-notifies them immediately
-- with the real actionLink, so tapping it jumps straight to setting a
-- password instead of waiting on email. Email is kept as the fallback
-- for everyone else (the common case: they don't have the app yet).
alter table public.access_requests add column if not exists push_token text;

-- Log of proactive "we thought of you" pushes sent by daily-nudges, so it
-- can enforce a cooldown per member and members can see their own history.
create table if not exists public.member_nudges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  nudge_type text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table public.member_nudges enable row level security;

create policy "members can view their own nudges"
  on public.member_nudges for select
  using (auth.uid() = member_id);

-- Runs daily at 09:00 Amsterdam time. Fixed a real bug while wiring this
-- up: birthday-check-daily's cron job was still using an old SYNC_SECRET
-- value from before the secret was rotated on 2026-09-23, so it had been
-- silently failing with 401 every single night since then (the birthday
-- bonus still worked if triggered manually with the current secret, just
-- never on its own schedule). All four sync-secret-gated cron jobs
-- (birthday-check, sync-empty-legs, sync-instagram, daily-nudges) were
-- rescheduled together with the current secret so they can't drift apart
-- like that again silently.
--
-- select cron.schedule(
--   'daily-nudges-daily',
--   '0 9 * * *',
--   $$
--   select net.http_post(
--     url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/daily-nudges',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
--       'x-sync-secret', 'SYNC_SECRET_VALUE'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Profile avatar upload. Uses expo-image-picker, already declared and
-- already in a compiled build for the concierge photo-attachment feature
-- (NSPhotoLibraryUsageDescription/NSCameraUsageDescription in app.json),
-- so this needed no new native permission or build -- ships as a plain JS
-- change. Fixed filename per member (not a timestamped one like concierge
-- attachments) so re-uploading just overwrites instead of piling up old
-- avatars in storage. Public read like the other photo buckets; write is
-- restricted to the member's own folder, same pattern as
-- concierge-attachments.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Members can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- There is no membership fee yet (confirmed: Kluiver treats every current
-- and future app user as an active member during this pre-revenue phase),
-- so is_member_active -- only ever set by stripe-webhook on a real Stripe
-- subscription event -- was stuck false for every single profile,
-- including Kluiver's own admin account. This silently broke: the
-- dashboard.html chat unlock/reward-teaser gating (always showed "locked"
-- to everyone), and would have broken any future is_member_active-gated
-- push broadcast (daily-nudges/broadcast-announcement were already fixed
-- to not depend on it). Backfilling true and flipping the column default
-- means every member just works without a payment step, while leaving
-- stripe-webhook itself in place (harmless, unused) in case a paid tier
-- gets introduced later.
update public.profiles set is_member_active = true where is_member_active = false;
alter table public.profiles alter column is_member_active set default true;

-- Push notifications alone aren't a reliable enough channel for an
-- announcement/nudge to actually reach someone: they might not have
-- granted notification permission, might be on an older TestFlight build
-- that predates this feature entirely, or might just miss the banner.
-- Giving member_nudges its own seen flag (same shape as requests.seen_by_member)
-- lets the Home screen's notification bell also surface unread nudges as a
-- durable, catch-up-able inbox -- whenever the member next opens an app
-- version that has this code, not only in the instant the push arrived.
alter table public.member_nudges add column if not exists seen boolean not null default false;

create policy "members can mark their own nudges seen"
  on public.member_nudges for update
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- Lets an applicant grant notification permission AFTER already submitting
-- their access request (on the "Request sent" screen, since that's a much
-- clearer moment to ask than mid-form) and still have the resulting push
-- token attached to their row. access_requests has no anon UPDATE policy
-- at all (by design -- see the SELECT lockdown comment above), so this is a
-- narrow security definer function rather than opening one up: it can only
-- ever touch push_token, and only on a still-pending row, never anything
-- already approved/rejected.
create or replace function public.set_access_request_push_token(p_request_id uuid, p_push_token text)
returns void as $$
begin
  update public.access_requests
  set push_token = p_push_token
  where id = p_request_id and status = 'pending';
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.set_access_request_push_token(uuid, text) from public;
grant execute on function public.set_access_request_push_token(uuid, text) to anon, authenticated;

-- Staff wants a live "who's online now" green dot in the concierge member
-- list. First attempt used Supabase Realtime Presence (a shared channel
-- both the member's own tracking and staff's observing hook joined), but
-- two hooks on one client subscribing to/binding the same channel topic
-- broke the whole Chats screen in production with no error detail
-- available to debug from. A plain heartbeat column sidesteps that entire
-- class of problem: the member's own app just updates this timestamp
-- periodically while foregrounded (see useHeartbeat, app-side), and staff
-- treats anyone updated within the last couple of minutes as online. Less
-- instant than true presence, plenty fast enough for this purpose, and
-- just an ordinary column write/read with no realtime channel involved.
alter table public.profiles add column if not exists last_active_at timestamptz;

-- Prevents duplicate access requests / accounts for the same email, and a
-- permanent blacklist for members who abused the platform. Deleting the
-- account (or the member deleting their own) naturally clears the
-- "already a member" check since it just queries auth.users live, so a
-- fresh request with that email works again -- exactly the behavior
-- Kluiver asked for. A ban, by contrast, is keyed on the email itself in
-- its own table, so it survives account deletion (that's the whole point
-- of a ban) and must be explicitly lifted.
create table public.banned_emails (
  email text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid references public.profiles(id)
);

alter table public.banned_emails enable row level security;

create policy "admins can view banned emails"
  on public.banned_emails for select
  using (public.is_admin());

create policy "admins can ban emails"
  on public.banned_emails for insert
  with check (public.is_admin());

create policy "admins can unban emails"
  on public.banned_emails for delete
  using (public.is_admin());

-- Called from RequestAccessScreen before submitting, so the applicant
-- gets an immediate, specific answer instead of a generic "something went
-- wrong" or (worse) a silent duplicate. security definer since anon has
-- no read access to auth.users, access_requests, or banned_emails at all.
create or replace function public.check_email_status(p_email text)
returns text as $$
declare
  v_email text := lower(trim(p_email));
begin
  if exists (select 1 from public.banned_emails where email = v_email) then
    return 'banned';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    return 'already_member';
  end if;
  if exists (select 1 from public.access_requests where lower(email) = v_email and status = 'pending') then
    return 'pending_request';
  end if;
  return 'available';
end;
$$ language plpgsql security definer set search_path = public, auth;

revoke all on function public.check_email_status(text) from public;
grant execute on function public.check_email_status(text) to anon, authenticated;

-- Called right after a successful sign-in (LoginScreen): a ban is on the
-- email, not the account, so it has to be checked with whatever identity
-- the now-authenticated session actually has -- auth.uid() here, not a
-- client-supplied email, so a banned member can't just claim they're
-- someone else's email to skip the check.
create or replace function public.is_current_user_banned()
returns boolean as $$
begin
  return exists (
    select 1 from public.banned_emails b
    join auth.users u on lower(u.email) = b.email
    where u.id = auth.uid()
  );
end;
$$ language plpgsql security definer set search_path = public, auth;

revoke all on function public.is_current_user_banned() from public;
grant execute on function public.is_current_user_banned() to authenticated;

-- AI-driven conduct moderation for the concierge: the AI already sees
-- every photo and message a member sends (multimodal), so rather than a
-- separate moderation pass, concierge-chat gained a flag_member_conduct
-- tool it's instructed to call instead of a normal reply for sexually
-- explicit photos, illegal requests, or harassment. A first warning-level
-- flag just gets the member a firm in-chat warning; staff is paged
-- (push) immediately for anything severe, or once a pattern shows up
-- (this member has been flagged before) -- deliberately not an automatic
-- ban, since a wrongly-flagged real member getting permanently locked
-- out over a misclassified image is a worse outcome than staff spending
-- a moment reviewing it. Banning, when staff does decide to, reuses the
-- banned_emails mechanism already built for access requests.
create table public.member_flags (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  severity text not null check (severity in ('warning', 'severe')),
  created_at timestamptz not null default now()
);

alter table public.member_flags enable row level security;

create policy "admins can view member flags"
  on public.member_flags for select
  using (public.is_admin());

-- Staff wants to be able to freeze a member's account (soft, reversible --
-- e.g. "we need to check something") or delete it outright (hard,
-- permanent), directly from the Access requests screen, with every such
-- action logged the way a card issuer would log an account action. Freeze
-- is a plain column flip rather than a ban: it's not tied to the email
-- (banned_emails already covers "never again"), it's reversible, and the
-- member is shown the reason rather than a generic lockout message.
alter table public.profiles add column if not exists is_frozen boolean not null default false;
alter table public.profiles add column if not exists freeze_reason text;

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_member_id uuid references public.profiles(id) on delete set null,
  target_email text,
  action text not null check (action in ('freeze', 'unfreeze', 'delete_account')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

create policy "admins can view admin actions"
  on public.admin_actions for select
  using (public.is_admin());

-- Lets the Access requests screen show each approved member's current
-- frozen state without giving the client any broader read access to
-- auth.users -- admin-gated (raises, doesn't just return empty, so a
-- non-admin caller can't quietly probe it) and batched over every email on
-- screen in one round trip instead of one call per row.
create or replace function public.admin_get_members_status(p_emails text[])
returns table(email text, member_id uuid, is_frozen boolean, freeze_reason text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  return query
    select lower(u.email), p.id, p.is_frozen, p.freeze_reason
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = any(select lower(e) from unnest(p_emails) as e);
end;
$$;

revoke all on function public.admin_get_members_status(text[]) from public;
grant execute on function public.admin_get_members_status(text[]) to authenticated;

-- Freeze/unfreeze a member's account by email (matches what the Access
-- requests screen has on hand). A plain RPC is enough here -- unlike full
-- deletion, this never touches auth.users, so it doesn't need the service
-- role / an edge function. Every call is logged to admin_actions.
create or replace function public.admin_set_member_frozen(p_email text, p_frozen boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select id into v_member_id from auth.users where lower(email) = lower(trim(p_email));
  if v_member_id is null then
    raise exception 'No member account found for this email';
  end if;

  update public.profiles
  set is_frozen = p_frozen,
      freeze_reason = case when p_frozen then p_reason else null end
  where id = v_member_id;

  insert into public.admin_actions (admin_id, target_member_id, target_email, action, reason)
  values (auth.uid(), v_member_id, lower(trim(p_email)), case when p_frozen then 'freeze' else 'unfreeze' end, p_reason);
end;
$$;

revoke all on function public.admin_set_member_frozen(text, boolean, text) from public;
grant execute on function public.admin_set_member_frozen(text, boolean, text) to authenticated;

-- Called right after sign-in (LoginScreen), same pattern as
-- is_current_user_banned -- checked against the now-authenticated
-- session's own auth.uid(), not a client-supplied email. Returns the
-- reason as its own column (rather than a single coalesced string) so the
-- app can fall back to its own translated default message when staff
-- didn't type one.
create or replace function public.is_current_user_frozen()
returns table(frozen boolean, reason text)
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(p.is_frozen, false), p.freeze_reason
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.is_current_user_frozen() from public;
grant execute on function public.is_current_user_frozen() to authenticated;

-- Freeze/delete moved off the Access requests screen onto its own Members
-- screen (that screen is about intake, this is about managing accounts
-- that already exist) -- this lists every real member directly by id
-- instead of the email-batch lookup access_requests needed.
create or replace function public.admin_list_members()
returns table(id uuid, full_name text, email text, is_admin boolean, is_frozen boolean, freeze_reason text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  return query
    select p.id, p.full_name, lower(u.email), coalesce(p.is_admin, false), p.is_frozen, p.freeze_reason, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc nulls last;
end;
$$;

revoke all on function public.admin_list_members() from public;
grant execute on function public.admin_list_members() to authenticated;

-- Lets the Live Activity / widget pick a themed icon (plane for a jet, boat
-- for a yacht, etc.) instead of one generic icon for every request. Set by
-- the AI itself in log_request/flag_change_request, since it already
-- understands the full conversation -- far more reliable than the app
-- guessing a category from the free-text `service` summary afterwards.
alter table public.requests add column if not exists category text not null default 'other'
  check (category in ('jet', 'yacht', 'watch', 'restaurant', 'hotel', 'car', 'event', 'other'));
