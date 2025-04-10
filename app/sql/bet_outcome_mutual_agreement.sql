-- Mutual Agreement System for Bet Outcomes
-- When a user declares a win, it needs confirmation from the counterparty
-- When a user declares a loss, the win is automatically accepted for the other party

-- First, add a column to the bet_recipients table to track pending outcome claims
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS pending_outcome TEXT DEFAULT NULL;
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS outcome_claimed_by UUID DEFAULT NULL;
ALTER TABLE bet_recipients ADD COLUMN IF NOT EXISTS outcome_claimed_at TIMESTAMPTZ DEFAULT NULL;

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
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Log function start and input parameters
  RAISE NOTICE 'secure_declare_bet_outcome started: p_recipient_id=%, p_outcome=%, user_id=%', p_recipient_id, p_outcome, v_user_id;
  
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
  
  -- Get the opposing recipient record
  IF v_is_creator THEN
    -- If user is creator, opponent is the recipient in this record
    v_opponent_recipient_id := p_recipient_id;
    RAISE NOTICE 'User is creator, opponent is the recipient: opponent_id=%', v_opponent_recipient_id;
  ELSE
    -- If user is recipient, opponent is the creator
    SELECT id INTO v_opponent_recipient_id
    FROM bet_recipients
    WHERE bet_id = v_bet_id AND recipient_id = v_creator_id;
    
    RAISE NOTICE 'Looking for creator recipient record: result=%', v_opponent_recipient_id;
    
    -- If no recipient record for creator, use any other recipient
    IF v_opponent_recipient_id IS NULL THEN
      SELECT id INTO v_opponent_recipient_id
      FROM bet_recipients
      WHERE bet_id = v_bet_id AND id != p_recipient_id
      LIMIT 1;
      
      RAISE NOTICE 'No creator recipient record, using any other recipient: result=%', v_opponent_recipient_id;
    END IF;
  END IF;
  
  RAISE NOTICE 'Final opponent recipient ID: %', v_opponent_recipient_id;
  
  -- Handling based on declared outcome
  IF p_outcome = 'lost' THEN
    -- If declaring a loss, automatically mark the current user's recipient as lost
    -- and the opponent's recipient as won
    
    RAISE NOTICE 'Processing LOST outcome. Current user ID=%, recipient ID=%', v_user_id, p_recipient_id;
    
    -- Update current user's status
    UPDATE bet_recipients 
    SET status = 'lost',
        pending_outcome = NULL,
        outcome_claimed_by = v_user_id,
        outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    RAISE NOTICE 'Updated current user status to LOST';
    
    -- Update opponent's status (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      RAISE NOTICE 'Updating opponent (ID=%) status to WON', v_opponent_recipient_id;
      
      UPDATE bet_recipients 
      SET status = 'won',
          pending_outcome = NULL,
          outcome_claimed_by = v_user_id,
          outcome_claimed_at = NOW()
      WHERE id = v_opponent_recipient_id;
      
      RAISE NOTICE 'Opponent status updated successfully';
    ELSE
      RAISE NOTICE 'WARNING: No opponent recipient ID found, skipping opponent update';
    END IF;
    
    -- Update the bet status
    RAISE NOTICE 'Updating bet (ID=%) status to COMPLETED', v_bet_id;
    
    UPDATE bets
    SET status = 'completed'
    WHERE id = v_bet_id;
    
    RAISE NOTICE 'Bet status updated successfully. Transaction complete.';
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'recipient_id', p_recipient_id,
      'bet_id', v_bet_id,
      'message', 'You have acknowledged losing this bet',
      'requires_confirmation', FALSE
    );
    
  ELSIF p_outcome = 'won' THEN
    -- If declaring a win, mark as pending and require confirmation
    
    RAISE NOTICE 'Processing WON outcome for user ID=%', v_user_id;
    
    -- Update current user's pending outcome
    UPDATE bet_recipients 
    SET pending_outcome = 'won',
        outcome_claimed_by = v_user_id,
        outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    RAISE NOTICE 'Updated current user pending_outcome to WON';
    
    -- Update opponent's pending outcome (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      RAISE NOTICE 'Updating opponent (ID=%) pending_outcome to LOST', v_opponent_recipient_id;
      
      UPDATE bet_recipients 
      SET pending_outcome = 'lost',
          outcome_claimed_by = v_user_id,
          outcome_claimed_at = NOW()
      WHERE id = v_opponent_recipient_id;
      
      RAISE NOTICE 'Opponent pending_outcome updated successfully';
    ELSE
      RAISE NOTICE 'WARNING: No opponent recipient ID found, skipping opponent update';
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
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if recipient record exists, user is the recipient, and there's a pending outcome
  SELECT bet_id, pending_outcome INTO v_bet_id, v_pending_outcome
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id AND pending_outcome IS NOT NULL;
  
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
  
  -- Update current user's status
  UPDATE bet_recipients 
  SET status = v_pending_outcome,
      pending_outcome = NULL
  WHERE id = p_recipient_id;
  
  -- Update opponent's status (if found)
  IF v_opponent_recipient_id IS NOT NULL THEN
    UPDATE bet_recipients 
    SET status = CASE WHEN v_pending_outcome = 'lost' THEN 'won' ELSE 'lost' END,
        pending_outcome = NULL
    WHERE id = v_opponent_recipient_id;
  END IF;
  
  -- Update the bet status
  UPDATE bets
  SET status = 'completed'
  WHERE id = v_bet_id;
  
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
  v_pending_outcome TEXT;
  v_opponent_recipient_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if recipient record exists, user is the recipient, and there's a pending outcome
  SELECT bet_id, pending_outcome INTO v_bet_id, v_pending_outcome
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id AND pending_outcome IS NOT NULL;
  
  IF v_bet_id IS NULL OR v_pending_outcome IS NULL THEN
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
  
  -- Clear the pending outcomes
  UPDATE bet_recipients 
  SET pending_outcome = NULL
  WHERE id = p_recipient_id;
  
  -- Clear opponent's pending outcome (if found)
  IF v_opponent_recipient_id IS NOT NULL THEN
    UPDATE bet_recipients 
    SET pending_outcome = NULL
    WHERE id = v_opponent_recipient_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'recipient_id', p_recipient_id,
    'bet_id', v_bet_id,
    'message', 'Outcome claim rejected'
  );
END;
$$; 