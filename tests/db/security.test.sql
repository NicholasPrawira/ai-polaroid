-- What this proves: that the rules in 0001 hold when a real signed-in user
-- attacks them, not just that the SQL parses.
--
-- Every block impersonates somebody the way PostgREST does — `set local role
-- authenticated` plus the JWT claims — so `auth.uid()` resolves exactly as it
-- will in production. A failed assertion aborts the run.

\set ON_ERROR_STOP on
\timing off

-- Three accounts: two ordinary, one admin. Inserting into auth.users fires the
-- signup trigger, which is itself the first thing under test.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'grace@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin@example.com');

update public.profiles set is_admin = true
 where id = '33333333-3333-3333-3333-333333333333';

\echo '--- signup grants a starting roll ---'
do $$
declare
  c integer;
  events integer;
begin
  select credits into c from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  assert c = 10, format('expected 10 starting credits, got %s', c);

  select count(*) into events from public.credit_events
   where user_id = '11111111-1111-1111-1111-111111111111' and reason = 'signup';
  assert events = 1, 'signup should be recorded in the ledger exactly once';
end
$$;

\echo '--- a user cannot give themselves credits ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  -- No UPDATE policy exists on profiles, so RLS filters this to zero rows
  -- rather than raising. The balance must be untouched either way.
  update public.profiles set credits = 9999
   where id = '11111111-1111-1111-1111-111111111111';

  do $$
  declare c integer;
  begin
    select credits into c from public.profiles
     where id = '11111111-1111-1111-1111-111111111111';
    assert c = 10, format('credits were writable by the user: now %s', c);
  end
  $$;
rollback;

\echo '--- a user cannot read anyone else''s profile ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare visible integer;
  begin
    select count(*) into visible from public.profiles;
    assert visible = 1, format('expected to see only my own profile, saw %s', visible);
  end
  $$;
rollback;

\echo '--- spending a credit ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare left_after integer;
  begin
    left_after := public.consume_credit();
    assert left_after = 9, format('expected 9 left, got %s', left_after);

    left_after := public.refund_credit();
    assert left_after = 10, format('refund should restore to 10, got %s', left_after);
  end
  $$;
rollback;

\echo '--- spending stops at zero rather than going negative ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare
    i integer;
    failed boolean := false;
  begin
    for i in 1..10 loop
      perform public.consume_credit();
    end loop;

    begin
      perform public.consume_credit();
    exception when others then
      failed := true;
    end;

    assert failed, 'an eleventh develop on a ten-credit account should fail';
  end
  $$;
rollback;

\echo '--- photos and folders are invisible to other accounts ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  insert into public.folders (owner_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Japan 2026');
  insert into public.photos (owner_id, status)
    values ('11111111-1111-1111-1111-111111111111', 'done');

  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  declare f integer; p integer;
  begin
    select count(*) into f from public.folders;
    select count(*) into p from public.photos;
    assert f = 0, format('another account''s folders leaked: %s rows', f);
    assert p = 0, format('another account''s photos leaked: %s rows', p);
  end
  $$;
rollback;

\echo '--- a user cannot file a photo into someone else''s folder ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare
    refused boolean := false;
  begin
    begin
      -- owner_id belongs to Grace; the WITH CHECK on `own photos` must refuse.
      insert into public.photos (owner_id, status)
        values ('22222222-2222-2222-2222-222222222222', 'done');
    exception when insufficient_privilege then
      refused := true;
    end;
    assert refused, 'inserting a photo owned by somebody else was allowed';
  end
  $$;
rollback;

\echo '--- promo codes are not readable by ordinary accounts ---'
insert into public.promo_codes (code, credits, note)
  values ('FILMROLL', 25, 'launch');

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare visible integer;
  begin
    select count(*) into visible from public.promo_codes;
    assert visible = 0, format('promo codes were listable by a user: %s rows', visible);
  end
  $$;
rollback;

\echo '--- redeeming a code, once and only once ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare
    result json;
    twice boolean := false;
  begin
    -- Lower case on purpose: codes are stored upper and matched upper.
    result := public.redeem_promo_code('filmroll');
    assert (result->>'added')::int = 25, format('expected 25 added, got %s', result->>'added');
    assert (result->>'credits')::int = 35, format('expected 35 total, got %s', result->>'credits');

    begin
      perform public.redeem_promo_code('FILMROLL');
    exception when others then
      twice := true;
    end;
    assert twice, 'the same code was claimed twice by one account';
  end
  $$;
rollback;

\echo '--- inactive, expired, and exhausted codes are all refused ---'
insert into public.promo_codes (code, credits, active) values ('SWITCHEDOFF', 5, false);
insert into public.promo_codes (code, credits, expires_at)
  values ('LASTYEAR', 5, now() - interval '1 day');
insert into public.promo_codes (code, credits, max_redemptions, redeemed_count)
  values ('ALLGONE', 5, 1, 1);

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

  do $$
  declare
    code text;
    refused boolean;
  begin
    foreach code in array array['SWITCHEDOFF', 'LASTYEAR', 'ALLGONE', 'NOSUCHCODE'] loop
      refused := false;
      begin
        perform public.redeem_promo_code(code);
      exception when others then
        refused := true;
      end;
      assert refused, format('%s should not have been claimable', code);
    end loop;
  end
  $$;
rollback;

\echo '--- a voucher only works for the address it names ---'
insert into public.promo_codes (code, credits, target_email)
  values ('FORADA', 40, 'ADA@example.com');

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

  do $$
  declare refused boolean := false;
  begin
    begin
      perform public.redeem_promo_code('FORADA');
    exception when others then
      refused := true;
    end;
    assert refused, 'Grace claimed a voucher addressed to Ada';
  end
  $$;

  -- And the person it is for can claim it, case of the address notwithstanding.
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare result json;
  begin
    result := public.redeem_promo_code('FORADA');
    assert (result->>'added')::int = 40, 'Ada could not claim her own voucher';
  end
  $$;
rollback;

\echo '--- only admins can hand out credits ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare refused boolean := false;
  begin
    begin
      perform public.admin_grant_credits(
        '11111111-1111-1111-1111-111111111111', 500);
    exception when insufficient_privilege then
      refused := true;
    end;
    assert refused, 'an ordinary account granted itself credits';
  end
  $$;
rollback;

\echo '--- an admin can grant, and can see every account ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

  do $$
  declare
    balance integer;
    visible integer;
  begin
    balance := public.admin_grant_credits(
      '22222222-2222-2222-2222-222222222222', 15);
    assert balance = 25, format('expected Grace on 25, got %s', balance);

    select count(*) into visible from public.profiles;
    assert visible = 3, format('admin should see 3 profiles, saw %s', visible);
  end
  $$;
rollback;

\echo '--- taking credits back cannot drive a balance negative ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

  do $$
  declare balance integer;
  begin
    balance := public.admin_grant_credits(
      '22222222-2222-2222-2222-222222222222', -9999);
    assert balance = 0, format('expected a floor of 0, got %s', balance);
  end
  $$;
rollback;

\echo '--- storage paths are owned by their first segment ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare refused boolean := false;
  begin
    insert into storage.objects (bucket_id, name)
      values ('photos', '11111111-1111-1111-1111-111111111111/abc/raw.jpg');

    begin
      insert into storage.objects (bucket_id, name)
        values ('photos', '22222222-2222-2222-2222-222222222222/abc/raw.jpg');
    exception when insufficient_privilege then
      refused := true;
    end;
    assert refused, 'a file was written into another account''s folder';
  end
  $$;
rollback;

\echo '--- the photos bucket is private ---'
do $$
declare is_public boolean;
begin
  select public into is_public from storage.buckets where id = 'photos';
  assert is_public is false, 'the photos bucket is public';
end
$$;

\echo ''
\echo 'ALL DATABASE SECURITY TESTS PASSED'
