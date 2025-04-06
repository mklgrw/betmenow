-- First, directly update all existing auth user metadata
UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object('display_name', u.username)
FROM public.users u
WHERE auth.users.id = u.id
  AND (auth.users.raw_app_meta_data->>'display_name' IS NULL 
       OR auth.users.raw_app_meta_data->>'display_name' = '-');

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION sync_display_name_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the raw_app_meta_data in auth.users with the username as display_name
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                          jsonb_build_object('display_name', NEW.username)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that runs after insert or update on public.users
DROP TRIGGER IF EXISTS sync_display_name ON public.users;
CREATE TRIGGER sync_display_name
AFTER INSERT OR UPDATE OF username ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_display_name_to_auth();

-- Test by selecting some users to verify display names are set
SELECT 
  u.id, 
  u.username, 
  a.raw_app_meta_data->>'display_name' as display_name
FROM 
  public.users u
JOIN 
  auth.users a ON u.id = a.id
LIMIT 10; 