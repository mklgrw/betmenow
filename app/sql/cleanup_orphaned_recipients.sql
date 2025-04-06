-- Step 1: Delete orphaned records in bet_recipients table
DELETE FROM bet_recipients
WHERE NOT EXISTS (
    SELECT 1 FROM bets WHERE bets.id = bet_recipients.bet_id
);

-- Step 2: Add proper ON DELETE CASCADE constraint
-- First drop the existing constraint if it exists
ALTER TABLE bet_recipients DROP CONSTRAINT IF EXISTS fk_bet;

-- Add the constraint back with ON DELETE CASCADE
ALTER TABLE bet_recipients
ADD CONSTRAINT fk_bet
FOREIGN KEY (bet_id) 
REFERENCES bets(id)
ON DELETE CASCADE;

-- Log results
DO $$
DECLARE
    recipient_count INT;
    bet_count INT;
BEGIN
    SELECT COUNT(*) INTO recipient_count FROM bet_recipients;
    SELECT COUNT(*) INTO bet_count FROM bets;
    
    RAISE NOTICE 'Cleanup complete. Remaining records: % bet_recipients, % bets', 
                 recipient_count, bet_count;
END $$; 