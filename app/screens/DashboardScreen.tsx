import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBets, ProcessedBet } from '../context/BetContext';
import { useFriends } from '../context/FriendsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow } from 'date-fns';
import ProfileAvatar from '../components/ProfileAvatar';

type StatisticSummary = {
  totalWon: number;
  totalLost: number;
  totalInProgress: number;
  totalPending: number;
  stakeWon: number;
  stakeLost: number;
};

type UserProfile = {
  id: string;
  username: string;
  display_name?: string;
  avatarUrl?: string;
};

type BetActivity = {
  id: string;
  description: string;
  timestamp: string;
  type: 'bet' | 'recipient' | 'won' | 'lost' | 'completed' | 'created';
  amount: number;
  creator: DatabaseUser;
  status: string;
  participants?: DatabaseUser[];
  betId?: string; // Optional field for navigation
};

type DatabaseUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

interface DatabaseResponse<T> {
  data: T[] | null;
  error: Error | null;
}

interface DatabaseBet {
  id: string;
  description: string;
  stake: number;
  created_at: string;
  status: string;
  creator: DatabaseUser;
}

interface DatabaseBetRecipient {
  bet: DatabaseBet;
}

interface DatabaseBetBetween extends DatabaseBet {
  bet_recipients: Array<{ recipient_id: string }>;
}

const DashboardScreen = () => {
  const [statistics, setStatistics] = useState<StatisticSummary>({
    totalWon: 0,
    totalLost: 0,
    totalInProgress: 0,
    totalPending: 0,
    stakeWon: 0,
    stakeLost: 0,
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [betActivities, setBetActivities] = useState<BetActivity[]>([]);
  const [betweenActivities, setBetweenActivities] = useState<BetActivity[]>([]);
  const [selectedTab, setSelectedTab] = useState<'feed' | 'between'>('feed');
  
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const { user } = useAuth();
  const { bets, fetchBets, loading } = useBets();
  const { friends, isFriend, addFriend, removeFriend } = useFriends();
  
  // Get userId from route params if available, otherwise use current user
  const userId = route.params?.userId || user?.id;
  // Determine if this is the current user's profile
  const isCurrentUser = userId === user?.id;

  useEffect(() => {
    if (userId) {
      fetchUserProfile(userId);
      fetchUserBets(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!loading && bets.length > 0) {
      calculateStatistics();
    } else if (!loading) {
      setIsLoading(false);
    }
  }, [loading, bets]);
  
  const fetchUserProfile = async (id: string) => {
    setIsProfileLoading(true);
    try {
      // Fetch user data from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        setIsProfileLoading(false);
        return;
      }
      
      if (data) {
        // Try to get avatar URL from AsyncStorage
        let avatarUrl = null;
        try {
          avatarUrl = await AsyncStorage.getItem(`user_avatar_${id}`);
        } catch (storageError) {
          console.error('Error fetching avatar from storage:', storageError);
        }
        
        setUserProfile({
          ...data,
          avatarUrl: avatarUrl || undefined
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching user profile:', error);
    } finally {
      setIsProfileLoading(false);
    }
  };
  
  const fetchUserBets = async (id: string) => {
    // If viewing current user, use the context
    if (id === user?.id) {
      fetchBets();
      return;
    }
    
    setIsLoading(true);
    try {
      // Get all bets created by the viewed user
      const { data: userBets, error: userBetsError } = await supabase
        .from('bets')
        .select('*')
        .eq('creator_id', id);
        
      if (userBetsError) {
        console.error("Error fetching user bets:", userBetsError);
        return;
      }
      
      // Get all bet recipients where the viewed user is a recipient
      const { data: recipientBets, error: recipientBetsError } = await supabase
        .from('bet_recipients')
        .select('*, bets(id, description, stake, creator_id, status, created_at)')
        .eq('recipient_id', id);
        
      if (recipientBetsError) {
        console.error("Error fetching recipient bets:", recipientBetsError);
        return;
      }
      
      // Process bets similar to BetContext
      let allBets: ProcessedBet[] = [];
      
      // Process bets created by the user
      if (userBets && userBets.length > 0) {
        const processedCreatedBets = await Promise.all(userBets.map(async bet => {
          // Check if there are any recipients with 'lost' status (meaning creator won)
          let myOutcome: 'won' | 'lost' | null = null;
          
          const { data: recipients, error } = await supabase
            .from('bet_recipients')
            .select('id, status')
            .eq('bet_id', bet.id);
            
          if (!error && recipients) {
            // If any recipient lost, the creator won
            if (recipients.some(r => r.status === 'lost')) {
              myOutcome = 'won';
            }
            // If any recipient won, the creator lost
            else if (recipients.some(r => r.status === 'won')) {
              myOutcome = 'lost';
            }
          }
          
          return {
            id: bet.id,
            description: bet.description || "No description",
            stake: bet.stake || 0,
            timestamp: bet.created_at,
            commentCount: 0,
            status: bet.status || 'pending',
            isCreator: true,
            hasWonOrLostRecipient: recipients?.some(r => r.status === 'won' || r.status === 'lost') || false,
            isMyOutcome: myOutcome
          } as ProcessedBet;
        }));
        
        allBets = [...processedCreatedBets];
      }
      
      // Process bets where user is a recipient
      if (recipientBets && recipientBets.length > 0) {
        const processedRecipientBets = recipientBets
          .map(recipientBet => {
            const bet = recipientBet.bets;
            if (!bet) return null;
            
            // For bets they're a recipient of, check if their status is won/lost
            const hasWonLost = recipientBet.status === 'won' || recipientBet.status === 'lost';
            
            // Set their outcome based on recipient status
            let myOutcome: 'won' | 'lost' | null = null;
            if (recipientBet.status === 'won') myOutcome = 'won';
            else if (recipientBet.status === 'lost') myOutcome = 'lost';
            
            return {
              id: bet.id,
              description: bet.description || "No description",
              stake: bet.stake || 0,
              timestamp: bet.created_at,
              commentCount: 0,
              status: recipientBet.status || 'pending',
              pendingOutcome: recipientBet.pending_outcome,
              isCreator: false,
              recipientId: recipientBet.id,
              creatorId: bet.creator_id,
              hasWonOrLostRecipient: hasWonLost,
              isMyOutcome: myOutcome
            } as ProcessedBet;
          })
          .filter((bet): bet is ProcessedBet => bet !== null);
        
        allBets = [...allBets, ...processedRecipientBets];
      }
      
      // Calculate statistics from the fetched bets
      const stats = {
        totalWon: 0,
        totalLost: 0,
        totalInProgress: 0,
        totalPending: 0,
        stakeWon: 0,
        stakeLost: 0,
      };

      allBets.forEach(bet => {
        // Count bets by status
        if (bet.status === 'won' || bet.isMyOutcome === 'won') {
          stats.totalWon++;
          stats.stakeWon += Number(bet.stake);
        } else if (bet.status === 'lost' || bet.isMyOutcome === 'lost') {
          stats.totalLost++;
          stats.stakeLost += Number(bet.stake);
        } else if (bet.status === 'in_progress') {
          stats.totalInProgress++;
        } else if (bet.status === 'pending') {
          stats.totalPending++;
        }
      });

      setStatistics(stats);
    } catch (error) {
      console.error("Error in fetchUserBets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStatistics = () => {
    const stats = {
      totalWon: 0,
      totalLost: 0,
      totalInProgress: 0,
      totalPending: 0,
      stakeWon: 0,
      stakeLost: 0,
    };

    console.log('Calculating statistics for current user', bets.length);
    
    // Process bets to find completed ones
    bets.forEach(bet => {
      console.log('Processing bet:', bet.id, 'status:', bet.status);
      
      // Check for won/lost bets based on recipients
      const isWon = bet.recipients?.some(r => {
        // Creator wins if a recipient lost
        if (bet.creator_id === user?.id && r.status === 'lost') return true;
        // Recipient wins if they won
        if (r.recipient_id === user?.id && r.status === 'won') return true;
        return false;
      });
      
      const isLost = bet.recipients?.some(r => {
        // Creator loses if a recipient won
        if (bet.creator_id === user?.id && r.status === 'won') return true;
        // Recipient loses if they lost
        if (r.recipient_id === user?.id && r.status === 'lost') return true;
        return false;
      });
      
      // Update stats accordingly
      if (isWon) {
        stats.totalWon++;
        stats.stakeWon += Number(bet.stake);
      } else if (isLost) {
        stats.totalLost++;
        stats.stakeLost += Number(bet.stake);
      } else if (bet.status === 'in_progress') {
        stats.totalInProgress++;
      } else if (bet.status === 'pending') {
        stats.totalPending++;
      }
    });

    console.log('Final stats:', stats);
    setStatistics(stats);
    setIsLoading(false);
  };

  const fetchBetActivities = async () => {
    try {
      setIsLoading(true);

      // Fetch bets created by the user
      const { data: createdBets, error: createdError } = await supabase
        .from('bets_with_details')
        .select('*')
        .eq('creator_id', userId)
        .returns<DatabaseBet[]>();

      // Fetch bets where user is a recipient
      const { data: participatedBets, error: participatedError } = await supabase
        .from('bet_recipients_with_details')
        .select('*')
        .eq('user_id', userId)
        .returns<DatabaseBetRecipient[]>();

      if (createdError || participatedError) {
        console.error('Error fetching bets:', createdError || participatedError);
        return;
      }

      // Transform created bets into activities
      const createdActivities: BetActivity[] = (createdBets || []).map((bet) => ({
        id: bet.id,
        description: bet.description,
        timestamp: bet.created_at,
        type: 'bet',
        amount: bet.stake,
        creator: {
          id: bet.creator_user_id,
          username: bet.creator_username,
          display_name: bet.creator_display_name,
          avatar_url: bet.creator_avatar_url
        },
        status: bet.status,
        betId: bet.id
      }));

      // Transform participated bets into activities
      const participatedActivities: BetActivity[] = (participatedBets || []).map((bet) => ({
        id: bet.id,
        description: bet.description,
        timestamp: bet.created_at,
        type: 'recipient',
        amount: bet.stake,
        creator: {
          id: bet.creator_user_id,
          username: bet.creator_username,
          display_name: bet.creator_display_name,
          avatar_url: bet.creator_avatar_url
        },
        status: bet.status,
        betId: bet.id
      }));

      // Combine and sort all activities by timestamp
      const allActivities = [...createdActivities, ...participatedActivities].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setBetActivities(allActivities);

      // If viewing another user's profile, fetch bets between the current user and that user
      if (user?.id !== userId) {
        const otherUserId = user?.id;
        if (!otherUserId) return;

        const { data: betweenUsers, error: betweenError } = await supabase
          .from('bet_recipients_with_details')
          .select('*')
          .or(`and(creator_id.eq.${userId},user_id.eq.${otherUserId}),and(creator_id.eq.${otherUserId},user_id.eq.${userId})`)
          .returns<DatabaseBetBetween[]>();

        if (betweenError) {
          console.error('Error fetching bets between users:', betweenError);
          return;
        }

        const betweenActivities: BetActivity[] = (betweenUsers || []).map((bet) => ({
          id: bet.id,
          description: bet.description,
          timestamp: bet.created_at,
          type: bet.creator_id === userId ? 'bet' : 'recipient',
          amount: bet.stake,
          creator: {
            id: bet.creator_user_id,
            username: bet.creator_username,
            display_name: bet.creator_display_name,
            avatar_url: bet.creator_avatar_url
          },
          status: bet.status,
          betId: bet.id
        }));

        setBetweenActivities(betweenActivities);
      }
    } catch (error) {
      console.error('Error in fetchBetActivities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBetActivityType = (status: string): BetActivity['type'] => {
    switch (status) {
      case 'won':
        return 'won';
      case 'lost':
        return 'lost';
      case 'completed':
        return 'completed';
      default:
        return 'created';
    }
  };

  useEffect(() => {
    if (userId && !isCurrentUser) {
      fetchBetActivities();
    }
  }, [userId, isCurrentUser]);

  const renderStatCard = (title: string, value: number | string, icon: string, bgColor: string, textColor: string = '#FFFFFF') => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={24} color={textColor} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: textColor }]}>{title}</Text>
      </View>
    </View>
  );

  const renderProfileSection = () => {
    if (isProfileLoading) {
      return (
        <View style={styles.profileLoadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
        </View>
      );
    }

    if (!userProfile) {
      return (
        <View style={styles.profileErrorContainer}>
          <Ionicons name="alert-circle" size={48} color="#666" />
          <Text style={styles.profileErrorText}>Profile not found</Text>
        </View>
      );
    }

    return (
      <View style={styles.profileContainer}>
        <View style={styles.profileHeader}>
          <ProfileAvatar
            size={80}
            avatarUrl={userProfile.avatarUrl}
            displayName={userProfile.display_name}
            username={userProfile.username}
            userId={userProfile.id}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {userProfile.display_name || userProfile.username}
              {isCurrentUser && <Text style={styles.profileYouText}> (You)</Text>}
            </Text>
            <Text style={styles.username}>@{userProfile.username}</Text>
          </View>
          {isCurrentUser ? (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={18} color="#FFF" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.friendButton,
                isFriend(userId) && styles.friendButtonActive
              ]}
              onPress={() => isFriend(userId) ? removeFriend(userId) : addFriend(userId)}
            >
              <Ionicons 
                name={isFriend(userId) ? "checkmark-circle" : "person-add"} 
                size={18} 
                color="#FFF" 
              />
              <Text style={styles.friendButtonText}>
                {isFriend(userId) ? "Friends" : "Add Friend"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: BetActivity }) => {
    // Use empty array as default value for optional participants
    const participantsList = item.participants ?? [];
    return (
      <TouchableOpacity
        style={styles.activityItem}
        onPress={() => {
          if (item.betId) {
            navigation.navigate('BetDetails', { betId: item.betId });
          }
        }}
      >
        <View style={styles.activityContent}>
          <Text style={styles.activityDescription}>{item.description}</Text>
          <Text style={styles.activityTimestamp}>
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </Text>
          <Text style={styles.activityAmount}>${item.amount}</Text>
          {participantsList.length > 0 && (
            <View style={styles.participantsContainer}>
              {participantsList.map((participant) => (
                <Text key={participant.id} style={styles.participantName}>
                  {participant.display_name || participant.username}
                </Text>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabs = () => {
    if (isCurrentUser) return null;

    return (
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'feed' && styles.activeTab]}
          onPress={() => setSelectedTab('feed')}
        >
          <Text style={[styles.tabText, selectedTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'between' && styles.activeTab]}
          onPress={() => setSelectedTab('between')}
        >
          <Text style={[styles.tabText, selectedTab === 'between' && styles.activeTabText]}>
            Between You
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCurrentUser ? 'Your Profile' : 'User Profile'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderProfileSection()}

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Bet Performance</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Bets Won',
              statistics.totalWon,
              'trophy',
              '#10B981',
            )}
            {renderStatCard(
              'Bets Lost',
              statistics.totalLost,
              'close-circle',
              '#EF4444',
            )}
            {renderStatCard(
              'In Progress',
              statistics.totalInProgress,
              'time',
              '#6B46C1',
            )}
            {renderStatCard(
              'Pending',
              statistics.totalPending,
              'hourglass',
              '#F59E0B',
            )}
          </View>
        </View>

        <View style={styles.financialSection}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.financeCards}>
            <View style={[styles.financeCard, { backgroundColor: '#10B981' }]}>
              <View style={styles.financeIconContainer}>
                <Ionicons name="trending-up" size={24} color="#FFF" />
              </View>
              <Text style={styles.financeLabel}>Stake Won</Text>
              <Text style={styles.financeValue}>${statistics.stakeWon.toFixed(2)}</Text>
            </View>
            <View style={[styles.financeCard, { backgroundColor: '#EF4444' }]}>
              <View style={styles.financeIconContainer}>
                <Ionicons name="trending-down" size={24} color="#FFF" />
              </View>
              <Text style={styles.financeLabel}>Stake Lost</Text>
              <Text style={styles.financeValue}>${statistics.stakeLost.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.netWinningsCard}>
            <Text style={styles.netWinningsLabel}>Net Winnings</Text>
            <Text style={[
              styles.netWinningsValue,
              { color: statistics.stakeWon - statistics.stakeLost >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              ${(statistics.stakeWon - statistics.stakeLost).toFixed(2)}
            </Text>
          </View>
        </View>

        {!isCurrentUser && (
          <View style={styles.activitySection}>
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'feed' && styles.activeTab]}
                onPress={() => setSelectedTab('feed')}
              >
                <Text style={[styles.tabText, selectedTab === 'feed' && styles.activeTabText]}>
                  Feed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'between' && styles.activeTab]}
                onPress={() => setSelectedTab('between')}
              >
                <Text style={[styles.tabText, selectedTab === 'between' && styles.activeTabText]}>
                  Between You
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedTab === 'feed' ? betActivities : betweenActivities}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.activityCard}
                  onPress={() => item.betId && navigation.navigate('BetDetails', { betId: item.betId })}
                >
                  <View style={styles.activityHeader}>
                    <View style={styles.activityCreatorContainer}>
                      <ProfileAvatar
                        size={36}
                        avatarUrl={item.creator.avatar_url}
                        displayName={item.creator.display_name}
                        username={item.creator.username}
                        userId={item.creator.id}
                        backgroundColor="#6B46C1"
                      />
                      <View style={styles.activityTextContainer}>
                        <Text style={styles.activityDescription}>{item.description}</Text>
                        <Text style={styles.activityCreatorName}>
                          {item.creator.display_name || item.creator.username || 'Unknown User'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.activityAmount}>${item.amount}</Text>
                  </View>
                  <View style={styles.activityFooter}>
                    <Text style={styles.activityTime}>
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </Text>
                    <View style={[styles.activityStatus, { backgroundColor: item.status === 'won' ? '#10B981' : '#6B46C1' }]}>
                      <Text style={styles.activityStatusText}>{item.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.activitiesList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color="#666" />
                  <Text style={styles.emptyStateText}>
                    {selectedTab === 'feed' ? 'No activities to show' : 'No bets between you'}
                  </Text>
                </View>
              }
            />
          </View>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    padding: 16,
    backgroundColor: '#1A1A1A',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileYouText: {
    color: '#999999',
    fontWeight: 'normal',
  },
  username: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  friendButtonActive: {
    backgroundColor: '#4A5568',
  },
  friendButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  statsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.9,
  },
  financialSection: {
    padding: 16,
  },
  financeCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  financeCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
  },
  financeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  financeLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  financeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  netWinningsCard: {
    backgroundColor: '#2D3748',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  netWinningsLabel: {
    fontSize: 16,
    color: '#FFF',
    marginBottom: 8,
  },
  netWinningsValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  activitySection: {
    flex: 1,
    padding: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6B46C1',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityCreatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  activityTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  activityCreatorName: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 2,
  },
  activityDescription: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginRight: 8,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTime: {
    fontSize: 14,
    color: '#999',
  },
  activityStatus: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activityStatusText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  profileLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  profileErrorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  profileErrorText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

export default DashboardScreen; 