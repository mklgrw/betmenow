import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { Bet, BetRecipient, BetStatus, RecipientStatus, PendingOutcome } from '../types/betTypes';

// Define type for processed bet data (used in HomeScreen and DashboardScreen)
export type ProcessedBet = {
  id: string;
  description: string;
  stake: number;
  timestamp: string;
  commentCount: number;
  status: BetStatus;
  pendingOutcome?: PendingOutcome;
  isCreator: boolean;
  recipientId?: string;
  creatorId?: string;
  hasWonOrLostRecipient: boolean;
  isMyOutcome?: 'won' | 'lost' | null; // User-specific outcome for this bet
};

// Define type for recipient update operations
export type RecipientUpdate = {
  status?: RecipientStatus;
  pending_outcome?: PendingOutcome;
  outcome_claimed_by?: string | null | undefined;
  outcome_claimed_at?: string | null;
};

// Define state type
interface BetState {
  bets: Bet[];
  pendingBets: Bet[];
  activeBets: Bet[];
  completedBets: Bet[];
  wonBets: Bet[];
  lostBets: Bet[];
  filteredBets: Bet[];
  activeTab: string;
  searchQuery: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: number;
}

// Define action types
type BetAction =
  | { type: 'FETCH_BETS_START' }
  | { type: 'FETCH_BETS_SUCCESS'; payload: Bet[] }
  | { type: 'FETCH_BETS_ERROR'; payload: string }
  | { type: 'UPDATE_BET'; payload: Bet }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'REFRESH_STATE' };

// Define context value type
interface BetContextType extends BetState {
  fetchBets: () => Promise<void>;
  refreshBets: () => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  deleteBet: (betId: string) => Promise<void>;
  handleRejectBet: (recipientId: string) => Promise<void>;
  handleAcceptBet: (recipientId: string) => Promise<void>;
}

// Initial state
const initialState: BetState = {
  bets: [],
  pendingBets: [],
  activeBets: [],
  completedBets: [],
  wonBets: [],
  lostBets: [],
  filteredBets: [],
  activeTab: 'in_progress',
  searchQuery: '',
  loading: false,
  refreshing: false,
  error: null,
  lastUpdated: Date.now()
};

// Create context
const BetContext = createContext<BetContextType>({
  ...initialState,
  fetchBets: async () => {},
  refreshBets: () => {},
  setActiveTab: () => {},
  setSearchQuery: () => {},
  onRefresh: () => {},
  deleteBet: async () => {},
  handleRejectBet: async () => {},
  handleAcceptBet: async () => {}
});

// Helper function to filter bets by tab and search query
const filterBets = (bets: Bet[], tab: string, query: string, userId?: string): Bet[] => {
  // First, get the correct list based on tab
  let filteredBets: Bet[] = [];
  
  if (tab === 'in_progress') {
    // Only show bets that are truly in progress and don't have won/lost recipients
    filteredBets = bets.filter(bet => {
      const isInProgress = bet.status === 'in_progress';
      const hasWonOrLost = bet.recipients?.some((r: BetRecipient) => 
        r.status === 'won' || r.status === 'lost'
      );
      return isInProgress && !hasWonOrLost;
    });
  } else if (tab === 'pending') {
    filteredBets = bets.filter(bet => bet.status === 'pending');
  } else if (tab === 'completed') {
    // Show bets that are completed OR have won/lost recipients
    filteredBets = bets.filter(bet => {
      const isCompleted = bet.status === 'completed';
      const hasWonOrLost = bet.recipients?.some((r: BetRecipient) => 
        r.status === 'won' || r.status === 'lost'
      );
      return isCompleted || hasWonOrLost;
    });
  } else if (tab === 'won') {
    // For 'won' tab, check the user's specific outcome
    filteredBets = bets.filter(bet => {
      // Check if this is a bet the user created and someone lost (which means they won)
      const isCreatorWin = bet.creator_id === userId && 
        bet.recipients?.some((r: BetRecipient) => r.status === 'lost');
      
      // Check if this is a bet where the user was a recipient and won directly
      const isRecipientWin = bet.is_recipient && 
        bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'won');
      
      return isCreatorWin || isRecipientWin;
    });
  } else if (tab === 'lost') {
    // For 'lost' tab, check the user's specific outcome
    filteredBets = bets.filter(bet => {
      // Check if this is a bet the user created and someone won (which means they lost)
      const isCreatorLoss = bet.creator_id === userId && 
        bet.recipients?.some((r: BetRecipient) => r.status === 'won');
      
      // Check if this is a bet where the user was a recipient and lost directly
      const isRecipientLoss = bet.is_recipient && 
        bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'lost');
      
      return isCreatorLoss || isRecipientLoss;
    });
  } else {
    // Default: show all bets
    filteredBets = bets;
    }
    
  // Then apply search query filter if it exists
  if (query) {
    const searchQuery = query.toLowerCase();
    return filteredBets.filter(bet => 
      bet.description?.toLowerCase().includes(searchQuery)
    );
  }
  
  return filteredBets;
};

// Reducer function
function betReducer(state: BetState, action: BetAction): BetState {
  switch (action.type) {
    case 'FETCH_BETS_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'FETCH_BETS_SUCCESS': {
      const bets = action.payload;

      // Filter bets into categories
      const pendingBets = bets.filter(bet => bet.status === 'pending');
      const activeBets = bets.filter(bet => bet.status === 'in_progress');
      const completedBets = bets.filter(bet => 
        bet.status === 'completed' || bet.status === 'cancelled'
      );
      
      // Find the user ID from the first bet in the list
      const userId = bets.length > 0 ? (bets[0].creator_id || '') : '';
      
      // Create special won and lost collections
      const wonBets = bets.filter(bet => {
        // Check if creator won (recipient lost)
        const isCreatorWin = bet.creator_id === userId && 
          bet.recipients?.some((r: BetRecipient) => r.status === 'lost');
        
        // Check if user is recipient and won
        const isRecipientWin = bet.is_recipient && 
          bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'won');
        
        return isCreatorWin || isRecipientWin;
      });
      
      const lostBets = bets.filter(bet => {
        // Check if creator lost (recipient won)
        const isCreatorLoss = bet.creator_id === userId && 
          bet.recipients?.some((r: BetRecipient) => r.status === 'won');
        
        // Check if user is recipient and lost
        const isRecipientLoss = bet.is_recipient && 
          bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'lost');
        
        return isCreatorLoss || isRecipientLoss;
      });
      
      // Filter based on active tab and search query
      const filteredBets = filterBets(bets, state.activeTab, state.searchQuery, userId);
      
      return {
        ...state,
        bets,
        pendingBets,
        activeBets,
        completedBets,
        wonBets,
        lostBets,
        filteredBets,
        loading: false,
        refreshing: false,
        lastUpdated: Date.now()
      };
      }
    case 'FETCH_BETS_ERROR':
      return {
        ...state,
        loading: false,
        refreshing: false,
        error: action.payload
      };
    case 'UPDATE_BET': {
      const updatedBet = action.payload;
      const updatedBets = state.bets.map(bet => 
        bet.id === updatedBet.id ? updatedBet : bet
      );
      
      // Re-filter the updated bets
      const pendingBets = updatedBets.filter(bet => bet.status === 'pending');
      const activeBets = updatedBets.filter(bet => bet.status === 'in_progress');
      const completedBets = updatedBets.filter(bet => 
        bet.status === 'completed' || bet.status === 'cancelled'
      );
      
      // Find the user ID from the first bet in the list
      const userId = updatedBets.length > 0 ? (updatedBets[0].creator_id || '') : '';
      
      // Create special won and lost collections
      const wonBets = updatedBets.filter(bet => {
        // Check if creator won (recipient lost)
        const isCreatorWin = bet.creator_id === userId && 
          bet.recipients?.some((r: BetRecipient) => r.status === 'lost');
        
        // Check if user is recipient and won
        const isRecipientWin = bet.is_recipient && 
          bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'won');
        
        return isCreatorWin || isRecipientWin;
      });
      
      const lostBets = updatedBets.filter(bet => {
        // Check if creator lost (recipient won)
        const isCreatorLoss = bet.creator_id === userId && 
          bet.recipients?.some((r: BetRecipient) => r.status === 'won');
        
        // Check if user is recipient and lost
        const isRecipientLoss = bet.is_recipient && 
          bet.recipients?.some((r: BetRecipient) => r.recipient_id === userId && r.status === 'lost');
        
        return isCreatorLoss || isRecipientLoss;
      });
      
      // Apply filters based on active tab and search query
      const filteredBets = filterBets(updatedBets, state.activeTab, state.searchQuery, userId);
      
      return {
        ...state,
        bets: updatedBets,
        pendingBets,
        activeBets,
        completedBets,
        wonBets,
        lostBets,
        filteredBets,
        lastUpdated: Date.now()
      };
    }
    case 'SET_ACTIVE_TAB': {
      const activeTab = action.payload;
      
      // Find the user ID from the first bet in the list
      const userId = state.bets.length > 0 ? (state.bets[0].creator_id || '') : '';
      
      // Update filtered bets based on new tab
      const filteredBets = filterBets(state.bets, activeTab, state.searchQuery, userId);
      
      return {
        ...state,
        activeTab,
        filteredBets,
        lastUpdated: Date.now()
      };
    }
    case 'SET_SEARCH_QUERY': {
      const searchQuery = action.payload;
      
      // Find the user ID from the first bet in the list
      const userId = state.bets.length > 0 ? (state.bets[0].creator_id || '') : '';
      
      // Update filtered bets based on search query
      const filteredBets = filterBets(state.bets, state.activeTab, searchQuery, userId);
      
      return {
        ...state,
        searchQuery,
        filteredBets,
        lastUpdated: Date.now()
      };
    }
    case 'SET_REFRESHING':
      return {
        ...state,
        refreshing: action.payload
      };
    case 'REFRESH_STATE':
      return {
        ...state,
        lastUpdated: Date.now()
      };
    default:
      return state;
  }
}

// Provider component
export const BetProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(betReducer, initialState);
  
  // Fetch all bets for the current user
  const fetchBets = useCallback(async () => {
    if (!user) return;
    
    dispatch({ type: 'FETCH_BETS_START' });
    
    try {
      // Get bets where user is the creator
      const { data: createdBets, error: createdError } = await supabase
        .from('bets')
        .select(`
          *,
          bet_recipients (*)
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
        
      if (createdError) {
        console.error("Error fetching created bets:", createdError);
        dispatch({ type: 'FETCH_BETS_ERROR', payload: createdError.message });
        return;
      }
      
      // Get bets where user is a recipient
      const { data: recipientBets, error: recipientError } = await supabase
        .from('bet_recipients')
        .select(`
          *,
          bets (*)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });
        
      if (recipientError) {
        console.error("Error fetching recipient bets:", recipientError);
        dispatch({ type: 'FETCH_BETS_ERROR', payload: recipientError.message });
        return;
      }
      
      // Create a uniform format for all bet types
      const allProcessedBets: Bet[] = [];
      
      // Process bets where user is creator
      if (createdBets && createdBets.length > 0) {
        createdBets.forEach(bet => {
          // Extract recipients from bet_recipients
          const recipients = bet.bet_recipients || [];
          
          // Create standardized bet object
          const processedBet: Bet = {
            ...bet,
            recipients, // Use recipients instead of bet_recipients for consistency
            is_recipient: false // Flag to indicate user is creator
          };
          
          // Remove the original bet_recipients to avoid duplication
          delete processedBet.bet_recipients;
          
          allProcessedBets.push(processedBet);
        });
      }
      
      // Process bets where user is a recipient
      if (recipientBets && recipientBets.length > 0) {
        recipientBets.forEach(item => {
          // Ensure bet data exists
          if (!item.bets) return;
          
          const bet = item.bets as Bet;
            
          // Create standardized bet object
          const processedBet: Bet = {
            ...bet,
            recipients: [item], // Add this recipient to the recipients array
            is_recipient: true // Flag to indicate user is recipient
          };
          
          // Remove the original bet_recipients to avoid duplication
          delete processedBet.bet_recipients;
          
          allProcessedBets.push(processedBet);
        });
      }
      
      // Deduplicate bets (in case user is both creator and recipient)
      const uniqueBets = Array.from(
        new Map(allProcessedBets.map(bet => [bet.id, bet])).values()
      );
      
      dispatch({ type: 'FETCH_BETS_SUCCESS', payload: uniqueBets });
    } catch (error) {
      console.error("Unexpected error fetching bets:", error);
      dispatch({ type: 'FETCH_BETS_ERROR', payload: 'An unexpected error occurred' });
    }
  }, [user]);
  
  // Set active tab
  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);
  
  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);
  
  // Refresh handler
  const onRefresh = useCallback(() => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    fetchBets();
  }, [fetchBets]);
      
  // Delete bet
  const deleteBet = useCallback(async (betId: string) => {
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);
      
      if (error) {
        console.error("Error deleting bet:", error);
        Alert.alert("Error", "Failed to delete bet");
      } else {
        Alert.alert("Success", "Bet deleted successfully");
        fetchBets();
      }
    } catch (error) {
      console.error("Error in deleteBet:", error);
      Alert.alert("Error", "An unexpected error occurred");
    }
  }, [fetchBets]);

  // Handle rejecting a bet
  const handleRejectBet = useCallback(async (recipientId: string) => {
    try {
      const { data, error } = await supabase.rpc('reject_bet', {
          p_recipient_id: recipientId
      });
      
      if (error) {
        console.error("Error rejecting bet:", error);
        Alert.alert("Error", "Failed to reject bet");
      } else {
        fetchBets();
      }
    } catch (error) {
      console.error("Error in handleRejectBet:", error);
      Alert.alert("Error", "An unexpected error occurred");
    }
  }, [fetchBets]);
  
  // Handle accepting a bet
  const handleAcceptBet = useCallback(async (recipientId: string) => {
    try {
      const { data, error } = await supabase.rpc('secure_accept_bet', {
          p_recipient_id: recipientId
      });
      
      if (error) {
        console.error("Error accepting bet:", error);
        Alert.alert("Error", "Failed to accept bet");
      } else {
        fetchBets();
      }
    } catch (error) {
      console.error("Error in handleAcceptBet:", error);
      Alert.alert("Error", "An unexpected error occurred");
    }
  }, [fetchBets]);

  // Force a refresh of the state without fetching new data
  const refreshBets = useCallback(() => {
    dispatch({ type: 'REFRESH_STATE' });
  }, []);
  
  // Fetch bets when user changes
  useEffect(() => {
    fetchBets();
  }, [user, fetchBets]);
  
  // Set up real-time subscription for bet updates
  useEffect(() => {
    if (!user) return;
    
    // We'll use standard channel subscriptions instead of table-specific ones
    // Subscribe to changes on the bets and bet_recipients tables
    const betChannel = supabase.channel('public:bets');
    const recipientChannel = supabase.channel('public:bet_recipients');
    
    // Set up the subscriptions
    betChannel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bets',
        filter: `creator_id=eq.${user.id}` 
      }, () => {
        console.log('Bets change received');
        fetchBets(); // Refetch all bets when changes occur
      })
      .subscribe();
    
    recipientChannel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bet_recipients',
        filter: `recipient_id=eq.${user.id}` 
      }, () => {
        console.log('Bet recipients change received');
        fetchBets(); // Refetch all bets when changes occur
      })
      .subscribe();
    
    // Clean up subscriptions
    return () => {
      betChannel.unsubscribe();
      recipientChannel.unsubscribe();
    };
  }, [user, fetchBets]);
  
  const value = {
    ...state,
      fetchBets,
    refreshBets,
      setActiveTab,
      setSearchQuery,
      onRefresh,
    deleteBet,
    handleRejectBet,
    handleAcceptBet
  };
  
  return (
    <BetContext.Provider value={value}>
      {children}
    </BetContext.Provider>
  );
}; 

// Custom hook to use bet context
export const useBets = () => useContext(BetContext); 