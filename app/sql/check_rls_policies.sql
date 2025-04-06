-- List all RLS policies on the bet_recipients table
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

-- Test RLS policy specific to the update operation on bet_recipients
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
  tablename = 'bet_recipients' AND 
  cmd = 'UPDATE';

-- Create a manual update query to test if an update would work
-- Replace 'your_bet_recipient_id' with an actual recipient ID from the database
-- This query won't actually run, it just shows what the equivalent SQL would be
-- TO RUN: Copy this query, replace the ID, and run it manually
/* 
UPDATE bet_recipients
SET status = 'in_progress'
WHERE id = 'your_bet_recipient_id'
RETURNING *;
*/ 