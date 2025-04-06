-- Force update with a specific recipient and bet ID
-- First, let's verify the current status
SELECT id, bet_id, recipient_id, status 
FROM bet_recipients 
WHERE id = '71a694a2-2166-46bd-902f-99b3600f370f';

-- Log the update attempt to see what happens
DO $$
BEGIN
  RAISE NOTICE 'Starting update of recipient 71a694a2-2166-46bd-902f-99b3600f370f...';
  
  UPDATE bet_recipients
  SET status = 'in_progress'
  WHERE id = '71a694a2-2166-46bd-902f-99b3600f370f';
  
  RAISE NOTICE 'Update completed. Rows affected: %', FOUND;
END $$;

-- Let's see if any triggers exist on the bet_recipients table
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'bet_recipients';

-- Finally, verify if the update was applied
SELECT id, bet_id, recipient_id, status 
FROM bet_recipients 
WHERE id = '71a694a2-2166-46bd-902f-99b3600f370f'; 