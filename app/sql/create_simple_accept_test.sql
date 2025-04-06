-- Create a simpler function to test accepting a bet
CREATE OR REPLACE FUNCTION test_accept_bet(recipient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  old_status TEXT;
  new_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO old_status FROM bet_recipients WHERE id = recipient_id;
  
  -- Log the current status
  RAISE NOTICE 'Current status for recipient %: %', recipient_id, old_status;
  
  -- Simple direct update
  UPDATE bet_recipients 
  SET status = 'in_progress'
  WHERE id = recipient_id
  RETURNING status INTO new_status;
  
  -- Log the result
  RAISE NOTICE 'Updated status to: %', new_status;
  
  -- Return a result
  result := jsonb_build_object(
    'success', TRUE,
    'old_status', old_status,
    'new_status', new_status
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$;

-- Make the function accessible to all users
GRANT EXECUTE ON FUNCTION test_accept_bet(UUID) TO authenticated, anon;

-- Verify the function exists
SELECT 
  routine_name, 
  routine_type
FROM 
  information_schema.routines
WHERE 
  routine_name = 'test_accept_bet'; 