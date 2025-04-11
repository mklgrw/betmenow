-- Migration to update existing records to use the new pending_outcome status
-- Run this migration after adding 'pending_outcome' to the RecipientStatus type definition

-- Update recipients that have a pending outcome but still show status 'pending'
UPDATE bet_recipients
SET status = 'pending_outcome'
WHERE pending_outcome IS NOT NULL 
AND status = 'pending';

-- Log information about the change
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  -- Get the count of records updated
  SELECT COUNT(*) INTO v_updated_count
  FROM bet_recipients
  WHERE status = 'pending_outcome';
  
  -- Log the results
  RAISE NOTICE 'Migration complete: Updated % records to status pending_outcome', v_updated_count;
END $$; 