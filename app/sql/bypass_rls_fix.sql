-- BYPASS RLS FIX FOR BET FUNCTIONS
-- This script creates admin functions that bypass RLS
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. ADMIN ACCEPT FUNCTION
------------------------------------------------------------

-- Function to accept a bet - completely bypasses RLS
CREATE OR REPLACE FUNCTION admin_accept_bet(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
SET search_path = public
AS $$
BEGIN
  -- Update the recipient status directly
  UPDATE bet_recipients 
  SET status = 'in_progress'
  WHERE id = p_recipient_id;
  
  -- Get the bet ID
  WITH recipient_data AS (
    SELECT bet_id FROM bet_recipients WHERE id = p_recipient_id
  )
  -- Update the bet status
  UPDATE bets
  SET status = 'in_progress'
  FROM recipient_data
  WHERE bets.id = recipient_data.bet_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in admin_accept_bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

------------------------------------------------------------
-- 2. ADMIN REJECT FUNCTION
------------------------------------------------------------

-- Function to reject a bet - completely bypasses RLS
CREATE OR REPLACE FUNCTION admin_reject_bet(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
SET search_path = public
AS $$
BEGIN
  -- Update the recipient status directly
  UPDATE bet_recipients 
  SET status = 'rejected'
  WHERE id = p_recipient_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in admin_reject_bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

------------------------------------------------------------
-- 3. DISABLE RLS TEMPORARILY FOR TESTING
------------------------------------------------------------

-- Temporarily disable RLS on these tables for testing
ALTER TABLE IF EXISTS bet_recipients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bets DISABLE ROW LEVEL SECURITY;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_accept_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION admin_reject_bet(UUID) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS bypass functions created successfully';
END $$; 