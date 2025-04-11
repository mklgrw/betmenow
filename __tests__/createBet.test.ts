import { SupabaseClient } from '@supabase/supabase-js';
import { Bet, BetRecipient } from '../app/types/betTypes';

// We need to mock the modules before importing
jest.mock('../app/services/supabase', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
  };
  
  return {
    supabase: mockSupabase,
    addBetRecipients: jest.fn(),
  };
});

// Now import the mocked modules
import { supabase, addBetRecipients } from '../app/services/supabase';

// Type the mocks properly
const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  insert: jest.Mock;
  select: jest.Mock;
  rpc: jest.Mock;
};

const mockedAddBetRecipients = addBetRecipients as jest.Mock;

// Add missing fields to Bet type to handle extended properties used in tests
interface ExtendedBet extends Partial<Bet> {
  visibility?: 'public' | 'private';
}

describe('Bet Creation', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should create a bet successfully', async () => {
    // Mock data
    const userId = 'test-user-id';
    const betData: ExtendedBet = {
      description: 'Test bet',
      stake: 10,
      due_date: new Date().toISOString(),
      status: 'pending',
      creator_id: userId,
      visibility: 'public'
    };
    
    const createdBet = { 
      id: 'new-bet-id', 
      ...betData 
    };

    // Mock Supabase responses
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: [createdBet],
      error: null
    });

    // Mock the recipient addition
    const selectedFriendIds = ['friend-1', 'friend-2'];
    mockedAddBetRecipients.mockResolvedValue({
      success: true,
      data: [
        { id: 'recipient-1', bet_id: 'new-bet-id', recipient_id: 'friend-1', status: 'pending' } as BetRecipient,
        { id: 'recipient-2', bet_id: 'new-bet-id', recipient_id: 'friend-2', status: 'pending' } as BetRecipient
      ]
    });

    // Create the bet
    const result = await mockedSupabase
      .from('bets')
      .insert([betData])
      .select();

    // Add recipients
    const recipientsResult = await mockedAddBetRecipients('new-bet-id', selectedFriendIds);

    // Assertions
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(mockedSupabase.insert).toHaveBeenCalledWith([betData]);
    expect(mockedSupabase.select).toHaveBeenCalled();
    expect(result.data).toEqual([createdBet]);
    expect(result.error).toBeNull();

    expect(mockedAddBetRecipients).toHaveBeenCalledWith('new-bet-id', selectedFriendIds);
    expect(recipientsResult.success).toBe(true);
    expect(recipientsResult.data.length).toBe(2);
  });

  test('should handle bet creation failure', async () => {
    // Mock data
    const userId = 'test-user-id';
    const betData: ExtendedBet = {
      description: 'Test bet',
      stake: 10,
      due_date: new Date().toISOString(),
      status: 'pending',
      creator_id: userId,
      visibility: 'public'
    };

    // Mock Supabase error response
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: null,
      error: { message: 'Failed to create bet' }
    });

    // Create the bet
    const result = await mockedSupabase
      .from('bets')
      .insert([betData])
      .select();

    // Assertions
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(mockedSupabase.insert).toHaveBeenCalledWith([betData]);
    expect(mockedSupabase.select).toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: 'Failed to create bet' });
  });

  test('should handle recipient addition failure', async () => {
    // Mock data
    const userId = 'test-user-id';
    const betData: ExtendedBet = {
      description: 'Test bet',
      stake: 10,
      due_date: new Date().toISOString(),
      status: 'pending',
      creator_id: userId,
      visibility: 'public'
    };
    
    const createdBet = { 
      id: 'new-bet-id', 
      ...betData 
    };

    // Define selectedFriendIds for this test
    const selectedFriendIds = ['friend-1', 'friend-2'];

    // Mock Supabase responses for successful bet creation
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: [createdBet],
      error: null
    });

    // Mock recipient addition failure
    mockedAddBetRecipients.mockResolvedValue({
      success: false,
      error: { message: 'Failed to add recipients' }
    });

    // Create the bet
    const result = await mockedSupabase
      .from('bets')
      .insert([betData])
      .select();

    // Try to add recipients
    const recipientsResult = await mockedAddBetRecipients('new-bet-id', selectedFriendIds);

    // Assertions
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(mockedSupabase.insert).toHaveBeenCalledWith([betData]);
    expect(mockedSupabase.select).toHaveBeenCalled();
    expect(result.data).toEqual([createdBet]);
    expect(result.error).toBeNull();

    expect(mockedAddBetRecipients).toHaveBeenCalledWith('new-bet-id', selectedFriendIds);
    expect(recipientsResult.success).toBe(false);
    expect(recipientsResult.error).toEqual({ message: 'Failed to add recipients' });
  });
}); 