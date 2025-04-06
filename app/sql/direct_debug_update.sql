-- First, let's check the structure of the bet_recipients table
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM 
  information_schema.columns 
WHERE 
  table_name = 'bet_recipients';

-- Create a debug log table to track update attempts
CREATE TABLE IF NOT EXISTS debug_updates (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL,
  record_id UUID,
  old_value TEXT,
  new_value TEXT,
  user_id UUID,
  successful BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update a recipient status with debug logging
CREATE OR REPLACE FUNCTION debug_update_recipient_status(
  recipient_id UUID, 
  new_status TEXT,
  user_id UUID DEFAULT NULL
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
  -- Get the current status
  SELECT status INTO old_status 
  FROM bet_recipients 
  WHERE id = recipient_id;
  
  -- Log the update attempt
  INSERT INTO debug_updates 
    (operation, record_id, old_value, new_value, user_id)
  VALUES 
    ('update_recipient_status', recipient_id, old_status, new_status, user_id);
  
  -- Try the update
  BEGIN
    UPDATE bet_recipients 
    SET status = new_status
    WHERE id = recipient_id;
    
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
    record_id = recipient_id AND
    operation = 'update_recipient_status' AND
    created_at = (
      SELECT MAX(created_at) 
      FROM debug_updates 
      WHERE record_id = recipient_id AND operation = 'update_recipient_status'
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
  '5e79f057-21a9-4678-8055-99b6639dc530', -- replace with actual recipient ID
  'in_progress', 
  '38ec4efd-230b-4f9f-9f4b-d37a21f99415'  -- replace with the user ID
);

-- Check the debug log
SELECT * FROM debug_updates ORDER BY created_at DESC LIMIT 10; 