import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Bet, BetRecipient } from '../types/betTypes';

// Define state type
interface BetDetailsState {
  bet: Bet | null;
  recipients: BetRecipient[];
  loading: boolean;
  error: string | null;
  recipientStatus: string;
  recipientId: string | null;
  isCreator: boolean;
  opponentPendingOutcome: string | null;
  pendingOutcome: string | null;
  hasPendingOutcome: boolean;
  hasWonOrLostRecipient: boolean;
  effectiveBetStatus: string;
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
      const recipientStatus = myRecipient?.status || '';
      const recipientId = myRecipient?.id || null;
      
      // Check for pending outcomes
      const hasPendingRecipient = recipients.some(r => r.pending_outcome !== null);
      const pendingOutcome = myRecipient?.pending_outcome || null;
      
      // Find opponent's pending outcome
      const opponentWithPendingOutcome = recipients.find(
        r => r.recipient_id !== currentUserId && r.pending_outcome !== null
      );
      const opponentPendingOutcome = opponentWithPendingOutcome?.pending_outcome || null;
      
      // Check if any recipient has won or lost
      const hasWonOrLostRecipient = recipients.some(
        r => r.status === 'won' || r.status === 'lost'
      );
      
      // Calculate effective bet status
      let effectiveBetStatus = bet?.status || 'pending';
      if (hasWonOrLostRecipient) {
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
      const recipientStatus = myRecipient?.status || '';
      const recipientId = myRecipient?.id || null;
      
      // Check for pending outcomes
      const hasPendingRecipient = state.recipients.some(r => r.pending_outcome !== null);
      const pendingOutcome = myRecipient?.pending_outcome || null;
      
      // Find opponent's pending outcome
      const opponentWithPendingOutcome = state.recipients.find(
        r => r.recipient_id !== currentUserId && r.pending_outcome !== null
      );
      const opponentPendingOutcome = opponentWithPendingOutcome?.pending_outcome || null;
      
      // Check if any recipient has won or lost
      const hasWonOrLostRecipient = state.recipients.some(
        r => r.status === 'won' || r.status === 'lost'
      );
      
      // Calculate effective bet status
      let effectiveBetStatus = state.bet?.status || 'pending';
      if (hasWonOrLostRecipient) {
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
          .from('profiles')
          .select('*')
          .eq('id', bet.creator_id)
          .single();
          
        if (creatorData) {
          bet.creator = creatorData;
        }
      }
      
      // Fetch bet recipients without any join
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('*')
        .eq('bet_id', betId);
      
      if (recipientsError) {
        console.error("Error fetching recipients:", recipientsError);
        dispatch({ type: 'FETCH_ERROR', payload: recipientsError.message });
        return;
      }
      
      // Fetch profile information for each recipient
      let recipients = recipientsData || [];
      
      if (recipients.length > 0) {
        // Get all unique recipient IDs
        const recipientIds = [...new Set(recipients.map(r => r.recipient_id))];
        
        // Fetch profiles for all recipients in a single query
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', recipientIds);
        
        if (profilesData) {
          // Add profile data to each recipient
          recipients = recipients.map(recipient => {
            const profile = profilesData.find(p => p.id === recipient.recipient_id);
            return {
              ...recipient,
              profile: profile || null
            };
          });
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