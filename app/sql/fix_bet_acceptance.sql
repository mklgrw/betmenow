-- SQL script to fix and test bet acceptance

-- First, examine a specific bet recipient (replace with your actual IDs)
SELECT * 
FROM bet_recipients 
WHERE bet_id = 'REPLACE_WITH_BET_ID' 
AND recipient_id = 'REPLACE_WITH_USER_ID';

-- Manually update a recipient to accepted status
-- UPDATE bet_recipients
-- SET status = 'in_progress'
-- WHERE bet_id = 'REPLACE_WITH_BET_ID' 
-- AND recipient_id = 'REPLACE_WITH_USER_ID'
-- RETURNING *;

-- Verify the trigger function is working
DO $$
BEGIN
    RAISE NOTICE 'Testing trigger function manually';
    
    -- First try a direct query to see if there are any permissions issues
    BEGIN
        UPDATE bet_recipients
        SET status = 'in_progress'
        WHERE id = 'REPLACE_WITH_RECIPIENT_ID'
        AND status != 'in_progress';
        
        RAISE NOTICE 'Direct update succeeded';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Direct update failed: %', SQLERRM;
    END;
END $$; 