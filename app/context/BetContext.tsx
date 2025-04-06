import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

// Define types for bet data
export type BetDetails = {
  id: string;
  description: string;
  stake: number;
  status: string;
  due_date?: string;
  created_at: string;
  creator_id: string;
};

export type RecipientBet = {
  id: string;
  status: string;
  bet_id: string;
  pending_outcome?: string | null;
  recipient_id: string;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url?: string;
};

export type ProcessedBet = {
  id: string;
  description: string;
  stake: number;
  timestamp: string;
  commentCount: number;
  status: 'in_progress' | 'pending' | 'lost' | 'won' | string;
  pendingOutcome?: string | null;
  isCreator: boolean;
  recipientId?: string;
  creatorId?: string;
};

export type RecipientUpdate = {
  status?: string;
  pending_outcome?: string | null;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
};

// Define the BetContext type
type BetContextType = {
  bets: ProcessedBet[];
  filteredBets: ProcessedBet[];
  loading: boolean;
  refreshing: boolean;
  activeTab: string;
  searchQuery: string;
  fetchBets: () => Promise<void>;
  deleteBet: (betId: string) => Promise<void>;
  handleRejectBet: (recipientId: string) => Promise<void>;
  handleAcceptBet: (recipientId: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  updateRecipientStatuses: (
    recipientId: string, 
    recipientUpdate: RecipientUpdate, 
    opponentId: string | null, 
    opponentUpdate: RecipientUpdate
  ) => Promise<boolean>;
  findOpponent: (recipientId: string) => Promise<{ betId: string; opponentId: string | null }>;
};

const initialState: BetContextType = {
  bets: [],
  filteredBets: [],
  loading: false,
  refreshing: false,
  activeTab: 'in_progress',
  searchQuery: '',
  fetchBets: async () => {},
  deleteBet: async () => {},
  handleRejectBet: async () => {},
  handleAcceptBet: async () => {},
  setActiveTab: () => {},
  setSearchQuery: () => {},
  onRefresh: () => {},
  updateRecipientStatuses: async () => false,
  findOpponent: async () => ({ betId: '', opponentId: null }),
};

const BetContext = createContext<BetContextType>(initialState);

export const useBets = () => useContext(BetContext);

type BetProviderProps = {
  children: ReactNode;
};

export const BetProvider: React.FC<BetProviderProps> = ({ children }) => {
  const [bets, setBets] = useState<ProcessedBet[]>([]);
  const [filteredBets, setFilteredBets] = useState<ProcessedBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('in_progress');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { user } = useAuth();
  
  // Helper function to format timestamps
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}`;
    }
    
    // Check if yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}`;
    }
    
    // Otherwise return month and day
    return `${date.toLocaleDateString([], {month: 'short', day: 'numeric'})} at ${date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}`;
  };

  // Filter bets based on active tab and search query
  useEffect(() => {
    const filtered = bets.filter((bet) => {
      const matchesTab = bet.status === activeTab;
      const matchesSearch = searchQuery === '' || 
        bet.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
    
    setFilteredBets(filtered);
  }, [activeTab, searchQuery, bets]);

  const fetchBets = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setBets([]);
        setLoading(false);
        return;
      }
      
      // Try fetching bets where user is creator
      const { data: myBets, error: myBetsError } = await supabase
        .from('bets')
        .select('id, description, stake, status, created_at')
        .eq('creator_id', user.id);
      
      if (myBetsError) {
        console.error("Error fetching created bets:", myBetsError);
        setBets([]);
        setLoading(false);
        return;
      }
      
      // Fetch bets where user is a recipient
      const { data: recipientBets, error: recipientBetsError } = await supabase
        .from('bet_recipients')
        .select('id, status, bet_id, pending_outcome')
        .eq('recipient_id', user.id);
      
      if (recipientBetsError) {
        console.error("Error fetching recipient bets:", recipientBetsError);
      }
      
      // Now fetch the actual bet details for those recipient bets
      let betDetails: BetDetails[] = [];
      if (recipientBets && recipientBets.length > 0) {
        // Extract bet IDs from recipient bets
        const betIds = recipientBets.map(rb => rb.bet_id);
        
        // Fetch the bet details
        const { data: betData, error: betDataError } = await supabase
          .from('bets')
          .select('id, description, stake, status, created_at, creator_id')
          .in('id', betIds);
          
        if (betDataError) {
          console.error("Error fetching bet details:", betDataError);
        } else {
          betDetails = betData || [];
        }
      }

      // Process the bets
      let allBets: ProcessedBet[] = [];
      
      // Process bets created by the user
      if (myBets && myBets.length > 0) {
        const processedCreatedBets = myBets.map(bet => {
          return {
            id: bet.id,
            description: bet.description || "No description",
            stake: bet.stake || 0,
            timestamp: formatTimestamp(bet.created_at),
            commentCount: 0,
            status: bet.status || 'pending',
            isCreator: true
          } as ProcessedBet;
        });
        
        allBets = [...processedCreatedBets];
      }
      
      // Process bets where user is a recipient
      if (recipientBets && recipientBets.length > 0 && betDetails.length > 0) {
        const processedRecipientBets = recipientBets
          .map(recipientBet => {
            // Find the corresponding bet details
            const bet = betDetails.find(b => b.id === recipientBet.bet_id);
            if (!bet) return null;
            
            return {
              id: bet.id,
              description: bet.description || "No description",
              stake: bet.stake || 0,
              timestamp: formatTimestamp(bet.created_at),
              commentCount: 0,
              status: recipientBet.status || 'pending',
              pendingOutcome: recipientBet.pending_outcome,
              isCreator: false,
              recipientId: recipientBet.id,
              creatorId: bet.creator_id
            } as ProcessedBet;
          })
          .filter((bet): bet is ProcessedBet => bet !== null); // Type guard to remove nulls
        
        allBets = [...allBets, ...processedRecipientBets];
      }
      
      setBets(allBets);
    } catch (error) {
      console.error("Unexpected error in fetchBets:", error);
      setBets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteBet = async (betId: string) => {
    try {
      setLoading(true);
      
      // Direct delete operation with minimal filters
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);
      
      if (error) {
        console.error("Error deleting bet:", error);
        Alert.alert("Error", "Failed to delete bet");
      } else {
        // Update the UI immediately
        setBets(prevBets => prevBets.filter(bet => bet.id !== betId));
        Alert.alert("Success", "Bet deleted successfully");
        
        // Refresh bets to ensure UI is in sync with server
        fetchBets();
      }
    } catch (e) {
      console.error("Exception in deleteBet:", e);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle rejecting a bet
  const handleRejectBet = async (recipientId: string) => {
    try {
      setLoading(true);
      
      // Use the secure function
      const { data, error } = await supabase.rpc(
        'secure_reject_bet',
        { 
          p_recipient_id: recipientId
        }
      );
      
      if (error) {
        console.error("Error rejecting bet:", error);
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      if (data && data.success) {
        // Refresh bets to update UI
        fetchBets();
      } else {
        console.error("Function returned failure:", data);
        Alert.alert("Error", "Failed to reject bet. The server returned an error.");
      }
    } catch (e) {
      console.error("Exception in handleRejectBet:", e);
      Alert.alert("Error", "An unexpected error occurred while rejecting the bet");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle accepting a bet
  const handleAcceptBet = async (recipientId: string) => {
    try {
      setLoading(true);
      
      // Use the secure function
      const { data, error } = await supabase.rpc(
        'secure_accept_bet',
        { 
          p_recipient_id: recipientId
        }
      );
      
      if (error) {
        console.error("Error accepting bet:", error);
        Alert.alert("Error", "Failed to accept bet. Please try again.");
        return;
      }
      
      if (data && data.success) {
        // Refresh bets to update UI
        fetchBets();
      } else {
        console.error("Function returned failure:", data);
        Alert.alert("Error", "Failed to accept bet. The server returned an error.");
      }
    } catch (e) {
      console.error("Exception in handleAcceptBet:", e);
      Alert.alert("Error", "An unexpected error occurred while accepting the bet");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBets();
  };

  // Find the opponent for a given recipient ID
  const findOpponent = async (recipientId: string) => {
    try {
      // Get bet ID for this recipient
      const { data: recipientData, error: recipientError } = await supabase
        .from('bet_recipients')
        .select('bet_id')
        .eq('id', recipientId)
        .single();
        
      if (recipientError || !recipientData) {
        throw new Error("Failed to get bet details");
      }
      
      const betId = recipientData.bet_id;
      
      // Find the opponent's recipient record
      const { data: opponentData, error: opponentError } = await supabase
        .from('bet_recipients')
        .select('id')
        .eq('bet_id', betId)
        .neq('id', recipientId);
        
      // Check if there are any opponents
      if (opponentError) {
        throw new Error("Failed to find opponent");
      }
      
      if (!opponentData || opponentData.length === 0) {
        return { betId, opponentId: null };
      }
      
      const opponentId = opponentData[0].id;
      return { betId, opponentId };
    } catch (error) {
      throw error;
    }
  };

  // Update recipient and opponent statuses
  const updateRecipientStatuses = async (
    recipientId: string, 
    recipientUpdate: RecipientUpdate, 
    opponentId: string | null, 
    opponentUpdate: RecipientUpdate
  ) => {
    try {
      // Update recipient status
      const { error: updateError } = await supabase
        .from('bet_recipients')
        .update(recipientUpdate)
        .eq('id', recipientId);
        
      if (updateError) {
        console.error("Error updating recipient status:", updateError);
        throw new Error("Failed to update status");
      }
      
      // Update opponent's status if an opponent exists
      if (opponentId) {
        const { error: opponentUpdateError } = await supabase
          .from('bet_recipients')
          .update(opponentUpdate)
          .eq('id', opponentId);
          
        if (opponentUpdateError) {
          console.error("Error updating opponent status:", opponentUpdateError);
          console.warn("Your status was updated, but there was an issue updating your opponent's status");
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error in updateRecipientStatuses:", error);
      throw error;
    }
  };

  // Call fetchBets when user changes
  useEffect(() => {
    if (user) {
      fetchBets();
    }
  }, [user]);

  return (
    <BetContext.Provider value={{
      bets,
      filteredBets,
      loading,
      refreshing,
      activeTab,
      searchQuery,
      fetchBets,
      deleteBet,
      handleRejectBet,
      handleAcceptBet,
      setActiveTab,
      setSearchQuery,
      onRefresh,
      updateRecipientStatuses,
      findOpponent
    }}>
      {children}
    </BetContext.Provider>
  );
}; 