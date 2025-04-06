-- This script directly updates the raw_app_meta_data for all auth users
-- Run this in the Supabase SQL Editor

-- Show current state
SELECT 
  id, 
  email, 
  raw_app_meta_data
FROM 
  auth.users;

-- Force update raw_app_meta_data for ALL users, regardless of current state
UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    -- When there's no existing metadata, create a new object
    WHEN raw_app_meta_data IS NULL THEN 
      jsonb_build_object('display_name', pu.display_name)
    -- When there is existing metadata, preserve it but replace/add display_name 
    ELSE
      raw_app_meta_data - 'display_name' || jsonb_build_object('display_name', pu.display_name)
  END
FROM public.users pu
WHERE auth.users.id = pu.id;

-- Verify the changes
SELECT 
  au.id, 
  au.email, 
  au.raw_app_meta_data,
  au.raw_app_meta_data->>'display_name' as auth_display_name,
  pu.display_name as public_display_name
FROM 
  auth.users au
JOIN 
  public.users pu ON au.id = pu.id
ORDER BY 
  au.email; 