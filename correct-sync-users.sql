-- This script correctly syncs users between auth.users and public.users tables
-- Run this in the Supabase SQL Editor

-- 1. First, see which users exist in auth but not in public table
SELECT 
  au.id, 
  au.email, 
  au.raw_user_meta_data->>'display_name' as display_name
FROM 
  auth.users au
LEFT JOIN 
  public.users pu ON au.id = pu.id
WHERE 
  pu.id IS NULL;

-- 2. Insert missing users into public.users
INSERT INTO public.users (id, email, username, display_name, created_at)
SELECT 
  au.id, 
  au.email,
  -- Use display_name from metadata if it exists, otherwise extract username from email
  COALESCE(au.raw_user_meta_data->>'display_name', SPLIT_PART(au.email, '@', 1)) as username,
  COALESCE(au.raw_user_meta_data->>'display_name', SPLIT_PART(au.email, '@', 1)) as display_name,
  au.created_at
FROM 
  auth.users au
LEFT JOIN 
  public.users pu ON au.id = pu.id
WHERE 
  pu.id IS NULL;

-- 3. Update display_name in raw_app_meta_data and raw_user_meta_data to match public.users
UPDATE auth.users
SET 
  raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('display_name', pu.display_name)
      ELSE
        raw_app_meta_data - 'display_name' || jsonb_build_object('display_name', pu.display_name)
    END,
  raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('display_name', pu.display_name)
      ELSE
        raw_user_meta_data - 'display_name' || jsonb_build_object('display_name', pu.display_name)
    END
FROM public.users pu
WHERE auth.users.id = pu.id;

-- 4. Create a trigger to automatically add new users to public.users when they register
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger for new user registrations
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- 5. Verify the results
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
  au.created_at DESC; 