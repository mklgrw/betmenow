import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl, 
  SafeAreaView, 
  ActivityIndicator,
  TouchableOpacity, 
  StatusBar
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

// Types
type RootStackParamList = {
  BetDetails: { betId: string, notificationId?: string };
  IssueBet: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Notification {
  id: string;
  status: string;
  created_at: string;
  bet_id: string;
  recipient_id: string;
  pending_outcome?: string | null;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
  type: string;
  display_name: string;
  bet_description: string;
  bet_stake: number;
  bet_creator_id: string;
}

interface EmptyStateProps {
  onCreateBet: () => void;
  theme: any;
}

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  theme: any;
}

interface HeaderProps {
  hasNotifications: boolean;
  onCreateBet: () => void;
}

// Helper Components
const Header = ({ hasNotifications, onCreateBet }: HeaderProps) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Activity</Text>
    {hasNotifications && (
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={onCreateBet}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    )}
  </View>
);

const EmptyState = ({ onCreateBet, theme }: EmptyStateProps) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="notifications-off-outline" size={48} color={theme.colors.text} />
    <Text style={[styles.emptyText, { color: theme.colors.text }]}>No notifications yet</Text>
    <TouchableOpacity
      style={[styles.createBetButton, { backgroundColor: theme.colors.primary }]}
      onPress={onCreateBet}
      activeOpacity={0.8}
    >
      <Text style={styles.createBetButtonText}>Create a Bet</Text>
    </TouchableOpacity>
  </View>
);

const getStatusIndicatorColor = (status: string, isPendingOutcome: boolean): string => {
  if (isPendingOutcome) return '#FF9500'; // Action required orange
  
  switch(status) {
    case 'pending': return '#777777'; // Gray for pending
    case 'accepted': 
    case 'in_progress': return '#4CAF50'; // Green for accepted/in progress
    case 'rejected': return '#FF3B30'; // Red for rejected
    case 'won': return '#34C759'; // iOS green for won
    case 'lost': return '#FF2D55'; // iOS pink for lost
    default: return '#777777'; // Default gray
  }
};

const NotificationCard = ({ notification, onPress, theme }: NotificationCardProps) => {
  const isPendingOutcome = notification.pending_outcome !== null;
  const statusColor = getStatusIndicatorColor(notification.status, isPendingOutcome);

  return (
    <TouchableOpacity 
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
      style={styles.notificationWrapper}
    >
      <View style={styles.notificationItem}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText} numberOfLines={2}>
            {getNotificationText(notification)}
          </Text>
          <View style={styles.notificationFooter}>
            <Text style={styles.stakeText}>Stake: ${notification.bet_stake?.toFixed(2) || "0.00"}</Text>
            <Text style={styles.timeText}>
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>
        {isPendingOutcome && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>Action Required</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Main Component
const ActivityScreen = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const fetchNotifications = async () => {
    if (!user?.id) {
      console.log('No user ID available, cannot fetch notifications.');
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_notifications', {
        user_id: user.id
      });

      if (error) {
        console.error('Error fetching notifications via RPC:', error);
        setError('Failed to load notifications');
        setNotifications([]);
      } else {
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Unexpected error fetching notifications:', error);
      setError('Something went wrong');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications().finally(() => setRefreshing(false));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleNotificationPress = (notification: Notification) => {
    if (notification.bet_id) {
      navigation.navigate('BetDetails', { 
        betId: notification.bet_id,
        notificationId: notification.id
      });
    }
  };

  const navigateToCreateBet = () => {
    navigation.navigate('IssueBet');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />
      
      {/* Header */}
      <Header 
        hasNotifications={notifications.length > 0} 
        onCreateBet={navigateToCreateBet} 
      />
      
      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={({ item }) => (
            <NotificationCard 
              notification={item} 
              onPress={handleNotificationPress}
              theme={theme}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
          ListEmptyComponent={
            <EmptyState onCreateBet={navigateToCreateBet} theme={theme} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

// Helper function for notification text
const getNotificationText = (notification: Notification): string => {
  const isCreator = notification.type === 'creator';
  const description = notification.bet_description || '';
  const status = notification.status;
  const displayName = notification.display_name || 'Someone';

  if (notification.pending_outcome) {
    return `${displayName} has declared "${notification.pending_outcome}" for bet: ${description}. Tap to confirm ✅`;
  }

  if (isCreator) {
    if (status === 'pending') {
      return `Waiting for ${displayName} to respond to your bet: ${description}`;
    } else if (status === 'accepted' || status === 'in_progress') {
      return `${displayName} accepted your bet: ${description}`;
    } else if (status === 'rejected') {
      return `${displayName} rejected your bet: ${description}`;
    }
  } else {
    if (status === 'pending') {
      return `${displayName} sent you a bet: ${description}`;
    } else if (status === 'accepted' || status === 'in_progress') {
      return `You accepted ${displayName}'s bet: ${description}`;
    } else if (status === 'rejected') {
      return `You rejected ${displayName}'s bet: ${description}`;
    }
  }

  return `Notification: ${description}`;
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerButton: {
    padding: 4,
  },
  errorBanner: {
    padding: 10,
    margin: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 12,
    flexGrow: 1,
  },
  notificationWrapper: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  notificationItem: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 16,
    paddingLeft: 12,
    position: 'relative',
    flexDirection: 'row',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 8,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stakeText: {
    color: '#AAAAAA',
    fontSize: 13,
  },
  timeText: {
    color: '#777777',
    fontSize: 13,
  },
  actionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  createBetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  createBetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ActivityScreen; 