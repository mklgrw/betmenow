-- Check the table structure and constraints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bet_recipients' AND column_name = 'status';

-- Check if there are any check constraints on the status column
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    cc.check_clause
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE 
    tc.table_name = 'bet_recipients' AND
    tc.constraint_type = 'CHECK' AND
    cc.check_clause LIKE '%status%';

-- Check if there's an enum type definition for status
SELECT
    t.typname,
    e.enumlabel
FROM
    pg_type t
JOIN
    pg_enum e ON t.oid = e.enumtypid
WHERE
    t.typname = 'bet_status' OR
    t.typname LIKE '%status%';

-- Check table definition from pg_tables
SELECT
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM
    pg_tables
WHERE
    tablename = 'bet_recipients'; 