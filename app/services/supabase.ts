import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

// Function to create a table directly using SQL
export const createTableWithSQL = async (tableSql: string) => {
  return supabase.rpc('create_table_if_not_exists', { table_sql: tableSql });
};

// Function to create users table if it doesn't exist
export const createUsersTable = async () => {
  return supabase.rpc('create_users_table');
};

// Function to create bets table if it doesn't exist
export const createBetsTable = async () => {
  return supabase.rpc('create_bets_table');
};

// Function to create friendships table if it doesn't exist
export const createFriendshipsTable = async () => {
  return supabase.rpc('create_friendships_table');
};

// Function to create bet_recipients table if it doesn't exist
export const createBetRecipientsTable = async () => {
  return supabase.rpc('create_bet_recipients_table');
};

// Function to create bet status update trigger
export const createBetStatusTrigger = async () => {
  const triggerSQL = `
  -- Function to update a bet's status based on recipient responses
  CREATE OR REPLACE FUNCTION update_bet_status_on_recipient_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    total_recipients INTEGER;
    accepted_recipients INTEGER;
    rejected_recipients INTEGER;
    all_processed BOOLEAN;
  BEGIN
    -- Get counts
    SELECT 
      COUNT(*), 
      COUNT(*) FILTER (WHERE status = 'in_progress'),
      COUNT(*) FILTER (WHERE status = 'rejected')
    INTO 
      total_recipients, 
      accepted_recipients,
      rejected_recipients
    FROM 
      public.bet_recipients
    WHERE 
      bet_id = NEW.bet_id;
    
    -- Check if all recipients have been processed
    all_processed := (total_recipients = accepted_recipients + rejected_recipients);
    
    -- If all rejected, mark bet as rejected
    IF all_processed AND rejected_recipients = total_recipients THEN
      UPDATE public.bets
      SET status = 'rejected'
      WHERE id = NEW.bet_id;
    -- If at least one accepted, mark bet as in_progress
    ELSIF accepted_recipients > 0 THEN
      UPDATE public.bets
      SET status = 'in_progress'
      WHERE id = NEW.bet_id;
    END IF;
    
    RETURN NEW;
  END;
  $$;

  -- Create trigger to run function after bet_recipients is updated
  DROP TRIGGER IF EXISTS update_bet_status_trigger ON public.bet_recipients;
  CREATE TRIGGER update_bet_status_trigger
  AFTER UPDATE ON public.bet_recipients
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_bet_status_on_recipient_change();
  `;
  
  return createTableWithSQL(triggerSQL);
};

// Function to accept a bet - updates both the recipient and the bet status
export const acceptBet = async (recipientId: string, betId: string) => {
  console.log(`[acceptBet] Starting with recipientId=${recipientId}, betId=${betId}`);
  
  try {
    // Get current session to get user ID
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    console.log(`[acceptBet] Current user: ${userId}`);
    
    // First, check if we can access the recipient
    const { data: recipient, error: fetchError } = await supabase
      .from('bet_recipients')
      .select('*')
      .eq('id', recipientId)
      .single();
      
    if (fetchError) {
      console.error('[acceptBet] Error fetching recipient:', fetchError);
      return { success: false, error: fetchError };
    }
    
    console.log('[acceptBet] Current recipient data:', recipient);
    
    // Use the debug function for direct admin update
    console.log('[acceptBet] Calling debug_update_recipient_status function');
    const { data: debugResult, error: debugError } = await supabase.rpc(
      'debug_update_recipient_status',
      { 
        record_id_param: recipientId,
        new_status: 'in_progress',
        user_id_param: userId
      }
    );
    
    console.log('[acceptBet] Debug update result:', debugResult, 'Error:', debugError);
    
    if (debugError) {
      console.error('[acceptBet] Debug update error:', debugError);
      return { success: false, error: debugError };
    }
    
    // Check if the debug function succeeded
    if (debugResult && debugResult.success) {
      console.log('[acceptBet] Debug update successful, now updating bet');
      
      // Update the bet status directly
      const { error: betError } = await supabase
        .from('bets')
        .update({ status: 'in_progress' })
        .eq('id', betId);
        
      if (betError) {
        console.error('[acceptBet] Error updating bet:', betError);
        // Don't return error here, we'll consider it a partial success
      }
      
      return { success: true, data: { status: 'in_progress' } };
    } else {
      console.error('[acceptBet] Debug update failed:', debugResult);
      return { success: false, error: 'Failed to update recipient status' };
    }
  } catch (error) {
    console.error('[acceptBet] Unexpected error:', error);
    return { success: false, error };
  }
};

// Function to reject a bet
export const rejectBet = async (recipientId: string) => {
  // Update the recipient status to rejected
  const { error } = await supabase
    .from('bet_recipients')
    .update({ status: 'rejected' })
    .eq('id', recipientId);
    
  if (error) {
    console.error("Error rejecting bet:", error);
    throw error;
  }
  
  // The trigger will handle the bet status update if needed
  
  return { success: true };
};

// Function to add recipients to a bet
export const addBetRecipients = async (betId: string, recipientIds: string[]) => {
  console.log("Adding recipients directly:", { betId, recipientIds });
  
  try {
    const { data, error } = await supabase
      .from('bet_recipients')
      .insert(
        recipientIds.map(recipientId => ({
          bet_id: betId,
          recipient_id: recipientId,
          status: 'pending'
        }))
      );
      
    console.log("Insert recipients result:", { data, error });
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error("Error adding bet recipients:", error);
    return { success: false, error };
  }
};

// Add a helper function for avatar uploads

export const uploadAvatar = async (uri: string, userId: string) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting XMLHttpRequest upload with uri:', uri);
      
      // Generate a simple unique filename
      const fileName = `${userId}_${Date.now()}.jpg`;
      console.log('Using filename:', fileName);
      
      // Create FormData
      const formData = new FormData();
      
      // Add the file to FormData - making sure to handle the URI correctly
      formData.append('file', {
        uri: uri,
        name: fileName,
        type: 'image/jpeg'
      } as any);
      
      // The URL for direct upload to Supabase Storage
      const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;
      console.log('Upload URL:', uploadUrl);
      
      // Create an XHR request for more direct control
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      
      // Set headers
      xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('x-upsert', 'true');
      
      // Set up event handlers
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('Upload successful, response:', xhr.responseText);
          
          // Construct the public URL
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}`;
          console.log('Public URL:', publicUrl);
          
          // Store in AsyncStorage for persistence
          if (userId) {
            AsyncStorage.setItem(`user_avatar_${userId}`, publicUrl)
              .catch(err => console.error('Error storing avatar URL:', err));
          }
          
          resolve({ success: true, url: publicUrl });
        } else {
          console.error('Upload failed with status:', xhr.status, xhr.responseText);
          resolve({ success: false, error: new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`) });
        }
      };
      
      xhr.onerror = function() {
        console.error('XHR error occurred during upload');
        resolve({ success: false, error: new Error('Network error during upload') });
      };
      
      xhr.onabort = function() {
        console.error('XHR upload aborted');
        resolve({ success: false, error: new Error('Upload aborted') });
      };
      
      xhr.ontimeout = function() {
        console.error('XHR upload timed out');
        resolve({ success: false, error: new Error('Upload timed out') });
      };
      
      // Set a timeout
      xhr.timeout = 30000; // 30 seconds
      
      // Log progress (helpful for debugging)
      xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log(`Upload progress: ${percentComplete}%`);
        }
      };
      
      // Send the FormData
      console.log('Sending XHR request...');
      xhr.send(formData);
      
    } catch (error) {
      console.error('Error in uploadAvatar:', error);
      resolve({ success: false, error });
    }
  });
};

// Add a function to ensure avatar_url column exists

export const ensureAvatarUrlColumn = async () => {
  try {
    // Try to execute a SQL statement that adds the avatar_url column if it doesn't exist
    const { error } = await supabase.rpc('ensure_avatar_url_column');
    
    if (error) {
      console.warn('Failed to ensure avatar_url column exists:', error);
      
      // Try alternate approach with direct SQL if RPC fails
      const { error: sqlError } = await supabase.from('users').select('avatar_url').limit(1);
      
      if (sqlError && sqlError.code === '42703') { // Column doesn't exist
        console.warn('Avatar URL column does not exist. App functionality may be limited.');
      }
    }
  } catch (error) {
    console.error('Error checking avatar_url column:', error);
  }
}; 