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
