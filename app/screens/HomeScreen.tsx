import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase, createBetsTable, createBetRecipientsTable, createTableWithSQL, createBetStatusTrigger } from '../services/supabase';

// Mock data for bets (will replace with actual data from Supabase)
const MOCK_BETS = [
  {
    id: '1',
    description: "Jake bet Rudy won't text 📱 his ex \"i miss u\"",
    stake: 2,
    timestamp: "Today at 9:45am",
    commentCount: 1,
    status: 'in_progress',
  },
  {
    id: '2',
    description: "Paul bet Earl he won't eat a slice of 🍕 with toothpaste as the sauce",
    stake: 15,
    timestamp: "Yesterday at 4:31pm",
    commentCount: 2,
    status: 'in_progress',
  },
  {
    id: '3',
    description: "James bet Sergey he can't burp the alphabet",
    stake: 10,
    timestamp: "Mar 29 at 9:35pm",
    commentCount: 3,
    status: 'in_progress',
  },
  {
    id: '4',
    description: "Axel bet Jake won't eat a spoonful of wasabi while maintaining 👁 contact",
    stake: 5,
    timestamp: "Mar 29 at 8:20pm",
    commentCount: 8,
    status: 'in_progress',
  },
  {
    id: '5',
    description: "Mark bet Sarah she can't go a week without social media",
    stake: 20,
    timestamp: "Mar 25 at 7:35pm",
    commentCount: 0,
    status: 'pending',
  },
  {
    id: '6',
    description: "You bet Lisa she won't run a 5K in under 30 minutes",
    stake: 25,
    timestamp: "Mar 22 at 5:10pm",
    commentCount: 5,
    status: 'won',
  },
  {
    id: '7',
    description: "You bet Michael he can't eat 5 hot wings in 2 minutes",
    stake: 50,
    timestamp: "Jan 12 at 6:45pm",
    commentCount: 12,
    status: 'lost',
  },
];

type TabType = 'in_progress' | 'pending' | 'lost' | 'won';

const HomeScreen = () => {
  const [activeTab, setActiveTab] = useState<TabType>('in_progress');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bets, setBets] = useState(MOCK_BETS);
  const [filteredBets, setFilteredBets] = useState(MOCK_BETS);
  
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();
  
  // Get the route to access parameters
  const route = useRoute();
  const refreshParam = route?.params?.refresh;
  const activeTabParam = route.params?.activeTab;
  
  // Check for activeTab parameter from IssueBetScreen
  useEffect(() => {
    if (activeTabParam && activeTabParam !== activeTab) {
      console.log("🔄 TAB CHANGE - Changing tab to:", activeTabParam);
      setActiveTab(activeTabParam as TabType);
      // Fetch fresh data
      onRefresh();
    }
  }, [activeTabParam]);

  // Add effect to trigger refresh when refresh param changes
  useEffect(() => {
    console.log("🔍 REFRESH EFFECT - Refresh parameter changed:", refreshParam);
    console.log("🔍 REFRESH EFFECT - Full route params:", route.params);
    
    // Check if we're returning after creating a new bet
    if (route.params?.newBetCreated) {
      console.log("🔄 NEW BET CREATED - Detected new bet creation with ID:", route.params.newBetId);
      // Set active tab to 'pending' to show newly created bet
      setActiveTab('pending');
      // Fetch bets to refresh the list
      fetchBets();
    } 
    // Otherwise just refresh if there's a refresh param
    else if (refreshParam) {
      fetchBets();
    }
  }, [refreshParam, route.params?.newBetCreated]);

  useEffect(() => {
    // Filter bets based on active tab and search query
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
      console.log("🔍 FETCH BETS - Starting to fetch bets, user ID:", user?.id);
      console.log("🔍 FETCH BETS - Active tab:", activeTab);
      console.log("🔍 FETCH BETS - Route params:", route.params);
      
      if (!user?.id) {
        console.log("🔍 FETCH BETS - No user ID available, using mock data");
        setBets(MOCK_BETS);
        setLoading(false);
        return;
      }
      
      // Debug: First try a simple query just to test connection
      console.log("🔍 FETCH BETS - Testing simple query...");
      const { data: testData, error: testError } = await supabase
        .from('bets')
        .select('id')
        .limit(1);
        
      if (testError) {
        console.error("❌ FETCH BETS - Basic query failed:", testError);
        setBets(MOCK_BETS);
        setLoading(false);
        return;
      }
      
      console.log("✅ FETCH BETS - Basic query succeeded, test data:", testData);
      
      // Try fetching bets where user is creator
      console.log("🔍 FETCH BETS - Fetching bets where user is creator...");
      const { data: myBets, error: myBetsError } = await supabase
        .from('bets')
        .select('id, description, stake, status, created_at')
        .eq('creator_id', user.id);
      
      if (myBetsError) {
        console.error("❌ FETCH BETS - Error fetching created bets:", myBetsError);
        setBets(MOCK_BETS);
        setLoading(false);
        return;
      }
      
      console.log("✅ FETCH BETS - Successfully fetched created bets:", myBets ? myBets.length : 0);
      if (myBets && myBets.length > 0) {
        console.log("📄 FETCH BETS - Created bets data:", JSON.stringify(myBets, null, 2));
      }
      
      // Fetch bets where user is a recipient
      console.log("🔍 FETCH BETS - Fetching bets where user is a recipient...");
      const { data: recipientBets, error: recipientBetsError } = await supabase
        .from('bet_recipients')
        .select('id, status, bet_id')
        .eq('recipient_id', user.id);
      
      if (recipientBetsError) {
        console.error("🔍 FETCH BETS - Error fetching recipient bets:", recipientBetsError);
      } else {
        console.log("🔍 FETCH BETS - Successfully fetched recipient bets:", recipientBets ? recipientBets.length : 0);
      }
      
      // Now fetch the actual bet details for those recipient bets
      let betDetails = [];
      if (recipientBets && recipientBets.length > 0) {
        // Extract bet IDs from recipient bets
        const betIds = recipientBets.map(rb => rb.bet_id);
        
        // Fetch the bet details
        const { data: betData, error: betDataError } = await supabase
          .from('bets')
          .select('id, description, stake, status, created_at, creator_id')
          .in('id', betIds);
          
        if (betDataError) {
          console.error("🔍 FETCH BETS - Error fetching bet details:", betDataError);
        } else {
          console.log("🔍 FETCH BETS - Successfully fetched bet details:", betData ? betData.length : 0);
          betDetails = betData || [];
        }
      }

      // Process the bets
      let allBets = [];
      
      // Process bets created by the user
      if (myBets && myBets.length > 0) {
        const processedCreatedBets = myBets.map(bet => {
          return {
            id: bet.id,
            description: bet.description || "No description",
            stake: bet.stake || 0,
            timestamp: formatTimestamp(bet.created_at),
            commentCount: 0,
            status: (bet.status as TabType) || 'pending',
            isCreator: true
          };
        });
        
        allBets = [...processedCreatedBets];
      }
      
      // Process bets where user is a recipient
      if (recipientBets && recipientBets.length > 0 && betDetails.length > 0) {
        const processedRecipientBets = recipientBets.map(recipientBet => {
          // Find the corresponding bet details
          const bet = betDetails.find(b => b.id === recipientBet.bet_id);
          if (!bet) return null;
          
          return {
            id: bet.id,
            description: bet.description || "No description",
            stake: bet.stake || 0,
            timestamp: formatTimestamp(bet.created_at),
            commentCount: 0,
            status: (recipientBet.status as TabType) || 'pending',
            isCreator: false,
            recipientId: recipientBet.id,
            creatorId: bet.creator_id
          };
        }).filter(Boolean); // Remove any null values
        
        allBets = [...allBets, ...processedRecipientBets];
      }
      
      if (allBets.length === 0) {
        console.log("🔍 FETCH BETS - No bets found, using mock data");
        setBets(MOCK_BETS);
      } else {
        console.log("🔍 FETCH BETS - Total processed bets:", allBets.length);
        setBets(allBets);
      }
    } catch (error) {
      console.error("🔍 FETCH BETS - Unexpected error in fetchBets:", error);
      setBets(MOCK_BETS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  // Call fetchBets when component loads
  useEffect(() => {
    if (user) {
      console.log("🔍 FETCH BETS - HomeScreen mounted with user, fetching bets...");
      fetchBets();
      
      // Add a focus listener to refresh data when the screen is focused
      const unsubscribe = navigation.addListener('focus', () => {
        console.log('🔍 FETCH BETS - HomeScreen focused - refreshing bets data');
        fetchBets();
      });
      
      // Clean up the listener when the component is unmounted
      return unsubscribe;
    }
  }, [navigation, user]);

  const deleteBet = async (betId: string) => {
    try {
      setLoading(true);
      console.log(`🔍 DELETE BET - Attempting to delete bet with ID: ${betId}`);
      
      // Direct delete operation with minimal filters
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);
      
      if (error) {
        console.error("🔍 DELETE BET - Error deleting bet:", error);
        Alert.alert("Error", "Failed to delete bet");
      } else {
        console.log("🔍 DELETE BET - Delete operation completed successfully");
        // Update the UI immediately
        setBets(prevBets => prevBets.filter(bet => bet.id !== betId));
        Alert.alert("Success", "Bet deleted successfully");
        
        // Refresh bets to ensure UI is in sync with server
        fetchBets();
      }
    } catch (e) {
      console.error("🔍 DELETE BET - Exception in deleteBet:", e);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteBet = (betId: string) => {
    Alert.alert(
      "Delete Bet",
      "Are you sure you want to delete this bet?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => deleteBet(betId),
          style: "destructive"
        }
      ]
    );
  };

  // Handle accepting a bet
  const handleAcceptBet = async (recipientId: string, betId: string) => {
    try {
      setLoading(true);
      
      // Update the bet_recipients record to 'accepted'
      const { error: recipientError } = await supabase
        .from('bet_recipients')
        .update({ status: 'in_progress' })
        .eq('id', recipientId);
        
      if (recipientError) {
        console.error("🔍 ACCEPT BET - Error updating bet recipient status:", recipientError);
        Alert.alert("Error", "Failed to accept bet. Please try again.");
        return;
      }
      
      // Update the main bet record to 'in_progress'
      const { error: betError } = await supabase
        .from('bets')
        .update({ status: 'in_progress' })
        .eq('id', betId);
        
      if (betError) {
        console.error("🔍 ACCEPT BET - Error updating bet status:", betError);
        Alert.alert("Error", "Failed to update bet. Please try again.");
        return;
      }
      
      Alert.alert("Success", "Bet accepted successfully!");
      
      // Refresh the bets list
      fetchBets();
    } catch (error) {
      console.error("🔍 ACCEPT BET - Unexpected error in handleAcceptBet:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle rejecting a bet
  const handleRejectBet = async (recipientId: string, betId: string) => {
    try {
      setLoading(true);
      console.log("🔍 REJECT BET - Attempting to reject bet with recipientId:", recipientId);
      
      // Use our specialized rejection function instead of direct update
      const { data, error } = await supabase.rpc(
        'reject_bet_recipient',
        { 
          p_recipient_id: recipientId
        }
      );
      
      if (error) {
        console.error("🔍 REJECT BET - Error updating bet recipient status:", error);
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      if (data === false) {
        console.error("🔍 REJECT BET - Function returned false");
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      console.log("🔍 REJECT BET - Successfully rejected");
      Alert.alert("Success", "Bet rejected successfully!");
      
      // Refresh the bets list
      fetchBets();
    } catch (error) {
      console.error("🔍 REJECT BET - Unexpected error in handleRejectBet:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Alternative handler for rejecting a bet that doesn't rely on SQL functions
  const alternativeRejectBet = async (recipientId: string) => {
    try {
      setLoading(true);
      console.log("🔍 ALTERNATIVE REJECT - Attempting direct table update for recipientId:", recipientId);
      
      // Try direct update to the table without using the function
      const { data, error } = await supabase
        .from('bet_recipients')
        .update({ status: 'rejected' })
        .eq('id', recipientId);
      
      if (error) {
        console.error("🔍 ALTERNATIVE REJECT - Error updating bet recipient status:", error);
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      Alert.alert("Success", "Bet rejected successfully!");
      
      // Refresh the bets list
      fetchBets();
    } catch (error) {
      console.error("🔍 ALTERNATIVE REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Updated confirm rejecting a bet to use alternative method
  const confirmRejectBet = (recipientId: string, betId: string) => {
    Alert.alert(
      "Reject Bet",
      "Are you sure you want to reject this bet?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Try Direct Reject", 
          onPress: () => alternativeRejectBet(recipientId),
          style: "destructive"
        },
        { 
          text: "Try Function Reject", 
          onPress: () => handleRejectBet(recipientId, betId)
        },
        { 
          text: "EMERGENCY RAW REJECT", 
          onPress: () => rawRejectBet(recipientId)
        },
        { 
          text: "☢️ NUCLEAR OPTION ☢️", 
          onPress: () => nuclearRejectBet(recipientId)
        }
      ]
    );
  };

  // Add back the confirmAcceptBet function
  const confirmAcceptBet = (recipientId: string, betId: string) => {
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
          onPress: () => handleAcceptBet(recipientId, betId)
        }
      ]
    );
  };

  // Raw direct update for rejecting a bet - last resort
  const rawRejectBet = async (recipientId: string) => {
    try {
      setLoading(true);
      console.log("🔥 RAW REJECT - Attempting raw SQL update for recipientId:", recipientId);
      
      // Call raw update function
      const { data, error } = await supabase.rpc(
        'raw_update_recipient_status',
        { 
          p_recipient_id: recipientId,
          p_status: 'rejected'
        }
      );
      
      if (error) {
        console.error("🔥 RAW REJECT - Error updating recipient status:", error);
        Alert.alert("Error", "Failed to reject bet. Please try again.");
        return;
      }
      
      if (data === true) {
        console.log("🔥 RAW REJECT - Successfully rejected!");
        Alert.alert("Success", "Bet rejected successfully!");
        // Refresh the bets list
        fetchBets();
      } else {
        console.error("🔥 RAW REJECT - Function returned false");
        Alert.alert("Error", "Raw rejection failed. Please try again.");
      }
    } catch (error) {
      console.error("🔥 RAW REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Nuclear option for rejecting a bet - absolute last resort
  const nuclearRejectBet = async (recipientId: string) => {
    try {
      setLoading(true);
      console.log("☢️ NUCLEAR REJECT - Last resort for recipientId:", recipientId);
      
      // Call our nuclear option
      const { data, error } = await supabase.rpc(
        'nuclear_reject_recipient',
        { 
          p_recipient_id: recipientId
        }
      );
      
      if (error) {
        console.error("☢️ NUCLEAR REJECT - Failed:", error);
        Alert.alert("Error", "Nuclear rejection failed: " + error.message);
        return;
      }
      
      console.log("☢️ NUCLEAR REJECT - Success response:", data);
      Alert.alert("Success", "Bet rejected with NUCLEAR option!");
      
      // Refresh the bets list
      fetchBets();
    } catch (error) {
      console.error("☢️ NUCLEAR REJECT - Unexpected error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderBetCard = ({ item }: { item: any }) => {
    // Determine if this bet can be deleted (creator can delete pending bets)
    const canDelete = item.status === 'pending' && item.isCreator === true;
    
    // Determine if this bet can be accepted/rejected (recipient can accept/reject pending bets)
    const canAcceptReject = item.status === 'pending' && item.isCreator === false;
    
    return (
      <TouchableOpacity
        style={styles.betCard}
        onPress={() => navigation.navigate('BetDetails', { betId: item.id })}
      >
        <View style={styles.betContent}>
          <Text style={styles.betDescription}>{item.description}</Text>
          <Text style={styles.betTimestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.betActions}>
          {canDelete && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent navigating to bet details
                confirmDeleteBet(item.id);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
          
          {canAcceptReject && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent navigating to bet details
                  confirmAcceptBet(item.recipientId, item.id);
                }}
              >
                <Ionicons name="checkmark" size={20} color="#4CAF50" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent navigating to bet details
                  confirmRejectBet(item.recipientId, item.id);
                }}
              >
                <Ionicons name="close" size={20} color="#FF6B6B" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.commentBubble}>
            <Text style={styles.commentCount}>{item.commentCount}</Text>
            <Ionicons name="chatbubble-outline" size={20} color="white" />
          </View>
          <View style={styles.stakeContainer}>
            <Text style={styles.stakeAmount}>${item.stake}</Text>
            <Text style={styles.stakeEmoji}>💰</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabButton = (tabName: string, tabValue: TabType, iconName: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tabValue && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tabValue)}
    >
      <Ionicons 
        name={iconName as any}
        size={20} 
        color={activeTab === tabValue ? "white" : "#666"} 
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tabValue && styles.activeTabText
      ]}>
        {tabName}
      </Text>
    </TouchableOpacity>
  );

  // Initialize required tables when component loads
  useEffect(() => {
    const initializeTables = async () => {
      // Initialize tables needed for bets to work by directly creating them
      console.log('🔍 CREATE TABLES - Creating tables directly if they don\'t exist...');
      
      // Create bets table
      const betsTableSQL = `
        CREATE TABLE IF NOT EXISTS public.bets (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          description TEXT NOT NULL,
          stake NUMERIC NOT NULL,
          due_date TIMESTAMP WITH TIME ZONE,
          visibility TEXT DEFAULT 'public',
          status TEXT DEFAULT 'pending',
          creator_id UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
      
      const { data: betsResult, error: betsError } = await createTableWithSQL(betsTableSQL);
      console.log('🔍 CREATE TABLES - Bets table creation result:', betsResult, betsError);
      
      // Create bet_recipients table
      const recipientsTableSQL = `
        CREATE TABLE IF NOT EXISTS public.bet_recipients (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          bet_id UUID NOT NULL,
          recipient_id UUID NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT fk_bet FOREIGN KEY(bet_id) REFERENCES public.bets(id) ON DELETE CASCADE
        );
      `;
      
      const { data: recipientsResult, error: recipientsError } = await createTableWithSQL(recipientsTableSQL);
      console.log('🔍 CREATE TABLES - Bet recipients table creation result:', recipientsResult, recipientsError);
      
      // Create status update trigger
      try {
        const { data: triggerResult, error: triggerError } = await createBetStatusTrigger();
        console.log('🔍 CREATE TABLES - Bet status trigger creation result:', triggerResult, triggerError);
      } catch (e) {
        console.error('🔍 CREATE TABLES - Error creating bet status trigger:', e);
      }
    };
    
    initializeTables();
  }, []);

  // Handle pull-to-refresh
  const onRefresh = () => {
    console.log("🔄 PULL TO REFRESH - User manually refreshed");
    setRefreshing(true);
    fetchBets();
  };
  
  // Update to trigger refresh when tabs change
  useEffect(() => {
    console.log("🔄 TAB CHANGE - Tab changed to:", activeTab);
    fetchBets();
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Bets</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Image 
            source={{ uri: 'https://via.placeholder.com/50' }} 
            style={styles.profileImage} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={24} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for your bets..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <View style={styles.tabsContainer}>
        {renderTabButton("In Progress", "in_progress", "hourglass-outline")}
        {renderTabButton("Pending", "pending", "time-outline")}
        {renderTabButton("Lost", "lost", "close-circle-outline")}
        {renderTabButton("Won", "won", "checkmark-circle-outline")}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredBets}
          renderItem={renderBetCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No bets found</Text>
              <TouchableOpacity
                style={styles.createBetButton}
                onPress={() => navigation.navigate('IssueBet')}
              >
                <Text style={styles.createBetText}>Create a Bet</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        />
      )}

      {/* Add Bet Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => navigation.navigate('IssueBet')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  menuButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginBottom: 15,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  activeTabButton: {
    backgroundColor: '#6B46C1',
  },
  tabButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 10,
  },
  betCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  betContent: {
    flex: 1,
    marginRight: 10,
  },
  betDescription: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  betTimestamp: {
    color: '#999',
    fontSize: 14,
  },
  betActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  commentBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentCount: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 5,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stakeAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 5,
  },
  stakeEmoji: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 15,
  },
  createBetText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createBetButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deleteButton: {
    padding: 5,
    marginBottom: 5,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  acceptButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  rejectButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;