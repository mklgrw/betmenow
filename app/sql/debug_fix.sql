-- DEBUG VERSION OF ACCEPT/REJECT FUNCTIONS
-- This script creates debug versions with detailed logging
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. DEBUG ACCEPT FUNCTION
------------------------------------------------------------

-- Function to accept a bet with detailed logging
CREATE OR REPLACE FUNCTION accept_bet_debug(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_recipient RECORD;
  v_bet RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Log function entry
  RAISE NOTICE 'accept_bet_debug: Started with recipient_id %', p_recipient_id;
  
  -- Get current user
  v_user_id := auth.uid();
  RAISE NOTICE 'accept_bet_debug: Current user is %', v_user_id;
  
  -- Get recipient details
  BEGIN
    SELECT * INTO v_recipient FROM bet_recipients WHERE id = p_recipient_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'accept_bet_debug: Recipient not found';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Recipient not found',
        'recipient_id', p_recipient_id
      );
    END IF;
    RAISE NOTICE 'accept_bet_debug: Found recipient with status %', v_recipient.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'accept_bet_debug: Error fetching recipient: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'fetch_recipient'
    );
  END;
  
  -- Get bet details
  BEGIN
    v_bet_id := v_recipient.bet_id;
    RAISE NOTICE 'accept_bet_debug: Bet ID is %', v_bet_id;
    
    SELECT * INTO v_bet FROM bets WHERE id = v_bet_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'accept_bet_debug: Bet not found';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Bet not found',
        'bet_id', v_bet_id
      );
    END IF;
    RAISE NOTICE 'accept_bet_debug: Found bet with status %', v_bet.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'accept_bet_debug: Error fetching bet: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'fetch_bet'
    );
  END;
  
  -- Update recipient status
  BEGIN
    RAISE NOTICE 'accept_bet_debug: Attempting to update recipient status';
    UPDATE bet_recipients 
    SET status = 'in_progress'
    WHERE id = p_recipient_id;
    
    RAISE NOTICE 'accept_bet_debug: Recipient update completed';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'accept_bet_debug: Error updating recipient: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'update_recipient'
    );
  END;
  
  -- Update bet status
  BEGIN
    RAISE NOTICE 'accept_bet_debug: Attempting to update bet status';
    UPDATE bets
    SET status = 'in_progress'
    WHERE id = v_bet_id;
    
    RAISE NOTICE 'accept_bet_debug: Bet update completed';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'accept_bet_debug: Error updating bet: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'update_bet'
    );
  END;
  
  -- Function completed successfully
  RAISE NOTICE 'accept_bet_debug: Function completed successfully';
  RETURN jsonb_build_object(
    'success', true,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'new_status', 'in_progress'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'accept_bet_debug: Unexpected error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'step', 'unexpected'
  );
END;
$$;

------------------------------------------------------------
-- 2. DEBUG REJECT FUNCTION
------------------------------------------------------------

-- Function to reject a bet with detailed logging
CREATE OR REPLACE FUNCTION reject_bet_debug(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_recipient RECORD;
  v_bet RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Log function entry
  RAISE NOTICE 'reject_bet_debug: Started with recipient_id %', p_recipient_id;
  
  -- Get current user
  v_user_id := auth.uid();
  RAISE NOTICE 'reject_bet_debug: Current user is %', v_user_id;
  
  -- Get recipient details
  BEGIN
    SELECT * INTO v_recipient FROM bet_recipients WHERE id = p_recipient_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'reject_bet_debug: Recipient not found';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Recipient not found',
        'recipient_id', p_recipient_id
      );
    END IF;
    RAISE NOTICE 'reject_bet_debug: Found recipient with status %', v_recipient.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'reject_bet_debug: Error fetching recipient: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'fetch_recipient'
    );
  END;
  
  -- Get bet details
  BEGIN
    v_bet_id := v_recipient.bet_id;
    RAISE NOTICE 'reject_bet_debug: Bet ID is %', v_bet_id;
    
    SELECT * INTO v_bet FROM bets WHERE id = v_bet_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'reject_bet_debug: Bet not found';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Bet not found',
        'bet_id', v_bet_id
      );
    END IF;
    RAISE NOTICE 'reject_bet_debug: Found bet with status %', v_bet.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'reject_bet_debug: Error fetching bet: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'fetch_bet'
    );
  END;
  
  -- Update recipient status
  BEGIN
    RAISE NOTICE 'reject_bet_debug: Attempting to update recipient status';
    UPDATE bet_recipients 
    SET status = 'rejected'
    WHERE id = p_recipient_id;
    
    RAISE NOTICE 'reject_bet_debug: Recipient update completed';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'reject_bet_debug: Error updating recipient: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'step', 'update_recipient'
    );
  END;
  
  -- Function completed successfully
  RAISE NOTICE 'reject_bet_debug: Function completed successfully';
  RETURN jsonb_build_object(
    'success', true,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'new_status', 'rejected'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reject_bet_debug: Unexpected error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'step', 'unexpected'
  );
END;
$$;

------------------------------------------------------------
-- 3. GRANT PERMISSIONS
------------------------------------------------------------

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_bet_debug(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reject_bet_debug(UUID) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Debug functions created successfully';
END $$; 