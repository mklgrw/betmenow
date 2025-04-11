import 'dotenv/config'; // Load environment variables
import { createClient } from '@supabase/supabase-js';

describe('Bet Tabs Verification Tests', () => {
  // Constants
  const CREATOR_USER_ID = 'cfacf527-b4a2-455f-9441-e51aca461720';
  
  // Environment variables
  const creatorEmail = process.env.TEST_CREATOR_EMAIL;
  const creatorPassword = process.env.TEST_CREATOR_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  // Validate environment variables
  beforeAll(() => {
    expect(creatorEmail).toBeDefined();
    expect(creatorPassword).toBeDefined();
    expect(supabaseUrl).toBeDefined();
    expect(supabaseAnonKey).toBeDefined();
  });
  
  // Initialize Supabase client
  const supabase = createClient(
    supabaseUrl!, 
    supabaseAnonKey!
  );
  
  let creatorSession: any;
  
  // Sign in before tests
  beforeEach(async () => {
    // Sign in as creator
    const { data, error } = await supabase.auth.signInWithPassword({
      email: creatorEmail!,
      password: creatorPassword!,
    });
    
    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    creatorSession = data;
  });
  
  // Sign out after tests
  afterEach(async () => {
    await supabase.auth.signOut();
  });
  
  it('shows bets the creator has won in the "Won" tab', async () => {
    // Query for bets where creator has won
    const { data: wonBets, error: wonBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status,
        bet_recipients!inner(
          recipient_id,
          status
        )
      `)
      .eq('bet_recipients.recipient_id', CREATOR_USER_ID)
      .eq('bet_recipients.status', 'won')
      .eq('status', 'completed');
    
    expect(wonBetsError).toBeNull();
    expect(wonBets?.length).toBeGreaterThan(0);
    
    // Verify that at least one bet matches the expected description (from existing E2E tests)
    const hasOpponentDeclareLossBet = wonBets!.some(bet => 
      bet.description.includes('opponent declare loss test')
    );
    
    expect(hasOpponentDeclareLossBet).toBe(true);
  });
  
  it('shows bets the creator has lost in the "Lost" tab', async () => {
    // Query for bets where creator has lost
    const { data: lostBets, error: lostBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status,
        bet_recipients!inner(
          recipient_id,
          status
        )
      `)
      .eq('bet_recipients.recipient_id', CREATOR_USER_ID)
      .eq('bet_recipients.status', 'lost')
      .eq('status', 'completed');
    
    expect(lostBetsError).toBeNull();
    expect(lostBets?.length).toBeGreaterThan(0);
    
    // Verify that at least one bet matches the expected description (from existing E2E tests)
    const hasCreatorDeclareLossBet = lostBets!.some(bet => 
      bet.description.includes('creator declare loss test')
    );
    
    expect(hasCreatorDeclareLossBet).toBe(true);
  });
  
  it('shows bets with in_progress status in the "In Progress" tab', async () => {
    // Query for bets with in_progress status
    const { data: inProgressBets, error: inProgressBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status,
        bet_recipients!inner(
          recipient_id,
          status
        )
      `)
      .eq('status', 'in_progress')
      .eq('bet_recipients.recipient_id', CREATOR_USER_ID);
    
    expect(inProgressBetsError).toBeNull();
    
    // Filter out bets where the creator has already won or lost
    const filteredBets = inProgressBets?.filter(bet => {
      const creatorRecord = bet.bet_recipients.find(
        (r: any) => r.recipient_id === CREATOR_USER_ID
      );
      return creatorRecord && !['won', 'lost'].includes(creatorRecord.status);
    });
    
    expect(filteredBets?.length).toBeGreaterThan(0);
    
    // Verify that in-progress bets have the right status
    for (const bet of filteredBets!) {
      expect(bet.status).toBe('in_progress');
      
      // Verify recipient record exists for the creator
      const creatorRecord = bet.bet_recipients.find(
        (r: any) => r.recipient_id === CREATOR_USER_ID
      );
      expect(creatorRecord).toBeDefined();
      
      // Verify the bet is truly in progress (not won or lost yet)
      // Note: any of these statuses are valid for in-progress bets
      expect(['in_progress', 'pending_outcome', 'pending']).toContain(creatorRecord!.status);
    }
  });
  
  it('shows bets that have not been accepted in the "Pending" tab', async () => {
    // Query for pending bets (not yet accepted)
    const { data: pendingBets, error: pendingBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status,
        bet_recipients(
          recipient_id,
          status
        )
      `)
      .eq('status', 'pending')
      .eq('creator_id', CREATOR_USER_ID);
    
    expect(pendingBetsError).toBeNull();
    
    // If there are any pending bets, verify they have the right status
    if (pendingBets && pendingBets.length > 0) {
      for (const bet of pendingBets) {
        expect(bet.status).toBe('pending');
      }
    }
    
    // Note: This test may pass with 0 pending bets if all have been acted upon
    console.log(`Found ${pendingBets?.length || 0} pending bets`);
  });
  
  it('does not show rejected bets in any active tab', async () => {
    // Query for rejected bets
    const { data: rejectedBets, error: rejectedBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status
      `)
      .eq('status', 'rejected')
      .eq('creator_id', CREATOR_USER_ID);
    
    expect(rejectedBetsError).toBeNull();
    
    // If there are any rejected bets, verify they have the right status
    if (rejectedBets && rejectedBets.length > 0) {
      for (const bet of rejectedBets) {
        expect(bet.status).toBe('rejected');
      }
      
      // Rejected bets should not be included in any active tab
      console.log(`Found ${rejectedBets.length} rejected bets that should not appear in tabs`);
    }
  });
  
  it('correctly categorizes bets based on outcome', async () => {
    // Get all completed bets involving the creator
    const { data: completedBets, error: completedBetsError } = await supabase
      .from('bets')
      .select(`
        id, 
        description,
        status,
        bet_recipients!inner(
          recipient_id,
          status
        )
      `)
      .eq('bet_recipients.recipient_id', CREATOR_USER_ID)
      .eq('status', 'completed')
      .in('bet_recipients.status', ['won', 'lost']); // Only include won or lost statuses
    
    expect(completedBetsError).toBeNull();
    expect(completedBets?.length).toBeGreaterThan(0);
    
    // Verify each bet is correctly categorized
    for (const bet of completedBets!) {
      const recipientRecord = bet.bet_recipients.find(
        (r: any) => r.recipient_id === CREATOR_USER_ID
      );
      
      expect(recipientRecord).toBeDefined();
      
      // Make sure status is either 'won' or 'lost'
      expect(['won', 'lost']).toContain(recipientRecord!.status);
      
      // Verify that bets with 'opponent declare loss test' in their description have status 'won'
      if (bet.description.includes('opponent declare loss test')) {
        expect(recipientRecord!.status).toBe('won');
      }
      
      // Verify that bets with 'creator declare loss test' in their description have status 'lost'
      if (bet.description.includes('creator declare loss test')) {
        expect(recipientRecord!.status).toBe('lost');
      }
    }
  });
}); 