import { useState, useReducer, useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { Bet, BetRecipient, BetStatus, RecipientStatus, PendingOutcome } from '../types/betTypes';

// Define state type
interface BetActionsState {
  loading: boolean;
  processingAction: boolean;
  error: string | null;
  actionType: string | null;
}

// Define action types
type BetActionsReducerAction =
  | { type: 'ACTION_START'; payload: string }
  | { type: 'ACTION_SUCCESS' }
  | { type: 'ACTION_ERROR'; payload: string }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: BetActionsState = {
  loading: false,
  processingAction: false,
  error: null,
  actionType: null
};

// Reducer function
function betActionsReducer(state: BetActionsState, action: BetActionsReducerAction): BetActionsState {
  switch (action.type) {
    case 'ACTION_START':
      return {
        ...state,
        loading: true,
        processingAction: true,
        error: null,
        actionType: action.payload
      };
    case 'ACTION_SUCCESS':
      return {
        ...state,
        loading: false,
        processingAction: false,
        error: null,
        actionType: null
      };
    case 'ACTION_ERROR':
      return {
        ...state,
        loading: false,
        processingAction: false,
        error: action.payload,
        actionType: null
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

interface BetActionsProps {
  betId?: string;
  recipientId?: string | null;
  recipients?: BetRecipient[];
  isCreator?: boolean;
  opponentPendingOutcome?: PendingOutcome;
  navigation: any;
  user: User | null;
  fetchBetDetails: () => void;
  fetchBets: () => void;
}

export const useBetActions = ({
  betId,
  recipientId,
  recipients = [],
  isCreator = false,
  opponentPendingOutcome,
  navigation,
  user,
  fetchBetDetails,
  fetchBets
}: BetActionsProps) => {
  const [state, dispatch] = useReducer(betActionsReducer, initialState);

  // Helper to find opponent info
  const findOpponent = useCallback(async (currentRecipientId: string) => {
    try {
      // Get the bet info first
      const { data: recipientData } = await supabase
        .from('bet_recipients')
        .select('bet_id, recipient_id')
        .eq('id', currentRecipientId)
        .single();
      
      if (!recipientData) {
        return { betId: null, opponentId: null };
      }
      
      // Find the opponent recipient in the same bet
      const { data: opponentData } = await supabase
        .from('bet_recipients')
        .select('id, recipient_id')
        .eq('bet_id', recipientData.bet_id)
        .neq('recipient_id', user?.id)
        .limit(1)
        .single();
      
      return {
        betId: recipientData.bet_id,
        opponentId: opponentData?.id || null
      };
    } catch (error) {
      console.error("Error finding opponent:", error);
      return { betId: null, opponentId: null };
    }
  }, [user?.id]);
  
  // Helper to update recipient statuses
  const updateRecipientStatuses = useCallback(async (
    myRecipientId: string, 
    myUpdate: {
      status?: RecipientStatus;
      pending_outcome?: PendingOutcome;
      outcome_claimed_by?: string | null;
      outcome_claimed_at?: string | null;
    }, 
    opponentId: string | null, 
    opponentUpdate: {
      status?: RecipientStatus;
      pending_outcome?: PendingOutcome;
      outcome_claimed_by?: string | null;
      outcome_claimed_at?: string | null;
    }
  ) => {
    try {
      // Update my status
      if (myRecipientId) {
        const { error: myError } = await supabase
          .from('bet_recipients')
          .update(myUpdate)
          .eq('id', myRecipientId);
        
        if (myError) {
          Alert.alert("Error", "Failed to update your status. Please try again.");
          return false;
        }
      }
      
      // Update opponent status if available
      if (opponentId) {
        const { error: opponentError } = await supabase
          .from('bet_recipients')
          .update(opponentUpdate)
          .eq('id', opponentId);
        
        if (opponentError) {
          console.error("Error updating opponent:", opponentError);
          // Continue anyway as the primary update succeeded
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error updating recipient statuses:", error);
      return false;
    }
  }, []);
  
  // Delete a bet (creator only)
  const deleteBet = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'delete' });
      
      // Delete the bet from Supabase
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId)
        .eq('creator_id', user?.id) // Ensure only creator can delete
        .eq('status', 'pending'); // Only pending bets can be deleted
      
      if (error) {
        console.error("Error deleting bet:", error);
        dispatch({ type: 'ACTION_ERROR', payload: error.message });
        Alert.alert("Error", "Failed to delete bet. Please try again.");
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Navigate back to home screen with safer navigation
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Unexpected error in deleteBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [betId, user?.id, navigation]);
  
  // Prompt for confirmation before deleting
  const confirmDeleteBet = useCallback(() => {
    Alert.alert(
      "Delete Bet",
      "Are you sure you want to delete this bet? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", onPress: deleteBet, style: "destructive" }
      ]
    );
  }, [deleteBet]);
  
  // Accept a bet (recipient only)
  const handleAcceptBet = useCallback(async () => {
    try {
      if (!recipientId) {
        Alert.alert("Error", "No recipient ID available");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'accept' });
      
      // Call accept_bet RPC function
      const { data, error } = await supabase.rpc('secure_accept_bet', {
        p_recipient_id: recipientId
      });
      
      if (error) {
        console.error("Error accepting bet:", error);
        dispatch({ type: 'ACTION_ERROR', payload: error.message });
        Alert.alert("Error", "Failed to accept bet. Please try again.");
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      await fetchBetDetails();
      await fetchBets();
      
      // Success alert removed
    } catch (error) {
      console.error("Unexpected error in acceptBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [recipientId, fetchBetDetails, fetchBets]);
  
  // Reject a bet (recipient only)
  const handleRejectBet = useCallback(async () => {
    try {
      if (!recipientId) {
        Alert.alert("Error", "No recipient ID available");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'reject' });
      
      // Call reject_bet RPC function
      const { data, error } = await supabase.rpc('reject_bet', {
        p_recipient_id: recipientId
      });
      
      if (error) {
        console.error("Error rejecting bet:", error);
        dispatch({ type: 'ACTION_ERROR', payload: error.message });
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      await fetchBetDetails();
      await fetchBets();
      
      // Success alert removed
    } catch (error) {
      console.error("Unexpected error in rejectBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [recipientId, fetchBetDetails, fetchBets]);
  
  // Declare winner
  const handleDeclareWin = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'declare-win' });
      
      // Handle the case where the current user is the creator
      if (isCreator && !recipientId) {
        // Get the creator's recipient record or find appropriate recipient to update
        const opponent = recipients.find(r => r.recipient_id !== user?.id);
        if (!opponent) {
          Alert.alert("Error", "Could not find opponent to declare outcome against");
          dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
          return;
        }
        
        // For creator win declaration - DO NOT change opponent's status to 'pending' 
        // if they're already 'in_progress', just clear any pending outcomes
        let opponentStatus = opponent.status;
        
        // Only set to pending if they're not already in a specific state
        if (!['in_progress', 'won', 'lost'].includes(opponent.status)) {
          opponentStatus = 'pending';
        }
        
        const result = await updateRecipientStatuses(
          opponent.id, // Update opponent's record
          { 
            status: opponentStatus, 
            pending_outcome: null, // Don't set their pending outcome
            outcome_claimed_by: null, 
            outcome_claimed_at: null 
          },
          null, // No direct second update needed
          {} // No update needed
        );
        
        if (!result) {
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to declare win' });
          return;
        }
        
        // Create a "creator record" if it doesn't exist
        const { data: creatorRecord, error: creatorError } = await supabase
          .from('bet_recipients')
          .select('*')
          .eq('bet_id', betId)
          .eq('recipient_id', user?.id)
          .maybeSingle();
        
        if (creatorError) {
          console.error("Error checking for creator record:", creatorError);
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to check creator status' });
          return;
        }
        
        // If creator has a recipient record, update it with pending outcome
        if (creatorRecord) {
          const { error: updateError } = await supabase
            .from('bet_recipients')
            .update({ 
              status: 'pending',
              pending_outcome: 'won', 
              outcome_claimed_by: user?.id,
              outcome_claimed_at: new Date().toISOString()
            })
            .eq('id', creatorRecord.id);
            
          if (updateError) {
            console.error("Error updating creator record:", updateError);
            dispatch({ type: 'ACTION_ERROR', payload: 'Failed to update creator status' });
            return;
          }
        } else {
          // If the creator doesn't have a recipient record, insert one
          const { error: insertError } = await supabase
            .from('bet_recipients')
            .insert({ 
              bet_id: betId,
              recipient_id: user?.id, 
              status: 'pending',
              pending_outcome: 'won',
              outcome_claimed_by: user?.id,
              outcome_claimed_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error("Error creating creator record:", insertError);
            dispatch({ type: 'ACTION_ERROR', payload: 'Failed to create creator status' });
            return;
          }
        }
      } else if (!recipientId) {
        Alert.alert("Error", "No recipient ID found");
        dispatch({ type: 'ACTION_ERROR', payload: 'No recipient ID found' });
        return;
      } else {
        // Find opponent if not provided
        let opponentRecipientId: string | null = null;
        if (recipients && recipients.length > 0) {
          const opponent = recipients.find(r => r.recipient_id !== user?.id && r.id !== recipientId);
          opponentRecipientId = opponent?.id || null;
        }
        
        // Update statuses
        const result = await updateRecipientStatuses(
          recipientId, 
          { 
            status: 'pending' as RecipientStatus, 
            pending_outcome: 'won' as PendingOutcome, 
            outcome_claimed_by: user?.id, 
            outcome_claimed_at: new Date().toISOString() 
          },
          opponentRecipientId,
          { 
            status: 'pending' as RecipientStatus, 
            pending_outcome: 'lost' as PendingOutcome // Set opponent's pending outcome as "lost"
          }
        );
        
        if (!result) {
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to declare win' });
          return;
        }
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      fetchBetDetails();
      fetchBets();
      
      // Success alert removed
    } catch (error) {
      console.error("Error declaring win:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to declare win. Please try again.");
    }
  }, [recipientId, recipients, user?.id, isCreator, betId, updateRecipientStatuses, fetchBetDetails, fetchBets]);
  
  // Declare loss
  const handleDeclareLoss = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'declare-loss' });
      
      // Handle the case where the current user is the creator
      if (isCreator && !recipientId) {
        // Get the creator's recipient record or find appropriate recipient to update
        const opponent = recipients.find(r => r.recipient_id !== user?.id);
        if (!opponent) {
          Alert.alert("Error", "Could not find opponent to declare outcome against");
          dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
          return;
        }
        
        // Update recipient statuses - immediate win for opponent, loss for creator
        const result = await updateRecipientStatuses(
          opponent.id, // Update opponent's record
          { 
            status: 'won' as RecipientStatus, 
            pending_outcome: null,
            outcome_claimed_by: user?.id, 
            outcome_claimed_at: new Date().toISOString() 
          },
          null, // No second recipient to update
          {} // No update needed
        );
        
        if (!result) {
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to declare loss' });
          return;
        }
        
        // Create a "creator record" if it doesn't exist to mark the loss
        const { data: creatorRecord, error: creatorError } = await supabase
          .from('bet_recipients')
          .select('*')
          .eq('bet_id', betId)
          .eq('recipient_id', user?.id)
          .maybeSingle();
        
        if (creatorError) {
          console.error("Error checking for creator record:", creatorError);
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to check creator status' });
          return;
        }
        
        // If creator has a recipient record, update it to lost
        if (creatorRecord) {
          const { error: updateError } = await supabase
            .from('bet_recipients')
            .update({ 
              status: 'lost',
              pending_outcome: null,
              outcome_claimed_by: user?.id,
              outcome_claimed_at: new Date().toISOString()
            })
            .eq('id', creatorRecord.id);
            
          if (updateError) {
            console.error("Error updating creator record:", updateError);
            dispatch({ type: 'ACTION_ERROR', payload: 'Failed to update creator status' });
            return;
          }
        } else {
          // If the creator doesn't have a recipient record, insert one with lost status
          const { error: insertError } = await supabase
            .from('bet_recipients')
            .insert({ 
              bet_id: betId,
              recipient_id: user?.id, 
              status: 'lost',
              pending_outcome: null,
              outcome_claimed_by: user?.id,
              outcome_claimed_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error("Error creating creator record:", insertError);
            dispatch({ type: 'ACTION_ERROR', payload: 'Failed to create creator status' });
            return;
          }
        }
        
        // Update the bet status to completed
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', betId);
          
        if (betUpdateError) {
          console.error("Error updating bet status:", betUpdateError);
          // Continue anyway as the primary update succeeded
        }
      } else if (!recipientId) {
        Alert.alert("Error", "No recipient ID found");
        dispatch({ type: 'ACTION_ERROR', payload: 'No recipient ID found' });
        return;
      } else {
        // Find opponent if not provided
        let opponentRecipientId: string | null = null;
        if (recipients && recipients.length > 0) {
          const opponent = recipients.find(r => r.recipient_id !== user?.id && r.id !== recipientId);
          opponentRecipientId = opponent?.id || null;
        }
        
        // Update statuses
        const result = await updateRecipientStatuses(
          recipientId, 
          { 
            status: 'lost' as RecipientStatus, 
            pending_outcome: null as PendingOutcome
          },
          opponentRecipientId,
          { 
            status: 'won' as RecipientStatus, 
            pending_outcome: null as PendingOutcome
          }
        );
        
        if (!result) {
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to declare loss' });
          return;
        }
        
        // Update the bet status to completed
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', betId);
          
        if (betUpdateError) {
          console.error("Error updating bet status:", betUpdateError);
          // Continue anyway as the primary update succeeded
        }
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      fetchBetDetails();
      fetchBets();
      
      // For direct loss declaration, navigate back to home to show updated list
      if (navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Error declaring loss:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to declare loss. Please try again.");
    }
  }, [recipientId, recipients, user?.id, isCreator, betId, updateRecipientStatuses, fetchBetDetails, fetchBets, navigation]);
  
  // Handle confirming a pending outcome
  const handleConfirmOutcome = useCallback(async () => {
    try {
      // Check for opponents with pending outcomes
      const opponentWithClaimedOutcome = recipients.find(r => 
        r.recipient_id !== user?.id && 
        r.pending_outcome !== null
      );
      
      // Better error handling and fallback
      if (!opponentWithClaimedOutcome && !opponentPendingOutcome && !recipientId) {
        Alert.alert("Error", "No pending outcome to confirm");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'confirm-outcome' });
      
      // Find opponent if not provided
      let opponentRecipientId: string | null = null;
      let opponentIsCreator = false;
      let pendingOutcomeToConfirm: PendingOutcome = 'won'; // Default to confirming a win
      
      if (opponentWithClaimedOutcome) {
        // Use the opponent we found with a pending outcome
        opponentRecipientId = opponentWithClaimedOutcome.id;
        pendingOutcomeToConfirm = opponentWithClaimedOutcome.pending_outcome || 'won';
        
        // Check if this opponent is the creator
        if (opponentWithClaimedOutcome.recipient_id && betId) {
          const { data: betData } = await supabase
            .from('bets')
            .select('creator_id')
            .eq('id', betId)
            .single();
            
          opponentIsCreator = betData?.creator_id === opponentWithClaimedOutcome.recipient_id;
        }
      } else if (recipients && recipients.length > 0) {
        // Fallback to traditional logic
        // First try to find opponent with explicit pending outcome
        let opponent = recipients.find(r => 
          r.pending_outcome !== null && r.id !== recipientId
        );
        
        // If no opponent with pending outcome found, look for an opponent with 'pending' status
        if (!opponent) {
          opponent = recipients.find(r => 
            r.status === 'pending' && r.id !== recipientId
          );
          
          // Default to treating them as claiming victory if status is pending but no explicit pending_outcome
          if (opponent && !opponent.pending_outcome) {
            pendingOutcomeToConfirm = 'won';
          }
        }
        
        if (opponent) {
          opponentRecipientId = opponent.id;
          
          // If opponent has explicit pending outcome, use it
          if (opponent.pending_outcome) {
            pendingOutcomeToConfirm = opponent.pending_outcome;
          }
          
          // Check if the opponent is the creator
          if (opponent.recipient_id && betId) {
            const { data: betData } = await supabase
              .from('bets')
              .select('creator_id')
              .eq('id', betId)
              .single();
              
            opponentIsCreator = betData?.creator_id === opponent.recipient_id;
          }
        }
      }
      
      if (!opponentRecipientId) {
        dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
        Alert.alert("Error", "Could not identify opponent");
        return;
      }
      
      // Determine outcome status based on opponent's pending outcome
      const myStatus = pendingOutcomeToConfirm === 'won' ? 'lost' as RecipientStatus : 'won' as RecipientStatus;
      const opponentStatus = pendingOutcomeToConfirm === 'won' ? 'won' as RecipientStatus : 'lost' as RecipientStatus;
      
      // Update statuses
      const result = await updateRecipientStatuses(
        recipientId || '', // Use empty string if no recipientId
        { 
          status: myStatus, 
          pending_outcome: null as PendingOutcome 
        },
        opponentRecipientId,
        { 
          status: opponentStatus, 
          pending_outcome: null as PendingOutcome 
        }
      );
      
      if (!result) {
        dispatch({ type: 'ACTION_ERROR', payload: 'Failed to confirm outcome' });
        return;
      }
      
      // ALWAYS Update the bet status to completed
      if (betId) {
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', betId);
          
        if (betUpdateError) {
          console.error("Error updating bet status:", betUpdateError);
          // Continue anyway as the primary confirmation succeeded
        }
      }
      
      // Update all recipients to completed status to ensure consistent filtering
      if (betId) {
        const { error: updateRecipientsError } = await supabase
          .from('bet_recipients')
          .update({ 
            status: (r: any) => `CASE 
              WHEN status = 'pending' AND outcome_claimed_by IS NULL THEN 'in_progress'::text
              ELSE status
            END`
          })
          .eq('bet_id', betId)
          .is('pending_outcome', null);
          
        if (updateRecipientsError) {
          console.error("Error updating recipients:", updateRecipientsError);
          // Continue anyway as the primary confirmation succeeded
        }
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      fetchBetDetails();
      fetchBets();
      
      // For direct confirmation, navigate back to home to show updated list
      if (navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Error confirming outcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to confirm outcome. Please try again.");
    }
  }, [recipientId, recipients, opponentPendingOutcome, updateRecipientStatuses, fetchBetDetails, fetchBets, navigation, betId, user?.id]);
  
  // Handle rejecting a claimed outcome
  const handleRejectOutcome = useCallback(async () => {
    try {
      if (!opponentPendingOutcome || !recipientId) {
        Alert.alert("Error", "No pending outcome to reject");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'reject-outcome' });
      
      // Find opponent if not provided
      let opponentRecipientId: string | null = null;
      let opponentIsCreator = false;
      
      if (recipients && recipients.length > 0) {
        const opponent = recipients.find(r => 
          r.pending_outcome !== null && r.id !== recipientId
        );
        
        if (opponent) {
          opponentRecipientId = opponent.id;
          // Check if the bet has a creator_id property and if it matches the opponent's recipient_id
          if (opponent.bet_id) {
            // Fetch the bet to check if the opponent is the creator
            const { data: betData } = await supabase
              .from('bets')
              .select('creator_id')
              .eq('id', opponent.bet_id)
              .single();
              
            opponentIsCreator = betData?.creator_id === opponent.recipient_id;
          }
        }
      }
      
      if (!opponentRecipientId) {
        dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
        Alert.alert("Error", "Could not identify opponent");
        return;
      }
      
      // Update statuses - reset to in_progress
      const result = await updateRecipientStatuses(
        recipientId, 
        { 
          status: 'in_progress' as RecipientStatus,
          pending_outcome: null as PendingOutcome
        },
        opponentRecipientId,
        { 
          status: 'in_progress' as RecipientStatus,
          pending_outcome: null as PendingOutcome
        }
      );
      
      if (!result) {
        dispatch({ type: 'ACTION_ERROR', payload: 'Failed to reject outcome' });
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      fetchBetDetails();
      fetchBets();
      
      // Success alert removed
    } catch (error) {
      console.error("Error rejecting outcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to reject outcome. Please try again.");
    }
  }, [recipientId, recipients, opponentPendingOutcome, updateRecipientStatuses, fetchBetDetails, fetchBets]);
  
  // Handle canceling a bet (for creators only)
  const handleCancelBet = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'cancel' });
      
      if (!betId) {
        Alert.alert("Error", "Invalid bet ID");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid bet ID' });
        return;
      }
      
      // Update the bet status to 'cancelled' instead of deleting it
      const { error } = await supabase
        .from('bets')
        .update({ status: 'cancelled' })
        .eq('id', betId)
        .eq('creator_id', user?.id); // Ensure only creator can cancel
      
      if (error) {
        console.error("Error canceling bet:", error);
        dispatch({ type: 'ACTION_ERROR', payload: error.message });
        Alert.alert("Error", "Failed to cancel bet. Please try again.");
        return;
      }
      
      // Also update all recipients to 'cancelled'
      await supabase
        .from('bet_recipients')
        .update({ status: 'cancelled' })
        .eq('bet_id', betId);
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Navigate back to home with safer navigation
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Unexpected error in cancelBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [betId, user?.id, navigation]);
  
  // Send a reminder to recipient (simple alert for now)
  const sendReminder = useCallback((recipientId: string) => {
    // Silently perform the reminder action without showing an alert
    console.log(`Reminder sent to recipient: ${recipientId}`);
    // Future implementation: actual notification functionality
  }, []);
  
  return {
    ...state,
    handleAcceptBet,
    handleRejectBet,
    handleDeclareWin,
    handleDeclareLoss,
    handleConfirmOutcome,
    handleRejectOutcome,
    handleCancelBet,
    confirmDeleteBet,
    sendReminder
  };
}; 