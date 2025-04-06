import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { 
  createUsersTable, 
  createBetsTable, 
  createBetRecipientsTable,
  createFriendshipsTable,
  createBetStatusTrigger 
} from '../services/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any, user: User | null }>;
  signOut: () => Promise<void>;
};

const initialState: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  signIn: async () => false,
  signUp: async () => ({ error: null, user: null }),
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(initialState);

export const useAuth = () => useContext(AuthContext);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<{
    user: User | null;
    session: Session | null;
    loading: boolean;
  }>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Check for active session on mount
    console.log('Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session check result:', session ? 'Session found' : 'No session');
      setState(prev => ({
        ...prev,
        session,
        user: session?.user || null,
        loading: false,
      }));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
        setState(prev => ({
          ...prev,
          session,
          user: session?.user || null,
          loading: false,
        }));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      // Try sign in with credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        Alert.alert("Error", error.message);
        return false;
      }

      // Initialize tables needed for the app
      try {
        await initializeTables();
      } catch (e) {
        console.error('Error initializing tables:', e);
        // We'll continue anyway since this is not critical
      }

      return true;
    } catch (e) {
      console.error('Unexpected sign in error:', e);
      Alert.alert("Error", "An unexpected error occurred");
      return false;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    console.log('Attempting to sign up with email:', email, 'and username:', username);
    try {
      // First sign up the user with Supabase Auth with metadata included
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: username // Only set display_name - triggers will handle the rest
          }
        }
      });
      
      if (error) {
        console.error('Sign up error:', error);
        return { error, user: null };
      }
      
      if (data.user) {
        console.log('Auth signup successful, now adding to users table');
        
        // Now add the user to our custom users table with the provided username
        // Note: This might be redundant with the trigger, but keeping as a safety measure
        const { error: userError } = await supabase
          .from('users')
          .upsert({ 
            id: data.user.id,
            username: username,
            display_name: username, // Single source of truth
            email: data.user.email,
            created_at: new Date().toISOString()
          });
        
        if (userError) {
          console.error('Error adding user to users table:', userError);
          // We don't return this error since the auth signup succeeded
        } else {
          console.log('Successfully added user to users table with display_name');
        }
      }
      
      console.log('Sign up result:', error ? `Error: ${String(error)}` : 'Success');
      return { error, user: data?.user || null };
    } catch (err) {
      console.error('Sign up exception:', err);
      return { error: err, user: null };
    }
  };

  const signOut = async () => {
    console.log('Attempting to sign out');
    try {
      await supabase.auth.signOut();
      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        loading: true,
      }));
      console.log('Sign out successful');
    } catch (err) {
      console.error('Sign out exception:', err);
    }
  };

  // Initialize required database tables and triggers
  const initializeTables = async () => {
    try {
      // Create tables (these are idempotent operations)
      console.log('Initializing database tables...');
      
      const { data: usersData, error: usersError } = await createUsersTable();
      console.log('Users table:', usersError || 'created');
      
      const { data: betsData, error: betsError } = await createBetsTable();
      console.log('Bets table:', betsError || 'created');
      
      const { data: recipientsData, error: recipientsError } = await createBetRecipientsTable();
      console.log('Bet recipients table:', recipientsError || 'created');
      
      const { data: friendshipsData, error: friendshipsError } = await createFriendshipsTable();
      console.log('Friendships table:', friendshipsError || 'created');
      
      // Create triggers
      const { data: triggerData, error: triggerError } = await createBetStatusTrigger();
      console.log('Bet status trigger:', triggerError || 'created');
      
      return true;
    } catch (e) {
      console.error('Error initializing tables:', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user: state.user,
      session: state.session,
      loading: state.loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};