-- Function to delete a bet safely
CREATE OR REPLACE FUNCTION delete_bet(bet_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_deleted BOOLEAN;
BEGIN
  -- Delete bet if it belongs to creator and is pending
  DELETE FROM public.bets 
  WHERE id = bet_id 
  AND creator_id = user_id
  AND status = 'pending';
  
  -- Check if deletion was successful
  SELECT COUNT(*) = 0 INTO is_deleted
  FROM public.bets
  WHERE id = bet_id;
  
  RETURN is_deleted;
END;
$$;

-- Function to add recipients to a bet
CREATE OR REPLACE FUNCTION add_bet_recipients(p_bet_id UUID, p_recipient_ids UUID[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_id UUID;
BEGIN
  -- Create the bet_recipients table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.bet_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bet_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Loop through recipients and add them
  FOREACH recipient_id IN ARRAY p_recipient_ids
  LOOP
    INSERT INTO public.bet_recipients (bet_id, recipient_id)
    VALUES (p_bet_id, recipient_id);
  END LOOP;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding bet recipients: %', SQLERRM;
    RETURN FALSE;
END;
$$; 