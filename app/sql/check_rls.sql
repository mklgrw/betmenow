-- Check RLS policies and permissions
-- Run this in the Supabase SQL Editor

-- Check RLS policies on bet_recipients table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename = 'bet_recipients';

-- Check RLS policies on bets table  
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename = 'bets';

-- Check if RLS is enabled on tables
SELECT
  tablename,
  rowsecurity
FROM
  pg_tables
WHERE
  tablename IN ('bet_recipients', 'bets');

-- Check function ownership
SELECT
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM
  pg_proc p
JOIN
  pg_namespace n ON p.pronamespace = n.oid
WHERE
  n.nspname = 'public' AND
  p.proname IN ('accept_bet_simple', 'reject_bet_simple');

-- Check users and their roles for debugging
SELECT
  usename,
  usesysid,
  usecreatedb,
  usesuper
FROM
  pg_user;

-- Log check completed
DO $$
BEGIN
  RAISE NOTICE 'RLS and permission check completed';
END $$; 