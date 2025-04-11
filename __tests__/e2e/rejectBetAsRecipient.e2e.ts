// IMPORTANT: This script interacts with the LIVE database.
// Ensure your .env file is configured correctly and run ONLY against a development environment.
// It tests the rejection of a bet by a recipient.

import 'dotenv/config'; // Load environment variables
import { createClient } from '@supabase/supabase-js';

// --- User IDs and test parameters ---
const RECIPIENT_USER_ID = '4a5149a9-fa36-4be1-bac9-d5cd3025513a';
// You will need to replace this with the bet ID from your previous test
// Or use dynamic bet fetching (see below)
let TEST_BET_ID = process.argv[2]; // Pass bet ID as command line argument

// --- Get Test User Credentials from Environment --- 
const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;
const recipientPassword = process.env.TEST_RECIPIENT_PASSWORD;

if (!recipientEmail || !recipientPassword) {
  console.error('Error: TEST_RECIPIENT_EMAIL and TEST_RECIPIENT_PASSWORD must be defined in your .env file');
  process.exit(1);
}

if (!TEST_BET_ID) {
  console.log('No bet ID provided. Will attempt to find the most recent pending bet for the recipient.');
}
// ----------------------------------------------

// --- Create Supabase client directly using environment variables ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined in your .env file');
  process.exit(1);
}

// Initialize with anon key - we will sign in later
const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('Supabase client initialized for E2E test.');
// ------------------------------------------------------------------

async function rejectTestBet() {
  console.log(`Attempting to reject a bet as recipient ${RECIPIENT_USER_ID}...`);

  try {
    // 1. Sign in as the recipient user
    console.log(`Signing in as recipient: ${recipientEmail}...`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: recipientEmail!,
      password: recipientPassword!,
    });

    if (signInError || !signInData.user) {
      console.error('Error signing in recipient user:', signInError);
      throw new Error(`Failed to sign in as recipient ${recipientEmail}. Check credentials and user status.`);
    }
    console.log(`Successfully signed in as user: ${signInData.user.id}`);
    
    // Verify the signed-in user ID matches the expected recipient ID
    if(signInData.user.id !== RECIPIENT_USER_ID) {
      console.warn(`Warning: Signed in user ID (${signInData.user.id}) does not match RECIPIENT_USER_ID (${RECIPIENT_USER_ID}). Proceeding anyway.`);
    }

    // 2. If no bet ID was provided, find the most recent pending bet for this recipient
    if (!TEST_BET_ID) {
      console.log(`No bet ID provided. Finding the most recent pending bet for recipient ${RECIPIENT_USER_ID}...`);
      
      const { data: recipientBets, error: fetchError } = await supabase
        .from('bet_recipients')
        .select('id, bet_id, status, created_at')
        .eq('recipient_id', RECIPIENT_USER_ID)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError || !recipientBets || recipientBets.length === 0) {
        console.error('Error finding a pending bet for the recipient:', fetchError || 'No pending bets found');
        throw new Error('Failed to find a pending bet for the recipient.');
      }
      
      TEST_BET_ID = recipientBets[0].bet_id;
      const recipientId = recipientBets[0].id;
      console.log(`Found pending bet with ID: ${TEST_BET_ID} and recipient record ID: ${recipientId}`);
      
      // 3. Reject the bet using RPC function
      console.log(`Rejecting bet ${TEST_BET_ID} as recipient...`);
      
      // Use the secure_reject_bet RPC function
      const { data: rejectResult, error: rejectError } = await supabase.rpc(
        'secure_reject_bet',
        { p_recipient_id: recipientId }
      );
      
      if (rejectError) {
        console.error('Error rejecting bet:', rejectError);
        throw new Error('Failed to reject bet.');
      }
      
      console.log('Bet rejection API call succeeded:', rejectResult);
      
      // 4. Verify the bet and recipient statuses were updated
      const { data: updatedRecipient, error: verifyRecipientError } = await supabase
        .from('bet_recipients')
        .select('status')
        .eq('id', recipientId)
        .single();
        
      if (verifyRecipientError || !updatedRecipient) {
        console.error('Error verifying recipient status update:', verifyRecipientError);
        throw new Error('Failed to verify recipient status update.');
      }
      
      console.log(`Recipient status is now: ${updatedRecipient.status}`);
      
      const { data: updatedBet, error: verifyBetError } = await supabase
        .from('bets')
        .select('status')
        .eq('id', TEST_BET_ID)
        .single();
        
      if (verifyBetError || !updatedBet) {
        console.error('Error verifying bet status update:', verifyBetError);
        throw new Error('Failed to verify bet status update.');
      }
      
      console.log(`Bet status is now: ${updatedBet.status}`);
      
      // Check if all recipients rejected the bet, in which case the bet status should be 'rejected'
      // Otherwise, the bet might still be 'pending' if there are other recipients
      const { data: otherPendingRecipients, error: countError } = await supabase
        .from('bet_recipients')
        .select('id')
        .eq('bet_id', TEST_BET_ID)
        .eq('status', 'pending');
      
      const expectedBetStatus = (otherPendingRecipients && otherPendingRecipients.length === 0) ? 'rejected' : 'pending';
      
      // Determine test success
      if (updatedRecipient.status === 'rejected') {
        console.log('--- Bet Rejection Test Successful (Recipient) ---');
        
        // Check if bet status is as expected based on other recipients
        if (updatedBet.status === expectedBetStatus) {
          console.log(`--- Bet Status Test Successful (${expectedBetStatus}) ---`);
        } else {
          console.warn(`Expected bet status to be '${expectedBetStatus}', but got '${updatedBet.status}'`);
        }
      } else {
        console.error('--- Bet Rejection Test Failed ---');
        console.error(`Expected recipient status to be 'rejected', but got '${updatedRecipient.status}'`);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('--- Test Failed ---');
    console.error('An error occurred during the bet rejection process:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Sign out the user
    await supabase.auth.signOut();
    console.log('Signed out test user.');
  }
}

// Run the function
rejectTestBet(); 