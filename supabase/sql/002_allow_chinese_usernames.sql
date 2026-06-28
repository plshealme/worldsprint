-- Run this in Supabase SQL Editor if the original ASCII-only username
-- constraint has already been applied to public.profiles.
--
-- The app and API enforce:
--   /^[\p{L}\p{N}_]{2,20}$/u
-- PostgreSQL regex Unicode category support is not portable across all
-- environments, so the database constraint is intentionally limited to the
-- durable invariants that must not conflict with Chinese usernames.

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (
    char_length(username) between 2 and 20
    and username = btrim(username)
    and username !~ '\s'
  );
