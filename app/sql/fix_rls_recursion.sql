-- FIX FOR RLS INFINITE RECURSION
-- This script fixes the recursive dependency in RLS policies
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. DROP EXISTING PROBLEMATIC POLICIES
------------------------------------------------------------

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS bets_select_policy ON bets;
DROP POLICY IF EXISTS bets_update_policy ON bets;
DROP POLICY IF EXISTS bets_insert_policy ON bets;
DROP POLICY IF EXISTS bet_recipients_select_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_update_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_insert_policy ON bet_recipients;

------------------------------------------------------------
-- 2. CREATE SIMPLER NON-RECURSIVE POLICIES
------------------------------------------------------------

-- Non-recursive select policy for bets
CREATE POLICY bets_select_policy 
ON bets 
FOR SELECT 
USING (TRUE);  -- Allow all users to see all bets temporarily

-- Update policy: Users can only update bets they created
CREATE POLICY bets_update_policy 
ON bets 
FOR UPDATE 
USING (creator_id = auth.uid());

-- Insert policy: Users can create new bets
CREATE POLICY bets_insert_policy 
ON bets 
FOR INSERT 
WITH CHECK (creator_id = auth.uid());

-- Non-recursive select policy for bet_recipients
CREATE POLICY bet_recipients_select_policy 
ON bet_recipients 
FOR SELECT 
USING (TRUE);  -- Allow all users to see all recipients temporarily

-- Update policy: Recipients can update their own records
CREATE POLICY bet_recipients_update_policy 
ON bet_recipients 
FOR UPDATE 
USING (recipient_id = auth.uid());

-- Insert policy: Users can only add recipients to bets they created
CREATE POLICY bet_recipients_insert_policy 
ON bet_recipients 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bets 
    WHERE bets.id = bet_recipients.bet_id AND 
          bets.creator_id = auth.uid()
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policy infinite recursion fixed';
END $$; 