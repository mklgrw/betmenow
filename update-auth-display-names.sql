-- This script updates auth.users raw_user_meta_data to include display_name
-- It copies the username from your custom users table to the auth metadata

-- First, let's make sure all users in custom table have usernames
UPDATE public.users
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

-- Now update the raw_user_meta_data in auth.users to include display_name
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || 
  jsonb_build_object(
    'display_name', (SELECT username FROM public.users WHERE public.users.id = auth.users.id)
  )
WHERE id IN (SELECT id FROM public.users);

-- Verify the results
SELECT id, email, raw_user_meta_data->'display_name' as display_name 
FROM auth.users
ORDER BY created_at DESC; 