import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase credentials
const supabaseUrl = 'https://hjuggbuiobpxdlgkbcph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqdWdnYnVpb2JweGRsZ2tiY3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjgyODYsImV4cCI6MjA1OTQwNDI4Nn0.vQ3gUz7QIJqctxeWpJx1ngzs4qomiEVDk501HlvC9Y4';

console.log('Supabase initialization with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Test the connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connection established successfully');
  }
}); 