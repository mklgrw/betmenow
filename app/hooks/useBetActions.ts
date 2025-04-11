import { useState, useReducer, useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { Bet, BetRecipient, BetStatus, RecipientStatus, PendingOutcome, RecipientUpdate } from '../types/betTypes';

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
  
  // Helper function to validate UUID format
  const isValidUUID = (uuid: string | null | undefined): boolean => {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };
  
  // Helper to update recipient statuses
  const updateRecipientStatuses = useCallback(async (
    myRecipientId: string, 
    myUpdate: RecipientUpdate, 
    opponentId: string | null, 
    opponentUpdate: RecipientUpdate
  ) => {
    try {
      // Update my status
      if (myRecipientId) {
        // Process the user ID first
        const userIdValue = user?.id ? (isValidUUID(user.id) ? user.id : null) : null;
        
        // Create a new update object with type safety
        const sanitizedUpdate = {
          ...myUpdate 
        };
        
        // Explicitly assign the validated user ID
        sanitizedUpdate.outcome_claimed_by = userIdValue as (string | null);
        
        const { error: myError } = await supabase
          .from('bet_recipients')
          .update(sanitizedUpdate)
          .eq('id', myRecipientId);
        
        if (myError) {
          Alert.alert("Error", "Failed to update your status. Please try again.");
          return false;
        }
      }
      
      // Update opponent status if available
      if (opponentId) {
        // Process the user ID first
        const userIdValue = user?.id ? (isValidUUID(user.id) ? user.id : null) : null;
        
        // Create a new update object with type safety
        const sanitizedOpponentUpdate = {
          ...opponentUpdate
        };
        
        // Explicitly assign the validated user ID
        sanitizedOpponentUpdate.outcome_claimed_by = userIdValue as (string | null);
        
        const { error: opponentError } = await supabase
          .from('bet_recipients')
          .update(sanitizedOpponentUpdate)
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
  }, [user?.id]);
  
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
      
      // Validate user ID to avoid UUID issues
      if (!user?.id) {
        console.error("Missing user ID");
        Alert.alert("Error", "User ID not found. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Missing user ID' });
        return;
      }
      
      // Validate the UUID format
      const userIdValue = isValidUUID(user.id) ? user.id : null;
      if (!userIdValue) {
        console.error("Invalid user ID format:", user.id);
        Alert.alert("Error", "Invalid user ID format. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid user ID format' });
        return;
      }

      // Handle the case where the current user is the creator
      if (isCreator && !recipientId) {
        // Get the creator's recipient record or find appropriate recipient to update
        const myRecipient = recipients.find(r => r.recipient_id === userIdValue);
        if (!myRecipient) {
          // If creator doesn't have a recipient record, we need to create one first
          const { data: createdRecord, error: createError } = await supabase
            .from('bet_recipients')
            .insert({ 
              bet_id: betId,
              recipient_id: userIdValue,
              status: 'in_progress',
              creator_lookup: userIdValue
            })
            .select()
            .single();
            
          if (createError) {
            console.error("Error creating creator record:", createError);
            dispatch({ type: 'ACTION_ERROR', payload: 'Failed to create creator record' });
            Alert.alert("Error", "Failed to prepare for win declaration. Please try again.");
            return;
          }
          
          // Now call the secure function with the new record
          const { data, error } = await supabase.rpc('secure_declare_bet_outcome', {
            p_recipient_id: createdRecord.id,
            p_outcome: 'won'
          });
          
          if (error || (data && data.success === false)) {
            const errorMsg = error?.message || data?.error || 'Unknown error';
            console.error("Error declaring win via RPC:", errorMsg);
            dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
            Alert.alert("Error", `Failed to declare win: ${errorMsg}`);
            return;
          }
        } else {
          // Creator has a recipient record, use it to declare win
          const { data, error } = await supabase.rpc('secure_declare_bet_outcome', {
            p_recipient_id: myRecipient.id,
            p_outcome: 'won'
          });
          
          if (error || (data && data.success === false)) {
            const errorMsg = error?.message || data?.error || 'Unknown error';
            console.error("Error declaring win via RPC:", errorMsg);
            dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
            Alert.alert("Error", `Failed to declare win: ${errorMsg}`);
            return;
          }
        }
      } else if (!recipientId) {
        Alert.alert("Error", "No recipient ID found");
        dispatch({ type: 'ACTION_ERROR', payload: 'No recipient ID found' });
        return;
      } else {
        // We have a recipient ID, use the secure function
        const { data, error } = await supabase.rpc('secure_declare_bet_outcome', {
          p_recipient_id: recipientId,
          p_outcome: 'won'
        });
        
        if (error || (data && data.success === false)) {
          const errorMsg = error?.message || data?.error || 'Unknown error';
          console.error("Error declaring win via RPC:", errorMsg);
          dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
          Alert.alert("Error", `Failed to declare win: ${errorMsg}`);
          return;
        }
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      
      // Refresh bet data
      fetchBetDetails();
      fetchBets();
      
      // User feedback
      Alert.alert("Success", "Win declared. Waiting for confirmation from your opponent.");
    } catch (error) {
      console.error("Error declaring win:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to declare win. Please try again.");
    }
  }, [recipientId, recipients, user?.id, isCreator, betId, fetchBetDetails, fetchBets, isValidUUID]);
  
  // Declare loss
  const handleDeclareLoss = useCallback(async () => {
    // Ensure betId exists right at the start
    if (!betId) {
      Alert.alert("Error", "Bet ID is missing.");
      dispatch({ type: 'ACTION_ERROR', payload: 'Bet ID missing' });
      return;
    }
    
    try {
      dispatch({ type: 'ACTION_START', payload: 'declare-loss' });
      
      // Validate user ID to avoid UUID issues
      if (!user?.id) {
        console.error("Missing user ID");
        Alert.alert("Error", "User ID not found. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Missing user ID' });
        return;
      }
      
      // Validate the UUID format
      const userIdValue = isValidUUID(user.id) ? user.id : null;
      if (!userIdValue) {
        console.error("Invalid user ID format:", user.id);
        Alert.alert("Error", "Invalid user ID format. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid user ID format' });
        return;
      }
      
      // Assign checked betId to a new constant for clearer type flow
      const currentBetId = betId;
      
      // Make sure recipientId is properly typed - null is a valid value but undefined isn't
      let declarerRecipientId: string | null = null;
      if (recipientId) {
        declarerRecipientId = recipientId;
      }
      
      // If the user is the creator AND they don't have a specific recipientId passed
      // (meaning they clicked declare loss on the main bet, not a specific opponent)
      // we need to find or create their own recipient record.
      if (isCreator && !declarerRecipientId) {
        
        const { data: creatorRecord, error: findError } = await supabase
          .from('bet_recipients')
          .select('id')
          .eq('bet_id', currentBetId) // Use the new constant here
          .eq('recipient_id', userIdValue) // Use validated ID
          .maybeSingle();

        if (findError) {
          console.error("Error finding creator recipient record:", findError);
          dispatch({ type: 'ACTION_ERROR', payload: 'Failed to find creator record' });
          Alert.alert("Error", "Failed to declare loss. Could not verify your status.");
          return;
        }
        
        if (creatorRecord) {
          declarerRecipientId = creatorRecord.id;
        } else {
          // If creator doesn't have a recipient record, we cannot declare loss this way yet.
          // Ideally, a record is always created for the creator.
          // For now, show an error.
          console.error("Creator recipient record missing for bet:", currentBetId);
          dispatch({ type: 'ACTION_ERROR', payload: 'Creator record missing' });
          Alert.alert("Error", "Failed to declare loss. Creator status record not found.");
          return;
        }
      }

      // Ensure we have a valid recipient ID for the person declaring loss
      if (!declarerRecipientId) {
        Alert.alert("Error", "Your participant record ID could not be determined.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Declarer recipient ID missing' });
        return;
      }

      // Call the backend function to handle the loss declaration
      const { data, error } = await supabase.rpc('secure_declare_bet_outcome', {
        p_recipient_id: declarerRecipientId,
        p_outcome: 'lost'
      });

      if (error || (data && data.success === false)) {
        const errorMsg = error?.message || data?.error || 'Unknown error';
        console.error("Error declaring loss via RPC:", errorMsg);
        dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
        Alert.alert("Error", `Failed to declare loss: ${errorMsg}`);
        return;
      }

      // If RPC call is successful
      dispatch({ type: 'ACTION_SUCCESS' });
      Alert.alert("Success", data?.message || "Loss declared successfully.");

      // Refresh bet data
      await fetchBetDetails();
      await fetchBets();

      // Navigate back or to home
      if (navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (e) {
      const error = e as Error;
      console.error("Unexpected error in handleDeclareLoss:", error);
      dispatch({ type: 'ACTION_ERROR', payload: error.message || 'Unexpected error occurred' });
      Alert.alert("Error", "An unexpected error occurred while declaring loss.");
    }
  }, [recipientId, isCreator, betId, user?.id, fetchBetDetails, fetchBets, navigation, isValidUUID]);
  
  // Handle confirming a claimed outcome
  const handleConfirmOutcome = useCallback(async () => {
    try {
      // Validate user ID to avoid UUID issues
      if (!user?.id) {
        console.error("Missing user ID");
        Alert.alert("Error", "User ID not found. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Missing user ID' });
        return;
      }
      
      // Validate the UUID format
      const userIdValue = isValidUUID(user.id) ? user.id : null;
      if (!userIdValue) {
        console.error("Invalid user ID format:", user.id);
        Alert.alert("Error", "Invalid user ID format. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid user ID format' });
        return;
      }
      
      // Find the opponent with a pending outcome
      const opponentWithClaimedOutcome = recipients.find(r => 
        r.recipient_id !== userIdValue && 
        (r.pending_outcome !== null || r.status === 'pending_outcome')
      );
      
      // If we don't find an opponent with a pending outcome, we can't confirm anything
      if (!opponentWithClaimedOutcome) {
        Alert.alert("Error", "No pending outcome to confirm");
        return;
      }
      
      // Find our own recipient record
      const userRecipient = recipients.find(r => r.recipient_id === userIdValue);
      
      if (!userRecipient) {
        Alert.alert("Error", "Could not find your recipient record for this bet");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'confirm-outcome' });
      
      // IMPORTANT: We need to pass the ID of OUR OWN recipient record
      // The secure_confirm_bet_outcome function expects the ID of the user's recipient record
      const userRecipientId = userRecipient.id;
      
      console.log("Calling secure_confirm_bet_outcome with user's recipient_id:", userRecipientId);
      
      // Call the RPC function to confirm outcome
      const { data, error } = await supabase.rpc('secure_confirm_bet_outcome', {
        p_recipient_id: userRecipientId
      });
      
      if (error || (data && data.success === false)) {
        const errorMsg = error?.message || data?.error || 'Unknown error';
        console.error("Error confirming outcome via RPC:", errorMsg);
        dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
        Alert.alert("Error", `Failed to confirm outcome: ${errorMsg}`);
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      Alert.alert("Success", "Outcome confirmed successfully.");
      
      // Refresh bet data
      await fetchBetDetails();
      await fetchBets();
      
      // Navigate back to home
      navigation?.navigate('Home');
    } catch (error) {
      console.error("Error confirming outcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to confirm outcome. Please try again.");
    }
  }, [recipients, fetchBetDetails, fetchBets, user?.id, isValidUUID, navigation]);
  
  // Handle rejecting a claimed outcome
  const handleRejectOutcome = useCallback(async () => {
    try {
      // Validate user ID to avoid UUID issues
      if (!user?.id) {
        console.error("Missing user ID");
        Alert.alert("Error", "User ID not found. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Missing user ID' });
        return;
      }
      
      // Validate the UUID format
      const userIdValue = isValidUUID(user.id) ? user.id : null;
      if (!userIdValue) {
        console.error("Invalid user ID format:", user.id);
        Alert.alert("Error", "Invalid user ID format. Please try logging in again.");
        dispatch({ type: 'ACTION_ERROR', payload: 'Invalid user ID format' });
        return;
      }
      
      // Find the opponent with a pending outcome
      const opponentWithClaimedOutcome = recipients.find(r => 
        r.recipient_id !== userIdValue && 
        (r.pending_outcome !== null || r.status === 'pending_outcome')
      );
      
      // If we don't find an opponent with a pending outcome, we can't reject anything
      if (!opponentWithClaimedOutcome) {
        Alert.alert("Error", "No pending outcome to reject");
        return;
      }
      
      // Find our own recipient record
      const userRecipient = recipients.find(r => r.recipient_id === userIdValue);
      
      if (!userRecipient) {
        Alert.alert("Error", "Could not find your recipient record for this bet");
        return;
      }
      
      dispatch({ type: 'ACTION_START', payload: 'reject-outcome' });
      
      // IMPORTANT: We need to pass the ID of OUR OWN recipient record
      // The secure_reject_bet_outcome function expects the ID of the user's recipient record
      const userRecipientId = userRecipient.id;
      
      console.log("Calling secure_reject_bet_outcome with user's recipient_id:", userRecipientId);
      
      // Call the RPC function to reject outcome
      const { data, error } = await supabase.rpc('secure_reject_bet_outcome', {
        p_recipient_id: userRecipientId
      });
      
      if (error || (data && data.success === false)) {
        const errorMsg = error?.message || data?.error || 'Unknown error';
        console.error("Error rejecting outcome via RPC:", errorMsg);
        dispatch({ type: 'ACTION_ERROR', payload: errorMsg });
        Alert.alert("Error", `Failed to reject outcome: ${errorMsg}`);
        return;
      }
      
      dispatch({ type: 'ACTION_SUCCESS' });
      Alert.alert("Success", "Outcome rejected successfully.");
      
      // Refresh bet data
      await fetchBetDetails();
      await fetchBets();
      
      // Navigate back to home
      navigation?.navigate('Home');
    } catch (error) {
      console.error("Error rejecting outcome:", error);
      dispatch({ type: 'ACTION_ERROR', payload: 'An unexpected error occurred' });
      Alert.alert("Error", "Failed to reject outcome. Please try again.");
    }
  }, [recipients, fetchBetDetails, fetchBets, user?.id, isValidUUID, navigation]);
  
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