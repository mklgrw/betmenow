-- Create a users table that maps to auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for the users table
-- Everyone can view all users
CREATE POLICY "Users are viewable by everyone" 
ON public.users FOR SELECT 
USING (true);

-- Users can insert their own data
CREATE POLICY "Users can insert their own data" 
ON public.users FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update their own data" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

-- Copy existing users from auth.users to public.users only if they don't exist yet
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at 
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.users.id)
ON CONFLICT (id) DO NOTHING;

-- Update username for existing users ONLY if username is NULL
-- This ensures we don't overwrite usernames that were set during registration
UPDATE public.users
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

-- Copy username to display_name for all users where display_name is NULL
UPDATE public.users
SET display_name = username
WHERE display_name IS NULL;

-- View the users table to verify data
SELECT * FROM public.users; 