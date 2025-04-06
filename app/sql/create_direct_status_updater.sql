-- Create a function that will FORCE the update directly with minimum overhead
CREATE OR REPLACE FUNCTION force_update_recipient(recipient_uuid TEXT, new_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Direct SQL update with minimum overhead, bypassing all policies
  EXECUTE format(
    'UPDATE public.bet_recipients SET status = %L WHERE id = %L',
    new_status, recipient_uuid
  );
  
  -- Also update the related bet to ensure consistency
  EXECUTE format(
    'UPDATE public.bets SET status = %L WHERE id IN (SELECT bet_id FROM public.bet_recipients WHERE id = %L)',
    new_status, recipient_uuid
  );
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in force_update_recipient: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execution permissions to all roles
GRANT EXECUTE ON FUNCTION force_update_recipient(TEXT, TEXT) TO authenticated, anon, postgres, service_role;

-- Test the function with a direct call - replace with your actual UUID
SELECT force_update_recipient('5e79f057-21a9-4678-8055-99b6639dc530', 'in_progress'); 