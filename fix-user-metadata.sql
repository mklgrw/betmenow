-- This script fixes both raw_user_meta_data and raw_app_meta_data
-- Run this in the Supabase SQL Editor

-- Show current state of both metadata fields
SELECT 
  id, 
  email, 
  raw_app_meta_data->>'display_name' as app_display_name,
  raw_user_meta_data->>'display_name' as user_display_name
FROM 
  auth.users;

-- Update raw_user_meta_data with display_name from public.users
UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    -- When there's no existing metadata, create a new object
    WHEN raw_user_meta_data IS NULL THEN 
      jsonb_build_object('display_name', pu.display_name)
    -- When there is existing metadata, preserve it but replace/add display_name 
    ELSE
      raw_user_meta_data - 'display_name' || jsonb_build_object('display_name', pu.display_name)
  END
FROM public.users pu
WHERE auth.users.id = pu.id;

-- Verify both fields after update
SELECT 
  au.id, 
  au.email, 
  au.raw_app_meta_data->>'display_name' as app_display_name,
  au.raw_user_meta_data->>'display_name' as user_display_name,
  pu.display_name as public_display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email; 