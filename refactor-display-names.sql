-- SINGLE SOURCE OF TRUTH IMPLEMENTATION
-- This script establishes public.users.display_name as the single source of truth
-- and creates triggers to automatically sync display names everywhere else

-- Step 1: Add display_name column to public.users if it doesn't exist already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN display_name TEXT;
        -- Initialize with usernames if available, otherwise use email username part
        UPDATE public.users 
        SET display_name = COALESCE(username, SPLIT_PART(email, '@', 1))
        WHERE display_name IS NULL;
    END IF;
END $$;

-- Step 2: Function to sync from public.users to auth.users metadata fields
CREATE OR REPLACE FUNCTION sync_display_name_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all three metadata fields in auth.users
    UPDATE auth.users
    SET 
        -- Standard user_metadata (what Auth UI shows)
        user_metadata = 
            CASE 
                WHEN user_metadata IS NULL OR user_metadata = '{}'::jsonb THEN 
                    jsonb_build_object('display_name', NEW.display_name)
                ELSE
                    user_metadata - 'display_name' || jsonb_build_object('display_name', NEW.display_name)
            END,
        -- Internal raw_user_meta_data (used by some Supabase features)
        raw_user_meta_data = 
            CASE 
                WHEN raw_user_meta_data IS NULL THEN 
                    jsonb_build_object('display_name', NEW.display_name)
                ELSE
                    raw_user_meta_data - 'display_name' || jsonb_build_object('display_name', NEW.display_name)
            END,
        -- Internal raw_app_meta_data (used by some app features)
        raw_app_meta_data = 
            CASE 
                WHEN raw_app_meta_data IS NULL THEN 
                    jsonb_build_object('display_name', NEW.display_name)
                ELSE
                    raw_app_meta_data - 'display_name' || jsonb_build_object('display_name', NEW.display_name)
            END
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Set up trigger to keep auth metadata in sync whenever display_name changes
DROP TRIGGER IF EXISTS sync_display_name_trigger ON public.users;
CREATE TRIGGER sync_display_name_trigger
AFTER INSERT OR UPDATE OF display_name ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_display_name_to_auth();

-- Step 4: Set up a function and trigger for new Auth users to be added to public.users
CREATE OR REPLACE FUNCTION add_new_auth_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if the user doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        INSERT INTO public.users (
            id, 
            email, 
            username,
            display_name,
            created_at
        ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.user_metadata->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
            COALESCE(NEW.user_metadata->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
            NEW.created_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new Auth user registrations
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION add_new_auth_user_to_public();

-- Run a one-time sync of any missing users from auth.users to public.users
INSERT INTO public.users (id, email, username, display_name, created_at)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.user_metadata->>'display_name', SPLIT_PART(au.email, '@', 1)),
    COALESCE(au.user_metadata->>'display_name', SPLIT_PART(au.email, '@', 1)),
    au.created_at
FROM 
    auth.users au
LEFT JOIN 
    public.users pu ON au.id = pu.id
WHERE 
    pu.id IS NULL;

-- Verify all users exist in public.users
SELECT 
    au.id, 
    au.email, 
    au.user_metadata->>'display_name' as auth_display_name,
    pu.display_name as public_display_name
FROM 
    auth.users au
LEFT JOIN 
    public.users pu ON au.id = pu.id; 