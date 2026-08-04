-- Data layer for AI Disposable Camera: owned photos, folders, and photo credits.
--
-- Two rules shape everything below.
--
-- 1. A photo belongs to exactly one account and is unreadable by anyone else.
--    We store strangers' faces — wedding guests who never signed up for this —
--    so RLS is load-bearing, not decoration.
--
-- 2. `profiles.credits` is never writable by the client. There is deliberately
--    no UPDATE policy on `profiles`; the balance only moves through the
--    SECURITY DEFINER functions at the bottom of this file. Without that, any
--    signed-in user could PATCH themselves an unlimited roll of film.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  -- One credit is one developed photo. Each develop costs real money at the
  -- image API, so the balance is what stops a shared link running up a bill.
  credits integer not null default 10 check (credits >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ------------------------------------------------------------------- folders

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create index folders_owner_idx on public.folders (owner_id, created_at desc);

alter table public.folders enable row level security;

-- -------------------------------------------------------------------- photos

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Deleting a folder must not delete the photographs inside it.
  folder_id uuid references public.folders (id) on delete set null,

  -- The untouched capture. Kept deliberately: if a develop fails, the prompt
  -- changes, or the model is swapped, the original moment still exists. Without
  -- this, one bad prompt permanently destroys somebody's memory.
  raw_path text,
  developed_path text,

  status text not null default 'queued'
    check (status in ('queued', 'developing', 'done', 'failed')),
  error text,

  -- When the shutter fired, which is not when the row was written. A photo can
  -- be taken offline on Tuesday and land here on Thursday; the roll must read
  -- in the order things happened.
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index photos_owner_idx on public.photos (owner_id, taken_at desc);
create index photos_folder_idx on public.photos (folder_id) where folder_id is not null;

alter table public.photos enable row level security;

-- --------------------------------------------------------------- promo codes

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- Stored upper-case so redeeming is effectively case-insensitive.
  code text not null unique check (code = upper(code) and char_length(code) between 4 and 32),
  credits integer not null check (credits > 0),

  -- null means unlimited claims.
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0,

  expires_at timestamptz,
  active boolean not null default true,

  -- Set for a voucher meant for one person; null for an open promo code. This
  -- is the difference between "here is a code for the newsletter" and "here is
  -- a voucher for you specifically".
  target_email text,
  note text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- One claim per person per code, enforced by the database rather than by
-- checking first and inserting after, which races.
-- user_id points at `profiles` rather than `auth.users` so the dashboard can ask
-- for a redemption and its claimant's email in one query. Deleting the account
-- still cascades, because profiles.id is itself a cascading reference.
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  credits integer not null,
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_id)
);

alter table public.redemptions enable row level security;

-- Append-only ledger. `profiles.credits` is the running balance; this is the
-- explanation for it, and the only way to answer "where did these go?".
create table public.credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null
    check (reason in ('signup', 'redeem', 'admin_grant', 'develop', 'refund')),
  code_id uuid references public.promo_codes (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_events_user_idx on public.credit_events (user_id, created_at desc);

alter table public.credit_events enable row level security;

-- ----------------------------------------------------------------- functions

-- SECURITY DEFINER so it reads `profiles` without tripping the RLS policy that
-- is itself defined in terms of this function. A plain query here would recurse.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.credit_events (user_id, delta, reason)
  values (new.id, 10, 'signup');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Spends one credit. Returns the balance left.
--
-- The `credits > 0` predicate lives in the UPDATE itself, so two develops fired
-- at once cannot both pass a check-then-write and drive the balance negative.
create function public.consume_credit()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  remaining integer;
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  update public.profiles
     set credits = credits - 1
   where id = uid and credits > 0
   returning credits into remaining;

  if remaining is null then
    raise exception 'You are out of photo credits.' using errcode = 'P0001';
  end if;

  insert into public.credit_events (user_id, delta, reason)
  values (uid, -1, 'develop');

  return remaining;
end;
$$;

-- Gives the credit back when a develop fails. A shot that never produced a
-- photograph must not cost the user anything.
create function public.refund_credit()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  remaining integer;
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  update public.profiles
     set credits = credits + 1
   where id = uid
   returning credits into remaining;

  insert into public.credit_events (user_id, delta, reason)
  values (uid, 1, 'refund');

  return remaining;
end;
$$;

-- Claims a promo code or a targeted voucher.
--
-- SECURITY DEFINER because users must be able to redeem a code without being
-- able to read the `promo_codes` table — otherwise anyone could list every
-- unclaimed code in the system.
create function public.redeem_promo_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_email text;
  c public.promo_codes%rowtype;
  remaining integer;
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select p.email into v_email from public.profiles p where p.id = uid;

  -- Locked so a code with one claim left cannot be taken twice concurrently.
  select * into c
    from public.promo_codes
   where code = upper(btrim(p_code))
     for update;

  if c.id is null then
    raise exception 'That code does not exist.' using errcode = 'P0001';
  end if;

  if not c.active then
    raise exception 'That code is no longer active.' using errcode = 'P0001';
  end if;

  if c.expires_at is not null and c.expires_at < now() then
    raise exception 'That code has expired.' using errcode = 'P0001';
  end if;

  if c.max_redemptions is not null and c.redeemed_count >= c.max_redemptions then
    raise exception 'That code has been fully claimed.' using errcode = 'P0001';
  end if;

  if c.target_email is not null
     and lower(c.target_email) is distinct from lower(coalesce(v_email, '')) then
    raise exception 'That voucher belongs to a different account.' using errcode = 'P0001';
  end if;

  insert into public.redemptions (code_id, user_id, credits)
  values (c.id, uid, c.credits);

  update public.promo_codes
     set redeemed_count = redeemed_count + 1
   where id = c.id;

  update public.profiles
     set credits = credits + c.credits
   where id = uid
   returning credits into remaining;

  insert into public.credit_events (user_id, delta, reason, code_id)
  values (uid, c.credits, 'redeem', c.id);

  return json_build_object('added', c.credits, 'credits', remaining);
exception
  when unique_violation then
    raise exception 'You have already used that code.' using errcode = 'P0001';
end;
$$;

-- Hands credits straight to somebody, no code involved. This is the "give this
-- person a voucher" path in the dashboard.
create function public.admin_grant_credits(
  p_user_id uuid,
  p_credits integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  if p_credits is null or p_credits = 0 then
    raise exception 'Credits must be a non-zero number.' using errcode = 'P0001';
  end if;

  -- greatest() so revoking more than somebody holds lands on zero rather than
  -- tripping the non-negative constraint.
  update public.profiles
     set credits = greatest(0, credits + p_credits)
   where id = p_user_id
   returning credits into remaining;

  if remaining is null then
    raise exception 'No such user.' using errcode = 'P0001';
  end if;

  insert into public.credit_events (user_id, delta, reason)
  values (p_user_id, p_credits, 'admin_grant');

  return remaining;
end;
$$;

-- These run as their definer, so they must not be callable by anonymous visitors.
revoke execute on function public.consume_credit() from public, anon;
revoke execute on function public.refund_credit() from public, anon;
revoke execute on function public.redeem_promo_code(text) from public, anon;
revoke execute on function public.admin_grant_credits(uuid, integer) from public, anon;

grant execute on function public.consume_credit() to authenticated;
grant execute on function public.refund_credit() to authenticated;
grant execute on function public.redeem_promo_code(text) to authenticated;
grant execute on function public.admin_grant_credits(uuid, integer) to authenticated;

-- ------------------------------------------------------------------ policies

-- Note the absence of insert/update/delete on profiles: see the header.
create policy "read own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "admins read every profile"
  on public.profiles for select
  using (public.is_admin());

create policy "own folders"
  on public.folders for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "own photos"
  on public.photos for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Codes are admin-only on purpose. Redeeming goes through redeem_promo_code().
create policy "admins manage promo codes"
  on public.promo_codes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "read own redemptions"
  on public.redemptions for select
  using ((select auth.uid()) = user_id);

create policy "admins read every redemption"
  on public.redemptions for select
  using (public.is_admin());

create policy "read own credit events"
  on public.credit_events for select
  using ((select auth.uid()) = user_id);

create policy "admins read every credit event"
  on public.credit_events for select
  using (public.is_admin());

-- ------------------------------------------------------------------- storage

-- Private. Photos are read back through short-lived signed URLs, never by
-- guessing a public path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Objects live at {user_id}/{photo_id}/{raw|developed}.{ext}, so the first path
-- segment is the ownership check.
create policy "own photo objects"
  on storage.objects for all
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ----------------------------------------------------------------- backfill

-- Accounts that existed before this migration never fired the trigger.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;
