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
  hasWonOrLostRecipient: boolean;
  isMyOutcome?: 'won' | 'lost' | null; // User-specific outcome for this bet
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
      // Special handling for in_progress and completed tabs
      if (activeTab === 'in_progress') {
        // Only show bets that are truly in progress and don't have won/lost recipients
        const isReallyInProgress = bet.status === 'in_progress' && 
          !bet.hasWonOrLostRecipient;
        const matchesSearch = searchQuery === '' || 
          bet.description.toLowerCase().includes(searchQuery.toLowerCase());
        return isReallyInProgress && matchesSearch;
      } 
      else if (activeTab === 'completed') {
        // Show bets that are completed OR have won/lost recipients
        const isCompletedOrDecided = bet.status === 'completed' || 
          bet.hasWonOrLostRecipient;
        const matchesSearch = searchQuery === '' || 
          bet.description.toLowerCase().includes(searchQuery.toLowerCase());
        return isCompletedOrDecided && matchesSearch;
      }
      else if (activeTab === 'won') {
        // For 'won' tab, check the user's specific outcome for this bet
        const userWon = bet.status === 'won' || (bet.isMyOutcome === 'won');
        const matchesSearch = searchQuery === '' || 
          bet.description.toLowerCase().includes(searchQuery.toLowerCase());
        return userWon && matchesSearch;
      }
      else if (activeTab === 'lost') {
        // For 'lost' tab, check the user's specific outcome for this bet
        const userLost = bet.status === 'lost' || (bet.isMyOutcome === 'lost');
        const matchesSearch = searchQuery === '' || 
          bet.description.toLowerCase().includes(searchQuery.toLowerCase());
        return userLost && matchesSearch;
      }
      else {
        // Normal filtering for other tabs
        const matchesTab = bet.status === activeTab;
        const matchesSearch = searchQuery === '' || 
          bet.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
      }
    });
    
    setFilteredBets(filtered);
  }, [activeTab, searchQuery, bets]);

  const fetchBets = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        console.error("No user found in fetchBets");
        return;
      }
      
      // Get all bets created by the user
      const { data: myBets, error: myBetsError } = await supabase
        .from('bets')
        .select('*')
        .eq('creator_id', user.id);
        
      if (myBetsError) {
        console.error("Error fetching created bets:", myBetsError);
        return;
      }
      
      // Get all bet recipients where the user is a recipient
      const { data: recipientBets, error: recipientBetsError } = await supabase
        .from('bet_recipients')
        .select('*, bets(id, description, stake, creator_id, status, created_at)')
        .eq('recipient_id', user.id);
        
      if (recipientBetsError) {
        console.error("Error fetching recipient bets:", recipientBetsError);
        return;
      }
      
      console.log("Fetched recipient bets:", recipientBets);
      
      // Extract bet IDs from recipient bets
      const betIds = recipientBets.map(rb => rb.bet_id);
      
      // Get details for these bets
      let betDetails: any[] = [];
      if (betIds.length > 0) {
        const { data: betData, error: betDataError } = await supabase
          .from('bets')
          .select('*')
          .in('id', betIds);
          
        if (betDataError) {
          console.error("Error fetching bet details:", betDataError);
        } else if (betData) {
          betDetails = betData;
        }
      }
      
      // For each bet, check if any recipients have won/lost status
      const betWonLostStatus: Record<string, boolean> = {};
      
      // First, check bets I created
      for (const bet of myBets || []) {
        const { data: recipients, error } = await supabase
          .from('bet_recipients')
          .select('id, status')
          .eq('bet_id', bet.id);
          
        if (!error && recipients) {
          betWonLostStatus[bet.id] = recipients.some(r => 
            r.status === 'won' || r.status === 'lost'
          );
        }
      }
      
      // Combine all bets
      let allBets: ProcessedBet[] = [];
      
      // Process bets created by the user
      if (myBets && myBets.length > 0) {
        const processedCreatedBets = await Promise.all(myBets.map(async bet => {
          // Check if there are any recipients with 'lost' status (meaning creator won)
          let myOutcome: 'won' | 'lost' | null = null;
          
          const { data: recipients, error } = await supabase
            .from('bet_recipients')
            .select('id, status')
            .eq('bet_id', bet.id);
            
          if (!error && recipients) {
            // If any recipient lost, the creator won
            if (recipients.some(r => r.status === 'lost')) {
              myOutcome = 'won';
            }
            // If any recipient won, the creator lost
            else if (recipients.some(r => r.status === 'won')) {
              myOutcome = 'lost';
            }
          }
          
          return {
            id: bet.id,
            description: bet.description || "No description",
            stake: bet.stake || 0,
            timestamp: formatTimestamp(bet.created_at),
            commentCount: 0,
            status: bet.status || 'pending',
            isCreator: true,
            hasWonOrLostRecipient: betWonLostStatus[bet.id] || false,
            isMyOutcome: myOutcome
          } as ProcessedBet;
        }));
        
        allBets = [...processedCreatedBets];
      }
      
      // Process bets where user is a recipient
      if (recipientBets && recipientBets.length > 0 && betDetails.length > 0) {
        const processedRecipientBets = recipientBets
          .map(recipientBet => {
            // Find the corresponding bet details
            const bet = betDetails.find(b => b.id === recipientBet.bet_id);
            if (!bet) return null;
            
            // For bets I'm a recipient of, check if my status is won/lost
            const hasWonLost = recipientBet.status === 'won' || recipientBet.status === 'lost';
            
            // Set my outcome based on my recipient status
            let myOutcome: 'won' | 'lost' | null = null;
            if (recipientBet.status === 'won') myOutcome = 'won';
            else if (recipientBet.status === 'lost') myOutcome = 'lost';
            
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
              creatorId: bet.creator_id,
              hasWonOrLostRecipient: hasWonLost || betWonLostStatus[bet.id] || false,
              isMyOutcome: myOutcome
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
      // First check if this recipient record exists
      const { data: recipientExists, error: checkError } = await supabase
        .from('bet_recipients')
        .select('id, bet_id, recipient_id')
        .eq('id', recipientId)
        .single();
        
      if (checkError) {
        console.log("Recipient record not found, checking if this is a bet ID...");
        
        // This might be a bet ID instead of a recipient ID
        // Let's check if it's a valid bet ID
        const { data: betData, error: betError } = await supabase
          .from('bets')
          .select('id, creator_id')
          .eq('id', recipientId)
          .single();
          
        if (!betError && betData) {
          console.log(`Valid bet ID found: ${recipientId}`);
          // It's a valid bet ID, now find all recipients for this bet
          const { data: recipients, error: recipientsError } = await supabase
            .from('bet_recipients')
            .select('id, recipient_id')
            .eq('bet_id', recipientId);
            
          if (!recipientsError && recipients && recipients.length > 0) {
            // Use the first recipient as the "opponent" for creator actions
            const opponentId = recipients[0].id;
            return { betId: recipientId, opponentId };
          }
          
          // If we get here, it's a valid bet but no recipients - unusual case
          return { betId: recipientId, opponentId: null };
        }
        
        // If we get here, it's neither a valid recipient ID nor a valid bet ID
        console.error("Invalid ID - not a recipient ID or bet ID:", recipientId);
        return { betId: '', opponentId: null };
      }
      
      const betId = recipientExists.bet_id;
      
      // Find all recipients for this bet
      const { data: allRecipients, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('id, recipient_id')
        .eq('bet_id', betId);
        
      if (recipientsError) {
        console.error("Error fetching all recipients:", recipientsError);
        return { betId, opponentId: null };
      }
      
      // If the current user is the creator, use all recipients as potential opponents
      // If the user is a recipient, find any recipient that isn't the current one
      if (user && recipientExists.recipient_id === user.id) {
        // User is a recipient, find another recipient as opponent
        const opponent = allRecipients.find(r => r.id !== recipientId);
        const opponentId = opponent ? opponent.id : null;
        return { betId, opponentId };
      } else {
        // User is likely the creator, use the first recipient that isn't this one as opponent
        const opponent = allRecipients.find(r => r.id !== recipientId);
        const opponentId = opponent ? opponent.id : null;
        return { betId, opponentId };
      }
    } catch (error) {
      console.error("Unexpected error in findOpponent:", error);
      // Return a partial result if possible to avoid complete failure
      return { betId: '', opponentId: null };
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