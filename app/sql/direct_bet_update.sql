-- Super direct function to update a bet and recipient status
-- This avoids all relationship issues
CREATE OR REPLACE FUNCTION direct_update_bet_status(
  p_recipient_id UUID,
  p_bet_id UUID,
  p_status TEXT DEFAULT 'in_progress' 
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with admin privileges
AS $$
BEGIN
  -- Validate recipient exists and belongs to this bet
  if not exists (
    select 1 from bet_recipients 
    where id = p_recipient_id and bet_id = p_bet_id
  ) then
    return false;
  end if;
  
  -- Update the recipient status
  UPDATE bet_recipients 
  SET status = p_status
  WHERE id = p_recipient_id;

  -- If we're setting to 'in_progress', update main bet status too
  if p_status = 'in_progress' then
    UPDATE bets
    SET status = 'in_progress'
    WHERE id = p_bet_id;
  end if;

  -- If we're setting to 'rejected', we DON'T change main bet status
  -- since other recipients may still want to accept
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating bet and recipient: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execute permissions to all users
GRANT EXECUTE ON FUNCTION direct_update_bet_status(UUID, UUID, TEXT) TO authenticated, anon; 

-- Direct function to update bet recipient status and handle appropriate bet status changes
CREATE OR REPLACE FUNCTION direct_update_bet_status(
  p_recipient_id UUID,
  p_bet_id UUID,
  p_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with admin privileges
AS $$
DECLARE
  v_success BOOLEAN := FALSE;
BEGIN
  -- Validate recipient exists and belongs to this bet
  IF NOT EXISTS (
    SELECT 1 FROM bet_recipients 
    WHERE id = p_recipient_id AND bet_id = p_bet_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = p_status
  WHERE id = p_recipient_id;
  
  -- If we're setting to 'in_progress', update main bet status too
  IF p_status = 'in_progress' THEN
    UPDATE bets
    SET status = 'in_progress' 
    WHERE id = p_bet_id;
  END IF;
  
  -- If we're setting to 'rejected', we DON'T change main bet status
  -- since other recipients may still want to accept
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating bet and recipient: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Specific function for handling rejections
CREATE OR REPLACE FUNCTION reject_bet_recipient(
  p_recipient_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with admin privileges
AS $$
DECLARE
  v_bet_id UUID;
BEGIN
  -- First, get the bet_id from the recipient
  SELECT bet_id INTO v_bet_id 
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  IF v_bet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Simply update the recipient status to 'rejected'
  -- Do NOT touch the main bet status
  UPDATE bet_recipients 
  SET status = 'rejected'
  WHERE id = p_recipient_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execute permissions to everyone
GRANT EXECUTE ON FUNCTION direct_update_bet_status(UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reject_bet_recipient(UUID) TO authenticated, anon; 