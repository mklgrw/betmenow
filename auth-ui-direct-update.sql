-- This script directly updates the user_metadata field in auth.users
-- which is what the Auth UI displays and edits
-- Run this in the Supabase SQL Editor

-- First, show current metadata (what we're working with)
SELECT 
  id, 
  email, 
  user_metadata,
  raw_user_meta_data 
FROM 
  auth.users;

-- Update user_metadata directly to match public display names
UPDATE auth.users
SET user_metadata = 
  CASE 
    -- When there's no existing metadata, create a new object
    WHEN user_metadata IS NULL OR user_metadata = '{}'::jsonb THEN 
      jsonb_build_object('display_name', pu.display_name)
    -- When there is existing metadata, preserve it but add/replace display_name
    ELSE
      user_metadata || jsonb_build_object('display_name', pu.display_name)
  END
FROM public.users pu
WHERE auth.users.id = pu.id;

-- Verify changes
SELECT 
  id, 
  email, 
  user_metadata->>'display_name' as ui_display_name,
  raw_user_meta_data->>'display_name' as meta_display_name,
  raw_app_meta_data->>'display_name' as app_display_name 
FROM 
  auth.users; 