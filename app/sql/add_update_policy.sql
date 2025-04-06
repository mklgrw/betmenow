-- Create an UPDATE policy for bet_recipients table
CREATE POLICY update_bet_recipients ON bet_recipients
FOR UPDATE
USING (
  -- Allow recipients to update their own status
  (auth.uid() = recipient_id) OR
  -- Allow creators to update the status
  (auth.uid() IN (
    SELECT creator_id FROM bets WHERE id = bet_id
  ))
);

-- Verify the policy was created
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
  tablename = 'bet_recipients' AND 
  cmd = 'UPDATE'; 