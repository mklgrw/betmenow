-- SECURITY FIX FOR SIMPLE FUNCTIONS
-- This script recreates the simplified bet functions with SECURITY DEFINER
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. FIX FUNCTION SECURITY SETTINGS
------------------------------------------------------------

-- Function to reject a bet - simple version with security definer
CREATE OR REPLACE FUNCTION reject_bet_simple(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
DECLARE
  v_bet_id UUID;
BEGIN
  -- Get bet ID for this recipient
  SELECT bet_id INTO v_bet_id 
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  IF v_bet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = 'rejected'
  WHERE id = p_recipient_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Function to accept a bet - simple version with security definer
CREATE OR REPLACE FUNCTION accept_bet_simple(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
DECLARE
  v_bet_id UUID;
BEGIN
  -- Get bet ID for this recipient
  SELECT bet_id INTO v_bet_id 
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  IF v_bet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update recipient status and parent bet
  UPDATE bet_recipients 
  SET status = 'in_progress'
  WHERE id = p_recipient_id;
  
  -- Also update the bet itself
  UPDATE bets
  SET status = 'in_progress'
  WHERE id = v_bet_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error accepting bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reject_bet_simple(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION accept_bet_simple(UUID) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Security fix for simple functions applied successfully';
END $$; 