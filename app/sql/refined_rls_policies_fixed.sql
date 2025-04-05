-- REFINED ROW LEVEL SECURITY POLICIES (FIXED ORDER)
-- This script implements properly structured RLS policies
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- 1. DROP EXISTING SIMPLE POLICIES
------------------------------------------------------------

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS bets_select_policy ON bets;
DROP POLICY IF EXISTS bets_update_policy ON bets;
DROP POLICY IF EXISTS bets_insert_policy ON bets;
DROP POLICY IF EXISTS bet_recipients_select_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_update_policy ON bet_recipients;
DROP POLICY IF EXISTS bet_recipients_insert_policy ON bet_recipients;

------------------------------------------------------------
-- 2. ADD CREATOR_LOOKUP COLUMN FIRST
------------------------------------------------------------

-- First, add a creator_lookup column to bet_recipients if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bet_recipients' AND column_name = 'creator_lookup'
  ) THEN
    ALTER TABLE bet_recipients ADD COLUMN creator_lookup UUID;
  END IF;
END $$;

-- Update all existing records to copy creator_id from the bets table
UPDATE bet_recipients br
SET creator_lookup = b.creator_id
FROM bets b
WHERE br.bet_id = b.id AND br.creator_lookup IS NULL;

-- Create a trigger function to keep creator_lookup in sync
CREATE OR REPLACE FUNCTION sync_bet_creator_to_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When inserting new recipient records, set creator_lookup
  IF TG_OP = 'INSERT' THEN
    UPDATE bet_recipients
    SET creator_lookup = (SELECT creator_id FROM bets WHERE id = NEW.bet_id)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on bet_recipients
DROP TRIGGER IF EXISTS sync_bet_creator_trigger ON bet_recipients;
CREATE TRIGGER sync_bet_creator_trigger
AFTER INSERT ON bet_recipients
FOR EACH ROW
EXECUTE FUNCTION sync_bet_creator_to_recipients();

------------------------------------------------------------
-- 3. CREATE POLICIES FOR BET_RECIPIENTS 
------------------------------------------------------------

-- Create proper select policy for bet_recipients 
-- (Avoids recursion by not referencing the bets table)
CREATE POLICY bet_recipients_select_policy 
ON bet_recipients 
FOR SELECT 
USING (
  -- Either the user is the recipient
  recipient_id = auth.uid() 
  OR 
  -- Or they are listed in a foreign_lookup field (which contains the bet creator ID)
  EXISTS (
    SELECT 1 FROM bet_recipients br 
    WHERE br.id = bet_recipients.id 
    AND br.creator_lookup = auth.uid()
  )
);

-- Update policy: Recipients can update their own records
CREATE POLICY bet_recipients_update_policy 
ON bet_recipients 
FOR UPDATE 
USING (recipient_id = auth.uid());

-- Insert policy: Use the creator_lookup field instead of checking bets table
CREATE POLICY bet_recipients_insert_policy 
ON bet_recipients 
FOR INSERT 
WITH CHECK (creator_lookup = auth.uid());

------------------------------------------------------------
-- 4. CREATE POLICIES FOR BETS TABLE
------------------------------------------------------------

-- Select policy for bets that doesn't reference bet_recipients
CREATE POLICY bets_select_policy 
ON bets 
FOR SELECT 
USING (
  -- Either they created the bet
  creator_id = auth.uid()
  OR
  -- Or they are a participant in the bet (using a join strategy that avoids recursion)
  id IN (
    SELECT bet_id FROM bet_recipients 
    WHERE recipient_id = auth.uid()
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
-- 5. REAPPLY THE SECURE FUNCTIONS
------------------------------------------------------------

-- Function to accept a bet (using proper security approach)
CREATE OR REPLACE FUNCTION secure_accept_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_success BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is the recipient (this will work with RLS)
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
  WHERE id = p_recipient_id;
  
  -- Update the bet status via admin helper function
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

-- Function to reject a bet (using proper security approach)
CREATE OR REPLACE FUNCTION secure_reject_bet(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_success BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is the recipient (this will work with RLS)
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
  WHERE id = p_recipient_id;
  
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

-- Helper function to update bet status
CREATE OR REPLACE FUNCTION update_bet_status(
  p_bet_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permissions to all functions
GRANT EXECUTE ON FUNCTION secure_accept_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION secure_reject_bet(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_bet_status(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION sync_bet_creator_to_recipients() TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Refined RLS policies created successfully';
END $$; 