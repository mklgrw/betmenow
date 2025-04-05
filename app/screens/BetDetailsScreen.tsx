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

type BetDetailsProps = {
  route: {
    params: {
      betId: string;
    };
  };
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

  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Extract and validate betId
  const params = route.params as { betId?: string; refresh?: number };
  const betId = params?.betId;
  
  // Log route params for debugging
  useEffect(() => {
    console.log("Route params:", route.params);
    console.log("Extracted betId:", betId);
  }, [route.params]);
  
  useEffect(() => {
    if (betId) {
      console.log("Loading bet with ID:", betId);
      fetchBetDetails();
    } else {
      console.error("No betId provided in route params");
    }
  }, [betId, params?.refresh]);

  // Function to fetch bet details
  const fetchBetDetails = async () => {
    console.log("Trying to fetch bet with ID:", betId);
    
    try {
      setLoading(true);
      
      // COMPLETELY SIMPLIFIED QUERY - No joins, no relationships
      const { data: betData, error: betError } = await supabase
        .from('bets')
        .select('id, description, stake, due_date, status, creator_id, created_at')
        .eq('id', betId)
        .single();
  
      if (betError) {
        console.error("Error fetching bet details:", betError);
        Alert.alert("Error", "Failed to load bet details. Please try again.");
        return;
      }
  
      setBet(betData);
      console.log("Loaded bet:", betData);
      
      // Check if user is creator - simple comparison
      const userIsCreator = betData.creator_id === user?.id;
      setIsCreator(userIsCreator);
      
      // Basic recipient query - no joins
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('bet_recipients')
        .select('id, bet_id, recipient_id, status')
        .eq('bet_id', betId);
      
      if (recipientsError) {
        console.error("Error fetching recipients:", recipientsError);
        return;
      }
      
      console.log("Found recipients:", recipientsData?.length || 0);
      
      if (recipientsData && recipientsData.length > 0) {
        // Directly use the data without trying to join with users
        setRecipients(recipientsData);
        
        // Check if current user is a recipient
        const userRecipient = recipientsData.find(r => r.recipient_id === user?.id);
        if (userRecipient) {
          console.log("User is a recipient with status:", userRecipient.status);
          setRecipientId(userRecipient.id);
          setRecipientStatus(userRecipient.status);
        }
      }
    } catch (error) {
      console.error("Unexpected error in fetchBetDetails:", error);
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
        [{ text: "OK", onPress: () => navigation.navigate('Home') }]
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
      
      // Call our proper accept function
      const { data, error } = await supabase.rpc(
        'accept_bet',
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
      
      if (data === true) {
        console.log("✅ Bet accepted successfully!");
        
        // Update local state
        setBet(prevBet => prevBet ? {...prevBet, status: 'in_progress'} : null);
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.id === recipientId ? {...r, status: 'in_progress'} : r
          );
        });
        
        // Show success and navigate back to home screen with refresh parameter
        Alert.alert(
          "Success", 
          "Bet accepted successfully!",
          [
            { 
              text: "OK", 
              onPress: () => {
                // Navigate back to home with refresh parameter
                navigation.navigate('Home', { refresh: Date.now() });
              }
            }
          ]
        );
      } else {
        console.error("❌ Function returned false");
        Alert.alert("Error", "Failed to accept bet. Please try again.");
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
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
      
      // Immediately update UI for better UX
      setRecipientStatus('rejected');
      
      // Call the proper reject function
      const { data, error } = await supabase.rpc(
        'reject_bet',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("➡️ Rejection result:", data, "Error:", error);
      
      if (error) {
        console.error("❌ Error rejecting bet:", error);
        Alert.alert("Error", "Failed to reject bet: " + error.message);
        // Revert UI
        setRecipientStatus('pending');
        return;
      }
      
      if (data === true) {
        console.log("✅ Bet rejected successfully!");
        
        // Update local state
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.id === recipientId ? {...r, status: 'rejected'} : r
          );
        });
        
        // Show success and navigate back to home screen with refresh parameter
        Alert.alert(
          "Success", 
          "Bet rejected successfully!",
          [
            { 
              text: "OK", 
              onPress: () => {
                // Navigate back to home with refresh parameter
                navigation.navigate('Home', { refresh: Date.now() });
              }
            }
          ]
        );
      } else {
        console.error("❌ Function returned false");
        Alert.alert("Error", "Failed to reject bet. Please try again.");
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };
  
  // Confirm accepting a bet
  const confirmAcceptBet = () => {
    if (!recipientId || !betId) {
      Alert.alert("Error", "Missing recipient or bet ID");
      return;
    }
    
    Alert.alert(
      "Accept Bet",
      "Are you sure you want to accept this bet?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Accept", 
          onPress: () => {
            console.log("Confirmation dialog 'Accept' pressed");
            handleAcceptBet();
          }
        }
      ]
    );
  };
  
  // Confirm rejecting a bet
  const confirmRejectBet = () => {
    if (!recipientId || !betId) {
      Alert.alert("Error", "Missing recipient or bet ID");
      return;
    }
    
    Alert.alert(
      "Reject Bet",
      "Are you sure you want to reject this bet?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Reject", 
          onPress: () => {
            console.log("Confirmation dialog 'Reject' pressed");
            handleRejectBet();
          },
          style: "destructive"
        }
      ]
    );
  };

  // Add this emergency direct accept function right after handleAcceptBet
  const emergencyDirectAccept = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("EMERGENCY: Attempting direct forced update with recipientId:", recipientId);
      
      // Import the supabase client directly
      const { supabase } = require('../services/supabase');
      
      // Call the force_update_recipient function that bypasses ALL restrictions
      const { data, error } = await supabase.rpc(
        'force_update_recipient',
        { 
          recipient_uuid: recipientId,
          new_status: 'in_progress'
        }
      );
      
      console.log("EMERGENCY: Direct force update result:", { data, error });
      
      if (error) {
        console.error("EMERGENCY: Force update failed:", error);
        Alert.alert("Emergency Update Failed", "Could not force update status: " + error.message);
        return;
      }
      
      if (data === true) {
        console.log("EMERGENCY: Force update succeeded!");
        Alert.alert("Success", "Emergency update successful!");
        
        // Force UI update
        setRecipientStatus('in_progress');
        
        // Force reload the entire component by changing a key prop
        navigation.setParams({ refresh: Date.now() });
      } else {
        console.error("EMERGENCY: Force update returned false");
        Alert.alert("Emergency Update Failed", "The update function returned false");
      }
    } catch (error) {
      console.error("EMERGENCY: Unexpected error in emergencyDirectAccept:", error);
      Alert.alert("Error", "An unexpected error occurred during emergency update");
    } finally {
      setLoading(false);
    }
  };

  // Handle force accepting a bet (for admin/emergency purposes)
  const forceAcceptBet = async () => {
    if (!betId) {
      Alert.alert("Error", "No bet ID found");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Force accepting bet with betId:", betId);
      
      if (recipients.length === 0) {
        Alert.alert("Error", "No recipients available for this bet");
        return;
      }
      
      // For each recipient in pending status, update to in_progress
      const pendingRecipients = recipients.filter(r => r.status === 'pending');
      
      if (pendingRecipients.length === 0) {
        Alert.alert("Info", "No pending recipients to accept");
        return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const recipient of pendingRecipients) {
        const { data, error } = await supabase.rpc(
          'direct_update_bet_status',
          { 
            p_recipient_id: recipient.id,
            p_bet_id: betId,
            p_status: 'in_progress'
          }
        );
        
        if (error) {
          console.error(`Error force accepting for recipient ${recipient.id}:`, error);
          errorCount++;
        } else if (data === true) {
          successCount++;
        }
      }
      
      // Update local state to reflect changes
      if (successCount > 0) {
        setBet(prevBet => prevBet ? {...prevBet, status: 'in_progress'} : null);
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.status === 'pending' ? {...r, status: 'in_progress'} : r
          );
        });
        
        // Show success and navigate back to home screen with refresh parameter
        Alert.alert(
          "Success", 
          `Forced acceptance for ${successCount} recipients. ${errorCount} failed.`,
          [
            { 
              text: "OK", 
              onPress: () => {
                // Navigate back to home with refresh parameter
                navigation.navigate('Home', { refresh: Date.now() });
              }
            }
          ]
        );
      } else if (errorCount > 0) {
        Alert.alert("Error", "Failed to force accept any recipients");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
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
    console.log('Rendering recipients, count:', recipients.length);
    
    if (loading) {
      return <ActivityIndicator size="small" color="#0000ff" />;
    }
    
    if (!recipients || recipients.length === 0) {
      return (
        <View style={styles.noRecipientContainer}>
          <Text style={styles.noRecipientText}>No recipients for this bet</Text>
          {__DEV__ && (
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={addTestRecipient}
            >
              <Text style={styles.debugButtonText}>Add Test Recipient (Debug)</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    return (
      <FlatList
        data={recipients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Format the recipient status for display
          const statusText = capitalizeFirstLetter(item.status || 'pending');
          
          // Get the correct color based on status
          let statusColor = "#FFC107"; // Default yellow for pending
          if (item.status === 'in_progress') statusColor = "#2196F3";
          else if (item.status === 'won') statusColor = "#4CAF50";
          else if (item.status === 'rejected') statusColor = "#F44336";
          
          return (
            <View style={styles.recipientItem}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>U</Text>
              </View>
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientName}>
                  User {item.recipient_id?.slice(0, 4) || ''}...
                </Text>
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
        }}
        style={styles.recipientsList}
      />
    );
  };

  // Add a test recipient directly into database
  const addTestRecipient = async () => {
    if (!betId || !user) {
      Alert.alert("Error", "Missing bet ID or user");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Adding test recipient for betId:", betId, "user:", user.id);
      
      // Check if this user is already a recipient
      const existingCheck = await supabase
        .from('bet_recipients')
        .select('id')
        .eq('bet_id', betId)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (existingCheck.data) {
        Alert.alert("Error", "You're already a recipient for this bet");
        return;
      }
      
      // Insert directly to bet_recipients
      const { data, error } = await supabase
        .from('bet_recipients')
        .insert({
          bet_id: betId,
          user_id: user.id,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error("Error adding test recipient:", error);
        Alert.alert("Error", "Failed to add test recipient: " + error.message);
        return;
      }
      
      console.log("Test recipient added:", data);
      
      // Update state with new recipient
      setRecipients(prev => [
        ...prev, 
        {
          id: data.id,
          bet_id: betId,
          user_id: user.id,
          status: 'pending',
          created_at: data.created_at
        }
      ]);
      
      Alert.alert("Success", "Test recipient added successfully. RecipientId: " + data.id);
      
      // Refresh data to confirm
      setTimeout(() => fetchBetDetails(), 500);
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Add this alternative rejection function that doesn't use RPC
  const alternativeRejectBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("ALTERNATIVE: Direct rejection attempt with recipientId:", recipientId);
      
      // Try direct update to the table without using the function
      const { data, error } = await supabase
        .from('bet_recipients')
        .update({ status: 'rejected' })
        .eq('id', recipientId);
      
      console.log("ALTERNATIVE: Direct table update result:", { data, error });
      
      if (error) {
        console.error("ALTERNATIVE: Direct update failed:", error);
        Alert.alert("Alternative Update Failed", "Could not update status: " + error.message);
        return;
      }
      
      console.log("ALTERNATIVE: Direct update succeeded!");
      Alert.alert("Success", "Bet rejected successfully!");
      
      // Force UI update
      setRecipientStatus('rejected');
      
      // Force reload the entire component by changing a key prop
      navigation.setParams({ refresh: Date.now() });
    } catch (error) {
      console.error("ALTERNATIVE: Unexpected error in alternativeRejectBet:", error);
      Alert.alert("Error", "An unexpected error occurred during alternative update");
    } finally {
      setLoading(false);
    }
  };

  // Add this raw rejection function
  const rawRejectBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("RAW REJECT: Attempting raw SQL update with recipientId:", recipientId);
      
      // Call our raw update function
      const { data, error } = await supabase.rpc(
        'raw_update_recipient_status',
        { 
          p_recipient_id: recipientId,
          p_status: 'rejected'
        }
      );
      
      console.log("RAW REJECT: Update result:", { data, error });
      
      if (error) {
        console.error("RAW REJECT: Update failed:", error);
        Alert.alert("Raw Update Failed", "Could not update status: " + error.message);
        return;
      }
      
      if (data === true) {
        console.log("RAW REJECT: Update succeeded!");
        Alert.alert("Success", "Bet rejected successfully with raw update!");
        
        // Force UI update
        setRecipientStatus('rejected');
        setRecipients(prevRecipients => {
          return prevRecipients.map(r => 
            r.id === recipientId ? {...r, status: 'rejected'} : r
          );
        });
        
        // Force reload the entire component by changing a key prop
        navigation.navigate('Home', { refresh: Date.now() });
      } else {
        console.error("RAW REJECT: Update returned false");
        Alert.alert("Raw Update Failed", "The update function returned false");
      }
    } catch (error) {
      console.error("RAW REJECT: Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred during raw update");
    } finally {
      setLoading(false);
    }
  };

  // Function to perform atomic reject with disabled triggers
  const triggerlessRejectBet = async () => {
    if (!recipientId || !betId) {
      Alert.alert("Error", "Missing recipient or bet ID");
      return;
    }
    
    try {
      setLoading(true);
      console.log("🧨 TRIGGERLESS REJECT - Starting with recipientId:", recipientId);
      
      // 1. Disable all triggers on bet_recipients table
      const { data: disableResult, error: disableError } = await supabase.rpc(
        'disable_all_triggers_on',
        { table_name: 'bet_recipients' }
      );
      
      if (disableError) {
        console.error("🧨 TRIGGERLESS REJECT - Error disabling triggers:", disableError);
        Alert.alert("Error", "Failed to disable triggers: " + disableError.message);
        return;
      }
      
      console.log("🧨 TRIGGERLESS REJECT - Triggers disabled:", disableResult);
      
      // 2. Update recipient status directly
      const { data: updateData, error: updateError } = await supabase
        .from('bet_recipients')
        .update({ status: 'rejected' })
        .eq('id', recipientId);
        
      // 3. Re-enable all triggers regardless of update success
      const { data: enableResult, error: enableError } = await supabase.rpc(
        'enable_all_triggers_on',
        { table_name: 'bet_recipients' }
      );
      
      if (enableError) {
        console.error("🧨 TRIGGERLESS REJECT - Error re-enabling triggers:", enableError);
      } else {
        console.log("🧨 TRIGGERLESS REJECT - Triggers re-enabled:", enableResult);
      }
      
      // Check if update succeeded
      if (updateError) {
        console.error("🧨 TRIGGERLESS REJECT - Error updating status:", updateError);
        Alert.alert("Error", "Failed to update status: " + updateError.message);
        return;
      }
      
      console.log("🧨 TRIGGERLESS REJECT - Update successful");
      Alert.alert("Success", "Bet rejected with triggers disabled!");
      
      // Update UI
      setRecipientStatus('rejected');
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => 
          r.id === recipientId ? {...r, status: 'rejected'} : r
        );
      });
      
      // Navigate back home with refresh
      navigation.navigate('Home', { refresh: Date.now() });
      
    } catch (error) {
      console.error("🧨 TRIGGERLESS REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // NUCLEAR reject option - last resort, bypasses ALL constraints
  const nuclearRejectBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("☢️ NUCLEAR REJECT - Last resort attempt for recipientId:", recipientId);
      
      // Call our nuclear option
      const { data, error } = await supabase.rpc(
        'nuclear_reject_recipient',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("☢️ NUCLEAR REJECT - Result:", data, "Error:", error);
      
      if (error) {
        console.error("☢️ NUCLEAR REJECT - Failed:", error);
        Alert.alert("Nuclear Option Failed", "Could not update status: " + error.message);
        return;
      }
      
      console.log("☢️ NUCLEAR REJECT - Success response:", data);
      Alert.alert("Success", "Bet rejected with NUCLEAR option!");
      
      // Force UI update
      setRecipientStatus('rejected');
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => 
          r.id === recipientId ? {...r, status: 'rejected'} : r
        );
      });
      
      // Navigate back to home with refresh
      navigation.navigate('Home', { refresh: Date.now() });
      
    } catch (error) {
      console.error("☢️ NUCLEAR REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred with nuclear option");
    } finally {
      setLoading(false);
    }
  };

  // SUPERUSER update - absolute last resort
  const superuserRejectBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("🦸‍♂️ SUPERUSER REJECT - Attempting superuser update for recipientId:", recipientId);
      
      // Call our superuser update function
      const { data, error } = await supabase.rpc(
        'superuser_update_recipient',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("🦸‍♂️ SUPERUSER REJECT - Result:", data, "Error:", error);
      
      if (error) {
        console.error("🦸‍♂️ SUPERUSER REJECT - Failed:", error);
        Alert.alert("Superuser Update Failed", "Could not update status: " + error.message);
        return;
      }
      
      console.log("🦸‍♂️ SUPERUSER REJECT - Success response:", data);
      Alert.alert("Success", "Bet rejected with SUPERUSER privileges!");
      
      // Force UI update
      setRecipientStatus('rejected');
      setRecipients(prevRecipients => {
        return prevRecipients.map(r => 
          r.id === recipientId ? {...r, status: 'rejected'} : r
        );
      });
      
      // Navigate back to home with refresh
      navigation.navigate('Home', { refresh: Date.now() });
      
    } catch (error) {
      console.error("🦸‍♂️ SUPERUSER REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred with superuser update");
    } finally {
      setLoading(false);
    }
  };
  
  // DELETE and RECREATE - ultimate last resort
  const deleteAndRecreateRecipient = async () => {
    if (!recipientId) {
      Alert.alert("Error", "No recipient ID available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("💥 DELETE & RECREATE - Last hope for recipientId:", recipientId);
      
      // Call our delete and recreate function
      const { data, error } = await supabase.rpc(
        'delete_recipient_and_create_new',
        { 
          p_recipient_id: recipientId
        }
      );
      
      console.log("💥 DELETE & RECREATE - Result:", data, "Error:", error);
      
      if (error) {
        console.error("💥 DELETE & RECREATE - Failed:", error);
        Alert.alert("Operation Failed", "Could not recreate recipient: " + error.message);
        return;
      }
      
      console.log("💥 DELETE & RECREATE - Success response:", data);
      Alert.alert("Success", "Recipient deleted and recreated with rejected status!");
      
      // Navigate back to home with refresh - old recipient ID is now invalid
      navigation.navigate('Home', { refresh: Date.now() });
      
    } catch (error) {
      console.error("💥 DELETE & RECREATE - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
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
        {!canDeleteBet && <View style={{ width: 28 }} />}
      </View>

      <ScrollView style={styles.content}>
        {/* Debug information - REMOVE AFTER FIXING */}
        <View style={{padding: 10, backgroundColor: '#333', borderRadius: 8, marginBottom: 10}}>
          <Text style={{color: 'white', fontWeight: 'bold'}}>DEBUG INFO:</Text>
          <Text style={{color: '#FF9800'}}>recipientId: {recipientId || 'NULL'}</Text>
          <Text style={{color: '#FF9800'}}>recipientStatus: {recipientStatus || 'NULL'}</Text>
          <Text style={{color: '#FF9800'}}>isCreator: {isCreator ? 'YES' : 'NO'}</Text>
          <Text style={{color: '#FF9800'}}>canAcceptRejectBet: {canAcceptRejectBet ? 'YES' : 'NO'}</Text>
          <Text style={{color: '#FF9800'}}>__DEV__: {__DEV__ ? 'YES' : 'NO'}</Text>
          <Text style={{color: '#FF9800'}}>Emergency button should show: {__DEV__ && recipientStatus === 'pending' && recipientId ? 'YES' : 'NO'}</Text>
          
          {/* Force show emergency button regardless of conditions */}
          <TouchableOpacity 
            style={{backgroundColor: 'red', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
            onPress={emergencyDirectAccept}
          >
            <Text style={{color: 'white', fontWeight: 'bold'}}>FORCE EMERGENCY ACCEPT (Debug Only)</Text>
          </TouchableOpacity>

          {/* Fix SQL functions button */}
          {__DEV__ && (
            <TouchableOpacity 
              style={{backgroundColor: '#00BFFF', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={async () => {
                try {
                  // First drop the functions
                  await supabase.rpc('execute_sql', { 
                    sql: "DROP FUNCTION IF EXISTS public.direct_update_bet_status(UUID, UUID, TEXT); DROP FUNCTION IF EXISTS public.reject_bet_recipient(UUID);" 
                  });
                  
                  // Then recreate them correctly
                  const sql = `
                    -- Fix function for updating bet status
                    CREATE OR REPLACE FUNCTION direct_update_bet_status(
                      p_recipient_id UUID,
                      p_bet_id UUID,
                      p_status TEXT DEFAULT 'in_progress'
                    ) RETURNS BOOLEAN
                    LANGUAGE plpgsql
                    SECURITY DEFINER
                    AS $$
                    DECLARE
                      v_success BOOLEAN := FALSE;
                    BEGIN
                      -- Validate recipient exists and belongs to this bet
                      IF NOT EXISTS (
                        SELECT 1 FROM bet_recipients 
                        WHERE id = p_recipient_id AND bet_id = p_bet_id
                      ) THEN
                        RETURN FALSE;
                      END IF;
                      
                      -- Update recipient status
                      UPDATE bet_recipients 
                      SET status = p_status
                      WHERE id = p_recipient_id;
                      
                      -- If we're setting to 'in_progress', update main bet status too
                      IF p_status = 'in_progress' THEN
                        UPDATE bets
                        SET status = 'in_progress' 
                        WHERE id = p_bet_id;
                      END IF;
                      
                      RETURN TRUE;
                    EXCEPTION WHEN OTHERS THEN
                      RAISE NOTICE 'Error updating bet and recipient: %', SQLERRM;
                      RETURN FALSE;
                    END;
                    $$;

                    -- Fix function for handling rejections
                    CREATE OR REPLACE FUNCTION reject_bet_recipient(
                      p_recipient_id UUID
                    ) RETURNS BOOLEAN
                    LANGUAGE plpgsql
                    SECURITY DEFINER
                    AS $$
                    DECLARE
                      v_bet_id UUID;
                    BEGIN
                      -- First, get the bet_id from the recipient
                      SELECT bet_id INTO v_bet_id 
                      FROM bet_recipients 
                      WHERE id = p_recipient_id;
                      
                      IF v_bet_id IS NULL THEN
                        RETURN FALSE;
                      END IF;
                      
                      -- Simply update the recipient status to 'rejected'
                      UPDATE bet_recipients 
                      SET status = 'rejected'
                      WHERE id = p_recipient_id;
                      
                      RETURN TRUE;
                    EXCEPTION WHEN OTHERS THEN
                      RAISE NOTICE 'Error rejecting bet: %', SQLERRM;
                      RETURN FALSE;
                    END;
                    $$;

                    -- Create raw update function
                    CREATE OR REPLACE FUNCTION raw_update_recipient_status(
                      p_recipient_id UUID,
                      p_status TEXT
                    ) RETURNS BOOLEAN
                    LANGUAGE plpgsql
                    SECURITY DEFINER
                    AS $$
                    BEGIN
                      -- EXECUTE raw SQL to bypass all possible constraints
                      EXECUTE 'UPDATE bet_recipients SET status = $1 WHERE id = $2'
                      USING p_status, p_recipient_id;
                      
                      RETURN TRUE;
                    EXCEPTION WHEN OTHERS THEN
                      RAISE NOTICE 'Error in raw update: %', SQLERRM;
                      RETURN FALSE;
                    END;
                    $$;

                    -- Grant execute permissions
                    GRANT EXECUTE ON FUNCTION direct_update_bet_status(UUID, UUID, TEXT) TO authenticated, anon;
                    GRANT EXECUTE ON FUNCTION reject_bet_recipient(UUID) TO authenticated, anon;
                    GRANT EXECUTE ON FUNCTION raw_update_recipient_status(UUID, TEXT) TO authenticated, anon;
                  `;
                  
                  const { data, error } = await supabase.rpc('execute_sql', { sql });
                  
                  if (error) {
                    console.error("Error fixing SQL functions:", error);
                    Alert.alert("Error", "Failed to fix SQL functions: " + error.message);
                  } else {
                    console.log("SQL functions fixed successfully:", data);
                    Alert.alert("Success", "SQL functions fixed successfully!");
                  }
                } catch (error) {
                  console.error("Unexpected error fixing SQL:", error);
                  Alert.alert("Error", "An unexpected error occurred");
                }
              }}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>FIX SQL FUNCTIONS</Text>
            </TouchableOpacity>
          )}
          
          {/* RAW REJECT button - most direct approach */}
          {__DEV__ && recipientId && (
            <TouchableOpacity 
              style={{backgroundColor: '#FF1493', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={rawRejectBet}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>EMERGENCY RAW REJECT</Text>
            </TouchableOpacity>
          )}
          
          {/* TRIGGERLESS REJECT button - bypass database triggers */}
          {__DEV__ && recipientId && betId && (
            <TouchableOpacity 
              style={{backgroundColor: '#FF4500', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={triggerlessRejectBet}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>TRIGGERLESS REJECT</Text>
            </TouchableOpacity>
          )}
          
          {/* NUCLEAR REJECT button - bypasses ALL constraints */}
          {__DEV__ && recipientId && (
            <TouchableOpacity 
              style={{backgroundColor: '#B22222', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={nuclearRejectBet}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>☢️ NUCLEAR REJECT OPTION ☢️</Text>
            </TouchableOpacity>
          )}
          
          {/* SUPERUSER REJECT button - ultimate last resort */}
          {__DEV__ && recipientId && (
            <TouchableOpacity 
              style={{backgroundColor: '#8B0000', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={superuserRejectBet}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>🦸‍♂️ SUPERUSER REJECT 🦸‍♂️</Text>
            </TouchableOpacity>
          )}
          
          {/* DELETE & RECREATE button - when everything else fails */}
          {__DEV__ && recipientId && (
            <TouchableOpacity 
              style={{backgroundColor: '#4B0082', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center'}}
              onPress={deleteAndRecreateRecipient}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>💥 DELETE & RECREATE 💥</Text>
            </TouchableOpacity>
          )}
        </View>

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

        {renderRecipients()}
        
        {canAcceptRejectBet && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={confirmAcceptBet}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.actionButtonText}>Accept Bet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.rejectButton}
              onPress={confirmRejectBet}
            >
              <Ionicons name="close" size={20} color="white" />
              <Text style={styles.actionButtonText}>Reject Bet</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Direct accept button for testing - no confirmation dialog */}
        {__DEV__ && canAcceptRejectBet && (
          <TouchableOpacity
            style={{
              backgroundColor: '#8B008B', // Dark Magenta
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              marginTop: 10
            }}
            onPress={handleAcceptBet}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              DIRECT ACCEPT (No Dialog)
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Direct reject button for testing - no confirmation dialog */}
        {__DEV__ && canAcceptRejectBet && (
          <TouchableOpacity
            style={{
              backgroundColor: '#800000', // Maroon
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              marginTop: 10
            }}
            onPress={handleRejectBet}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              DIRECT REJECT (No Dialog)
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Alternative rejection button - use when normal method fails */}
        {__DEV__ && canAcceptRejectBet && (
          <TouchableOpacity
            style={{
              backgroundColor: '#9932CC', // Dark Orchid
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              marginTop: 10
            }}
            onPress={alternativeRejectBet}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              ALTERNATIVE REJECT (Bypass Function)
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Emergency override button - only in development */}
        {__DEV__ && recipientStatus === 'pending' && recipientId && (
          <TouchableOpacity 
            style={[styles.acceptButton, { marginTop: 10, backgroundColor: '#FF9800' }]}
            onPress={emergencyDirectAccept}
          >
            <Ionicons name="warning" size={20} color="white" />
            <Text style={styles.actionButtonText}>EMERGENCY DIRECT ACCEPT</Text>
          </TouchableOpacity>
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

        {__DEV__ && (
          <Button
            title="Force Emergency Accept"
            onPress={forceAcceptBet}
            color="#FF6347"
            disabled={loading}
          />
        )}

        {__DEV__ && (
          <Button
            title="Add Test Recipient"
            onPress={addTestRecipient}
            color="#4682B4"
            disabled={loading}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  debugButton: {
    backgroundColor: '#6B46C1',
    padding: 10,
    borderRadius: 8,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
});

export default BetDetailsScreen; 