import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Bet, BetRecipient, BetStatus, RecipientStatus, PendingOutcome } from '../types/betTypes';

// Define state type
interface BetDetailsState {
  bet: Bet | null;
  recipients: BetRecipient[];
  loading: boolean;
  error: string | null;
  recipientStatus: RecipientStatus | '';
  recipientId: string | null;
  isCreator: boolean;
  opponentPendingOutcome: PendingOutcome;
  pendingOutcome: PendingOutcome;
  hasPendingOutcome: boolean;
  hasWonOrLostRecipient: boolean;
  effectiveBetStatus: BetStatus | 'pending'; // Use 'pending' as default but allow other types
}

// Define action types
type BetDetailsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { bet: Bet, recipients: BetRecipient[], currentUserId: string | undefined } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'UPDATE_COMPUTED_VALUES'; payload: { currentUserId: string | undefined } }
  | { type: 'CLEAR_DATA' };

// Initial state
const initialState: BetDetailsState = {
  bet: null,
  recipients: [],
  loading: true,
  error: null,
  recipientStatus: '',
  recipientId: null,
  isCreator: false,
  opponentPendingOutcome: null,
  pendingOutcome: null,
  hasPendingOutcome: false,
  hasWonOrLostRecipient: false,
  effectiveBetStatus: 'pending'
};

// Type guard for RecipientStatus
const isRecipientStatus = (status: string | undefined): status is RecipientStatus => {
  const validStatuses: ReadonlyArray<RecipientStatus> = [
    'pending', 'in_progress', 'rejected', 'creator', 'won', 'lost'
  ];
  return !!status && validStatuses.includes(status as RecipientStatus);
};

// Type guard for BetStatus
const isBetStatus = (status: string | undefined): status is BetStatus => {
  const validStatuses: ReadonlyArray<BetStatus> = [
    'pending', 'in_progress', 'completed', 'cancelled'
  ];
  return !!status && validStatuses.includes(status as BetStatus);
};

// Helper to safely get recipient status
const getRecipientStatus = (status: string | undefined): RecipientStatus | '' => {
  if (isRecipientStatus(status)) {
    return status;
  }
  return '';
};

// Helper to safely get bet status
const getBetStatus = (status: string | undefined): BetStatus | 'pending' => {
  if (isBetStatus(status)) {
    return status;
  }
  return 'pending';
};

// Reducer function
function betDetailsReducer(state: BetDetailsState, action: BetDetailsAction): BetDetailsState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'FETCH_SUCCESS': {
      const { bet, recipients, currentUserId } = action.payload;
      // Calculate derived state
      const isCreator = bet?.creator_id === currentUserId;
      
      // Find recipient record for current user
      const myRecipient = recipients.find(r => r.recipient_id === currentUserId);
      const recipientStatus = getRecipientStatus(myRecipient?.status);
      const recipientId = myRecipient?.id || null;
      
      // Check for pending outcomes
      const hasPendingRecipient = recipients.some(r => r.pending_outcome !== null);
      const pendingOutcome = myRecipient?.pending_outcome || null;
      
      // Find opponent's pending outcome
      const opponentWithPendingOutcome = recipients.find(
        r => r.recipient_id !== currentUserId && r.pending_outcome
      );
      const opponentPendingOutcome = opponentWithPendingOutcome?.pending_outcome ?? null;
      
      // Check if any recipient has won or lost
      const hasWonOrLostRecipient = recipients.some(
        r => isRecipientStatus(r.status) && (r.status === 'won' || r.status === 'lost')
      );
      
      // Calculate effective bet status
      let effectiveBetStatus = getBetStatus(bet?.status);
      if (hasWonOrLostRecipient && effectiveBetStatus === 'in_progress') {
        effectiveBetStatus = 'completed';
      }

      return {
        ...state,
        bet,
        recipients,
        loading: false,
        isCreator,
        recipientStatus,
        recipientId,
        opponentPendingOutcome,
        pendingOutcome,
        hasPendingOutcome: hasPendingRecipient,
        hasWonOrLostRecipient,
        effectiveBetStatus
      };
    }
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'UPDATE_COMPUTED_VALUES': {
      // Recalculate derived values without refetching data
      const { currentUserId } = action.payload;
      const isCreator = state.bet?.creator_id === currentUserId;
      
      // Find recipient record for current user
      const myRecipient = state.recipients.find(r => r.recipient_id === currentUserId);
      const recipientStatus = getRecipientStatus(myRecipient?.status);
      const recipientId = myRecipient?.id || null;
      
      // Check for pending outcomes
      const hasPendingRecipient = state.recipients.some(r => r.pending_outcome !== null);
      const pendingOutcome = myRecipient?.pending_outcome || null;
      
      // Find opponent's pending outcome
      const opponentWithPendingOutcome = state.recipients.find(
        r => r.recipient_id !== currentUserId && r.pending_outcome
      );
      const opponentPendingOutcome = opponentWithPendingOutcome?.pending_outcome ?? null;
      
      // Check if any recipient has won or lost
      const hasWonOrLostRecipient = state.recipients.some(
        r => isRecipientStatus(r.status) && (r.status === 'won' || r.status === 'lost')
      );
      
      // Calculate effective bet status
      let effectiveBetStatus = getBetStatus(state.bet?.status);
      if (hasWonOrLostRecipient && effectiveBetStatus === 'in_progress') {
        effectiveBetStatus = 'completed';
      }

      return {
        ...state,
        isCreator,
        recipientStatus,
        recipientId,
        opponentPendingOutcome,
        pendingOutcome,
        hasPendingOutcome: hasPendingRecipient,
        hasWonOrLostRecipient,
        effectiveBetStatus
      };
    }
    case 'CLEAR_DATA':
      return initialState;
    default:
      return state;
  }
}

export const useBetDetails = (betId?: string, refresh?: number) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(betDetailsReducer, initialState);
  
  // Update computed values when user changes
  useEffect(() => {
    if (state.bet && state.recipients.length > 0) {
      dispatch({ 
        type: 'UPDATE_COMPUTED_VALUES', 
        payload: { currentUserId: user?.id } 
      });
    }
  }, [user?.id]);

  // Memoized fetch function
  const fetchBetDetails = useCallback(async () => {
    if (!betId) {
      dispatch({ type: 'CLEAR_DATA' });
      return;
    }
    
    dispatch({ type: 'FETCH_START' });
    
    try {
      // Fetch bet details with creator info
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('*')
        .eq('id', betId)
        .single();
      
      if (betError) {
        console.error("Error fetching bet:", betError);
        dispatch({ type: 'FETCH_ERROR', payload: betError.message });
        return;
      }
      
      if (!bet) {
        dispatch({ type: 'FETCH_ERROR', payload: 'Bet not found' });
        return;
      }
      
      // Fetch creator info separately
      if (bet.creator_id) {
        const { data: creatorData } = await supabase
          .from('users')
          .select('*')
          .eq('id', bet.creator_id)
          .single();
          
        if (creatorData) {
          bet.creator = creatorData;
        }
      }
      
      // Fetch bet recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('*')
        .eq('bet_id', betId);
      
      if (recipientsError) {
        console.error("Error fetching recipients:", recipientsError);
        dispatch({ type: 'FETCH_ERROR', payload: recipientsError.message });
        return;
      }
      
      // Use an empty array if no recipients exist
      const recipients = recipientsData ?? [];
      
      // Only fetch profiles if we have recipients
      if (recipients.length > 0) {
        // Get unique recipient IDs (filter out nulls/undefined)
        const recipientIds = [...new Set(
          recipients
            .map(r => r.recipient_id)
            .filter(Boolean)
        )];
        
        if (recipientIds.length > 0) {
          // Fetch all profiles in a single query
          const { data: profilesData } = await supabase
            .from('users')
            .select('*')
            .in('id', recipientIds);
          
          // Add profile data to recipients if profiles were found
          if (profilesData?.length) {
            // Create a Map for faster lookups
            const profileMap = new Map(
              profilesData.map(profile => [profile.id, profile])
            );
            
            // Enhance recipients with profile data
            recipients.forEach(recipient => {
              if (recipient.recipient_id) {
                recipient.profiles = profileMap.get(recipient.recipient_id) || null;
              }
            });
          }
        }
      }
      
      // Update state with fetched data
      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { 
          bet, 
          recipients,
          currentUserId: user?.id
        }
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      dispatch({ type: 'FETCH_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "Failed to load bet details");
    }
  }, [betId, user?.id]);
  
  // Fetch bet details when params change
  useEffect(() => {
    fetchBetDetails();
  }, [fetchBetDetails, betId, refresh]);
  
  return {
    ...state,
    fetchBetDetails
  };
}; 