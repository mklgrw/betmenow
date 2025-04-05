-- PROPER ROW LEVEL SECURITY POLICIES
-- This script sets up proper RLS policies and functions
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY
------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_recipients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS bets_select_policy ON bets;
DROP POLICY IF EXISTS bets_update_policy ON bets;
DROP POLICY IF EXISTS bets_insert_policy ON bets;
DROP POLICY IF EXISTS bet_recipients_select_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_update_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_insert_policy ON bet_recipients;

------------------------------------------------------------
-- 2. CREATE RLS POLICIES FOR BETS TABLE
------------------------------------------------------------

-- Select policy: Users can view bets they created or are recipients of
CREATE POLICY bets_select_policy 
ON bets 
FOR SELECT 
USING (
  creator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM bet_recipients 
    WHERE bet_recipients.bet_id = bets.id AND 
          bet_recipients.recipient_id = auth.uid()
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
-- 3. CREATE RLS POLICIES FOR BET_RECIPIENTS TABLE
------------------------------------------------------------

-- Select policy: Users can view recipient records if they created the bet or are the recipient
CREATE POLICY bet_recipients_select_policy 
ON bet_recipients 
FOR SELECT 
USING (
  recipient_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM bets 
    WHERE bets.id = bet_recipients.bet_id AND 
          bets.creator_id = auth.uid()
  )
);

-- Update policy: Users can update recipient status if they are the recipient
CREATE POLICY bet_recipients_update_policy 
ON bet_recipients 
FOR UPDATE 
USING (recipient_id = auth.uid());

-- Insert policy: Users can add recipients if they created the bet
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

------------------------------------------------------------
-- 4. UPDATED FUNCTIONS THAT RESPECT RLS
------------------------------------------------------------

-- Function to accept a bet - with proper security checks
CREATE OR REPLACE FUNCTION secure_accept_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER -- Run with caller's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_success BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is the recipient
  IF NOT EXISTS (
    SELECT 1 FROM bet_recipients
    WHERE id = p_recipient_id AND recipient_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'You are not authorized to accept this bet',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Get bet ID
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  -- Update recipient status (will work with RLS)
  UPDATE bet_recipients 
  SET status = 'in_progress'
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
  -- Update the bet status via admin helper function
  -- (This requires SECURITY DEFINER since recipients can't update bets directly)
  PERFORM update_bet_status(v_bet_id, 'in_progress');
  
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

-- Function to reject a bet - with proper security checks
CREATE OR REPLACE FUNCTION secure_reject_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER -- Run with caller's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_success BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is the recipient
  IF NOT EXISTS (
    SELECT 1 FROM bet_recipients
    WHERE id = p_recipient_id AND recipient_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'You are not authorized to reject this bet',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Get bet ID
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  -- Update recipient status (will work with RLS)
  UPDATE bet_recipients 
  SET status = 'rejected'
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
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

-- Helper function to update bet status (needs SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_bet_status(
  p_bet_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This needs to run with elevated privileges
SET search_path = public
AS $$
BEGIN
  -- Update the bet status
  UPDATE bets
  SET status = p_status
  WHERE id = p_bet_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating bet status: %', SQLERRM;
  RETURN FALSE;
END;
$$;

------------------------------------------------------------
-- 5. GRANT PERMISSIONS
------------------------------------------------------------

-- Grant execute permissions to all functions
GRANT EXECUTE ON FUNCTION secure_accept_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION secure_reject_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_bet_status(UUID, TEXT) TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Proper RLS policies and secure functions created successfully';
END $$; 