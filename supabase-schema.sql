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

drop policy if exists "Anyone can view concierge attachments" on storage.objects;
create policy "Anyone can view concierge attachments"
  on storage.objects for select
  using (bucket_id = 'concierge-attachments');

drop policy if exists "Authenticated users can upload concierge attachments" on storage.objects;
create policy "Authenticated users can upload concierge attachments"
  on storage.objects for insert
  with check (bucket_id = 'concierge-attachments' and auth.role() = 'authenticated');

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
