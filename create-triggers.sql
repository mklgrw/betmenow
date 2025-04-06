-- This script creates triggers to automatically sync display names between auth.users and public.users

-- Function to sync auth.users display_name to public.users
CREATE OR REPLACE FUNCTION sync_auth_to_public_display_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'display_name' IS NOT NULL THEN
    UPDATE public.users
    SET display_name = NEW.raw_app_meta_data->>'display_name'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync public.users display_name to auth.users
CREATE OR REPLACE FUNCTION sync_public_to_auth_display_name()
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
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users to update public.users
DROP TRIGGER IF EXISTS sync_auth_display_name_trigger ON auth.users;
CREATE TRIGGER sync_auth_display_name_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.raw_app_meta_data->>'display_name' IS DISTINCT FROM NEW.raw_app_meta_data->>'display_name')
EXECUTE FUNCTION sync_auth_to_public_display_name();

-- Create trigger on public.users to update auth.users
DROP TRIGGER IF EXISTS sync_public_display_name_trigger ON public.users;
CREATE TRIGGER sync_public_display_name_trigger
AFTER UPDATE ON public.users
FOR EACH ROW
WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
EXECUTE FUNCTION sync_public_to_auth_display_name(); 