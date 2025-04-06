-- This script syncs display names from Auth UI to database tables
-- Run this in the Supabase SQL Editor

-- Show current state of display names
SELECT 
  au.id, 
  au.email, 
  au.raw_user_meta_data->>'display_name' as auth_ui_display_name,  -- This is what shows in Auth UI
  au.raw_app_meta_data->>'display_name' as app_display_name,
  pu.display_name as public_display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email;

-- UPDATE 1: Update public.users with display names from Auth UI (raw_user_meta_data)
UPDATE public.users
SET display_name = au.raw_user_meta_data->>'display_name'
FROM auth.users au
WHERE public.users.id = au.id
  AND au.raw_user_meta_data->>'display_name' IS NOT NULL
  AND public.users.display_name != au.raw_user_meta_data->>'display_name';

-- UPDATE 2: Update raw_app_meta_data with display names from Auth UI (raw_user_meta_data)
UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    WHEN raw_app_meta_data IS NULL THEN 
      jsonb_build_object('display_name', raw_user_meta_data->>'display_name')
    ELSE
      raw_app_meta_data - 'display_name' || jsonb_build_object('display_name', raw_user_meta_data->>'display_name')
  END
WHERE raw_user_meta_data->>'display_name' IS NOT NULL
  AND (
    raw_app_meta_data IS NULL
    OR raw_app_meta_data->>'display_name' IS NULL
    OR raw_app_meta_data->>'display_name' != raw_user_meta_data->>'display_name'
  );

-- Verify changes worked
SELECT 
  au.id, 
  au.email, 
  au.raw_user_meta_data->>'display_name' as auth_ui_display_name,  -- This is what shows in Auth UI
  au.raw_app_meta_data->>'display_name' as app_display_name,
  pu.display_name as public_display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email; 