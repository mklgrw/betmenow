-- Grant permissions on the accept_bet function to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION accept_bet(UUID, UUID) TO authenticated, anon;

-- Verify grants
SELECT 
  r.routine_name, 
  p.privilege_type, 
  p.grantee
FROM 
  information_schema.routines r
JOIN 
  information_schema.routine_privileges p ON r.specific_name = p.specific_name
WHERE 
  r.routine_name IN ('accept_bet', 'test_accept_bet')
ORDER BY 
  r.routine_name, p.grantee; 