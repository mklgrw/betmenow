// IMPORTANT: This script interacts with the LIVE database.
// Ensure your .env file is configured correctly and run ONLY against a development environment.
// It WILL create data in your 'bets' and 'bet_recipients' tables.

import 'dotenv/config'; // Load environment variables
import { createClient } from '@supabase/supabase-js';
import { Bet } from '../../app/types/betTypes';

const RECIPIENT_USER_ID = '4a5149a9-fa36-4be1-bac9-d5cd3025513a';
const CREATOR_USER_ID = 'cfacf527-b4a2-455f-9441-e51aca461720'; // Keep for logging/reference
const BET_DESCRIPTION = 'test bet';

// --- Get Test User Credentials from Environment --- 
const creatorEmail = process.env.TEST_CREATOR_EMAIL;
const creatorPassword = process.env.TEST_CREATOR_PASSWORD;

if (!creatorEmail || !creatorPassword) {
  console.error('Error: TEST_CREATOR_EMAIL and TEST_CREATOR_PASSWORD must be defined in your .env file');
  process.exit(1);
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

// --- Inlined addBetRecipients logic --- 
// Replicates the logic from app/services/supabase.ts but uses the local client
async function addBetRecipientsE2E(betId: string, recipientIds: string[]) {
  console.log(`[E2E] Adding recipients directly:`, { betId, recipientIds });
  try {
    const insertData = recipientIds.map(recipientId => ({
      bet_id: betId,
      recipient_id: recipientId, // Assuming your column is recipient_id
      status: 'pending'
    }));

    const { data, error } = await supabase
      .from('bet_recipients')
      .insert(insertData)
      .select(); // Select to get the created records back
      
    if (error) {
      console.error("[E2E] Error details inserting recipients:", error);
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error("[E2E] Catch block: Error adding bet recipients:", error);
    return { success: false, error };
  }
}
// --------------------------------------

async function issueTestBet() {
  console.log(`Attempting to issue bet "${BET_DESCRIPTION}" from creator ${CREATOR_USER_ID} to recipient ${RECIPIENT_USER_ID}...`);

  try {
    // 0. Sign in as the creator user
    console.log(`Signing in as creator: ${creatorEmail}...`);
    // TypeScript knows these are defined because of the check above
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });

    if (signInError || !signInData.user) {
      console.error('Error signing in creator user:', signInError);
      throw new Error(`Failed to sign in as creator ${creatorEmail}. Check credentials and user status.`);
    }
    console.log(`Successfully signed in as user: ${signInData.user.id}`);
    // Verify the signed-in user ID matches the expected creator ID
    if(signInData.user.id !== CREATOR_USER_ID) {
        console.warn(`Warning: Signed in user ID (${signInData.user.id}) does not match CREATOR_USER_ID (${CREATOR_USER_ID}). Proceeding anyway.`);
    }

    // 1. Verify recipient user exists (optional but recommended)
    console.log(`Verifying recipient user ${RECIPIENT_USER_ID} exists...`);
    // Now uses the authenticated client
    const { data: recipientUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', RECIPIENT_USER_ID)
      .single();

    if (userError || !recipientUser) {
      console.error(`Error: Recipient user with ID ${RECIPIENT_USER_ID} not found or error fetching:`, userError);
      throw new Error(`Recipient user ${RECIPIENT_USER_ID} not found.`);
    }
    console.log(`Recipient user ${RECIPIENT_USER_ID} verified.`);

    // 2. Create the Bet
    console.log(`Creating bet with description "${BET_DESCRIPTION}"...`);
    // The creator_id should now automatically be the signed-in user's ID if RLS relies on auth.uid()
    // However, explicitly setting it ensures correctness if the policy relies on the column value.
    const betData: Omit<Bet, 'id' | 'created_at' | 'creator' | 'recipients' | 'bet_recipients' | 'is_recipient' | 'has_activity'> = {
      description: BET_DESCRIPTION,
      stake: 1, // Using a nominal stake
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
      status: 'pending',
      creator_id: signInData.user.id, // Use signed-in user ID
      // visibility: 'public', // Uncomment if needed
    };

    const { data: newBetData, error: betError } = await supabase
      .from('bets')
      .insert([betData])
      .select()
      .single();

    if (betError || !newBetData) {
      console.error('Error creating bet:', betError);
      // Check specifically for RLS error again after signing in
      if (betError?.code === '42501') {
        console.error('RLS policy still prevents bet creation even after signing in. Check INSERT policy for bets table.');
      }
      throw new Error('Failed to create bet.');
    }

    const newBetId = newBetData.id;
    console.log(`Bet created successfully with ID: ${newBetId}`);

    // 3. Add the Recipient using the inlined function
    console.log(`Adding recipient ${RECIPIENT_USER_ID} to bet ${newBetId}...`);
    const { success, error: recipientError, data: recipientData } = await addBetRecipientsE2E(newBetId, [RECIPIENT_USER_ID]);

    if (!success || recipientError) {
      console.error('Error adding bet recipient:', recipientError);
      throw new Error('Failed to add bet recipient.');
    }

    console.log('Recipient added successfully:', recipientData);
    console.log('--- Test Bet Issued Successfully ---');

  } catch (error) {
    console.error('--- Test Failed ---');
    console.error('An error occurred during the bet issuance process:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Optionally sign out the user
    await supabase.auth.signOut();
    console.log('Signed out test user.');
  }
}

// Run the function
issueTestBet(); 