-- Promotes the first admin.
--
-- Admin status lives in the database rather than in an env allowlist because
-- the RLS policies in 0001 are written in terms of public.is_admin(). Splitting
-- the check between Postgres and the app would mean the dashboard and the
-- policies could disagree about who is an admin, which is the one thing an
-- authorisation check must never do.
--
-- Change the address below before running this on a project you own.

update public.profiles
   set is_admin = true
 where lower(email) = lower('nicholasprawiratan@gmail.com');
