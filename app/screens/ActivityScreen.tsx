import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// Mock data for activity feed
const MOCK_ACTIVITIES = [
  {
    id: '1',
    description: "You paid James $30 because you didn't go to the gym 3x last week 🏋️",
    timestamp: "Jan 15 at 11:30pm",
    likes: 7,
    comments: 3,
  },
  {
    id: '2',
    description: "You won $50 from Mark in the basketball game 🏀",
    timestamp: "Jan 12 at 6:45pm",
    likes: 12,
    comments: 5,
  },
  {
    id: '3',
    description: "Jake lost to Axel at 1v1 basketball 🏀",
    timestamp: "Mar 25 at 7:35pm",
    likes: 1,
    comments: 3,
  },
  {
    id: '4',
    description: "Elliot paid you $5 because he couldn't bench 135 😅",
    timestamp: "Mar 22 at 5:10pm",
    likes: 10,
    comments: 8,
  },
];

type Activity = {
  id: string;
  description: string;
  timestamp: string;
  likes: number;
  comments: number;
  betId?: string;
};

const ActivityScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);

  useEffect(() => {
    if (user) {
      fetchActivities();
      
      // Add a focus listener to refresh data when the screen is focused
      const unsubscribe = navigation.addListener('focus', () => {
        console.log('ActivityScreen focused - refreshing activities data');
        fetchActivities();
      });
      
      // Clean up the listener when the component is unmounted
      return unsubscribe;
    }
  }, [navigation, user]);

  // Format timestamp for display
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

  const fetchActivities = async () => {
    try {
      setLoading(true);
      console.log("Starting to fetch activities, user ID:", user?.id);
      
      if (!user?.id) {
        console.log("No user ID available, using mock data");
        setActivities(MOCK_ACTIVITIES);
        setLoading(false);
        return;
      }
      
      // Fetch bet notifications where user is creator (to see acceptance/rejection)
      const { data: createdBetNotifications, error: createdBetError } = await supabase
        .from('bet_recipients')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          bet_id,
          recipient_id,
          bets (
            id,
            description,
            stake,
            creator_id
          ),
          users: recipient_id (
            id,
            username,
            display_name
          )
        `)
        .eq('bets.creator_id', user.id)
        .in('status', ['in_progress', 'rejected'])
        .order('updated_at', { ascending: false });
        
      if (createdBetError) {
        console.error("Error fetching creator bet notifications:", createdBetError);
      }
      
      console.log("Fetched creator bet notifications:", createdBetNotifications?.length || 0);
      
      // Fetch bet notifications where user is recipient (invitations & outcomes)
      const { data: receivedBetNotifications, error: receivedBetError } = await supabase
        .from('bet_recipients')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          bet_id,
          recipient_id,
          bets (
            id,
            description,
            stake,
            creator_id
          ),
          users: bets.creator_id (
            id,
            username,
            display_name
          )
        `)
        .eq('recipient_id', user.id)
        .order('updated_at', { ascending: false });
        
      if (receivedBetError) {
        console.error("Error fetching recipient bet notifications:", receivedBetError);
      }
      
      console.log("Fetched recipient bet notifications:", receivedBetNotifications?.length || 0);
      
      // Process notifications into activity items
      const activityItems: Activity[] = [];
      
      // Process notifications for bets user created
      if (createdBetNotifications && createdBetNotifications.length > 0) {
        createdBetNotifications.forEach(notification => {
          const bet = notification.bets;
          const recipient = notification.users;
          
          const displayName = recipient.display_name || recipient.username || 'User';
          let description = '';
          
          if (notification.status === 'in_progress') {
            description = `${displayName} accepted your bet: "${bet.description}" for $${bet.stake} 🎉`;
          } else if (notification.status === 'rejected') {
            description = `${displayName} rejected your bet: "${bet.description}" for $${bet.stake} 😔`;
          }
          
          if (description) {
            activityItems.push({
              id: notification.id,
              description,
              timestamp: formatTimestamp(notification.updated_at || notification.created_at),
              likes: 0,
              comments: 0,
              betId: bet.id
            });
          }
        });
      }
      
      // Process notifications for bets user received
      if (receivedBetNotifications && receivedBetNotifications.length > 0) {
        receivedBetNotifications.forEach(notification => {
          const bet = notification.bets;
          const creator = notification.users;
          
          const displayName = creator.display_name || creator.username || 'User';
          let description = '';
          
          if (notification.status === 'pending') {
            description = `${displayName} invited you to a bet: "${bet.description}" for $${bet.stake} 📨`;
          } else if (notification.status === 'in_progress') {
            description = `You accepted ${displayName}'s bet: "${bet.description}" for $${bet.stake} 🎯`;
          } else if (notification.status === 'rejected') {
            description = `You rejected ${displayName}'s bet: "${bet.description}" for $${bet.stake} 👎`;
          }
          
          if (description) {
            activityItems.push({
              id: notification.id,
              description,
              timestamp: formatTimestamp(notification.updated_at || notification.created_at),
              likes: 0,
              comments: 0,
              betId: bet.id
            });
          }
        });
      }
      
      if (activityItems.length > 0) {
        console.log(`Setting ${activityItems.length} activity items`);
        setActivities(activityItems);
      } else {
        console.log("No activities found, using mock data");
        setActivities(MOCK_ACTIVITIES);
      }
    } catch (error) {
      console.error("Unexpected error in fetchActivities:", error);
      Alert.alert("Error", "Failed to load activity feed");
      setActivities(MOCK_ACTIVITIES);
    } finally {
      setLoading(false);
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => item.betId 
        ? navigation.navigate('BetDetails', { betId: item.betId })
        : navigation.navigate('ActivityDetails', { activityId: item.id })
      }
    >
      <Text style={styles.activityDescription}>{item.description}</Text>
      <Text style={styles.activityTimestamp}>{item.timestamp}</Text>
      <View style={styles.activityStats}>
        <View style={styles.statItem}>
          <Text style={styles.statText}>{item.likes} ❤️</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statText}>{item.comments} 💬</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No activity yet</Text>
              <TouchableOpacity
                style={styles.createBetButton}
                onPress={() => navigation.navigate('IssueBet')}
              >
                <Text style={styles.createBetText}>Create a Bet</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => navigation.navigate('IssueBet')}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
  },
  activityCard: {
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  activityDescription: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  activityTimestamp: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 10,
  },
  activityStats: {
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  createBetButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  createBetText: {
    color: '#FFFFFF',
    fontWeight: '500',
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
    elevation: 5,
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ActivityScreen; 