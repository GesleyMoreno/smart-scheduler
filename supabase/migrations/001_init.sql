-- Profiles: one row per auth user, with a role
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('admin', 'customer'))
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  customer_name text not null,
  customer_email text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  google_event_id text,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- overlapping confirmed bookings are rejected by the database itself
  exclude using gist (tstzrange(starts_at, ends_at) with &&) where (status = 'confirmed')
);
alter table public.appointments enable row level security;
create policy "admins read appointments" on public.appointments for select using (public.is_admin());
-- Writes happen only in Edge Functions (service role)

-- Public read of busy times only (no names or emails)
create or replace function public.booked_slots(from_ts timestamptz, to_ts timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql security definer set search_path = public as $$
  select a.starts_at, a.ends_at from public.appointments a
  where a.status = 'confirmed' and a.starts_at >= from_ts and a.starts_at < to_ts;
$$;
grant execute on function public.booked_slots(timestamptz, timestamptz) to anon, authenticated;
