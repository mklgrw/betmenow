-- SQL script to help debug bet recipient status changes

-- 1. View all bet recipients and their statuses
SELECT
    br.id as recipient_id,
    br.bet_id,
    br.recipient_id as user_id,
    br.status as recipient_status,
    b.status as bet_status,
    b.description as bet_description
FROM
    bet_recipients br
JOIN
    bets b ON br.bet_id = b.id
ORDER BY
    br.created_at DESC
LIMIT 20;

-- 2. Test updating a specific recipient status
-- Replace RECIPIENT_ID with the actual ID
/*
UPDATE bet_recipients
SET status = 'in_progress'
WHERE id = 'RECIPIENT_ID'
RETURNING *;
*/

-- 3. Check if the trigger is working by examining function definition
SELECT
    pg_get_functiondef(oid) as function_definition
FROM
    pg_proc
WHERE
    proname = 'update_bet_status_on_recipient_change';

-- 4. Check if the trigger is properly attached to the bet_recipients table
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM
    information_schema.triggers
WHERE
    event_object_table = 'bet_recipients';

-- 5. Check for any row-level security policies that might be interfering
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
WHERE
    tablename = 'bet_recipients'; 