-- Function to execute SQL directly to create tables
CREATE OR REPLACE FUNCTION create_table_if_not_exists(table_sql TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE table_sql;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error executing SQL: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Function to create users table
CREATE OR REPLACE FUNCTION create_users_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    username TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating users table: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Function to create bets table
CREATE OR REPLACE FUNCTION create_bets_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    stake NUMERIC NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    visibility TEXT DEFAULT 'public',
    status TEXT DEFAULT 'pending',
    creator_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_creator
      FOREIGN KEY(creator_id)
      REFERENCES public.users(id)
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating bets table: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Function to create friendships table
CREATE OR REPLACE FUNCTION create_friendships_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    friend_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user
      FOREIGN KEY(user_id)
      REFERENCES public.users(id),
    CONSTRAINT fk_friend
      FOREIGN KEY(friend_id)
      REFERENCES public.users(id)
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating friendships table: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Function to create bet_recipients table
CREATE OR REPLACE FUNCTION create_bet_recipients_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.bet_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bet_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_bet
      FOREIGN KEY(bet_id)
      REFERENCES public.bets(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipient
      FOREIGN KEY(recipient_id)
      REFERENCES public.users(id)
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating bet_recipients table: %', SQLERRM;
    RETURN FALSE;
END;
$$; 