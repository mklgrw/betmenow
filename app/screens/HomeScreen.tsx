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
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBets, ProcessedBet } from '../context/BetContext';
import { supabase, createBetsTable, createBetRecipientsTable, createTableWithSQL, createBetStatusTrigger } from '../services/supabase';
import { StackNavigationProp } from '@react-navigation/stack';
import { NavigationProp } from '@react-navigation/native';

// Define route parameter types
type RouteParams = {
  refresh?: boolean;
  activeTab?: string;
  newBetCreated?: boolean;
  newBetId?: string;
};

// Define types for bet data
type BetDetails = {
  id: string;
  description: string;
  stake: number;
  status: string;
  created_at: string;
  creator_id: string;
};

type RecipientBet = {
  id: string;
  status: string;
  bet_id: string;
  pending_outcome?: string | null;
  recipient_id: string;
};

type TabType = 'in_progress' | 'pending' | 'lost' | 'won';

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const theme = useTheme();
  const { user } = useAuth();
  
  // Get the route to access parameters
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const refreshParam = route.params?.refresh;
  const activeTabParam = route.params?.activeTab;
  
  // Use the BetContext for state management
  const { 
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
    onRefresh 
  } = useBets();

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

  const renderBetCard = ({ item }: { item: ProcessedBet }) => {
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
                  if (item.recipientId) {
                    handleAcceptBet(item.recipientId);
                  }
                }}
              >
                <Ionicons name="checkmark" size={20} color="#4CAF50" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent navigating to bet details
                  if (item.recipientId) {
                    handleRejectBet(item.recipientId);
                  }
                }}
              >
                <Ionicons name="close" size={20} color="#FF6B6B" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
          
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
          pending_outcome TEXT DEFAULT NULL,
          outcome_claimed_by UUID DEFAULT NULL,
          outcome_claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    fontWeight: '500',
  },
  betTimestamp: {
    color: '#999',
    fontSize: 14,
  },
  betActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    backgroundColor: '#3D3D3D',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
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
});

export default HomeScreen;