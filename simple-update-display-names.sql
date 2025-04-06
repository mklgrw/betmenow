-- Simple script to update display names in auth.users 
-- Updates raw_app_meta_data with display_name from public.users

-- Update auth.users raw_app_meta_data directly
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('display_name', u.username)
FROM public.users u
WHERE auth.users.id = u.id;

-- Verify results
SELECT 
  au.id, 
  au.email, 
  pu.username, 
  au.raw_app_meta_data->>'display_name' as display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email; 