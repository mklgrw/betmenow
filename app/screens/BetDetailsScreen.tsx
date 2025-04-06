import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  FlatList,
  Button,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { SupabaseClient } from '@supabase/supabase-js';
import { useBets, RecipientUpdate } from '../context/BetContext';

type BetDetailsProps = {
  route: {
    params: {
      betId: string;
    };
  };
};

type Profile = {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
};

type Bet = {
  id: string;
  description: string;
  stake: number;
  due_date: string;
  status: string;
  creator_id: string;
  created_at: string;
  updated_at?: string;
};

type BetRecipient = {
  id: string;
  bet_id: string;
  recipient_id?: string;
  user_id?: string;
  status: string;
  created_at?: string;
  display_name?: string;
  profiles?: Profile | null;
  pending_outcome?: string | null;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
  recipient?: {
    id: string;
    username: string;
    display_name: string;
  };
  // Keep user for backward compatibility 
  user?: {
    id: string;
    username: string;
    display_name: string;
  };
  // Add creator property to store creator profile info
  creator?: {
    id: string;
    username?: string;
    display_name?: string;
  };
};

const BetDetailsScreen = () => {
  const [bet, setBet] = useState<Bet | null>(null);
  const [recipients, setRecipients] = useState<BetRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientStatus, setRecipientStatus] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [opponentPendingOutcome, setOpponentPendingOutcome] = useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<string | null>(null);
  const [hasPendingOutcome, setHasPendingOutcome] = useState(false);

  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Get shared functions from BetContext
  const { updateRecipientStatuses, findOpponent, fetchBets } = useBets();
  
  // Extract and validate betId
  const params = route.params as { betId?: string; refresh?: number };
  const betId = params?.betId;
  
  // Log route params for debugging
  useEffect(() => {
    if (betId) {
      fetchBetDetails();
    }
  }, [betId, params?.refresh]);

  // Add a useEffect to update the UI when the status changes locally
  useEffect(() => {
    if (bet && bet.status === 'completed') {
      // Force a refresh of recipients to ensure they have correct status
      const checkRecipientsStatus = async () => {
        try {
          // Get fresh data for the bet
          const { data: updatedBet, error: betError } = await supabase
            .from('bets')
            .select('status')
            .eq('id', betId)
            .single();
          
          if (!betError && updatedBet && updatedBet.status !== bet.status) {
            // If the database status differs from local, update local
            setBet(prevBet => prevBet ? {...prevBet, status: updatedBet.status} : null);
          }
        } catch (error) {
          console.error("Error checking bet status:", error);
        }
      };
      
      checkRecipientsStatus();
    }
  }, [recipientStatus]);

  // Function to fetch bet details
  const fetchBetDetails = async () => {
    try {
      setLoading(true);
      
      // Get the bet details
      const { data: betData, error: betError } = await supabase
        .from('bets')
        .select('id, description, stake, due_date, status, creator_id, created_at')
        .eq('id', betId)
        .single();
  
      if (betError) {
        Alert.alert("Error", "Failed to load bet details. Please try again.");
        return;
      }
  
      setBet(betData);
      
      // Check if user is creator
      const userIsCreator = betData.creator_id === user?.id;
      setIsCreator(userIsCreator);
      console.log("🔍 User is creator:", userIsCreator);
      
      // Get recipients with pending outcome and status
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select(`
          id, 
          bet_id, 
          recipient_id, 
          status, 
          pending_outcome,
          outcome_claimed_by,
          outcome_claimed_at
        `)
        .eq('bet_id', betId);
      
      if (recipientsError) {
        Alert.alert("Error", "Failed to load recipient details.");
        return;
      }
      
      console.log("🔍 Recipients data:", recipientsData);
      
      // Check if any recipients have pending outcomes - FOR DEBUGGING
      const anyPendingOutcomes = recipientsData?.some(r => !!r.pending_outcome);
      console.log("🔍 Any pending outcomes:", anyPendingOutcomes);
      if (anyPendingOutcomes) {
        console.log("🔍 Pending outcomes found:", recipientsData.filter(r => !!r.pending_outcome));
        
        // If user is creator and there are pending outcomes from recipients,
        // directly set opponentPendingOutcome
        if (userIsCreator) {
          const recipientsWithPendingOutcomes = recipientsData.filter(r => !!r.pending_outcome);
          if (recipientsWithPendingOutcomes.length > 0) {
            console.log("🔍 Creator should see pending outcome from recipient:", recipientsWithPendingOutcomes[0]);
            setOpponentPendingOutcome(recipientsWithPendingOutcomes[0].pending_outcome);
          }
        }
      }
      
      // Check if the bet should be marked as completed based on recipient statuses
      const hasWonOrLostStatus = recipientsData?.some(r => 
        r.status === 'won' || r.status === 'lost'
      );
      
      // If recipients have won/lost status but bet isn't marked completed, update it
      if (hasWonOrLostStatus && betData.status !== 'completed') {
        console.log(`Bet ${betId} has won/lost recipients but status is ${betData.status}. Updating to completed.`);
        const { error: updateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', betId);
          
        if (updateError) {
          console.error("Failed to update bet status:", updateError);
        } else {
          // Update local state to reflect the change
          betData.status = 'completed';
          setBet({...betData});
        }
      }
      
      // Get the creator information
      const { data: creatorData, error: creatorError } = await supabase
        .from('users')
        .select('id, username, display_name')
        .eq('id', betData.creator_id)
        .single();
        
      if (creatorError) {
        console.error("Error fetching creator data:", creatorError);
      } else {
        console.log("Fetched creator data:", creatorData);
      }
      
      if (recipientsData && recipientsData.length > 0) {
        // Collect user IDs to fetch display names
        const userIds = recipientsData.map(r => r.recipient_id).filter(Boolean);
        
        console.log("Fetching user data for user IDs:", userIds);
        
        // Fetch user display names from users table instead of profiles
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, display_name')
          .in('id', userIds);
          
        if (userError) {
          console.error("Error fetching user data:", userError);
        }
        
        console.log("Fetched user data:", userData);
        
        if (!userError && userData) {
          // Add display names to the recipients data
          const enhancedRecipients = recipientsData.map(recipient => {
            const userInfo = userData.find(u => u.id === recipient.recipient_id);
            console.log(`Matching recipient_id ${recipient.recipient_id} with user:`, userInfo);
            return {
              ...recipient,
              profiles: userInfo || null // Keep the field name as profiles for backward compatibility
            };
          });
          
          // Store creator data for use in UI
          if (creatorData) {
            // Add creator data as a special property
            enhancedRecipients.forEach(r => {
              r.creator = creatorData;
            });
          }
          
          setRecipients(enhancedRecipients);
        } else {
          // Even without user data, add creator data if available
          if (creatorData) {
            const updatedRecipients = recipientsData.map(r => ({
              ...r,
              creator: creatorData
            }));
            setRecipients(updatedRecipients);
          } else {
            setRecipients(recipientsData);
          }
        }
        
        // Find my recipient record
        const myRecipient = recipientsData.find(r => r.recipient_id === user?.id);
        
        if (myRecipient) {
          setRecipientId(myRecipient.id);
          setRecipientStatus(myRecipient.status);
          setPendingOutcome(myRecipient.pending_outcome || null);
          setHasPendingOutcome(!!myRecipient.pending_outcome);
          
          // Find opponent's record - improved to work in all cases
          const opponentRecipients = recipientsData.filter(r => 
            r.recipient_id !== user?.id && 
            r.id !== myRecipient.id
          );
          
          console.log("Opponent recipients:", opponentRecipients);
          
          // Check for pending outcomes from any opponent
          const opponentWithPendingOutcome = opponentRecipients.find(r => !!r.pending_outcome);
          if (opponentWithPendingOutcome?.pending_outcome) {
            console.log("Found opponent with pending outcome:", opponentWithPendingOutcome);
            setOpponentPendingOutcome(opponentWithPendingOutcome.pending_outcome);
          }
        } else {
          // If no recipient record for current user, check if they're the creator
          if (isCreator && recipientsData.length > 0) {
            // As creator, use the first recipient's ID for actions
            setRecipientId(recipientsData[0].id);
            // Set appropriate default states for creator
            setRecipientStatus('creator');
            
            // Check if any recipients have pending outcomes
            const recipientWithPendingOutcome = recipientsData.find(r => !!r.pending_outcome);
            if (recipientWithPendingOutcome?.pending_outcome) {
              console.log("Creator found recipient with pending outcome:", recipientWithPendingOutcome);
              setOpponentPendingOutcome(recipientWithPendingOutcome.pending_outcome);
            }
            
            setPendingOutcome(null);
            setHasPendingOutcome(false);
            console.log("User is creator but not recipient - using first recipient ID for actions");
          } else {
            // This is an edge case - user is neither creator nor recipient
            console.log("User is neither creator nor recipient of this bet");
            if (recipientsData.length > 0) {
              // Use the first recipient's ID as a fallback for view-only access
              setRecipientId(recipientsData[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching bet details:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteBet = async () => {
    try {
      setLoading(true);
      
      // Delete the bet from Supabase
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId)
        .eq('creator_id', user?.id) // Ensure only creator can delete
        .eq('status', 'pending'); // Only pending bets can be deleted
      
      if (error) {
        console.error("Error deleting bet:", error);
        Alert.alert("Error", "Failed to delete bet. Please try again.");
        return;
      }
      
      // Show success message and navigate back to home screen
      Alert.alert(
        "Success",
        "Bet deleted successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Unexpected error in deleteBet:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteBet = () => {
    Alert.alert(
      "Delete Bet",
      "Are you sure you want to delete this bet? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: deleteBet,
          style: "destructive"
        }
      ]
    );
  };

  // Handle accepting a bet
  const handleAcceptBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("➡️ Accepting bet with recipientId:", recipientId);
      
      // Update UI immediately for better UX
      setRecipientStatus('in_progress');
      
      // Call our secure accept function
      const { data, error } = await supabase.rpc(
        'secure_accept_bet',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("➡️ Accept result:", data, "Error:", error);
      
      if (error) {
        console.error("❌ Error accepting bet:", error);
        Alert.alert("Error", "Failed to accept bet: " + error.message);
        // Revert UI
        setRecipientStatus('pending');
        return;
      }
      
      if (data && data.success) {
        console.log("✅ Bet accepted successfully!");
        
        // Update local state
        setBet(prevBet => prevBet ? {...prevBet, status: 'in_progress'} : null);
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.id === recipientId ? {...r, status: 'in_progress'} : r
          );
        });
        
        // Just go back without showing an alert
        navigation.goBack();
      } else {
        console.error("❌ Function returned failure:", data?.error || "Unknown error");
        Alert.alert("Error", data?.error || "Failed to accept bet. Please try again.");
        // Revert UI
        setRecipientStatus('pending');
      }
    } catch (error) {
      console.error("❌ Unexpected error in handleAcceptBet:", error);
      Alert.alert("Error", "An unexpected error occurred while accepting the bet. Please try again.");
      // Revert UI
      setRecipientStatus('pending');
    } finally {
      setLoading(false);
    }
  };

  // Handle rejecting a bet
  const handleRejectBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("➡️ Rejecting bet with recipientId:", recipientId);
      
      // Update UI immediately for better UX
      setRecipientStatus('rejected');
      
      // Call our secure reject function
      const { data, error } = await supabase.rpc(
        'secure_reject_bet',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("➡️ Reject result:", data, "Error:", error);
      
      if (error) {
        console.error("❌ Error rejecting bet:", error);
        Alert.alert("Error", "Failed to reject bet: " + error.message);
        // Revert UI
        setRecipientStatus('pending');
        return;
      }
      
      if (data && data.success) {
        console.log("✅ Bet rejected successfully!");
        
        // Update local state
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.id === recipientId ? {...r, status: 'rejected'} : r
          );
        });
        
        // Just go back without showing an alert
        navigation.goBack();
      } else {
        console.error("❌ Function returned failure:", data?.error || "Unknown error");
        Alert.alert("Error", data?.error || "Failed to reject bet. Please try again.");
        // Revert UI
        setRecipientStatus('pending');
      }
    } catch (error) {
      console.error("❌ Unexpected error in handleRejectBet:", error);
      Alert.alert("Error", "An unexpected error occurred while rejecting the bet. Please try again.");
      // Revert UI
      setRecipientStatus('pending');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle declaring win for a bet
  const handleDeclareWin = async () => {
    try {
      setLoading(true);
      console.log("📢 Declaring win...");
      console.log("Current recipient ID:", recipientId);
      console.log("All recipients:", recipients);
      
      // Handle cases where recipientId might not be available
      let currentRecipientId = recipientId;
      
      if (!currentRecipientId) {
        // If no recipientId is available but we have recipients, use the first one
        if (recipients && recipients.length > 0) {
          currentRecipientId = recipients[0].id;
          console.log("Using first recipient ID:", currentRecipientId);
        } else if (betId) {
          // If we have a betId but no recipients, use the betId directly
          console.log("No recipient ID available, using bet ID as fallback:", betId);
          
          // Update statuses using direct bet ID
          const timestamp = new Date().toISOString();
          await declareBetOutcome(betId, 'won', timestamp);
          
          // Update UI to show pending state
          setPendingOutcome('won');
          setHasPendingOutcome(true);
          
          Alert.alert(
            "Win Claimed", 
            "Your win has been claimed and is waiting for confirmation from your opponent."
          );
          
          setLoading(false);
          return;
        } else {
          Alert.alert("Error", "No recipient ID or bet ID available");
          setLoading(false);
          return;
        }
      }
      
      // Find opponent using the recipient ID
      const { betId: foundBetId, opponentId } = await findOpponent(currentRecipientId);
      console.log("Found opponent ID:", opponentId, "for recipient:", currentRecipientId);
      
      // Ensure we have a valid bet ID
      const currentBetId = foundBetId || betId;
      
      if (!currentBetId) {
        Alert.alert("Error", "Invalid bet ID");
        setLoading(false);
        return;
      }
      
      // Prepare updates
      const timestamp = new Date().toISOString();
      const recipientUpdate = {
        pending_outcome: 'won',
        outcome_claimed_by: user?.id,
        outcome_claimed_at: timestamp
      };
      
      const opponentUpdate = {
        pending_outcome: 'lost',
        outcome_claimed_by: user?.id,
        outcome_claimed_at: timestamp
      };
      
      console.log("Updating with:", recipientUpdate, "for recipient:", currentRecipientId);
      console.log("Updating with:", opponentUpdate, "for opponent:", opponentId);
      
      // Update statuses
      await updateRecipientStatuses(
        currentRecipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Verify the updates were successful by re-fetching
      if (currentRecipientId) {
        const { data: updatedRecipient, error: recipientError } = await supabase
          .from('bet_recipients')
          .select('*')
          .eq('id', currentRecipientId)
          .single();
          
        console.log("Updated recipient:", updatedRecipient, "Error:", recipientError);
      }
      
      if (opponentId) {
        const { data: updatedOpponent, error: opponentError } = await supabase
          .from('bet_recipients')
          .select('*')
          .eq('id', opponentId)
          .single();
          
        console.log("Updated opponent:", updatedOpponent, "Error:", opponentError);
      }
      
      // Update UI to show pending state
      setPendingOutcome('won');
      setHasPendingOutcome(true);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === currentRecipientId) {
            return {...r, pending_outcome: 'won'};
          } else if (opponentId && r.id === opponentId) {
            return {...r, pending_outcome: 'lost'};
          }
          return r;
        });
      });
      
      // Refresh bet details to get the latest state
      await fetchBetDetails();
      
      Alert.alert(
        "Win Claimed", 
        "Your win has been claimed and is waiting for confirmation from your opponent."
      );
    } catch (error) {
      console.error("Error declaring win:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to declare outcome when only bet ID is available
  const declareBetOutcome = async (betId: string, outcome: string, timestamp: string) => {
    try {
      console.log(`Declaring ${outcome} outcome for bet ${betId}`);
      
      // Get all recipients for this bet
      const { data: recipients, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('id, recipient_id')
        .eq('bet_id', betId);
        
      if (recipientsError || !recipients || recipients.length === 0) {
        console.error("Could not find recipients for this bet:", recipientsError);
        throw new Error("Could not find recipients for this bet");
      }
      
      // If we're the creator, we need to find our own recipient record vs others
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('creator_id')
        .eq('id', betId)
        .single();
        
      if (betError) {
        console.error("Could not fetch bet details:", betError);
        throw new Error("Could not fetch bet details");
      }
      
      const isCreator = bet.creator_id === user?.id;
      console.log(`User is creator of this bet: ${isCreator}`);
      
      // If there's only one recipient, update it
      if (recipients.length === 1) {
        console.log("Single recipient case - updating with pending outcome");
        const recipientUpdate = {
          pending_outcome: outcome === 'won' ? 'lost' : 'won', // Creator declares opposite for recipient
          outcome_claimed_by: user?.id,
          outcome_claimed_at: timestamp
        };
        
        const { error: updateError } = await supabase
          .from('bet_recipients')
          .update(recipientUpdate)
          .eq('id', recipients[0].id);
          
        if (updateError) {
          console.error("Error updating recipient:", updateError);
        }
        
        return;
      }
      
      // If there are multiple recipients, we need to determine which ones to update
      console.log(`Multiple recipients case (${recipients.length}) - updating all`);
      for (const recipient of recipients) {
        // If creator is declaring, set opposite outcome for recipients
        // If not creator (unlikely here), set outcome based on if it's our record
        const isMyRecord = isCreator ? false : recipient.recipient_id === user?.id;
        const pendingOutcomeToSet = isCreator ? 
          (outcome === 'won' ? 'lost' : 'won') : // Creator declares opposite for recipients
          (isMyRecord ? outcome : (outcome === 'won' ? 'lost' : 'won')); // Handle non-creator case too
          
        const update = {
          pending_outcome: pendingOutcomeToSet,
          outcome_claimed_by: user?.id,
          outcome_claimed_at: timestamp
        };
        
        console.log(`Updating recipient ${recipient.id} with pending outcome: ${pendingOutcomeToSet}`);
        const { error: updateError } = await supabase
          .from('bet_recipients')
          .update(update)
          .eq('id', recipient.id);
          
        if (updateError) {
          console.error(`Error updating recipient ${recipient.id}:`, updateError);
        }
      }
      
    } catch (error) {
      console.error("Error in declareBetOutcome:", error);
      throw error;
    }
  };

  // Handle declaring loss for a bet
  const handleDeclareLoss = async () => {
    try {
      setLoading(true);
      
      // Handle cases where recipientId might not be available
      let currentRecipientId = recipientId;
      
      if (!currentRecipientId) {
        // If no recipientId is available but we have recipients, use the first one
        if (recipients && recipients.length > 0) {
          currentRecipientId = recipients[0].id;
          console.log("Using first recipient ID:", currentRecipientId);
        } else if (betId) {
          // If we have a betId but no recipients, use the betId directly
          console.log("No recipient ID available, using bet ID as fallback:", betId);
          
          // This is a direct loss declaration - no need for confirmation
          const timestamp = new Date().toISOString();
          await declareFinalOutcome(betId, 'lost', timestamp);
          
          // Update UI immediately
          setRecipientStatus('lost');
          setPendingOutcome(null);
          setHasPendingOutcome(false);
          
          // Update local bet state immediately
          setBet(prevBet => prevBet ? {...prevBet, status: 'completed'} : null);
          
          // Refresh the bet lists to ensure correct tab display
          await fetchBets();
          
          // Skip dialog and navigate back
          navigation.goBack();
          setLoading(false);
          return;
        } else {
          console.error("Error: No recipient ID or bet ID available");
          navigation.goBack();
          setLoading(false);
          return;
        }
      }
      
      // Find opponent using the recipient ID
      const { betId: foundBetId, opponentId } = await findOpponent(currentRecipientId);
      
      // Ensure we have a valid bet ID
      const currentBetId = foundBetId || betId;
      
      if (!currentBetId) {
        console.error("Error: Invalid bet ID");
        navigation.goBack();
        setLoading(false);
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
        console.log(`Updating bet ${currentBetId} status to completed`);
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', currentBetId);
          
        if (betUpdateError) {
          console.error("Could not update bet status:", betUpdateError);
        } else {
          console.log("Successfully marked bet as completed");
          // Update the local bet state immediately
          setBet(prevBet => prevBet ? {...prevBet, status: 'completed'} : null);
        }
      }
      
      // Update UI immediately
      setRecipientStatus('lost');
      setPendingOutcome(null);
      setHasPendingOutcome(false);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === currentRecipientId) {
            return {...r, status: 'lost', pending_outcome: null};
          } else if (opponentId && r.id === opponentId) {
            return {...r, status: 'won', pending_outcome: null};
          }
          return r;
        });
      });
      
      // Refresh the bet lists to ensure correct tab display
      await fetchBets();
      
    } catch (error) {
      console.error("Error declaring loss:", error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to declare final outcome when only bet ID is available (direct declaration)
  const declareFinalOutcome = async (betId: string, outcome: string, timestamp: string) => {
    try {
      console.log(`Declaring final ${outcome} outcome for bet ${betId}`);
      
      // Get all recipients for this bet
      const { data: recipients, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('id, recipient_id')
        .eq('bet_id', betId);
        
      if (recipientsError || !recipients || recipients.length === 0) {
        console.error("Could not find recipients for this bet:", recipientsError);
        throw new Error("Could not find recipients for this bet");
      }
      
      // If we're the creator, we need to find our own recipient record vs others
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('creator_id')
        .eq('id', betId)
        .single();
        
      if (betError) {
        console.error("Could not fetch bet details:", betError);
        throw new Error("Could not fetch bet details");
      }
      
      const isCreator = bet.creator_id === user?.id;
      console.log(`User is creator of this bet: ${isCreator}`);
      
      // Update the bet's status directly as well - MAKE THIS A PRIORITY AND LOG THE RESULT
      const { data: betUpdateData, error: betUpdateError } = await supabase
        .from('bets')
        .update({ status: 'completed' })
        .eq('id', betId)
        .select('id, status');
        
      if (betUpdateError) {
        console.error("Could not update bet status:", betUpdateError);
      } else {
        console.log("Successfully marked bet as completed:", betUpdateData);
        // Also update local state
        setBet(prevBet => prevBet ? {...prevBet, status: 'completed'} : null);
      }
      
      // If there's only one recipient, update it
      if (recipients.length === 1) {
        console.log("Single recipient case - updating with final status");
        // For direct declaration, we set the status directly (not pending)
        const recipientUpdate = {
          status: isCreator ? (outcome === 'won' ? 'lost' : 'won') : outcome, // Creator declares opposite for recipient
          pending_outcome: null,
          outcome_claimed_by: user?.id,
          outcome_claimed_at: timestamp
        };
        
        const { error: updateError } = await supabase
          .from('bet_recipients')
          .update(recipientUpdate)
          .eq('id', recipients[0].id);
          
        if (updateError) {
          console.error("Error updating recipient:", updateError);
        } else {
          console.log(`Successfully updated recipient ${recipients[0].id} status`);
        }
        
        // Refresh the bet lists to ensure correct tab display
        await fetchBets();
        
        return;
      }
      
      // If there are multiple recipients, we need to determine which ones to update
      console.log(`Multiple recipients case (${recipients.length}) - updating all with final status`);
      for (const recipient of recipients) {
        // If creator is declaring, all recipients get the opposite outcome
        // If not creator (unlikely), outcome depends on if it's our record
        const isMyRecord = isCreator ? false : recipient.recipient_id === user?.id;
        const finalStatus = isCreator ? 
          (outcome === 'won' ? 'lost' : 'won') : // Creator declares opposite for recipients
          (isMyRecord ? outcome : (outcome === 'won' ? 'lost' : 'won')); // Non-creator case
          
        const update = {
          status: finalStatus,
          pending_outcome: null,
          outcome_claimed_by: user?.id,
          outcome_claimed_at: timestamp
        };
        
        console.log(`Updating recipient ${recipient.id} with final status: ${finalStatus}`);
        const { error: updateError } = await supabase
          .from('bet_recipients')
          .update(update)
          .eq('id', recipient.id);
          
        if (updateError) {
          console.error(`Error updating recipient ${recipient.id}:`, updateError);
        }
      }
      
      // Refresh the bet lists to ensure correct tab display
      await fetchBets();
      
    } catch (error) {
      console.error("Error in declareFinalOutcome:", error);
      throw error;
    }
  };

  // Handle confirming a pending outcome
  const handleConfirmOutcome = async () => {
    if (!opponentPendingOutcome) {
      Alert.alert("Error", "No outcome to confirm");
      return;
    }
    
    try {
      setLoading(true);
      
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
          console.log("Using first recipient ID:", currentRecipientId);
        } else {
          Alert.alert("Error", "No recipient ID available");
          setLoading(false);
          return;
        }
      }
      
      // Different logic for creator vs recipient
      if (isCreator) {
        // For creators, find the recipient who has a pending outcome
        const recipientWithPendingOutcome = recipients.find(r => !!r.pending_outcome);
        if (recipientWithPendingOutcome) {
          opponentId = recipientWithPendingOutcome.id;
          console.log("Creator found recipient with pending outcome:", recipientWithPendingOutcome);
        } else {
          console.log("No recipient with pending outcome found");
        }
      } else {
        // For recipients, use the standard findOpponent function
        const { betId: foundBetId, opponentId: foundOpponentId } = await findOpponent(currentRecipientId);
        opponentId = foundOpponentId;
      }
      
      // Get the bet ID
      const currentBetId = betId;
      
      if (!currentBetId) {
        Alert.alert("Error", "Invalid bet ID");
        setLoading(false);
        return;
      }
      
      if (!opponentId) {
        Alert.alert("Error", "No opponent found to confirm outcome with");
        setLoading(false);
        return;
      }
      
      console.log("Confirming outcome with:", { currentRecipientId, opponentId, myFinalStatus, opponentFinalStatus });
      
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
      if (currentBetId) {
        console.log(`Updating bet ${currentBetId} status to completed`);
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ status: 'completed' })
          .eq('id', currentBetId);
          
        if (betUpdateError) {
          console.error("Could not update bet status:", betUpdateError);
        } else {
          console.log("Successfully marked bet as completed");
          // Also update the local bet state
          setBet(prevBet => prevBet ? {...prevBet, status: 'completed'} : null);
        }
      }
      
      // Update UI
      setRecipientStatus(myFinalStatus);
      setOpponentPendingOutcome(null);
      setPendingOutcome(null);
      setHasPendingOutcome(false);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === currentRecipientId) {
            return {...r, status: myFinalStatus, pending_outcome: null};
          } else if (opponentId && r.id === opponentId) {
            return {...r, status: opponentFinalStatus, pending_outcome: null};
          }
          return r;
        });
      });
      
      // Refresh the bet lists to ensure correct tab display
      await fetchBets();
      
      // If I'm confirming a loss, open Venmo to pay the bet
      if (myFinalStatus === 'lost') {
        // Get winner's Venmo username (my opponent)
        let winnerVenmoUsername = null;
        const opponent = recipients.find(r => r.id === opponentId);
        
        if (opponent && opponent.profiles) {
          const opponentUserId = opponent.recipient_id;
          
          if (opponentUserId) {
            // Fetch the winner's Venmo username from the users table
            const { data: winnerData, error: winnerError } = await supabase
              .from('users')
              .select('venmo_username')
              .eq('id', opponentUserId)
              .single();
              
            if (!winnerError && winnerData && winnerData.venmo_username) {
              winnerVenmoUsername = winnerData.venmo_username;
            }
          }
        }
        
        // Try to open Venmo with the payment
        try {
          if (bet) {
            // Use hardcoded Venmo username if the fetched one is not available
            const venmoUsername = winnerVenmoUsername || 'S-PBOO'; // Fallback to the test username
            const note = "Paying bet";
            const venmoUrl = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${bet.stake}&note=${note}`;
            
            console.log("Opening Venmo with URL:", venmoUrl);
            
            // Try to open Venmo
            Linking.openURL(venmoUrl).catch(err => {
              console.error('Error opening Venmo:', err);
            });
          }
        } catch (error) {
          console.error('Error with Venmo deep linking:', error);
        }
        
        // Show alert and navigate back
        Alert.alert(
          "Loss Confirmed",
          "You've confirmed your loss. Make sure to complete the payment in Venmo.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        // For confirming a win, just show standard confirmation
        Alert.alert(
          "Outcome Confirmed", 
          `You've confirmed the outcome of this bet.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error("Error confirming outcome:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle rejecting a pending outcome
  const handleRejectOutcome = async () => {
    if (!opponentPendingOutcome) {
      Alert.alert("Error", "No outcome to reject");
      return;
    }
    
    try {
      setLoading(true);
      
      // Handle cases where recipientId might not be available
      let currentRecipientId = recipientId;
      
      if (!currentRecipientId) {
        // If no recipientId is available but we have recipients, use the first one
        if (recipients && recipients.length > 0) {
          currentRecipientId = recipients[0].id;
          console.log("Using first recipient ID:", currentRecipientId);
        } else {
          Alert.alert("Error", "No recipient ID available");
          setLoading(false);
          return;
        }
      }
      
      // Find opponent using the recipient ID
      const { betId: foundBetId, opponentId } = await findOpponent(currentRecipientId);
      
      // Ensure we have a valid bet ID
      const currentBetId = foundBetId || betId;
      
      if (!currentBetId) {
        Alert.alert("Error", "Invalid bet ID");
        setLoading(false);
        return;
      }
      
      if (!opponentId) {
        Alert.alert("Error", "No opponent found to reject outcome with");
        setLoading(false);
        return;
      }
      
      // Prepare updates - clear pending outcomes
      const recipientUpdate = {
        pending_outcome: null
      };
      
      const opponentUpdate = {
        pending_outcome: null
      };
      
      // Update statuses
      await updateRecipientStatuses(
        currentRecipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update UI
      setOpponentPendingOutcome(null);
      setPendingOutcome(null);
      setHasPendingOutcome(false);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === currentRecipientId || (opponentId && r.id === opponentId)) {
            return {...r, pending_outcome: null};
          }
          return r;
        });
      });
      
      Alert.alert(
        "Outcome Rejected", 
        "You've rejected the claimed outcome of this bet."
      );
      
    } catch (error) {
      console.error("Error rejecting outcome:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle canceling a bet (for creators only)
  const handleCancelBet = async () => {
    try {
      setLoading(true);
      console.log("🚫 Canceling bet:", betId);
      
      // Update the bet status to 'cancelled' instead of deleting it
      const { error } = await supabase
        .from('bets')
        .update({ status: 'cancelled' })
        .eq('id', betId)
        .eq('creator_id', user?.id); // Ensure only creator can delete
      
      if (error) {
        console.error("Error canceling bet:", error);
        Alert.alert("Error", "Failed to cancel bet. Please try again.");
        return;
      }
      
      // Also update all recipients to 'cancelled'
      const { error: recipientsError } = await supabase
        .from('bet_recipients')
        .update({ status: 'cancelled' })
        .eq('bet_id', betId);
        
      if (recipientsError) {
        console.error("Error updating recipients:", recipientsError);
        // Continue anyway, we've already updated the main bet
      }
      
      // Update local state
      setBet(prevBet => prevBet ? {...prevBet, status: 'cancelled'} : null);
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => ({...r, status: 'cancelled'}));
      });
      
      // Show success message and navigate back to home screen
      Alert.alert(
        "Success",
        "Bet cancelled successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Unexpected error in cancelBet:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Send a reminder to a recipient
  const sendReminder = async (recipientId: string) => {
    try {
      // In a real app, you would implement push notifications here
      console.log(`Sending reminder to user ${recipientId}`);
      Alert.alert('Reminder Sent', 'A reminder has been sent to this user.');
    } catch (error) {
      console.error('Error sending reminder:', error);
      Alert.alert('Error', 'Failed to send reminder');
    }
  };

  // Helper function to render recipients
  const renderRecipients = () => {
    if (loading) {
      return <ActivityIndicator size="small" color="#0000ff" />;
    }
    
    if (!recipients || recipients.length === 0) {
      return (
        <View style={styles.noRecipientContainer}>
          <Text style={styles.noRecipientText}>No participants for this bet</Text>
        </View>
      );
    }
    
    // Prepare to render both participants
    const participantElements = [];
    
    // Add Creator/Challenger - if we have bet data
    if (bet) {
      // Get creator data from the first recipient's creator property
      const creatorData = recipients[0]?.creator;
      
      // Get creator name with better fallbacks
      const creatorName = creatorData?.display_name || 
                         creatorData?.username || 
                         (bet.creator_id === user?.id ? "You (Challenger)" : `Challenger ${bet.creator_id?.slice(0, 8) || ''}`);
      
      // Get avatar initial
      const creatorInitial = (creatorData?.display_name?.charAt(0) || 
                             creatorData?.username?.charAt(0) || 
                             creatorName.charAt(0) || 'C').toUpperCase();
      
      // Get color based on status
      let creatorStatusColor = "#2196F3"; // Default blue
      
      // Add creator element
      participantElements.push(
        <View key="creator" style={styles.participantItem}>
          <View style={[styles.avatarContainer, styles.challengerAvatar]}>
            <Text style={styles.avatarText}>{creatorInitial}</Text>
          </View>
          <View style={styles.recipientInfo}>
            <View style={styles.recipientNameContainer}>
              <Text style={styles.recipientName}>{creatorName}</Text>
              <Text style={[styles.participantLabel, styles.challengerLabel]}>Challenger</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: creatorStatusColor }]}>
              <Text style={styles.statusText}>Creator</Text>
            </View>
          </View>
        </View>
      );
    }
    
    // Add all recipients who aren't the creator
    recipients.forEach(item => {
      if (item.recipient_id !== bet?.creator_id) {
        // Format the recipient status for display
        const statusText = capitalizeFirstLetter(item.status || 'pending');
        
        // Get the correct color based on status
        let statusColor = "#FFC107"; // Default yellow for pending
        if (item.status === 'in_progress') statusColor = "#2196F3";
        else if (item.status === 'won') statusColor = "#4CAF50";
        else if (item.status === 'lost') statusColor = "#FF5722";
        else if (item.status === 'rejected') statusColor = "#F44336";
        
        // Get the username from users data with better fallbacks
        const displayName = item.profiles?.display_name || item.profiles?.username;
        const username = displayName || (item.recipient_id === user?.id ? "You (Recipient)" : `User ${item.recipient_id?.slice(0, 8) || ''}`);
        
        // Get first initial for avatar
        const firstInitial = (displayName?.charAt(0) || username.charAt(0) || 'U').toUpperCase();
        
        participantElements.push(
          <View key={item.id.toString()} style={styles.participantItem}>
            <View style={[styles.avatarContainer, styles.recipientAvatar]}>
              <Text style={styles.avatarText}>{firstInitial}</Text>
            </View>
            <View style={styles.recipientInfo}>
              <View style={styles.recipientNameContainer}>
                <Text style={styles.recipientName}>{username}</Text>
                <Text style={[styles.participantLabel, styles.recipientLabel]}>Recipient</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
            {bet?.creator_id === user?.id && item.status === 'pending' && (
              <View style={styles.reminderContainer}>
                <TouchableOpacity
                  style={styles.reminderButton}
                  onPress={() => sendReminder(item.recipient_id || '')}
                >
                  <Ionicons name="notifications-outline" size={20} color="white" />
                  <Text style={styles.reminderText}>Remind</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }
    });
    
    return participantElements;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date set";
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
      </View>
    );
  }

  if (!bet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Bet not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Check if any recipient has a 'won' or 'lost' status
  // If so, the bet status should be 'completed'
  const hasWonOrLostRecipient = recipients.some(r => 
    r.status === 'won' || r.status === 'lost'
  );
  
  // We'll use this calculated status to ensure UI consistency
  const effectiveBetStatus = hasWonOrLostRecipient ? 'completed' : bet.status;

  const canDeleteBet = isCreator && bet.status === 'pending';
  const canEditBet = isCreator && bet.status === 'pending';
  const canAcceptRejectBet = !isCreator && recipientStatus === 'pending';
  const canDeclareOutcome = effectiveBetStatus === 'in_progress' && (recipientStatus === 'in_progress' || recipientStatus === 'creator');
  const canCancelBet = isCreator && effectiveBetStatus === 'in_progress';
  
  // Flag to determine if the user can confirm a pending outcome (claimed by the opponent)
  const canConfirmOutcome = 
    // Any status is fine as long as there's a pending outcome to confirm
    opponentPendingOutcome !== null; 
  
  // Debug logs for why confirmation UI might not show
  console.log("🔍 RENDER DEBUG: Rendering with opponentPendingOutcome:", opponentPendingOutcome);
  console.log("🔍 RENDER DEBUG: recipientStatus:", recipientStatus);
  console.log("🔍 RENDER DEBUG: User is creator:", isCreator);
  console.log("🔍 RENDER DEBUG: effectiveBetStatus:", effectiveBetStatus);
  console.log("🔍 RENDER DEBUG: canConfirmOutcome:", canConfirmOutcome);
  console.log("🔍 RENDER DEBUG: All recipients:", recipients);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bet Details</Text>
        {canDeleteBet && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={confirmDeleteBet}
          >
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        )}
        {canCancelBet && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleCancelBet}
          >
            <Ionicons name="ban" size={24} color="#9C27B0" />
          </TouchableOpacity>
        )}
        {!canDeleteBet && !canCancelBet && <View style={{ width: 28 }} />}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.betCard}>
          <Text style={styles.betDescription}>{bet.description}</Text>
          
          <View style={styles.betDetail}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              // Always show completed if any recipient has won/lost status
              hasWonOrLostRecipient ? styles.completedBadge :
              effectiveBetStatus === 'pending' ? styles.pendingBadge : 
              effectiveBetStatus === 'in_progress' ? styles.inProgressBadge :
              effectiveBetStatus === 'cancelled' ? styles.rejectedBadge :
              styles.completedBadge
            ]}>
              <Text style={styles.statusText}>
                {hasWonOrLostRecipient ? 'Completed' : capitalizeFirstLetter(effectiveBetStatus)}
              </Text>
            </View>
          </View>
          
          <View style={styles.betDetail}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={styles.detailValue}>${bet.stake}</Text>
          </View>
          
          <View style={styles.betDetail}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{formatDate(bet.due_date)}</Text>
          </View>
          
          <View style={styles.betDetail}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>{formatDate(bet.created_at)}</Text>
          </View>
        </View>

        <View style={styles.recipientsList}>
          {renderRecipients()}
        </View>
        
        {canAcceptRejectBet && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={handleAcceptBet}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.actionButtonText}>Accept Bet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.rejectButton}
              onPress={handleRejectBet}
            >
              <Ionicons name="close" size={20} color="white" />
              <Text style={styles.actionButtonText}>Reject Bet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Display action buttons if the bet is still in progress and there's no pending outcome */}
        {canDeclareOutcome && !pendingOutcome && !opponentPendingOutcome && (
          <View style={styles.actionContainerVertical}>
            <Text style={styles.actionTitle}>Declare Outcome</Text>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.outcomeButton, styles.winButton]} 
                onPress={handleDeclareWin}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>I Won</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.outcomeButton, styles.loseButton]} 
                onPress={handleDeclareLoss}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>I Lost</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Display pending outcome confirmation UI if opponent claimed an outcome */}
        {canConfirmOutcome && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              {opponentPendingOutcome === 'won' 
                ? (isCreator 
                  ? 'Your opponent claims they won this bet. Do you agree?' 
                  : 'Your opponent claims they won this bet')
                : (isCreator
                  ? 'Your opponent claims they lost this bet. Do you agree?'
                  : 'Your opponent claims they lost this bet')
              }
            </Text>
            
            <View style={styles.pendingOutcomeButtons}>
              <TouchableOpacity 
                style={[styles.outcomeButton, styles.confirmButton]} 
                onPress={handleConfirmOutcome}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>
                  {opponentPendingOutcome === 'won' 
                    ? (isCreator ? 'Confirm (They Won)' : 'Confirm (I Lost)')
                    : (isCreator ? 'Confirm (They Lost)' : 'Confirm (I Won)')
                  }
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.outcomeButton, styles.disputeButton]} 
                onPress={handleRejectOutcome}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Display my pending outcome status */}
        {pendingOutcome && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              {pendingOutcome === 'won' 
                ? 'You claimed victory. Waiting for confirmation...' 
                : 'You claimed a loss. Waiting for confirmation...'}
            </Text>
          </View>
        )}

        {canEditBet && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('EditBet', { bet })}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.editButtonText}>Edit Bet</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#1A1A1A',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  betCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  betDescription: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  betDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  detailValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFC107',
  },
  inProgressBadge: {
    backgroundColor: '#2196F3',
  },
  wonBadge: {
    backgroundColor: '#4CAF50',
  },
  lostBadge: {
    backgroundColor: '#FF5722',
  },
  rejectedBadge: {
    backgroundColor: '#F44336',
  },
  completedBadge: {
    backgroundColor: '#9C27B0',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#6B46C1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  recipientsContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recipientsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recipientInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipientName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  recipientStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recipientStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recipientsEmptyContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  recipientsEmptyText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionContainerVertical: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  disputeButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  noRecipientContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  noRecipientText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  recipientsList: {
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recipientStatus: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reminderButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  reminderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  winButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  loseButton: {
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  pendingOutcomeContainer: {
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#555555',
  },
  pendingOutcomeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  pendingOutcomeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  outcomeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
  },
  recipientNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantLabel: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengerAvatar: {
    backgroundColor: '#2196F3',
  },
  challengerLabel: {
    color: '#E0F7FA',
  },
  recipientAvatar: {
    backgroundColor: '#6B46C1',
  },
  recipientLabel: {
    color: '#F3E5F5',
  },
});

export default BetDetailsScreen; 