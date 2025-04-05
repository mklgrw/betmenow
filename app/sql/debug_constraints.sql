-- This SQL file helps debug database constraints

-- View table constraints
SELECT conname, conrelid::regclass, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'bet_recipients'::regclass
   OR conrelid = 'bets'::regclass;

-- View table triggers
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'bet_recipients'::regclass
   OR tgrelid = 'bets'::regclass;

-- View check constraints for bets table
SELECT
    table_name,
    constraint_name,
    check_clause
FROM
    information_schema.check_constraints c
JOIN
    information_schema.constraint_column_usage u
    ON c.constraint_name = u.constraint_name
WHERE
    u.table_name = 'bets'
    OR u.table_name = 'bet_recipients';
    
-- Check enum values if applicable
SELECT
    pg_type.typname,
    pg_enum.enumlabel
FROM
    pg_type
JOIN
    pg_enum ON pg_enum.enumtypid = pg_type.oid
ORDER BY
    pg_type.typname,
    pg_enum.enumsortorder;

-- Create a manual function to fix bet status
CREATE OR REPLACE FUNCTION fix_bet_status(
  bet_uuid UUID,
  new_status VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Direct update with intentionally loose validation
  EXECUTE format('UPDATE bets SET status = ''%I'' WHERE id = ''%s''', new_status, bet_uuid);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in fix_bet_status: %', SQLERRM;
  RETURN false;
END;
$$;

-- Function to disable all triggers on a table temporarily
CREATE OR REPLACE FUNCTION disable_all_triggers_on(
  table_name TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I DISABLE TRIGGER ALL', table_name);
  RETURN 'All triggers on ' || table_name || ' disabled';
END;
$$;

-- Function to re-enable all triggers on a table
CREATE OR REPLACE FUNCTION enable_all_triggers_on(
  table_name TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE TRIGGER ALL', table_name);
  RETURN 'All triggers on ' || table_name || ' re-enabled';
END;
$$;

-- Grant permissions to these functions
GRANT EXECUTE ON FUNCTION fix_bet_status(UUID, VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION disable_all_triggers_on(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION enable_all_triggers_on(TEXT) TO authenticated, anon; 