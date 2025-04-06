-- Script to manually update a recipient status
-- Replace these values with real values from your database
-- SET @recipient_id = 'actual-recipient-id-here';
-- SET @bet_id = 'actual-bet-id-here';

-- First, check if the recipient exists and what its current status is
SELECT * FROM bet_recipients 
WHERE id = 'replace-with-actual-recipient-id';

-- Then try to update the status directly
UPDATE bet_recipients
SET status = 'in_progress'
WHERE id = 'replace-with-actual-recipient-id'
RETURNING *;

-- Also update the corresponding bet
UPDATE bets
SET status = 'in_progress'
WHERE id = 'replace-with-actual-bet-id'
RETURNING *;

-- Verify the update worked
SELECT * FROM bet_recipients 
WHERE id = 'replace-with-actual-recipient-id';

-- Check the bet status too
SELECT * FROM bets
WHERE id = 'replace-with-actual-bet-id'; 