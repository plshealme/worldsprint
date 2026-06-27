create table if not exists public.words (
  id bigint generated always as identity primary key,
  source_id integer not null unique,
  word text not null,
  word_raw text,
  section text not null,
  unit integer,
  subsection text,
  source_order integer not null,
  flags text,
  phonetic text,
  part_of_speech text,
  meaning text,
  is_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_section_check check (section in ('必考词', '基础词', '超纲词'))
);

create index if not exists words_section_idx on public.words (section);
create index if not exists words_unit_idx on public.words (unit);
create index if not exists words_section_unit_idx on public.words (section, unit);
create index if not exists words_source_order_idx on public.words (source_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_words_updated_at on public.words;

create trigger set_words_updated_at
before update on public.words
for each row
execute function public.set_updated_at();

alter table public.words enable row level security;

drop policy if exists "Authenticated users can read words" on public.words;

create policy "Authenticated users can read words"
on public.words
for select
to authenticated
using (true);

grant select on public.words to authenticated;
revoke insert, update, delete on public.words from anon, authenticated;
