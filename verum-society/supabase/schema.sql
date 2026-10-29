-- Verum Society: plak dit in de Supabase SQL editor.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'onboarding' check (status in ('onboarding','pending','active','suspended')),
  questionnaire jsonb,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('feest','diner','trip','proeverij','activiteit')),
  starts_at timestamptz not null,
  location text not null default '',
  capacity int,
  price_eur numeric,
  created_at timestamptz not null default now()
);

create table public.rsvps (
  event_id uuid references public.events on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  status text not null check (status in ('going','maybe','declined')),
  primary key (event_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  user_id uuid not null references public.profiles on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages (room, created_at);

-- profiel automatisch aanmaken bij registratie
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- helpers (security definer, zodat RLS niet recursief wordt)
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.messages enable row level security;

-- profiles: eigen profiel, actieve leden zien elkaar, admin ziet alles
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_admin() or public.is_active());
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles update admin" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- een lid mag zichzelf nooit activeren of admin maken
create function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    -- alleen onboarding -> pending is toegestaan voor leden
    if new.status is distinct from old.status and not (old.status = 'onboarding' and new.status = 'pending') then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- events: alleen actieve leden lezen, admin beheert
create policy "events read" on public.events for select using (public.is_active() or public.is_admin());
create policy "events admin" on public.events for all using (public.is_admin()) with check (public.is_admin());

-- rsvps
create policy "rsvps read" on public.rsvps for select using (public.is_active() or public.is_admin());
create policy "rsvps write own" on public.rsvps for all
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());

-- chat
create policy "messages read" on public.messages for select using (public.is_active() or public.is_admin());
create policy "messages insert" on public.messages for insert
  with check (user_id = auth.uid() and public.is_active());

alter publication supabase_realtime add table public.messages;

-- Eerste admin: registreer in de app en voer dan uit:
-- update public.profiles set role='admin', status='active' where email='jouw@email.nl';
