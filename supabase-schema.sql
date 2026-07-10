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
