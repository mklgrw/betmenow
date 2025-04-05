-- Proper fix for bet rejection issue
-- This file provides a long-term solution by fixing the database schema and constraints

-- 1. First, let's examine current constraints and triggers
DO $$
BEGIN
    RAISE NOTICE 'Starting comprehensive database fix for bet rejection...';
END $$;

-- 2. Create a proper status enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bet_status') THEN
        CREATE TYPE bet_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected', 'cancelled');
        RAISE NOTICE 'Created bet_status enum type';
    ELSE
        -- Check if we need to add 'rejected' to the enum
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'bet_status')
            AND enumlabel = 'rejected'
        ) THEN
            ALTER TYPE bet_status ADD VALUE 'rejected' AFTER 'completed';
            RAISE NOTICE 'Added rejected status to bet_status enum';
        END IF;
    END IF;
END $$;

-- 3. Fix the bets table to use the proper status type and include rejected status
ALTER TABLE IF EXISTS bets 
    DROP CONSTRAINT IF EXISTS bets_status_check;

ALTER TABLE IF EXISTS bets
    ADD CONSTRAINT bets_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));

-- 4. Fix the bet_recipients table to use proper status constraints
ALTER TABLE IF EXISTS bet_recipients 
    DROP CONSTRAINT IF EXISTS bet_recipients_status_check;

ALTER TABLE IF EXISTS bet_recipients
    ADD CONSTRAINT bet_recipients_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));

-- 5. Create or replace a proper trigger function to handle status updates correctly
CREATE OR REPLACE FUNCTION update_bet_status_from_recipients()
RETURNS TRIGGER AS $$
DECLARE
    all_rejected BOOLEAN;
    any_in_progress BOOLEAN;
BEGIN
    -- Check if all recipients rejected the bet
    SELECT 
        (COUNT(*) = COUNT(*) FILTER (WHERE status = 'rejected')) AS all_rejected,
        COUNT(*) FILTER (WHERE status = 'in_progress') > 0 AS any_in_progress
    INTO all_rejected, any_in_progress
    FROM bet_recipients
    WHERE bet_id = NEW.bet_id;
    
    -- If all recipients rejected, mark bet as rejected
    IF all_rejected AND all_rejected IS NOT NULL THEN
        UPDATE bets SET status = 'rejected' WHERE id = NEW.bet_id;
    -- If any recipient accepted (in_progress), mark bet as in_progress
    ELSIF any_in_progress THEN
        UPDATE bets SET status = 'in_progress' WHERE id = NEW.bet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create or replace the trigger
DROP TRIGGER IF EXISTS update_bet_status ON bet_recipients;

CREATE TRIGGER update_bet_status
AFTER UPDATE OF status ON bet_recipients
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_bet_status_from_recipients();

-- 7. Create a proper function to handle bet rejection
CREATE OR REPLACE FUNCTION reject_bet(
    p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_bet_id UUID;
BEGIN
    -- Get bet ID for this recipient
    SELECT bet_id INTO v_bet_id 
    FROM bet_recipients 
    WHERE id = p_recipient_id;
    
    IF v_bet_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update recipient status - trigger will handle bet status
    UPDATE bet_recipients 
    SET status = 'rejected'
    WHERE id = p_recipient_id;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 8. Grant proper permissions
GRANT EXECUTE ON FUNCTION reject_bet(UUID) TO authenticated, anon;

-- 9. Add a proper function for accepting bets
CREATE OR REPLACE FUNCTION accept_bet(
    p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_bet_id UUID;
BEGIN
    -- Get bet ID for this recipient
    SELECT bet_id INTO v_bet_id 
    FROM bet_recipients 
    WHERE id = p_recipient_id;
    
    IF v_bet_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update recipient status - trigger will handle bet status
    UPDATE bet_recipients 
    SET status = 'in_progress'
    WHERE id = p_recipient_id;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error accepting bet: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION accept_bet(UUID) TO authenticated, anon;

-- Return success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema updated successfully for proper bet rejection handling';
END $$; 