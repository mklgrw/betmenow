-- SQL script to remove the redundant recipient_ids column from bets table

-- First, ensure all existing data is migrated (this is a safeguard even though all bets are reportedly deleted)
DO $$
DECLARE
    bet RECORD;
    recipient_id TEXT;
BEGIN
    -- Loop through all bets that have recipient_ids
    FOR bet IN SELECT id, recipient_ids FROM bets WHERE recipient_ids IS NOT NULL AND array_length(recipient_ids, 1) > 0
    LOOP
        -- For each recipient ID in the array
        FOREACH recipient_id IN ARRAY bet.recipient_ids
        LOOP
            -- Insert into bet_recipients if not already exists
            INSERT INTO bet_recipients (bet_id, recipient_id, status)
            VALUES (bet.id, recipient_id, 'pending')
            ON CONFLICT (bet_id, recipient_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Drop the existing RLS policy that depends on recipient_ids
DROP POLICY IF EXISTS "Private bets are viewable by creator and recipients" ON bets;

-- Create a new replacement policy using the bet_recipients table
CREATE POLICY "Private bets are viewable by creator and recipients (updated)" ON bets
FOR SELECT
USING (
    visibility = 'public'
    OR auth.uid() = creator_id
    OR EXISTS (
        SELECT 1 FROM bet_recipients
        WHERE bet_recipients.bet_id = bets.id
        AND bet_recipients.recipient_id = auth.uid()
    )
);

-- Now we can safely remove the column
ALTER TABLE bets DROP COLUMN IF EXISTS recipient_ids; 