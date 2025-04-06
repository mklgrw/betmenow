-- Create a function to handle the bet acceptance process
CREATE OR REPLACE FUNCTION accept_bet(recipient_id UUID, bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
DECLARE
  result JSONB;
  recipient_record RECORD;
  bet_record RECORD;
  updated_recipient RECORD;
  updated_bet RECORD;
BEGIN
  -- Log the function call
  RAISE NOTICE 'accept_bet called with recipient_id % and bet_id %', recipient_id, bet_id;
  
  -- First, check if the recipient exists
  SELECT * INTO recipient_record FROM bet_recipients WHERE id = recipient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient with ID % not found', recipient_id;
  END IF;
  
  -- Check if the bet exists
  SELECT * INTO bet_record FROM bets WHERE id = bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet with ID % not found', bet_id;
  END IF;
  
  -- Log current statuses
  RAISE NOTICE 'Current recipient status: %, Current bet status: %', 
    recipient_record.status, bet_record.status;
  
  -- Update the recipient status
  UPDATE bet_recipients 
  SET status = 'in_progress' 
  WHERE id = recipient_id
  RETURNING * INTO updated_recipient;
  
  -- Log the recipient update 
  RAISE NOTICE 'Updated recipient status to: %', updated_recipient.status;
  
  -- Update the bet status
  UPDATE bets 
  SET status = 'in_progress' 
  WHERE id = bet_id
  RETURNING * INTO updated_bet;
  
  -- Log the bet update
  RAISE NOTICE 'Updated bet status to: %', updated_bet.status;
  
  -- Return success with details
  result := jsonb_build_object(
    'success', true,
    'recipient_status', updated_recipient.status,
    'bet_status', updated_bet.status,
    'timestamp', now()
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log and return any errors
  RAISE NOTICE 'Error in accept_bet: %', SQLERRM;
  
  result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$; 