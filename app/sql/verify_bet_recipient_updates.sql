-- Verify the current state of bet_recipients table
SELECT 
  br.id, 
  br.bet_id, 
  br.recipient_id, 
  br.status, 
  b.status as bet_status,
  b.created_at, 
  u.username as recipient_username
FROM 
  bet_recipients br
JOIN 
  bets b ON br.bet_id = b.id
JOIN 
  users u ON br.recipient_id = u.id
ORDER BY 
  b.created_at DESC
LIMIT 20;

-- Specifically check if any bet with 'in_progress' status has recipient status still as 'pending'
SELECT 
  b.id as bet_id, 
  b.title, 
  b.status as bet_status, 
  br.id as recipient_id,
  br.status as recipient_status,
  u.username as recipient_username
FROM 
  bets b
JOIN 
  bet_recipients br ON b.id = br.bet_id
JOIN 
  users u ON br.recipient_id = u.id
WHERE 
  b.status = 'in_progress' AND br.status = 'pending'
ORDER BY 
  b.created_at DESC;

-- Double check the opposite case - if any 'pending' bet has 'in_progress' recipients
SELECT 
  b.id as bet_id, 
  b.title, 
  b.status as bet_status, 
  br.id as recipient_id,
  br.status as recipient_status,
  u.username as recipient_username
FROM 
  bets b
JOIN 
  bet_recipients br ON b.id = br.bet_id
JOIN 
  users u ON br.recipient_id = u.id
WHERE 
  b.status = 'pending' AND br.status = 'in_progress'
ORDER BY 
  b.created_at DESC; 