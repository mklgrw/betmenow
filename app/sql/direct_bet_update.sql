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
  -- Update the recipient status
  UPDATE bet_recipients 
  SET status = p_status
  WHERE id = p_recipient_id;

  -- Update the bet status 
  UPDATE bets
  SET status = p_status
  WHERE id = p_bet_id;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating bet and recipient: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execute permissions to all users
GRANT EXECUTE ON FUNCTION direct_update_bet_status(UUID, UUID, TEXT) TO authenticated, anon; 