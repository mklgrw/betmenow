-- Repopulate public.users table from auth.users
-- Run this in your Supabase SQL Editor

-- First copy all auth users to the public.users table
INSERT INTO public.users (id, email, username, display_name, created_at)
SELECT 
  id, 
  email,
  -- Extract username from email (before @)
  SPLIT_PART(email, '@', 1) as username,
  -- Use the same value for display_name
  SPLIT_PART(email, '@', 1) as display_name,
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Update auth.users to include display_name in metadata
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('display_name', SPLIT_PART(email, '@', 1))
WHERE raw_app_meta_data->>'display_name' IS NULL
   OR raw_app_meta_data->>'display_name' = '-';

-- Verify users were created
SELECT id, email, username, display_name FROM public.users;

-- Verify auth display names
SELECT id, email, raw_app_meta_data->>'display_name' as display_name FROM auth.users; 