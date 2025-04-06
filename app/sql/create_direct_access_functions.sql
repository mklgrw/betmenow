-- Create a function to get bet by ID directly bypassing RLS
CREATE OR REPLACE FUNCTION get_bet_by_id(bet_id_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT 
    row_to_json(b)::JSONB INTO result
  FROM 
    public.bets b
  WHERE 
    b.id = bet_id_param::UUID;
    
  IF result IS NULL THEN
    RAISE NOTICE 'No bet found with ID %', bet_id_param;
    RETURN NULL;
  END IF;
  
  -- Add creator info
  SELECT 
    result || jsonb_build_object(
      'creator', 
      (SELECT row_to_json(u) FROM public.users u WHERE u.id = (result->>'creator_id')::UUID)
    ) INTO result;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_bet_by_id: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Create a function to get recipients for a bet directly bypassing RLS
CREATE OR REPLACE FUNCTION get_recipients_for_bet(bet_id_param TEXT)
RETURNS JSONB[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  results JSONB[];
BEGIN
  SELECT 
    array_agg(
      (row_to_json(br)::JSONB || 
       jsonb_build_object(
         'recipient', 
         (SELECT row_to_json(u) FROM public.users u WHERE u.id = br.recipient_id)
       )
      )
    ) INTO results
  FROM 
    public.bet_recipients br
  WHERE 
    br.bet_id = bet_id_param::UUID;
  
  RETURN COALESCE(results, '{}');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_recipients_for_bet: %', SQLERRM;
  RETURN '{}';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_bet_by_id(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_recipients_for_bet(TEXT) TO authenticated, anon;

-- Test the functions
SELECT get_bet_by_id('71a694a2-2166-46bd-902f-99b3600f370f'); -- Replace with actual bet ID 