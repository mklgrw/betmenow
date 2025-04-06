-- Drop the previous function if it exists
DROP FUNCTION IF EXISTS debug_update_recipient_status(UUID, TEXT, UUID);

-- Create a fixed version of the debug function
CREATE OR REPLACE FUNCTION debug_update_recipient_status(
  record_id_param UUID,  -- Changed name to avoid ambiguity
  new_status TEXT,
  user_id_param UUID DEFAULT NULL  -- Changed name to avoid ambiguity
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with admin privileges
AS $$
DECLARE
  old_status TEXT;
  success BOOLEAN := FALSE;
  error_msg TEXT;
  result JSONB;
BEGIN
  -- Get the current status - using parameter name that doesn't conflict with column name
  SELECT status INTO old_status 
  FROM bet_recipients 
  WHERE id = record_id_param;  -- Use the renamed parameter
  
  -- Log the update attempt
  INSERT INTO debug_updates 
    (operation, record_id, old_value, new_value, user_id)
  VALUES 
    ('update_recipient_status', record_id_param, old_status, new_status, user_id_param);
  
  -- Try the update
  BEGIN
    UPDATE bet_recipients 
    SET status = new_status
    WHERE id = record_id_param;  -- Use the renamed parameter
    
    success := TRUE;
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    success := FALSE;
  END;
  
  -- Update the debug record with the result
  UPDATE debug_updates
  SET 
    successful = success,
    error_message = error_msg
  WHERE 
    record_id = record_id_param AND  -- Use the renamed parameter
    operation = 'update_recipient_status' AND
    created_at = (
      SELECT MAX(created_at) 
      FROM debug_updates 
      WHERE record_id = record_id_param AND operation = 'update_recipient_status'
    );
  
  -- Return the result
  result := jsonb_build_object(
    'success', success,
    'old_status', old_status,
    'new_status', new_status,
    'error', error_msg
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions on this function
GRANT EXECUTE ON FUNCTION debug_update_recipient_status(UUID, TEXT, UUID) TO authenticated, anon;

-- Test the function with a specific recipient ID
-- Replace these IDs with actual values from your database
SELECT debug_update_recipient_status(
  '5e79f057-21a9-4678-8055-99b6639dc530',  -- replace with actual recipient ID
  'in_progress',
  '38ec4efd-230b-4f9f-9f4b-d37a21f99415'   -- replace with the user ID
); 