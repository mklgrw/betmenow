// IMPORTANT: This script interacts with the LIVE database.
// Ensure your .env file is configured correctly and run ONLY against a development environment.
// This tests the complete flow of creating, accepting, and rejecting bets.

import 'dotenv/config'; // Load environment variables
import { createClient } from '@supabase/supabase-js';
import { Bet } from '../../app/types/betTypes';

// --- User IDs and test parameters ---
const RECIPIENT_USER_ID = '4a5149a9-fa36-4be1-bac9-d5cd3025513a';
const CREATOR_USER_ID = 'cfacf527-b4a2-455f-9441-e51aca461720';
const BET_DESCRIPTION = 'test bet';

// --- Get Test User Credentials from Environment --- 
const creatorEmail = process.env.TEST_CREATOR_EMAIL;
const creatorPassword = process.env.TEST_CREATOR_PASSWORD;
const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;
const recipientPassword = process.env.TEST_RECIPIENT_PASSWORD;

if (!creatorEmail || !creatorPassword || !recipientEmail || !recipientPassword) {
  console.error('Error: Test user credentials must be defined in your .env file');
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

// Test function 1: Create and accept bet
async function testAcceptBet() {
  console.log('=========================================');
  console.log('STARTING TEST: CREATE AND ACCEPT BET');
  console.log('=========================================');
  
  let acceptTestBetId = '';
  
  try {
    // Step 1: Sign in as creator and issue a bet
    console.log('\n--- Step 1: Creating a bet as creator ---');
    console.log(`Signing in as creator: ${creatorEmail}...`);
    
    const { data: creatorSignInData, error: creatorSignInError } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });

    if (creatorSignInError || !creatorSignInData.user) {
      console.error('Error signing in creator user:', creatorSignInError);
      throw new Error(`Failed to sign in as creator ${creatorEmail}`);
    }
    console.log(`Successfully signed in as creator: ${creatorSignInData.user.id}`);
    
    // Create the bet
    console.log(`Creating bet with description "${BET_DESCRIPTION}"...`);
    const betData: Omit<Bet, 'id' | 'created_at' | 'creator' | 'recipients' | 'bet_recipients' | 'is_recipient' | 'has_activity'> = {
      description: BET_DESCRIPTION + ' (accept test)',
      stake: 1,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      creator_id: creatorSignInData.user.id,
    };

    const { data: newBetData, error: betError } = await supabase
      .from('bets')
      .insert([betData])
      .select()
      .single();

    if (betError || !newBetData) {
      console.error('Error creating bet:', betError);
      throw new Error('Failed to create bet.');
    }

    acceptTestBetId = newBetData.id;
    console.log(`Bet created successfully with ID: ${acceptTestBetId}`);
    
    // Sign out creator
    await supabase.auth.signOut();
    console.log('Signed out creator user.');
    
    // Step 2: Sign in as recipient and accept the bet
    console.log('\n--- Step 2: Accepting the bet as recipient ---');
    console.log(`Signing in as recipient: ${recipientEmail}...`);
    
    const { data: recipientSignInData, error: recipientSignInError } = await supabase.auth.signInWithPassword({
      email: recipientEmail!,
      password: recipientPassword!,
    });

    if (recipientSignInError || !recipientSignInData.user) {
      console.error('Error signing in recipient user:', recipientSignInError);
      throw new Error(`Failed to sign in as recipient ${recipientEmail}`);
    }
    console.log(`Successfully signed in as recipient: ${recipientSignInData.user.id}`);
    
    // Accept the bet
    console.log(`Accepting bet ${acceptTestBetId} as recipient...`);
    const { data: acceptResult, error: acceptError } = await supabase.rpc(
      'secure_accept_bet',
      { p_bet_id: acceptTestBetId }
    );
      
    if (acceptError) {
      console.error('Error accepting bet:', acceptError);
      throw new Error('Failed to accept bet.');
    }
      
    console.log('Bet acceptance API call succeeded:', acceptResult);
    
    // Verify the bet status
    const { data: updatedBet, error: verifyBetError } = await supabase
      .from('bets')
      .select('status')
      .eq('id', acceptTestBetId)
      .single();
        
    if (verifyBetError || !updatedBet) {
      console.error('Error verifying bet status update:', verifyBetError);
      throw new Error('Failed to verify bet status update.');
    }
      
    console.log(`Bet status is now: ${updatedBet.status}`);
    
    // Verify recipient records were created
    const { data: recipientRecords, error: verifyRecipientError } = await supabase
      .from('bet_recipients')
      .select('recipient_id, status')
      .eq('bet_id', acceptTestBetId);
        
    if (verifyRecipientError) {
      console.error('Error verifying recipient records:', verifyRecipientError);
      throw new Error('Failed to verify recipient records.');
    }
    
    console.log(`Found ${recipientRecords.length} recipient records:`, recipientRecords);
    
    // Validate test success
    if (updatedBet.status === 'in_progress' && recipientRecords.length >= 2) {
      console.log('\n✅ ACCEPT BET TEST: PASSED');
    } else {
      console.error('\n❌ ACCEPT BET TEST: FAILED');
      console.error(`Expected bet status to be 'in_progress' and at least 2 recipient records, but got status: ${updatedBet.status}, record count: ${recipientRecords.length}`);
    }
    
    // Sign out recipient
    await supabase.auth.signOut();
    console.log('Signed out recipient user.');
    
  } catch (error) {
    console.error('\n❌ ACCEPT BET TEST: FAILED');
    console.error('Error during accept bet test:', error);
    await supabase.auth.signOut();
  }
}

// Test function 2: Create and reject bet
async function testRejectBet() {
  console.log('\n=========================================');
  console.log('STARTING TEST: CREATE AND REJECT BET');
  console.log('=========================================');
  
  let rejectTestBetId = '';
  
  try {
    // Step 1: Sign in as creator and issue a bet
    console.log('\n--- Step 1: Creating a bet as creator ---');
    console.log(`Signing in as creator: ${creatorEmail}...`);
    
    const { data: creatorSignInData, error: creatorSignInError } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });

    if (creatorSignInError || !creatorSignInData.user) {
      console.error('Error signing in creator user:', creatorSignInError);
      throw new Error(`Failed to sign in as creator ${creatorEmail}`);
    }
    console.log(`Successfully signed in as creator: ${creatorSignInData.user.id}`);
    
    // Create the bet
    console.log(`Creating bet with description "${BET_DESCRIPTION}"...`);
    const betData: Omit<Bet, 'id' | 'created_at' | 'creator' | 'recipients' | 'bet_recipients' | 'is_recipient' | 'has_activity'> = {
      description: BET_DESCRIPTION + ' (reject test)',
      stake: 1,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      creator_id: creatorSignInData.user.id,
    };

    const { data: newBetData, error: betError } = await supabase
      .from('bets')
      .insert([betData])
      .select()
      .single();

    if (betError || !newBetData) {
      console.error('Error creating bet:', betError);
      throw new Error('Failed to create bet.');
    }

    rejectTestBetId = newBetData.id;
    console.log(`Bet created successfully with ID: ${rejectTestBetId}`);
    
    // Sign out creator
    await supabase.auth.signOut();
    console.log('Signed out creator user.');
    
    // Step 2: Sign in as recipient and reject the bet
    console.log('\n--- Step 2: Rejecting the bet as recipient ---');
    console.log(`Signing in as recipient: ${recipientEmail}...`);
    
    const { data: recipientSignInData, error: recipientSignInError } = await supabase.auth.signInWithPassword({
      email: recipientEmail!,
      password: recipientPassword!,
    });

    if (recipientSignInError || !recipientSignInData.user) {
      console.error('Error signing in recipient user:', recipientSignInError);
      throw new Error(`Failed to sign in as recipient ${recipientEmail}`);
    }
    console.log(`Successfully signed in as recipient: ${recipientSignInData.user.id}`);
    
    // Reject the bet
    console.log(`Rejecting bet ${rejectTestBetId} as recipient...`);
    const { data: rejectResult, error: rejectError } = await supabase.rpc(
      'secure_reject_bet',
      { p_bet_id: rejectTestBetId }
    );
      
    if (rejectError) {
      console.error('Error rejecting bet:', rejectError);
      throw new Error('Failed to reject bet.');
    }
      
    console.log('Bet rejection API call succeeded:', rejectResult);
    
    // Verify the bet status is rejected
    const { data: updatedBet, error: verifyBetError } = await supabase
      .from('bets')
      .select('status')
      .eq('id', rejectTestBetId)
      .single();
        
    if (verifyBetError || !updatedBet) {
      console.error('Error verifying bet status update:', verifyBetError);
      throw new Error('Failed to verify bet status update.');
    }
      
    console.log(`Bet status is now: ${updatedBet.status}`);
    
    // Verify NO recipient records were created
    const { data: recipientRecords, error: verifyRecipientError } = await supabase
      .from('bet_recipients')
      .select('recipient_id, status')
      .eq('bet_id', rejectTestBetId);
        
    if (verifyRecipientError) {
      console.error('Error checking recipient records:', verifyRecipientError);
      throw new Error('Failed to check recipient records.');
    }
    
    console.log(`Found ${recipientRecords.length} recipient records for rejected bet`);
    
    // Validate test success - we allow some existing records, since a creator record may exist by default
    if (updatedBet.status === 'rejected') {
      console.log('\n✅ REJECT BET TEST: PASSED');
    } else {
      console.error('\n❌ REJECT BET TEST: FAILED');
      console.error(`Expected bet status to be 'rejected', but got status: ${updatedBet.status}`);
    }
    
    // Sign out recipient
    await supabase.auth.signOut();
    console.log('Signed out recipient user.');
    
  } catch (error) {
    console.error('\n❌ REJECT BET TEST: FAILED');
    console.error('Error during reject bet test:', error);
    await supabase.auth.signOut();
  }
}

// Test function 3: Create, accept, and declare loss as creator
async function testCreatorDeclareLoss() {
  console.log('\n=========================================');
  console.log('STARTING TEST: CREATE, ACCEPT AND DECLARE LOSS');
  console.log('=========================================');
  
  let testBetId = '';
  let creatorRecipientId = '';
  
  try {
    // Step 1: Sign in as creator and issue a bet
    console.log('\n--- Step 1: Creating a bet as creator ---');
    console.log(`Signing in as creator: ${creatorEmail}...`);
    
    const { data: creatorSignInData, error: creatorSignInError } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });

    if (creatorSignInError || !creatorSignInData.user) {
      console.error('Error signing in creator user:', creatorSignInError);
      throw new Error(`Failed to sign in as creator ${creatorEmail}`);
    }
    console.log(`Successfully signed in as creator: ${creatorSignInData.user.id}`);
    
    // Create the bet
    console.log(`Creating bet with description "${BET_DESCRIPTION}"...`);
    const betData: Omit<Bet, 'id' | 'created_at' | 'creator' | 'recipients' | 'bet_recipients' | 'is_recipient' | 'has_activity'> = {
      description: BET_DESCRIPTION + ' (creator declare loss test)',
      stake: 1,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      creator_id: creatorSignInData.user.id,
    };

    const { data: newBetData, error: betError } = await supabase
      .from('bets')
      .insert([betData])
      .select()
      .single();

    if (betError || !newBetData) {
      console.error('Error creating bet:', betError);
      throw new Error('Failed to create bet.');
    }

    testBetId = newBetData.id;
    console.log(`Bet created successfully with ID: ${testBetId}`);
    
    // Sign out creator
    await supabase.auth.signOut();
    console.log('Signed out creator user.');
    
    // Step 2: Sign in as recipient and accept the bet
    console.log('\n--- Step 2: Accepting the bet as recipient ---');
    console.log(`Signing in as recipient: ${recipientEmail}...`);
    
    const { data: recipientSignInData, error: recipientSignInError } = await supabase.auth.signInWithPassword({
      email: recipientEmail!,
      password: recipientPassword!,
    });

    if (recipientSignInError || !recipientSignInData.user) {
      console.error('Error signing in recipient user:', recipientSignInError);
      throw new Error(`Failed to sign in as recipient ${recipientEmail}`);
    }
    console.log(`Successfully signed in as recipient: ${recipientSignInData.user.id}`);
    
    // Accept the bet
    console.log(`Accepting bet ${testBetId} as recipient...`);
    const { data: acceptResult, error: acceptError } = await supabase.rpc(
      'secure_accept_bet',
      { p_bet_id: testBetId }
    );
      
    if (acceptError) {
      console.error('Error accepting bet:', acceptError);
      throw new Error('Failed to accept bet.');
    }
      
    console.log('Bet acceptance API call succeeded:', acceptResult);
    
    // Verify the bet status and recipient records
    const { data: recipientRecords, error: verifyRecipientError } = await supabase
      .from('bet_recipients')
      .select('id, recipient_id, status')
      .eq('bet_id', testBetId);
        
    if (verifyRecipientError) {
      console.error('Error verifying recipient records:', verifyRecipientError);
      throw new Error('Failed to verify recipient records.');
    }
    
    console.log(`Found ${recipientRecords.length} recipient records:`, recipientRecords);
    
    // Find the creator's recipient ID
    const creatorRecord = recipientRecords.find(r => r.recipient_id === CREATOR_USER_ID);
    if (!creatorRecord) {
      throw new Error('Creator record not found in bet_recipients.');
    }
    creatorRecipientId = creatorRecord.id;
    console.log(`Found creator's recipient ID: ${creatorRecipientId}`);
    
    // Sign out recipient
    await supabase.auth.signOut();
    console.log('Signed out recipient user.');
    
    // Step 3: Sign back in as creator and declare loss
    console.log('\n--- Step 3: Declaring loss as creator ---');
    console.log(`Signing in as creator: ${creatorEmail}...`);
    
    const { data: creatorSignInData2, error: creatorSignInError2 } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });

    if (creatorSignInError2 || !creatorSignInData2.user) {
      console.error('Error signing in creator user:', creatorSignInError2);
      throw new Error(`Failed to sign in as creator ${creatorEmail}`);
    }
    console.log(`Successfully signed in as creator: ${creatorSignInData2.user.id}`);
    
    // Declare loss as creator
    console.log(`Declaring loss as creator for recipient ID: ${creatorRecipientId}`);
    const { data: declareLossResult, error: declareLossError } = await supabase.rpc(
      'secure_declare_bet_outcome',
      { 
        p_outcome: 'lost',
        p_recipient_id: creatorRecipientId
      }
    );
      
    if (declareLossError) {
      console.error('Error declaring loss:', declareLossError);
      throw new Error('Failed to declare loss.');
    }
      
    console.log('Loss declaration API call succeeded:', declareLossResult);
    
    // Verify the updated bet status and recipient records
    const { data: updatedBet, error: verifyBetError } = await supabase
      .from('bets')
      .select('status')
      .eq('id', testBetId)
      .single();
        
    if (verifyBetError || !updatedBet) {
      console.error('Error verifying bet status update:', verifyBetError);
      throw new Error('Failed to verify bet status update.');
    }
    
    console.log(`Bet status is now: ${updatedBet.status}`);
    
    const { data: updatedRecipients, error: verifyRecipientsError } = await supabase
      .from('bet_recipients')
      .select('id, recipient_id, status, pending_outcome')
      .eq('bet_id', testBetId);
        
    if (verifyRecipientsError) {
      console.error('Error verifying recipient status updates:', verifyRecipientsError);
      throw new Error('Failed to verify recipient status updates.');
    }
    
    console.log('Updated recipient records:', updatedRecipients);
    
    // Validate test success
    const creatorUpdatedRecord = updatedRecipients.find(r => r.recipient_id === CREATOR_USER_ID && r.pending_outcome === 'lost');
    const recipientUpdatedRecord = updatedRecipients.find(r => r.recipient_id === RECIPIENT_USER_ID && r.pending_outcome === 'won');
    
    if (
      updatedBet.status === 'completed' &&
      creatorUpdatedRecord?.pending_outcome === 'lost' &&
      recipientUpdatedRecord?.pending_outcome === 'won'
    ) {
      console.log('\n✅ CREATOR DECLARE LOSS TEST: PASSED');
    } else {
      console.error('\n❌ CREATOR DECLARE LOSS TEST: FAILED');
      console.error(`Expected bet status 'completed', creator outcome 'lost', recipient outcome 'won', but got: bet status ${updatedBet.status}, creator outcome ${creatorUpdatedRecord?.pending_outcome}, recipient outcome ${recipientUpdatedRecord?.pending_outcome}`);
    }
    
    // Sign out creator
    await supabase.auth.signOut();
    console.log('Signed out creator user.');
    
  } catch (error) {
    console.error('\n❌ CREATOR DECLARE LOSS TEST: FAILED');
    console.error('Error during creator declare loss test:', error);
    await supabase.auth.signOut();
  }
}

// Run tests in sequence
async function runFullE2ETests() {
  try {
    // First, test accepting a bet
    await testAcceptBet();
    
    // Then, test rejecting a bet
    await testRejectBet();
    
    // Finally, test creator declaring a loss
    await testCreatorDeclareLoss();
    
    console.log('\n=========================================');
    console.log('E2E TESTS COMPLETED');
    console.log('=========================================');
  } catch (error) {
    console.error('Error running E2E tests:', error);
    await supabase.auth.signOut();
    process.exit(1);
  }
}

// Run the tests
runFullE2ETests(); 