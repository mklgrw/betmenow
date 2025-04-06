-- Function to update a bet's status based on recipient responses
CREATE OR REPLACE FUNCTION update_bet_status_on_recipient_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_recipients INTEGER;
  accepted_recipients INTEGER;
  rejected_recipients INTEGER;
  all_processed BOOLEAN;
BEGIN
  -- Get counts
  SELECT 
    COUNT(*), 
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO 
    total_recipients, 
    accepted_recipients,
    rejected_recipients
  FROM 
    public.bet_recipients
  WHERE 
    bet_id = NEW.bet_id;
  
  -- Check if all recipients have been processed
  all_processed := (total_recipients = accepted_recipients + rejected_recipients);
  
  -- If all rejected, mark bet as rejected
  IF all_processed AND rejected_recipients = total_recipients THEN
    UPDATE public.bets
    SET status = 'rejected'
    WHERE id = NEW.bet_id;
  -- If at least one accepted, mark bet as in_progress
  ELSIF accepted_recipients > 0 THEN
    UPDATE public.bets
    SET status = 'in_progress'
    WHERE id = NEW.bet_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run function after bet_recipients is updated
DROP TRIGGER IF EXISTS update_bet_status_trigger ON public.bet_recipients;
CREATE TRIGGER update_bet_status_trigger
AFTER UPDATE ON public.bet_recipients
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_bet_status_on_recipient_change(); 