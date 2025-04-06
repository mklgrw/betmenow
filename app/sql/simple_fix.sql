-- SIMPLE CONSTRAINT FIX
-- This script simply adds 'rejected' as a valid status value
-- without attempting to change column types

------------------------------------------------------------
-- 1. DIRECTLY FIX CONSTRAINTS
------------------------------------------------------------

-- Drop existing constraints
ALTER TABLE IF EXISTS bets 
  DROP CONSTRAINT IF EXISTS bets_status_check;
    
ALTER TABLE IF EXISTS bet_recipients 
  DROP CONSTRAINT IF EXISTS bet_recipients_status_check;
  
-- Add constraints that allow 'rejected'
ALTER TABLE IF EXISTS bets
  ADD CONSTRAINT bets_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));
    
ALTER TABLE IF EXISTS bet_recipients
  ADD CONSTRAINT bet_recipients_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));

------------------------------------------------------------
-- 2. CREATE SIMPLIFIED REJECTION FUNCTION
------------------------------------------------------------

-- Function to reject a bet - simple version with security invoker
CREATE OR REPLACE FUNCTION reject_bet_simple(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
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

-- Function to accept a bet - simple version with security invoker
CREATE OR REPLACE FUNCTION accept_bet_simple(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
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

------------------------------------------------------------
-- 3. GRANT PERMISSION TO THESE FUNCTIONS
------------------------------------------------------------

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reject_bet_simple(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION accept_bet_simple(UUID) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Simple constraint fix applied successfully';
END $$; 