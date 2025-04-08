import { useState, useReducer, useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { Bet, BetRecipient } from '../types/betTypes';

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
  opponentPendingOutcome?: string | null;
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
    myUpdate: any, 
    opponentId: string | null, 
    opponentUpdate: any
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
      
      // Show success message and navigate back to home screen with safer navigation
      Alert.alert(
        "Success",
        "Bet deleted successfully.",
        [{ 
          text: "OK", 
          onPress: () => {
            if (navigation && navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          } 
        }]
      );
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
      const { data, error } = await supabase.rpc('accept_bet', {
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
      
      Alert.alert("Success", "Bet accepted successfully!");
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
      
      Alert.alert("Success", "Bet rejected successfully!");
    } catch (error) {
      console.error("Unexpected error in rejectBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [recipientId, fetchBetDetails, fetchBets]);
  
  // Declare outcome (creator or recipient)
  const declareBetOutcome = useCallback(async (
    status: string, 
    recipientId: string,
    timestamp: string
  ) => {
    try {
      if (!recipientId) return false;
      
      // Set pending outcome for the recipient
      const { error } = await supabase
        .from('bet_recipients')
        .update({
          pending_outcome: status,
          outcome_claimed_by: user?.id,
          outcome_claimed_at: timestamp
        })
        .eq('id', recipientId);
        
      if (error) {
        console.error("Error declaring outcome:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error in declareBetOutcome:", error);
      return false;
    }
  }, [user?.id]);
  
  // Directly set final outcome (bypassing pending status)
  const declareFinalOutcome = useCallback(async (
    betId: string,
    status: string,
    timestamp: string
  ) => {
    try {
      if (!betId) return false;
      
      // Update the bet status to completed
      const { error: betError } = await supabase
        .from('bets')
        .update({ status: 'completed' })
        .eq('id', betId);
        
      if (betError) {
        console.error("Error updating bet status:", betError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error in declareFinalOutcome:", error);
      return false;
    }
  }, []);
  
  // Handle declaring win for a bet
  const handleDeclareWin = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'declareWin' });
      
      const timestamp = new Date().toISOString();
      
      if (recipientId) {
        // Set own status to pending win
        const success = await declareBetOutcome('won', recipientId, timestamp);
        
        if (!success) {
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to declare win' });
          Alert.alert("Error", "Failed to declare outcome. Please try again.");
          return;
        }
        
        // Refresh the data
        await fetchBetDetails();
        await fetchBets();
        
        dispatch({ type: 'ACTION_SUCCESS' });
        
        Alert.alert(
          "Win Claimed",
          "You've claimed victory for this bet. The other person will need to confirm the outcome."
        );
      }
    } catch (error) {
      console.error("Error declaring win:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [recipientId, declareBetOutcome, fetchBetDetails, fetchBets]);
  
  // Handle declaring loss for a bet
  const handleDeclareLoss = useCallback(async () => {
    try {
      dispatch({ type: 'ACTION_START', payload: 'declareLoss' });
      
      // Handle cases where recipientId might not be available
      let currentRecipientId = recipientId;
      
      if (!currentRecipientId) {
        // If no recipientId is available but we have recipients, use the first one
        if (recipients && recipients.length > 0) {
          currentRecipientId = recipients[0].id;
        } else if (betId) {
          // If we have a betId but no recipients, use the betId directly
          const timestamp = new Date().toISOString();
          await declareFinalOutcome(betId, 'lost', timestamp);
          
          // Refresh the bet lists to ensure correct tab display
          await fetchBets();
          
          // Instead of trying to navigate back, navigate to a specific screen
          // or use a callback to inform the parent component
          if (navigation && navigation.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
          dispatch({ type: 'ACTION_SUCCESS' });
          return;
        } else {
          console.error("Error: No recipient ID or bet ID available");
          // Use safer navigation
          dispatch({ type: 'ACTION_ERROR', payload: 'No recipient ID or bet ID available' });
          if (navigation && navigation.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
          return;
        }
      }
      
      // Find opponent using the recipient ID
      const { betId: foundBetId, opponentId } = await findOpponent(currentRecipientId);
      
      // Ensure we have a valid bet ID
      const currentBetId = foundBetId || betId;
      
      if (!currentBetId) {
        console.error("Error: Invalid bet ID");
        // Use safer navigation
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid bet ID' });
        if (navigation && navigation.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Home');
        }
        return;
      }
      
      // Prepare updates
      const timestamp = new Date().toISOString();
      const recipientUpdate = {
        status: 'lost',
        pending_outcome: null,
        outcome_claimed_by: user?.id,
        outcome_claimed_at: timestamp
      };
      
      const opponentUpdate = {
        status: 'won',
        pending_outcome: null,
        outcome_claimed_by: user?.id,
        outcome_claimed_at: timestamp
      };
      
      // Update statuses
      await updateRecipientStatuses(
        currentRecipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update the bet status to 'completed' in the database
      if (currentBetId) {
        await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', currentBetId);
      }
      
      // Refresh the bet lists to ensure correct tab display
      await fetchBets();
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Use safer navigation approach
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Error declaring loss:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      // Use safer navigation
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    }
  }, [
    betId, 
    recipientId, 
    recipients, 
    navigation, 
    user?.id, 
    findOpponent, 
    updateRecipientStatuses, 
    declareFinalOutcome, 
    fetchBets
  ]);
  
  // Handle confirming a pending outcome
  const handleConfirmOutcome = useCallback(async () => {
    if (!opponentPendingOutcome) {
      Alert.alert("Error", "No outcome to confirm");
      return;
    }
    
    try {
      dispatch({ type: 'ACTION_START', payload: 'confirmOutcome' });
      
      // My status is opposite of what opponent claimed
      const myFinalStatus = opponentPendingOutcome === 'won' ? 'lost' : 'won';
      const opponentFinalStatus = opponentPendingOutcome;
      
      // Handle cases where recipientId might not be available
      let currentRecipientId = recipientId;
      let opponentId = null;
      
      if (!currentRecipientId) {
        // If no recipientId is available but we have recipients, use the first one
        if (recipients && recipients.length > 0) {
          currentRecipientId = recipients[0].id;
        } else {
          Alert.alert("Error", "No recipient ID available");
          dispatch({ type: 'ACTION_ERROR', payload: 'No recipient ID available' });
          return;
        }
      }
      
      // Different logic for creator vs recipient
      if (isCreator) {
        // For creators, find the recipient who has a pending outcome
        const recipientWithPendingOutcome = recipients.find(r => !!r.pending_outcome);
        if (recipientWithPendingOutcome) {
          opponentId = recipientWithPendingOutcome.id;
        } else {
          console.log("No recipient with pending outcome found");
        }
      } else {
        // For recipients, use the standard findOpponent function
        const { opponentId: foundOpponentId } = await findOpponent(currentRecipientId);
        opponentId = foundOpponentId;
      }
      
      if (!betId) {
        Alert.alert("Error", "Invalid bet ID");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid bet ID' });
        return;
      }
      
      if (!opponentId) {
        Alert.alert("Error", "No opponent found to confirm outcome with");
        dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
        return;
      }
      
      // Prepare updates
      const recipientUpdate = {
        status: myFinalStatus,
        pending_outcome: null
      };
      
      const opponentUpdate = {
        status: opponentFinalStatus,
        pending_outcome: null
      };
      
      // Update statuses
      await updateRecipientStatuses(
        currentRecipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update the bet status to 'completed' in the database
      if (betId) {
        await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', betId);
      }
      
      // Refresh the bet lists to ensure correct tab display
      await fetchBets();
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // If I'm confirming a loss, open Venmo to pay the bet
      if (myFinalStatus === 'lost') {
        // Get winner's Venmo username (my opponent)
        let winnerVenmoUsername = null;
        const opponent = recipients.find(r => r.id === opponentId);
        
        if (opponent && opponent.profiles) {
          const opponentUserId = opponent.recipient_id;
          
          if (opponentUserId) {
            // Fetch the winner's Venmo username from the users table
            const { data: winnerData } = await supabase
              .from('users')
              .select('venmo_username')
              .eq('id', opponentUserId)
              .single();
               
            if (winnerData && winnerData.venmo_username) {
              winnerVenmoUsername = winnerData.venmo_username;
            }
          }
        }
        
        // Try to open Venmo with the payment
        try {
          // Get bet details (for stake amount)
          const { data: betData } = await supabase
            .from('bets')
            .select('stake')
            .eq('id', betId)
            .single();
            
          if (betData) {
            // Use hardcoded Venmo username if the fetched one is not available
            const venmoUsername = winnerVenmoUsername || 'S-PBOO'; // Fallback to the test username
            const note = "Paying bet";
            const venmoUrl = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${betData.stake}&note=${note}`;
            
            // Try to open Venmo
            Linking.openURL(venmoUrl).catch(err => {
              console.error('Error opening Venmo:', err);
            });
          }
        } catch (error) {
          console.error('Error with Venmo deep linking:', error);
        }
        
        // Show alert and navigate back using safer navigation
        Alert.alert(
          "Loss Confirmed",
          "You've confirmed your loss. Make sure to complete the payment in Venmo.",
          [{ 
            text: "OK", 
            onPress: () => {
              if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            } 
          }]
        );
      } else {
        // For confirming a win, just show standard confirmation with safer navigation
        Alert.alert(
          "Outcome Confirmed", 
          `You've confirmed the outcome of this bet.`,
          [{ 
            text: "OK", 
            onPress: () => {
              if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            } 
          }]
        );
      }
    } catch (error) {
      console.error("Error confirming outcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [
    opponentPendingOutcome,
    recipientId,
    recipients,
    isCreator,
    betId,
    findOpponent,
    updateRecipientStatuses,
    fetchBets,
    navigation
  ]);
  
  // Handle rejecting a claimed outcome
  const handleRejectOutcome = useCallback(async () => {
    if (!opponentPendingOutcome) {
      Alert.alert("Error", "No claimed outcome to reject");
      return;
    }
    
    try {
      dispatch({ type: 'ACTION_START', payload: 'rejectOutcome' });
      
      // Find the recipient with a pending outcome
      let opponentId = null;
      
      if (isCreator) {
        // For creators, directly find recipient with pending outcome
        const recipientWithPendingOutcome = recipients.find(r => !!r.pending_outcome);
        if (recipientWithPendingOutcome) {
          opponentId = recipientWithPendingOutcome.id;
        }
      } else if (recipientId) {
        // For recipients, find creator's recipient record
        const { opponentId: foundOpponentId } = await findOpponent(recipientId);
        opponentId = foundOpponentId;
      }
      
      if (!opponentId) {
        console.error("No opponent found with pending outcome");
        dispatch({ type: 'ACTION_ERROR', payload: 'No opponent found' });
        Alert.alert("Error", "No opponent found with pending outcome");
        return;
      }
      
      // Clear the pending outcome
      const { error } = await supabase
        .from('bet_recipients')
        .update({
          pending_outcome: null
        })
        .eq('id', opponentId);
      
      if (error) {
        console.error("Error rejecting outcome:", error);
        dispatch({ type: 'ACTION_ERROR', payload: error.message });
        Alert.alert("Error", "Failed to reject the outcome. Please try again.");
        return;
      }
      
      // Refresh the bet details
      await fetchBetDetails();
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Show confirmation
      Alert.alert(
        "Outcome Rejected",
        "You've rejected the claimed outcome. The bet will remain active."
      );
    } catch (error) {
      console.error("Error in rejectOutcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [
    opponentPendingOutcome,
    isCreator,
    recipients,
    recipientId,
    findOpponent,
    fetchBetDetails
  ]);
  
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
      
      // Show success message and navigate back with safer navigation
      Alert.alert(
        "Success",
        "Bet cancelled successfully.",
        [{ 
          text: "OK", 
          onPress: () => {
            if (navigation && navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          } 
        }]
      );
    } catch (error) {
      console.error("Unexpected error in cancelBet:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [betId, user?.id, navigation]);
  
  // Send a reminder to recipient (simple alert for now)
  const sendReminder = useCallback((recipientId: string) => {
    Alert.alert("Reminder Sent", "A reminder has been sent to this user.");
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