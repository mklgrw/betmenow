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
  avatar_url?: string;
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
  const { updateRecipientStatuses, findOpponent } = useBets();
  
  // Extract and validate betId
  const params = route.params as { betId?: string; refresh?: number };
  const betId = params?.betId;
  
  // Log route params for debugging
  useEffect(() => {
    if (betId) {
      fetchBetDetails();
    }
  }, [betId, params?.refresh]);

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
      
      if (recipientsData && recipientsData.length > 0) {
        // Collect user IDs to fetch display names
        const userIds = recipientsData.map(r => r.recipient_id).filter(Boolean);
        
        // Fetch user display names
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
          
        if (!userError && userData) {
          // Add display names to the recipients data
          const enhancedRecipients = recipientsData.map(recipient => {
            const userInfo = userData.find(u => u.id === recipient.recipient_id);
            return {
              ...recipient,
              profiles: userInfo || null
            };
          });
          
          setRecipients(enhancedRecipients);
        } else {
          setRecipients(recipientsData);
        }
        
        // Find my recipient record
        const myRecipient = recipientsData.find(r => r.recipient_id === user?.id);
        
        if (myRecipient) {
          setRecipientId(myRecipient.id);
          setRecipientStatus(myRecipient.status);
          setPendingOutcome(myRecipient.pending_outcome || null);
          setHasPendingOutcome(!!myRecipient.pending_outcome);
          
          // Find opponent's record
          const opponentRecipient = recipientsData.find(r => r.recipient_id !== user?.id);
          
          if (opponentRecipient?.pending_outcome) {
            setOpponentPendingOutcome(opponentRecipient.pending_outcome);
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
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      
      // Find opponent
      const { betId, opponentId } = await findOpponent(recipientId);
      
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
      
      // Update statuses
      await updateRecipientStatuses(
        recipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update UI to show pending state
      setPendingOutcome('won');
      setHasPendingOutcome(true);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === recipientId) {
            return {...r, pending_outcome: 'won'};
          } else if (opponentId && r.id === opponentId) {
            return {...r, pending_outcome: 'lost'};
          }
          return r;
        });
      });
      
      Alert.alert(
        "Win Claimed", 
        "Your win has been claimed and is waiting for confirmation from your opponent."
      );
      
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle declaring loss for a bet
  const handleDeclareLoss = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      
      // Find opponent
      const { betId, opponentId } = await findOpponent(recipientId);
      
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
        recipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update UI
      setRecipientStatus('lost');
      setPendingOutcome(null);
      setHasPendingOutcome(false);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === recipientId) {
            return {...r, status: 'lost', pending_outcome: null};
          } else if (opponentId && r.id === opponentId) {
            return {...r, status: 'won', pending_outcome: null};
          }
          return r;
        });
      });
      
      Alert.alert(
        "Loss Declared", 
        "You've declared a loss for this bet. Your opponent has been marked as the winner.",
        [
          { 
            text: "OK", 
            onPress: () => {
              navigation.goBack();
            }
          }
        ]
      );
      
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle confirming a pending outcome
  const handleConfirmOutcome = async () => {
    if (!recipientId || !opponentPendingOutcome) {
      Alert.alert("Error", "No outcome to confirm");
      return;
    }
    
    try {
      setLoading(true);
      
      // My status is opposite of what opponent claimed
      const myFinalStatus = opponentPendingOutcome === 'won' ? 'lost' : 'won';
      const opponentFinalStatus = opponentPendingOutcome;
      
      // Find opponent
      const { betId, opponentId } = await findOpponent(recipientId);
      
      if (!opponentId) {
        throw new Error("No opponent found to confirm outcome with");
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
        recipientId, 
        recipientUpdate, 
        opponentId, 
        opponentUpdate
      );
      
      // Update UI
      setRecipientStatus(myFinalStatus);
      setOpponentPendingOutcome(null);
      setPendingOutcome(null);
      setHasPendingOutcome(false);
      
      // Update recipients list
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => {
          if (r.id === recipientId) {
            return {...r, status: myFinalStatus, pending_outcome: null};
          } else if (opponentId && r.id === opponentId) {
            return {...r, status: opponentFinalStatus, pending_outcome: null};
          }
          return r;
        });
      });
      
      Alert.alert(
        "Outcome Confirmed", 
        `You've confirmed the outcome of this bet.`,
        [
          { 
            text: "OK", 
            onPress: () => {
              navigation.goBack();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error("❌ Unexpected error in handleConfirmOutcome:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle rejecting a pending outcome
  const handleRejectOutcome = async () => {
    if (!recipientId || !opponentPendingOutcome) {
      Alert.alert("Error", "No outcome to reject");
      return;
    }
    
    try {
      setLoading(true);
      
      // Find opponent
      const { betId, opponentId } = await findOpponent(recipientId);
      
      if (!opponentId) {
        throw new Error("No opponent found to reject outcome with");
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
        recipientId, 
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
          if (r.id === recipientId || (opponentId && r.id === opponentId)) {
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
      console.error("❌ Unexpected error in handleRejectOutcome:", error);
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
          <Text style={styles.noRecipientText}>No recipients for this bet</Text>
        </View>
      );
    }
    
    return recipients.map((item) => {
      // Format the recipient status for display
      const statusText = capitalizeFirstLetter(item.status || 'pending');
      
      // Get the correct color based on status
      let statusColor = "#FFC107"; // Default yellow for pending
      if (item.status === 'in_progress') statusColor = "#2196F3";
      else if (item.status === 'won') statusColor = "#4CAF50";
      else if (item.status === 'rejected') statusColor = "#F44336";
      
      // Get the username from the profiles object or use recipient_id as fallback
      const username = item.profiles?.username || `User ${item.recipient_id?.slice(0, 4) || ''}...`;
      const firstInitial = (username.charAt(0) || 'U').toUpperCase();
      
      return (
        <View key={item.id.toString()} style={styles.recipientItem}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{firstInitial}</Text>
          </View>
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientName}>{username}</Text>
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
                <Ionicons name="notifications-outline" size={20} color="#007AFF" />
                <Text style={styles.reminderText}>Remind</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    });
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

  const canDeleteBet = isCreator && bet.status === 'pending';
  const canEditBet = isCreator && bet.status === 'pending';
  const canAcceptRejectBet = !isCreator && recipientStatus === 'pending';
  const canDeclareOutcome = bet.status === 'in_progress';
  const canCancelBet = isCreator && bet.status === 'in_progress';

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
              bet.status === 'pending' ? styles.pendingBadge : 
              bet.status === 'in_progress' ? styles.inProgressBadge :
              bet.status === 'won' ? styles.wonBadge : styles.lostBadge
            ]}>
              <Text style={styles.statusText}>
                {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
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
        {recipientStatus === 'in_progress' && !pendingOutcome && !opponentPendingOutcome && (
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
        {opponentPendingOutcome && recipientStatus === 'in_progress' && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              {opponentPendingOutcome === 'won' 
                ? 'Your opponent claims they won this bet' 
                : 'Your opponent claims they lost this bet'}
            </Text>
            
            <View style={styles.pendingOutcomeButtons}>
              <TouchableOpacity 
                style={[styles.outcomeButton, styles.confirmButton]} 
                onPress={handleConfirmOutcome}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>
                  {opponentPendingOutcome === 'won' ? 'Confirm Their Win' : 'Accept Their Loss'}
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

        {/* Creator actions for bet management */}
        {isCreator && bet?.status === 'in_progress' && !recipientStatus && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelBet}
              disabled={loading}
            >
              <Ionicons name="close-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Cancel Bet</Text>
            </TouchableOpacity>
          </View>
        )}

        {canDeclareOutcome && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.winButton}
              onPress={handleDeclareWin}
            >
              <Ionicons name="trophy" size={20} color="white" />
              <Text style={styles.actionButtonText}>I Won</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.loseButton}
              onPress={handleDeclareLoss}
            >
              <Ionicons name="sad" size={20} color="white" />
              <Text style={styles.actionButtonText}>I Lost</Text>
            </TouchableOpacity>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#f9f0d9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6d292',
  },
  pendingOutcomeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
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
  }
});

export default BetDetailsScreen; 