-- This script fixes the display_name in auth.users.raw_app_meta_data
-- Run this in the Supabase SQL Editor

-- First, let's see what we have now
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

-- Now update the raw_app_meta_data for all auth users where display_name is missing or doesn't match
UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    -- When raw_app_meta_data is null, create a new JSON with display_name
    WHEN raw_app_meta_data IS NULL THEN 
      jsonb_build_object('display_name', pu.display_name)
    -- When raw_app_meta_data exists but doesn't have display_name, add it  
    WHEN raw_app_meta_data->>'display_name' IS NULL THEN
      raw_app_meta_data || jsonb_build_object('display_name', pu.display_name)
    -- When display_name exists but doesn't match public.users, update it
    ELSE
      raw_app_meta_data - 'display_name' || jsonb_build_object('display_name', pu.display_name)
  END
FROM public.users pu
WHERE auth.users.id = pu.id
  AND (
    raw_app_meta_data IS NULL 
    OR raw_app_meta_data->>'display_name' IS NULL
    OR raw_app_meta_data->>'display_name' != pu.display_name
  );

-- Finally, check the results to confirm
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