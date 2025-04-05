-- FINAL RLS FIX
-- This script provides a completely non-recursive RLS implementation
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
-- 2. CREATE SIMPLIFIED BET_RECIPIENTS POLICIES
------------------------------------------------------------

-- Absolutely simple select policy for bet_recipients with no self-reference
CREATE POLICY bet_recipients_select_policy 
ON bet_recipients 
FOR SELECT 
USING (
  -- Either the user is the recipient
  recipient_id = auth.uid() 
  OR 
  -- Or they are the creator (directly using creator_lookup field)
  creator_lookup = auth.uid()
);

-- Update policy: Recipients can update their own records
CREATE POLICY bet_recipients_update_policy 
ON bet_recipients 
FOR UPDATE 
USING (recipient_id = auth.uid());

-- Insert policy: Only creators can insert recipients
CREATE POLICY bet_recipients_insert_policy 
ON bet_recipients 
FOR INSERT 
WITH CHECK (creator_lookup = auth.uid());

------------------------------------------------------------
-- 3. CREATE POLICIES FOR BETS TABLE
------------------------------------------------------------

-- Select policy for bets
CREATE POLICY bets_select_policy 
ON bets 
FOR SELECT 
USING (
  -- Either they created the bet
  creator_id = auth.uid()
  OR
  -- Or they are a participant in the bet
  EXISTS (
    SELECT 1 FROM bet_recipients 
    WHERE bet_id = bets.id AND recipient_id = auth.uid()
  )
);

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

------------------------------------------------------------
-- 4. SECURE FUNCTIONS WITH PERMISSION CHECKS
------------------------------------------------------------

-- Function to accept a bet
CREATE OR REPLACE FUNCTION secure_accept_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Using definer for cross-table updates
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if recipient record exists and user is the recipient
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
  IF v_bet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'You are not authorized to accept this bet or the bet does not exist',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = 'in_progress'
  WHERE id = p_recipient_id;
  
  -- Update the bet status
  UPDATE bets
  SET status = 'in_progress'
  WHERE id = v_bet_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'message', 'Bet accepted successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'recipient_id', p_recipient_id
  );
END;
$$;

-- Function to reject a bet
CREATE OR REPLACE FUNCTION secure_reject_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Using definer for cross-table updates
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if recipient record exists and user is the recipient
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
  IF v_bet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'You are not authorized to reject this bet or the bet does not exist',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = 'rejected'
  WHERE id = p_recipient_id;
  
  -- Do not update the bet status for rejection
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'message', 'Bet rejected successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'recipient_id', p_recipient_id
  );
END;
$$;

-- Grant execute permissions to all functions
GRANT EXECUTE ON FUNCTION secure_accept_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION secure_reject_bet(UUID) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Final RLS fix applied successfully';
END $$; 