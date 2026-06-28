create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  email text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format_check check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_username_normalized_check check (username_normalized = lower(username)),
  constraint profiles_role_check check (role in ('user', 'admin'))
);

alter table public.profiles add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end;
$$;

create index if not exists profiles_email_idx on public.profiles (email);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.username_normalized = lower(new.username);
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before insert or update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = 'user');

grant select, update on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- 手动设置管理员，只能由站长在 Supabase SQL Editor 执行。
-- 不要做成公开 API，也不要让客户端调用。
--
-- update public.profiles
-- set role = 'admin'
-- where email = '3172456681@qq.com';
