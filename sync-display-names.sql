-- This script syncs display names between auth.users and public.users tables both ways

-- PART 1: Update public.users to match auth.users display names
-- This is for when users have set display names in the Auth UI but not in the custom table
UPDATE public.users
SET display_name = auth.raw_app_meta_data->>'display_name'
FROM auth.users auth
WHERE public.users.id = auth.id
  AND auth.raw_app_meta_data->>'display_name' IS NOT NULL
  AND (public.users.display_name != auth.raw_app_meta_data->>'display_name' OR public.users.display_name IS NULL);

-- PART 2: Update auth.users to match public.users display names
-- This is for when display names were set in the custom table but not in Auth
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                      jsonb_build_object('display_name', public.users.display_name)
FROM public.users
WHERE auth.users.id = public.users.id
  AND public.users.display_name IS NOT NULL
  AND (auth.users.raw_app_meta_data->>'display_name' != public.users.display_name OR auth.users.raw_app_meta_data->>'display_name' IS NULL);

-- PART 3: Create triggers to keep them in sync going forward
-- Create function for syncing display name from auth to public
CREATE OR REPLACE FUNCTION sync_auth_display_name_to_public()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'display_name' IS NOT NULL THEN
    UPDATE public.users
    SET display_name = NEW.raw_app_meta_data->>'display_name'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for syncing display name from public to auth
CREATE OR REPLACE FUNCTION sync_public_display_name_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                          jsonb_build_object('display_name', NEW.display_name)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS on_auth_display_name_change ON auth.users;
DROP TRIGGER IF EXISTS on_public_display_name_change ON public.users;

-- Create trigger on auth.users to sync to public.users
CREATE TRIGGER on_auth_display_name_change
AFTER UPDATE OF raw_app_meta_data ON auth.users
FOR EACH ROW
WHEN (OLD.raw_app_meta_data->>'display_name' IS DISTINCT FROM NEW.raw_app_meta_data->>'display_name')
EXECUTE FUNCTION sync_auth_display_name_to_public();

-- Create trigger on public.users to sync to auth.users
CREATE TRIGGER on_public_display_name_change
AFTER UPDATE OF display_name ON public.users
FOR EACH ROW
WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
EXECUTE FUNCTION sync_public_display_name_to_auth();

-- Verify results
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