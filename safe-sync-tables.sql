-- Verify existing triggers and create them only if they don't exist

-- First, update display names in auth.users from public.users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('display_name', u.username)
FROM public.users u
WHERE auth.users.id = u.id
  AND (
    auth.users.raw_app_meta_data->>'display_name' IS NULL 
    OR auth.users.raw_app_meta_data->>'display_name' = '-'
  );

-- Check trigger function exists and create if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'handle_auth_user_changes'
  ) THEN
    -- Create trigger function
    CREATE OR REPLACE FUNCTION handle_auth_user_changes()
    RETURNS TRIGGER AS $$
    BEGIN
      -- When a user is deleted from auth.users
      IF (TG_OP = 'DELETE') THEN
        -- Delete from public.users
        DELETE FROM public.users WHERE id = OLD.id;
        RETURN OLD;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- Check if trigger exists and create if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'on_auth_user_deleted'
  ) THEN
    -- Create trigger on auth.users
    CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_auth_user_changes();
  END IF;
END $$;

-- Trigger to sync public.users changes to auth.users metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'sync_display_name'
  ) THEN
    -- Create function
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

    -- Create trigger
    CREATE TRIGGER sync_display_name
    AFTER INSERT OR UPDATE OF username ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_display_name_to_auth();
  END IF;
END $$;

-- Verify display names are set correctly
SELECT 
  u.id, 
  u.username,
  a.raw_app_meta_data->>'display_name' as auth_display_name,
  u.display_name as users_display_name
FROM 
  public.users u
JOIN 
  auth.users a ON u.id = a.id
LIMIT 10; 