import { Alert } from 'react-native';
import { Bet, BetRecipient } from '../app/types/betTypes';

// We need to mock the modules before importing
jest.mock('../app/services/supabase', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  };
  
  return {
    supabase: mockSupabase,
    addBetRecipients: jest.fn(),
  };
});

// Mock React Native Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock React Navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Now import the mocked modules
import { supabase, addBetRecipients } from '../app/services/supabase';

// Type the mocks properly
const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  insert: jest.Mock;
  select: jest.Mock;
};

const mockedAddBetRecipients = addBetRecipients as jest.Mock;

// Add missing fields to Bet type to handle extended properties used in tests
interface ExtendedBet extends Partial<Bet> {
  visibility?: 'public' | 'private';
}

interface HandleIssueBetProps {
  description?: string;
  stake?: string;
  dueDate?: Date;
  isPublic?: boolean;
  selectedFriendIds?: string[];
  user?: { id: string };
}

interface BetResult {
  success: boolean;
  error?: any;
  warning?: any;
  betId?: string;
}

describe('Issue Bet Integration Tests', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to simulate the handleIssueBet function from IssueBetScreen
  async function handleIssueBet({
    description = '',
    stake = '',
    dueDate = new Date(),
    isPublic = true,
    selectedFriendIds = [],
    user = { id: 'test-user-id' },
  }: HandleIssueBetProps = {}): Promise<BetResult> {
    // Validation checks similar to IssueBetScreen
    if (!description || !stake || !dueDate) {
      Alert.alert('Error', 'Please fill in all fields');
      return { success: false, error: 'Please fill in all fields' };
    }

    if (selectedFriendIds.length === 0) {
      Alert.alert('Error', 'Please select at least one friend to bet with');
      return { success: false, error: 'Please select at least one friend to bet with' };
    }

    try {
      // Prepare bet data
      const betData: ExtendedBet = {
        description,
        stake: parseFloat(stake),
        due_date: dueDate.toISOString(),
        status: 'pending',
        creator_id: user?.id,
        visibility: isPublic ? 'public' : 'private'
      };

      // Create the bet
      const { data, error } = await mockedSupabase
        .from('bets')
        .insert([betData])
        .select();

      if (error) {
        Alert.alert('Error', 'Failed to create bet: ' + error.message);
        return { success: false, error };
      }

      if (!data || data.length === 0) {
        Alert.alert('Error', 'Failed to create bet: No data returned');
        return { success: false, error: 'No data returned' };
      }

      const newBetId = data[0].id;
      
      // Add recipients
      if (selectedFriendIds.length > 0) {
        const { success, error } = await mockedAddBetRecipients(newBetId, selectedFriendIds);
        
        if (!success) {
          Alert.alert('Warning', 'Bet created, but failed to add some recipients.');
          return { success: true, warning: error, betId: newBetId };
        }
      }

      Alert.alert('Success', 'Bet created successfully');
      
      // Simulate navigation
      setTimeout(() => {
        mockNavigate('Home', { activeTab: 'pending' });
      }, 500);

      return { success: true, betId: newBetId };
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred');
      return { success: false, error: e };
    }
  }

  test('should create a bet with recipients successfully', async () => {
    // Mock data
    const mockBetData: HandleIssueBetProps = {
      description: 'Test bet',
      stake: '10',
      dueDate: new Date(),
      selectedFriendIds: ['friend-1', 'friend-2'],
    };

    // Mock Supabase responses for successful bet creation
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: [{ id: 'new-bet-id', ...mockBetData, stake: 10 }],
      error: null
    });

    // Mock successful recipient addition
    mockedAddBetRecipients.mockResolvedValue({
      success: true,
      data: [
        { id: 'recipient-1', bet_id: 'new-bet-id', recipient_id: 'friend-1', status: 'pending' } as BetRecipient,
        { id: 'recipient-2', bet_id: 'new-bet-id', recipient_id: 'friend-2', status: 'pending' } as BetRecipient
      ]
    });

    // Call the handleIssueBet function
    const result = await handleIssueBet(mockBetData);

    // Assertions
    expect(result.success).toBe(true);
    expect(result.betId).toBe('new-bet-id');
    
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(mockedSupabase.insert).toHaveBeenCalledWith([{
      description: 'Test bet',
      stake: 10,
      due_date: expect.any(String),
      status: 'pending',
      creator_id: 'test-user-id',
      visibility: 'public'
    }]);
    
    expect(mockedAddBetRecipients).toHaveBeenCalledWith('new-bet-id', ['friend-1', 'friend-2']);
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Bet created successfully');
    
    // Wait for the navigation timeout
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(mockNavigate).toHaveBeenCalledWith('Home', { activeTab: 'pending' });
  });

  test('should fail when fields are missing', async () => {
    // Call with missing description
    const result1 = await handleIssueBet({
      stake: '10',
      selectedFriendIds: ['friend-1']
    });

    // Call with missing stake
    const result2 = await handleIssueBet({
      description: 'Test bet',
      selectedFriendIds: ['friend-1']
    });

    // Call with missing recipients
    const result3 = await handleIssueBet({
      description: 'Test bet',
      stake: '10',
      selectedFriendIds: []
    });

    // Assertions
    expect(result1.success).toBe(false);
    expect(result2.success).toBe(false);
    expect(result3.success).toBe(false);
    
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all fields');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please select at least one friend to bet with');
    
    // Supabase should not be called for validation failures
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  test('should handle bet creation failure from Supabase', async () => {
    // Mock data
    const mockBetData: HandleIssueBetProps = {
      description: 'Test bet',
      stake: '10',
      dueDate: new Date(),
      selectedFriendIds: ['friend-1']
    };

    // Mock Supabase error response
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: null,
      error: { message: 'Database error' }
    });

    // Call the handleIssueBet function
    const result = await handleIssueBet(mockBetData);

    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toEqual({ message: 'Database error' });
    
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create bet: Database error');
    
    // Recipients should not be added if bet creation fails
    expect(mockedAddBetRecipients).not.toHaveBeenCalled();
  });

  test('should handle recipient addition failure', async () => {
    // Mock data
    const mockBetData: HandleIssueBetProps = {
      description: 'Test bet',
      stake: '10',
      dueDate: new Date(),
      selectedFriendIds: ['friend-1']
    };

    // Mock Supabase responses for successful bet creation
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockResolvedValue({
      data: [{ id: 'new-bet-id', ...mockBetData, stake: 10 }],
      error: null
    });

    // Mock recipient addition failure
    mockedAddBetRecipients.mockResolvedValue({
      success: false,
      error: { message: 'Failed to add recipients' }
    });

    // Call the handleIssueBet function
    const result = await handleIssueBet(mockBetData);

    // Assertions
    expect(result.success).toBe(true); // The bet was created successfully, even though recipients failed
    expect(result.warning).toEqual({ message: 'Failed to add recipients' });
    expect(result.betId).toBe('new-bet-id');
    
    expect(mockedSupabase.from).toHaveBeenCalledWith('bets');
    expect(mockedAddBetRecipients).toHaveBeenCalledWith('new-bet-id', ['friend-1']);
    expect(Alert.alert).toHaveBeenCalledWith('Warning', 'Bet created, but failed to add some recipients.');
  });
}); 