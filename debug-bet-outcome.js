/**
 * Debug script for testing bet outcome declaration
 * This script will help diagnose why the bet status isn't being updated to 'completed'
 * and why the opponent's status isn't being updated to 'won' when a user declares a loss.
 * 
 * Usage: 
 * node debug-bet-outcome.js <recipientId> [supabaseUrl] [supabaseKey]
 * 
 * If supabaseUrl and supabaseKey are not provided, they'll be loaded from .env
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get command line arguments
const args = process.argv.slice(2);
const recipientId = args[0];
const supabaseUrl = args[1] || process.env.SUPABASE_URL;
const supabaseKey = args[2] || process.env.SUPABASE_ANON_KEY;

// Validate required inputs
if (!recipientId) {
  console.error('ERROR: Please provide a recipient ID as the first argument');
  console.log('Usage: node debug-bet-outcome.js <recipientId> [supabaseUrl] [supabaseKey]');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Supabase URL and anon key are required');
  console.log('Either provide them as arguments or in your .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to debug the declare loss functionality
async function debugDeclareLoss() {
  try {
    console.log(`Starting debug test for declaring loss on recipient ID: ${recipientId}`);
    
    // First, retrieve the current state
    const { data: initialRecipient, error: initialError } = await supabase
      .from('bet_recipients')
      .select('*, bets(*)')
      .eq('id', recipientId)
      .single();
    
    if (initialError) {
      console.error('Error retrieving initial recipient data:', initialError);
      return;
    }
    
    console.log('Initial state:');
    console.log('- Bet ID:', initialRecipient.bet_id);
    console.log('- Bet Status:', initialRecipient.bets.status);
    console.log('- Current Recipient Status:', initialRecipient.status);
    
    // Find the opponent recipient
    const { data: opponents, error: opponentsError } = await supabase
      .from('bet_recipients')
      .select('id, recipient_id, status, pending_outcome')
      .eq('bet_id', initialRecipient.bet_id)
      .neq('id', recipientId);
    
    if (opponentsError) {
      console.error('Error retrieving opponent data:', opponentsError);
      return;
    }
    
    console.log('Opponents found:', opponents.length);
    if (opponents.length > 0) {
      console.log('Opponent data:');
      opponents.forEach((opponent, index) => {
        console.log(`Opponent ${index + 1}:`);
        console.log('- ID:', opponent.id);
        console.log('- Status:', opponent.status);
        console.log('- Pending Outcome:', opponent.pending_outcome);
      });
    } else {
      console.log('WARNING: No opponents found for this bet!');
    }
    
    // Call the function to declare loss
    console.log('\nCalling secure_declare_bet_outcome with outcome "lost"...');
    const { data: result, error } = await supabase.rpc('secure_declare_bet_outcome', {
      p_recipient_id: recipientId,
      p_outcome: 'lost'
    });
    
    if (error) {
      console.error('Error calling declare bet outcome function:', error);
      return;
    }
    
    console.log('Function result:', result);
    
    // Retrieve the updated state after declaring loss
    console.log('\nRetrieving updated state...');
    
    // Check the current recipient's status
    const { data: updatedRecipient, error: updatedError } = await supabase
      .from('bet_recipients')
      .select('*, bets(*)')
      .eq('id', recipientId)
      .single();
    
    if (updatedError) {
      console.error('Error retrieving updated recipient data:', updatedError);
      return;
    }
    
    console.log('Updated state:');
    console.log('- Bet ID:', updatedRecipient.bet_id);
    console.log('- Bet Status:', updatedRecipient.bets.status);
    console.log('- Current Recipient Status:', updatedRecipient.status);
    
    // Check if the bet status was updated correctly
    if (updatedRecipient.bets.status === 'completed') {
      console.log('✅ SUCCESS: Bet status was correctly updated to "completed"');
    } else {
      console.log('❌ FAILURE: Bet status was NOT updated to "completed"!');
      console.log('  Current status:', updatedRecipient.bets.status);
    }
    
    // Check if the current recipient's status was updated correctly
    if (updatedRecipient.status === 'lost') {
      console.log('✅ SUCCESS: Current recipient status was correctly updated to "lost"');
    } else {
      console.log('❌ FAILURE: Current recipient status was NOT updated to "lost"!');
      console.log('  Current status:', updatedRecipient.status);
    }
    
    // Check the opponent recipients
    if (opponents.length > 0) {
      console.log('\nChecking opponent statuses...');
      
      // Get all opponent statuses after the update
      const { data: updatedOpponents, error: updatedOpponentsError } = await supabase
        .from('bet_recipients')
        .select('id, recipient_id, status, pending_outcome')
        .eq('bet_id', initialRecipient.bet_id)
        .neq('id', recipientId);
      
      if (updatedOpponentsError) {
        console.error('Error retrieving updated opponent data:', updatedOpponentsError);
        return;
      }
      
      let allOpponentsWon = true;
      
      updatedOpponents.forEach((opponent, index) => {
        console.log(`Updated Opponent ${index + 1}:`);
        console.log('- ID:', opponent.id);
        console.log('- Status:', opponent.status);
        
        if (opponent.status !== 'won') {
          allOpponentsWon = false;
          console.log(`❌ FAILURE: Opponent ${index + 1} status was NOT updated to "won"!`);
        } else {
          console.log(`✅ SUCCESS: Opponent ${index + 1} status was correctly updated to "won"`);
        }
      });
      
      if (allOpponentsWon) {
        console.log('✅ ALL OPPONENTS: All opponents were correctly updated to "won"');
      } else {
        console.log('❌ OPPONENTS ISSUE: Not all opponents were updated to "won"');
      }
    }
    
    console.log('\nDebug test completed.');
    
  } catch (e) {
    console.error('Unexpected error during debugging:', e);
  }
}

// Run the debug function
debugDeclareLoss();
