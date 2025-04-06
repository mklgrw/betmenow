-- Create a debug log table to track update attempts
CREATE TABLE IF NOT EXISTS debug_updates (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL,
  record_id UUID,
  old_value TEXT,
  new_value TEXT,
  user_id UUID,
  successful BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions on the table
GRANT ALL ON debug_updates TO authenticated;
GRANT ALL ON debug_updates TO anon;
GRANT ALL ON debug_updates TO postgres;
GRANT ALL ON debug_updates TO service_role;

-- Grant permissions on the id sequence
GRANT USAGE, SELECT ON SEQUENCE debug_updates_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE debug_updates_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE debug_updates_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE debug_updates_id_seq TO service_role;

-- Verify the table was created
SELECT EXISTS (
   SELECT FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename  = 'debug_updates'
);

-- View table columns (proper SQL replacement for \d)
SELECT 
   column_name, 
   data_type, 
   is_nullable
FROM 
   information_schema.columns
WHERE 
   table_name = 'debug_updates'
ORDER BY 
   ordinal_position; 