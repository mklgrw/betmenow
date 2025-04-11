-- Mutual Agreement System for Bet Outcomes
-- When a user declares a win, it needs confirmation from the counterparty
-- When a user declares a loss, the win is automatically accepted for the other party

-- First, add a column to the bet_recipients table to track pending outcome claims
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS pending_outcome TEXT DEFAULT NULL;
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS outcome_claimed_by UUID DEFAULT NULL;
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS outcome_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Helper function to validate UUIDs
CREATE OR REPLACE FUNCTION is_valid_uuid(text)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Check if the input is a valid UUID
  RETURN $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Function to declare a bet outcome with mutual agreement system
CREATE OR REPLACE FUNCTION secure_declare_bet_outcome(
  p_recipient_id UUID,
  p_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_creator_id UUID;
  v_opponent_recipient_id UUID;
  v_is_creator BOOLEAN;
  v_update_count INTEGER;
  v_user_record RECORD;
  v_opponent_record RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Log function start and input parameters
  RAISE NOTICE 'secure_declare_bet_outcome started: p_recipient_id=%, p_outcome=%, user_id=%', p_recipient_id, p_outcome, v_user_id;
  
  -- Validate that user_id is a valid UUID
  IF NOT is_valid_uuid(v_user_id::text) THEN
    RAISE NOTICE 'Invalid user ID format: %', v_user_id;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid user ID format',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Check if recipient record exists and user is the recipient
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
  -- Log result of recipient check
  RAISE NOTICE 'Recipient check result: bet_id=%', v_bet_id;
  
  -- If not found, check if user is the creator of this bet
  IF v_bet_id IS NULL THEN
    SELECT b.id, b.creator_id INTO v_bet_id, v_creator_id
    FROM bet_recipients br
    JOIN bets b ON br.bet_id = b.id
    WHERE br.id = p_recipient_id AND b.creator_id = v_user_id;
    
    -- Log creator check results
    RAISE NOTICE 'Creator check result: bet_id=%, creator_id=%', v_bet_id, v_creator_id;
    
    IF v_bet_id IS NULL THEN
      RAISE NOTICE 'Authorization failed: User is neither recipient nor creator';
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'You are not authorized to declare an outcome for this bet',
        'recipient_id', p_recipient_id
      );
    END IF;
    
    v_is_creator := TRUE;
  ELSE
    v_is_creator := FALSE;
    
    -- Get the creator ID
    SELECT creator_id INTO v_creator_id
    FROM bets
    WHERE id = v_bet_id;
    
    RAISE NOTICE 'User is recipient: creator_id=%', v_creator_id;
  END IF;
  
  RAISE NOTICE 'Auth check passed. User is_creator=%', v_is_creator;
  
  -- Validate outcome
  IF p_outcome NOT IN ('won', 'lost') THEN
    RAISE NOTICE 'Invalid outcome: %', p_outcome;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid outcome. Must be "won" or "lost"',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Find opponent's recipient record
  SELECT id INTO v_opponent_recipient_id
  FROM bet_recipients
  WHERE bet_id = v_bet_id 
    AND id != p_recipient_id
    AND recipient_id != v_user_id
  LIMIT 1;
  
  -- Log the opponent finding results
  RAISE NOTICE 'First opponent lookup result: %', v_opponent_recipient_id;
  
  IF v_opponent_recipient_id IS NULL THEN
    -- If we couldn't find an opponent by usual means, try harder
    SELECT id INTO v_opponent_recipient_id
    FROM bet_recipients
    WHERE bet_id = v_bet_id 
      AND id != p_recipient_id
    LIMIT 1;
    
    RAISE NOTICE 'Alternative opponent lookup found: %', v_opponent_recipient_id;
  END IF;
  
  -- Log what records we're going to update
  SELECT * INTO v_user_record FROM bet_recipients WHERE id = p_recipient_id;
  RAISE NOTICE 'About to update user record with ID=%, current status=%, pending_outcome=%', 
    p_recipient_id, v_user_record.status, v_user_record.pending_outcome;
  
  IF v_opponent_recipient_id IS NOT NULL THEN
    SELECT * INTO v_opponent_record FROM bet_recipients WHERE id = v_opponent_recipient_id;
    RAISE NOTICE 'About to update opponent record with ID=%, current status=%, pending_outcome=%', 
      v_opponent_recipient_id, v_opponent_record.status, v_opponent_record.pending_outcome;
  END IF;

  -- HANDLE DIFFERENT OUTCOME TYPES
  IF p_outcome = 'lost' THEN
    -- If declaring a loss, directly mark user as lost and opponent as won
    RAISE NOTICE 'Processing LOST outcome';
    
    -- Update current user's status
    UPDATE bet_recipients 
    SET status = 'lost',
        pending_outcome = NULL,
        outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
        outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE 'Updated current user status to LOST, rows affected: %', v_update_count;
    
    -- Update opponent's status (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      RAISE NOTICE 'Updating opponent status to WON';
      
      UPDATE bet_recipients 
      SET status = 'won',
          pending_outcome = NULL,
          outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
          outcome_claimed_at = NOW()
      WHERE id = v_opponent_recipient_id;
      
      GET DIAGNOSTICS v_update_count = ROW_COUNT;
      RAISE NOTICE 'Opponent status updated successfully, rows affected: %', v_update_count;
    END IF;
    
    -- Update the bet status
    UPDATE bets
    SET status = 'completed'
    WHERE id = v_bet_id;
    
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE 'Bet status updated successfully, rows affected: %', v_update_count;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'recipient_id', p_recipient_id,
      'bet_id', v_bet_id,
      'message', 'You have acknowledged losing this bet',
      'requires_confirmation', FALSE
    );
    
  ELSIF p_outcome = 'won' THEN
    -- If declaring a win, need confirmation from opponent
    RAISE NOTICE 'Processing WON outcome';
    
    -- CRITICAL FIX: Make sure the declaring user gets pending_outcome='won'
    UPDATE bet_recipients SET
      pending_outcome = 'won',
      status = 'pending_outcome',
      outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
      outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE 'Set current user pending_outcome to WON, rows affected: %', v_update_count;
    
    -- Check results
    SELECT * INTO v_user_record FROM bet_recipients WHERE id = p_recipient_id;
    RAISE NOTICE 'User record after update: status=%, pending_outcome=%', 
      v_user_record.status, v_user_record.pending_outcome;
    
    -- Update opponent's pending outcome (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      RAISE NOTICE 'Setting opponent pending_outcome to LOST';
      
      -- CRITICAL FIX: Make sure the opponent gets pending_outcome='lost'
      UPDATE bet_recipients SET
        pending_outcome = 'lost',
        status = 'pending_outcome',
        outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
        outcome_claimed_at = NOW()
      WHERE id = v_opponent_recipient_id;
      
      GET DIAGNOSTICS v_update_count = ROW_COUNT;
      RAISE NOTICE 'Set opponent pending_outcome to LOST, rows affected: %', v_update_count;
      
      -- Check results
      SELECT * INTO v_opponent_record FROM bet_recipients WHERE id = v_opponent_recipient_id;
      RAISE NOTICE 'Opponent record after update: status=%, pending_outcome=%', 
        v_opponent_record.status, v_opponent_record.pending_outcome;
    END IF;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'recipient_id', p_recipient_id,
      'bet_id', v_bet_id,
      'message', 'Win claimed. Waiting for confirmation from your opponent',
      'requires_confirmation', TRUE
    );
  END IF;
  
  -- This should never happen due to earlier validation
  RAISE NOTICE 'Unexpected execution path reached. This should never happen.';
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Invalid outcome',
    'recipient_id', p_recipient_id
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Exception in secure_declare_bet_outcome: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'recipient_id', p_recipient_id
  );
END;
$$;

-- Function to confirm a pending outcome claim
CREATE OR REPLACE FUNCTION secure_confirm_bet_outcome(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_pending_outcome TEXT;
  v_opponent_recipient_id UUID;
  v_update_count INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Validate that user_id is a valid UUID
  IF NOT is_valid_uuid(v_user_id::text) THEN
    RAISE NOTICE 'Invalid user ID format in confirm outcome: %', v_user_id;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid user ID format',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Check if recipient record exists, user is the recipient, and there's a pending outcome
  SELECT bet_id, pending_outcome INTO v_bet_id, v_pending_outcome
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id AND pending_outcome IS NOT NULL;
  
  RAISE NOTICE 'Confirm outcome - bet_id: %, pending_outcome: %', v_bet_id, v_pending_outcome;
  
  IF v_bet_id IS NULL OR v_pending_outcome IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No pending outcome to confirm or you are not authorized',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Find the opposing recipient record
  SELECT id INTO v_opponent_recipient_id
  FROM bet_recipients
  WHERE bet_id = v_bet_id AND id != p_recipient_id AND pending_outcome IS NOT NULL
  LIMIT 1;
  
  RAISE NOTICE 'Found opponent with ID: %', v_opponent_recipient_id;
  
  -- Update current user's status
  UPDATE bet_recipients 
  SET status = v_pending_outcome,
      pending_outcome = NULL,
      outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
      outcome_claimed_at = NOW()
  WHERE id = p_recipient_id;
  
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  RAISE NOTICE 'Updated current user status, rows affected: %', v_update_count;
  
  -- Update opponent's status (if found)
  IF v_opponent_recipient_id IS NOT NULL THEN
    UPDATE bet_recipients 
    SET status = CASE WHEN v_pending_outcome = 'lost' THEN 'won' ELSE 'lost' END,
        pending_outcome = NULL,
        outcome_claimed_by = CASE WHEN is_valid_uuid(v_user_id::text) THEN v_user_id ELSE NULL END,
        outcome_claimed_at = NOW()
    WHERE id = v_opponent_recipient_id;
    
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE 'Updated opponent status, rows affected: %', v_update_count;
  END IF;
  
  -- Update the bet status
  UPDATE bets
  SET status = 'completed'
  WHERE id = v_bet_id;
  
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  RAISE NOTICE 'Updated bet status, rows affected: %', v_update_count;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'message', 'Outcome confirmed successfully',
    'your_outcome', v_pending_outcome
  );
END;
$$;

-- Function to reject a pending outcome claim
CREATE OR REPLACE FUNCTION secure_reject_bet_outcome(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
  v_opponent_recipient_id UUID;
  v_update_count INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Validate that user_id is a valid UUID
  IF NOT is_valid_uuid(v_user_id::text) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid user ID format',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Check if recipient record exists, user is the recipient, and there's a pending outcome
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients
  WHERE id = p_recipient_id 
    AND recipient_id = v_user_id 
    AND pending_outcome IS NOT NULL;
  
  IF v_bet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No pending outcome to reject or you are not authorized',
      'recipient_id', p_recipient_id
    );
  END IF;
  
  -- Find the opposing recipient record
  SELECT id INTO v_opponent_recipient_id
  FROM bet_recipients
  WHERE bet_id = v_bet_id AND id != p_recipient_id AND pending_outcome IS NOT NULL
  LIMIT 1;
  
  -- Update current user's status back to in_progress
  UPDATE bet_recipients 
  SET status = 'in_progress',
      pending_outcome = NULL,
      outcome_claimed_by = NULL,
      outcome_claimed_at = NULL
  WHERE id = p_recipient_id;
  
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  RAISE NOTICE 'Reset current user status, rows affected: %', v_update_count;
  
  -- Update opponent's status (if found) back to in_progress
  IF v_opponent_recipient_id IS NOT NULL THEN
    UPDATE bet_recipients 
    SET status = 'in_progress',
        pending_outcome = NULL,
        outcome_claimed_by = NULL,
        outcome_claimed_at = NULL
    WHERE id = v_opponent_recipient_id;
    
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE 'Reset opponent status, rows affected: %', v_update_count;
  END IF;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'message', 'Outcome claim rejected successfully'
  );
END;
$$; 