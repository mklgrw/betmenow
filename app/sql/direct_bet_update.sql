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