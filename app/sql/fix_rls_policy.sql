-- First, let's check which policies exist on the bet_recipients table
SELECT * FROM pg_policies WHERE tablename = 'bet_recipients';

-- Drop existing policies on bet_recipients
DROP POLICY IF EXISTS update_bet_recipients ON bet_recipients;
DROP POLICY IF EXISTS "Users can view all bet recipients" ON bet_recipients;
DROP POLICY IF EXISTS "Users can add recipients to their bets" ON bet_recipients;

-- Enable RLS on bet_recipients (in case it's not already enabled)
ALTER TABLE bet_recipients ENABLE ROW LEVEL SECURITY;

-- Create a simple policy for all operations (SELECT, INSERT, UPDATE, DELETE)
-- This policy allows users to:
-- 1. Access their own records as a recipient
-- 2. Access records for bets they created
CREATE POLICY bet_recipients_all_operations ON bet_recipients
FOR ALL
USING (
  -- Current user is the recipient
  auth.uid() = recipient_id
  OR
  -- Current user is the bet creator
  EXISTS (
    SELECT 1 FROM bets 
    WHERE bets.id = bet_recipients.bet_id 
    AND bets.creator_id = auth.uid()
  )
);

-- Verify that the policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM 
  pg_policies 
WHERE 
  tablename = 'bet_recipients';

-- Create a temporary test function to verify permissions
CREATE OR REPLACE FUNCTION test_bet_recipient_permissions()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result TEXT;
  target_id UUID;
BEGIN
  -- Log attempt
  RAISE NOTICE 'Testing permissions...';
  
  -- Try to update a record (this won't actually make changes due to the ROLLBACK)
  BEGIN
    -- Start a transaction that we'll roll back
    START TRANSACTION;
    
    -- Get the ID of a pending recipient first
    SELECT id INTO target_id 
    FROM bet_recipients 
    WHERE status = 'pending' 
    LIMIT 1;
    
    IF target_id IS NULL THEN
      result := 'No pending recipients found to test';
    ELSE
      -- Try to update using the ID we found
      UPDATE bet_recipients 
      SET status = 'in_progress' 
      WHERE id = target_id;
      
      result := 'UPDATE test successful';
    END IF;
    
    -- Roll back the transaction
    ROLLBACK;
  EXCEPTION WHEN OTHERS THEN
    result := 'UPDATE test failed: ' || SQLERRM;
    -- Make sure to roll back even if there's an error
    IF (SELECT txid_current()) <> 0 THEN
      ROLLBACK;
    END IF;
  END;
  
  RETURN result;
END;
$$; 