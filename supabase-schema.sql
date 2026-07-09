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
