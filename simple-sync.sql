-- This script directly syncs display names between auth.users and public.users tables in both directions

-- PART 1: Update auth.users raw_app_meta_data with display_name from public.users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                      jsonb_build_object('display_name', pu.display_name)
FROM public.users pu
WHERE auth.users.id = pu.id
  AND pu.display_name IS NOT NULL;

-- PART 2: Update public.users display_name with display_name from auth.users raw_app_meta_data
UPDATE public.users
SET display_name = au.raw_app_meta_data->>'display_name'
FROM auth.users au
WHERE public.users.id = au.id
  AND au.raw_app_meta_data->>'display_name' IS NOT NULL
  AND au.raw_app_meta_data->>'display_name' != public.users.display_name;

-- Show verification results
SELECT 
  au.id, 
  au.email, 
  au.raw_app_meta_data->>'display_name' as auth_display_name,
  pu.display_name as public_display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email; 