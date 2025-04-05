import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any, user: User | null }>;
  signOut: () => Promise<void>;
};

const initialState: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
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
    console.log('Attempting to sign in with email:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email, 
        password
      });
      console.log('Sign in result:', error ? `Error: ${error.message}` : 'Success');
      return { error };
    } catch (err) {
      console.error('Sign in exception:', err);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('Attempting to sign up with email:', email);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      console.log('Sign up result:', error ? `Error: ${error.message}` : 'Success');
      return { error, user: data?.user || null };
    } catch (err) {
      console.error('Sign up exception:', err);
      return { error: err, user: null };
    }
  };

  const signOut = async () => {
    console.log('Signing out');
    await supabase.auth.signOut();
  };

  const value = {
    ...state,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 