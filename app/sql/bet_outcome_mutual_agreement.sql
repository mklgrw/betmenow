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
  
  -- Check if recipient record exists and user is the recipient
  SELECT bet_id INTO v_bet_id
  FROM bet_recipients
  WHERE id = p_recipient_id AND recipient_id = v_user_id;
  
  -- If not found, check if user is the creator of this bet
  IF v_bet_id IS NULL THEN
    SELECT b.id, b.creator_id INTO v_bet_id, v_creator_id
    FROM bet_recipients br
    JOIN bets b ON br.bet_id = b.id
    WHERE br.id = p_recipient_id AND b.creator_id = v_user_id;
    
    IF v_bet_id IS NULL THEN
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
  END IF;
  
  -- Validate outcome
  IF p_outcome NOT IN ('won', 'lost') THEN
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
  ELSE
    -- If user is recipient, opponent is the creator
    SELECT id INTO v_opponent_recipient_id
    FROM bet_recipients
    WHERE bet_id = v_bet_id AND recipient_id = v_creator_id;
    
    -- If no recipient record for creator, use any other recipient
    IF v_opponent_recipient_id IS NULL THEN
      SELECT id INTO v_opponent_recipient_id
      FROM bet_recipients
      WHERE bet_id = v_bet_id AND id != p_recipient_id
      LIMIT 1;
    END IF;
  END IF;
  
  -- Handling based on declared outcome
  IF p_outcome = 'lost' THEN
    -- If declaring a loss, automatically mark the current user's recipient as lost
    -- and the opponent's recipient as won
    
    -- Update current user's status
    UPDATE bet_recipients 
    SET status = 'lost',
        pending_outcome = NULL,
        outcome_claimed_by = v_user_id,
        outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    -- Update opponent's status (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      UPDATE bet_recipients 
      SET status = 'won',
          pending_outcome = NULL,
          outcome_claimed_by = v_user_id,
          outcome_claimed_at = NOW()
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
      'message', 'You have acknowledged losing this bet',
      'requires_confirmation', FALSE
    );
    
  ELSIF p_outcome = 'won' THEN
    -- If declaring a win, mark as pending and require confirmation
    
    -- Update current user's pending outcome
    UPDATE bet_recipients 
    SET pending_outcome = 'won',
        outcome_claimed_by = v_user_id,
        outcome_claimed_at = NOW()
    WHERE id = p_recipient_id;
    
    -- Update opponent's pending outcome (if found)
    IF v_opponent_recipient_id IS NOT NULL THEN
      UPDATE bet_recipients 
      SET pending_outcome = 'lost',
          outcome_claimed_by = v_user_id,
          outcome_claimed_at = NOW()
      WHERE id = v_opponent_recipient_id;
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
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Invalid outcome',
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