-- Add display_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN display_name TEXT;
    END IF;
END $$;

-- Update display_name for existing users (copy from username)
UPDATE public.users
SET display_name = username
WHERE display_name IS NULL;

-- Check the result
SELECT id, username, display_name, email FROM public.users; 