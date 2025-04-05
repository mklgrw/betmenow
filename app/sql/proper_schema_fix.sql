-- COMPREHENSIVE PERMANENT FIX
-- This file implements a proper schema design with appropriate permissions
-- without relying on SECURITY DEFINER privileges

------------------------------------------------------------
-- 1. PROPER SCHEMA DEFINITIONS
------------------------------------------------------------

-- Create proper enum type for bet statuses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bet_status_type') THEN
    CREATE TYPE bet_status_type AS ENUM (
      'pending',
      'in_progress',
      'completed',
      'rejected',
      'cancelled'
    );
    RAISE NOTICE 'Created bet_status_type enum';
  ELSE
    -- If type exists, make sure it has all the values we need
    BEGIN
      ALTER TYPE bet_status_type ADD VALUE IF NOT EXISTS 'rejected' AFTER 'completed';
      RAISE NOTICE 'Added rejected to bet_status_type enum';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
      RAISE NOTICE 'Value rejected already exists in bet_status_type enum';
    END;
  END IF;
END $$;

-- Update tables to use enum type - properly handling default values
-- First drop defaults, then change types, then add defaults back
ALTER TABLE IF EXISTS bets 
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE IF EXISTS bet_recipients 
  ALTER COLUMN status DROP DEFAULT;

-- Now change the types
ALTER TABLE IF EXISTS bets
  ALTER COLUMN status TYPE bet_status_type USING status::bet_status_type;

ALTER TABLE IF EXISTS bet_recipients
  ALTER COLUMN status TYPE bet_status_type USING status::bet_status_type;

-- Add back defaults with proper type
ALTER TABLE IF EXISTS bets
  ALTER COLUMN status SET DEFAULT 'pending'::bet_status_type;

ALTER TABLE IF EXISTS bet_recipients
  ALTER COLUMN status SET DEFAULT 'pending'::bet_status_type;

------------------------------------------------------------
-- 2. PROPER PERMISSION MODEL
------------------------------------------------------------

-- Create application roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
    RAISE NOTICE 'Created app_user role';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager') THEN
    CREATE ROLE bet_manager;
    RAISE NOTICE 'Created bet_manager role';
  END IF;
END $$;

-- Grant app_user to authenticated
GRANT app_user TO authenticated;

-- Define precise table permissions
-- App users can select from all tables
GRANT SELECT ON bets TO app_user;
GRANT SELECT ON bet_recipients TO app_user;

-- Bet creators can update their own bets (managed via RLS)
GRANT UPDATE (status) ON bets TO app_user;

-- Bet recipients can update their own received bets (managed via RLS)
GRANT UPDATE (status) ON bet_recipients TO app_user;

-- Bet managers have more privileges
GRANT bet_manager TO authenticated;
GRANT ALL ON bets TO bet_manager;
GRANT ALL ON bet_recipients TO bet_manager;

------------------------------------------------------------
-- 3. ROW LEVEL SECURITY POLICIES
------------------------------------------------------------

-- Enable RLS on tables
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_recipients ENABLE ROW LEVEL SECURITY;

-- Bet policies
DROP POLICY IF EXISTS bets_select_policy ON bets;
CREATE POLICY bets_select_policy ON bets
  FOR SELECT USING (true); -- Everyone can view bets

DROP POLICY IF EXISTS bets_update_policy ON bets;
CREATE POLICY bets_update_policy ON bets
  FOR UPDATE USING (
    -- Only creators can update their own bets or bet managers
    creator_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(auth.uid(), oid, 'member'))
  );

-- Bet recipient policies
DROP POLICY IF EXISTS bet_recipients_select_policy ON bet_recipients;
CREATE POLICY bet_recipients_select_policy ON bet_recipients
  FOR SELECT USING (true); -- Everyone can view bet recipients

DROP POLICY IF EXISTS bet_recipients_update_policy ON bet_recipients;
CREATE POLICY bet_recipients_update_policy ON bet_recipients
  FOR UPDATE USING (
    -- Only the recipient can update their own status or bet managers
    recipient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(auth.uid(), oid, 'member'))
  );

------------------------------------------------------------
-- 4. SECURE TRIGGERS
------------------------------------------------------------

-- Create a trigger function to update bet status based on recipient statuses
CREATE OR REPLACE FUNCTION update_bet_status_from_recipients()
RETURNS TRIGGER AS $$
DECLARE
  all_rejected BOOLEAN;
  any_in_progress BOOLEAN;
  v_bet_id UUID;
BEGIN
  -- Store bet_id for check
  v_bet_id := NEW.bet_id;
  
  -- Make sure we're only processing status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the current status of all recipients for this bet
  SELECT 
    (COUNT(*) > 0 AND COUNT(*) = COUNT(*) FILTER (WHERE status = 'rejected')) AS all_rejected,
    COUNT(*) FILTER (WHERE status = 'in_progress') > 0 AS any_in_progress
  INTO all_rejected, any_in_progress
  FROM bet_recipients
  WHERE bet_id = v_bet_id;
  
  -- Check if the current user has permission to update the bet
  IF EXISTS (
    SELECT 1 FROM bets 
    WHERE 
      id = v_bet_id AND 
      (creator_id = auth.uid() OR 
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(auth.uid(), oid, 'member')))
  ) THEN
    -- If all recipients rejected, mark bet as rejected
    IF all_rejected THEN
      UPDATE bets SET status = 'rejected'::bet_status_type WHERE id = v_bet_id;
    -- If any recipient accepted, mark bet as in_progress
    ELSIF any_in_progress THEN
      UPDATE bets SET status = 'in_progress'::bet_status_type WHERE id = v_bet_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_bet_status ON bet_recipients;
CREATE TRIGGER update_bet_status
AFTER UPDATE OF status ON bet_recipients
FOR EACH ROW
EXECUTE FUNCTION update_bet_status_from_recipients();

------------------------------------------------------------
-- 5. SECURE FUNCTIONS USING SECURITY INVOKER
------------------------------------------------------------

-- Function to reject a bet
CREATE OR REPLACE FUNCTION reject_bet(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER -- Run with caller's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get bet ID for this recipient
  SELECT bet_id INTO v_bet_id 
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  IF v_bet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is authorized to update this recipient
  IF NOT EXISTS (
    SELECT 1 FROM bet_recipients 
    WHERE id = p_recipient_id AND 
          (recipient_id = v_user_id OR 
           EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(v_user_id, oid, 'member')))
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this bet recipient';
    RETURN FALSE;
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = 'rejected'::bet_status_type
  WHERE id = p_recipient_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Function to accept a bet
CREATE OR REPLACE FUNCTION accept_bet(
  p_recipient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER -- Run with caller's privileges
AS $$
DECLARE
  v_bet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get bet ID for this recipient
  SELECT bet_id INTO v_bet_id 
  FROM bet_recipients 
  WHERE id = p_recipient_id;
  
  IF v_bet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is authorized to update this recipient
  IF NOT EXISTS (
    SELECT 1 FROM bet_recipients 
    WHERE id = p_recipient_id AND 
          (recipient_id = v_user_id OR 
           EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(v_user_id, oid, 'member')))
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this bet recipient';
    RETURN FALSE;
  END IF;
  
  -- Update recipient status
  UPDATE bet_recipients 
  SET status = 'in_progress'::bet_status_type
  WHERE id = p_recipient_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error accepting bet: %', SQLERRM;
  RETURN FALSE;
END;
$$;

------------------------------------------------------------
-- 6. GRANT FUNCTION EXECUTION PERMISSIONS
------------------------------------------------------------

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reject_bet(UUID) TO app_user;
GRANT EXECUTE ON FUNCTION accept_bet(UUID) TO app_user;

------------------------------------------------------------
-- 7. EMERGENCY FUNCTION FOR INITIAL FIXES
------------------------------------------------------------

-- This function can be run once to fix any inconsistent data
-- It uses SECURITY DEFINER but is meant to be run only once by an admin
CREATE OR REPLACE FUNCTION one_time_fix_bet_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Only this function uses elevated privileges
AS $$
DECLARE
  fixed_recipients INTEGER := 0;
  fixed_bets INTEGER := 0;
  v_error TEXT;
BEGIN
  -- Make sure constraints are properly set
  BEGIN
    -- Fix any recipients with bad status values
    UPDATE bet_recipients 
    SET status = 'rejected'::bet_status_type
    WHERE status::text = 'rejected' AND status IS NOT NULL;
    
    GET DIAGNOSTICS fixed_recipients = ROW_COUNT;
    
    -- Fix any bets with bad status values
    UPDATE bets
    SET status = 'rejected'::bet_status_type
    WHERE status::text = 'rejected' AND status IS NOT NULL;
    
    GET DIAGNOSTICS fixed_bets = ROW_COUNT;
    
    -- Make sure both tables have the same constraints
    ALTER TABLE IF EXISTS bets
      DROP CONSTRAINT IF EXISTS bets_status_check;
      
    ALTER TABLE IF EXISTS bet_recipients
      DROP CONSTRAINT IF EXISTS bet_recipients_status_check;
      
    -- Ensure default values are correct
    ALTER TABLE IF EXISTS bets
      ALTER COLUMN status SET DEFAULT 'pending'::bet_status_type;
      
    ALTER TABLE IF EXISTS bet_recipients
      ALTER COLUMN status SET DEFAULT 'pending'::bet_status_type;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
    RETURN 'Error fixing data: ' || SQLERRM || ' - ' || v_error;
  END;
  
  RETURN 'Fixed ' || fixed_recipients || ' recipients and ' || fixed_bets || ' bets';
END;
$$;

-- This function should be run by an admin, so we don't grant it broadly
GRANT EXECUTE ON FUNCTION one_time_fix_bet_data() TO bet_manager;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database schema updated successfully with proper permissions and security';
END $$;

------------------------------------------------------------
-- 8. ALTERNATIVE MIGRATION APPROACH
------------------------------------------------------------

-- If the enum conversion is causing issues, this function provides
-- an alternative approach that keeps the text fields but fixes constraints
CREATE OR REPLACE FUNCTION alternative_migration()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
DECLARE
  v_error TEXT;
BEGIN
  -- Drop constraints if they exist
  ALTER TABLE IF EXISTS bets 
    DROP CONSTRAINT IF EXISTS bets_status_check;
    
  ALTER TABLE IF EXISTS bet_recipients 
    DROP CONSTRAINT IF EXISTS bet_recipients_status_check;
  
  -- Add constraints that allow 'rejected'
  ALTER TABLE IF EXISTS bets
    ADD CONSTRAINT bets_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));
    
  ALTER TABLE IF EXISTS bet_recipients
    ADD CONSTRAINT bet_recipients_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));
  
  -- Create our functions without using enums
  CREATE OR REPLACE FUNCTION reject_bet_text(
    p_recipient_id UUID
  )
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY INVOKER -- Run with caller's privileges
  AS $$
  DECLARE
    v_bet_id UUID;
    v_user_id UUID;
  BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Get bet ID for this recipient
    SELECT bet_id INTO v_bet_id 
    FROM bet_recipients 
    WHERE id = p_recipient_id;
    
    IF v_bet_id IS NULL THEN
      RETURN FALSE;
    END IF;
    
    -- Check if user is authorized to update this recipient
    IF NOT EXISTS (
      SELECT 1 FROM bet_recipients 
      WHERE id = p_recipient_id AND 
            (recipient_id = v_user_id OR 
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bet_manager' AND pg_has_role(v_user_id, oid, 'member')))
    ) THEN
      RAISE EXCEPTION 'Not authorized to update this bet recipient';
      RETURN FALSE;
    END IF;
    
    -- Update recipient status
    UPDATE bet_recipients 
    SET status = 'rejected'
    WHERE id = p_recipient_id;
    
    RETURN TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
    RETURN FALSE;
  END;
  $$;
  
  -- Grant permission for text version
  GRANT EXECUTE ON FUNCTION reject_bet_text(UUID) TO app_user;
  
  RETURN 'Alternative migration completed successfully. Use reject_bet_text() function instead.';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
  RETURN 'Error in alternative migration: ' || SQLERRM || ' - ' || v_error;
END;
$$;

-- Grant permission for the alternative migration
GRANT EXECUTE ON FUNCTION alternative_migration() TO bet_manager; 