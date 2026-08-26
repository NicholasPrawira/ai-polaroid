-- Waitlist for the pre-launch landing page CTA.
--
-- Applied to the live project via the Supabase MCP as migration
-- `add_waitlist`; kept here as the record of what was run.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  -- citext isn't enabled on this project, so the address is normalised to
  -- lower case in the server action and the unique index enforces it here.
  email text not null,
  -- Which entry point the visitor came from (`?from=` on /waitlist).
  source text,
  created_at timestamptz not null default now(),

  constraint waitlist_email_format check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint waitlist_email_length check (char_length(email) <= 254),
  constraint waitlist_source_length check (source is null or char_length(source) <= 64)
);

-- Both the dedupe guarantee and the lookup index for "is this address on the
-- list?". The server action relies on the 23505 this raises.
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Anonymous visitors may add themselves and nothing else. There is
-- deliberately no select policy: with RLS on and no policy granting reads,
-- the anon key cannot enumerate the list, so the table is write-only from
-- the browser. Read it from the Supabase dashboard or a service-role key.
drop policy if exists waitlist_anon_insert on public.waitlist;
create policy waitlist_anon_insert
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);
