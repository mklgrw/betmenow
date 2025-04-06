import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// User type for leaderboard entries
type LeaderboardUser = {
  id: string;
  username: string;
  display_name: string;
  bets_won: number;
  bets_lost: number;
  total_bets: number;
  stake_won: number;
  stake_lost: number;
  win_percentage: number;
  net_winnings: number;
  score: number; // Calculated ranking score
};

// Enum for time filter options
enum TimeFilter {
  ALL_TIME = 'all_time',
  THIS_MONTH = 'this_month',
  THIS_WEEK = 'this_week'
}

// Enum for sorting options
enum SortOption {
  SCORE = 'score',
  WIN_RATE = 'win_percentage',
  NET_WINNINGS = 'net_winnings',
  TOTAL_BETS = 'total_bets'
}

const LeaderboardScreen = () => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TimeFilter.ALL_TIME);
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.SCORE);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboardData();
  }, [timeFilter]);
  
  // Filter and sort users when dependencies change
  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchQuery, sortOption]);

  const fetchLeaderboardData = async () => {
    setIsLoading(true);
    try {
      // First, get all users with their basic profile data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, display_name');
      
      if (userError) {
        console.error('Error fetching users:', userError);
        setIsLoading(false);
        return;
      }
      
      if (!userData || userData.length === 0) {
        setIsLoading(false);
        return;
      }

      // For each user, calculate bet statistics
      const userPromises = userData.map(async (user) => {
        try {
          // Build query based on time filter
          let query = supabase.from('bets')
            .select('id, stake, status, creator_id, created_at')
            .eq('creator_id', user.id);
          
          // Apply time filter
          if (timeFilter === TimeFilter.THIS_MONTH) {
            const firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            firstDayOfMonth.setHours(0, 0, 0, 0);
            query = query.gte('created_at', firstDayOfMonth.toISOString());
          } else if (timeFilter === TimeFilter.THIS_WEEK) {
            const firstDayOfWeek = new Date();
            const day = firstDayOfWeek.getDay() || 7;
            firstDayOfWeek.setDate(firstDayOfWeek.getDate() - day + 1);
            firstDayOfWeek.setHours(0, 0, 0, 0);
            query = query.gte('created_at', firstDayOfWeek.toISOString());
          }

          // Execute query to get creator bets
          const { data: createdBets, error: createdBetsError } = await query;
          
          if (createdBetsError) {
            console.error(`Error fetching bets for user ${user.id}:`, createdBetsError);
            return null;
          }

          // Get bets where user is recipient
          let recipientQuery = supabase.from('bet_recipients')
            .select('bet_id, status, recipient_id, bets(stake, created_at)')
            .eq('recipient_id', user.id);
          
          // Apply time filter to recipient bets
          if (timeFilter === TimeFilter.THIS_MONTH) {
            const firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            firstDayOfMonth.setHours(0, 0, 0, 0);
            recipientQuery = recipientQuery.gte('bets.created_at', firstDayOfMonth.toISOString());
          } else if (timeFilter === TimeFilter.THIS_WEEK) {
            const firstDayOfWeek = new Date();
            const day = firstDayOfWeek.getDay() || 7;
            firstDayOfWeek.setDate(firstDayOfWeek.getDate() - day + 1);
            firstDayOfWeek.setHours(0, 0, 0, 0);
            recipientQuery = recipientQuery.gte('bets.created_at', firstDayOfWeek.toISOString());
          }
          
          const { data: recipientBets, error: recipientBetsError } = await recipientQuery;
          
          if (recipientBetsError) {
            console.error(`Error fetching recipient bets for user ${user.id}:`, recipientBetsError);
            return null;
          }

          // Calculate statistics
          let betsWon = 0;
          let betsLost = 0;
          let stakeWon = 0;
          let stakeLost = 0;
          
          // Process created bets
          createdBets?.forEach((bet) => {
            if (bet.status === 'won') {
              betsWon++;
              stakeWon += Number(bet.stake);
            } else if (bet.status === 'lost') {
              betsLost++;
              stakeLost += Number(bet.stake);
            }
          });
          
          // Process recipient bets
          recipientBets?.forEach((recipientBet) => {
            if (recipientBet.status === 'won') {
              betsWon++;
              // Access the stake safely with type handling
              const betData = recipientBet.bets as unknown as { stake: number };
              stakeWon += Number(betData?.stake || 0);
            } else if (recipientBet.status === 'lost') {
              betsLost++;
              // Access the stake safely with type handling
              const betData = recipientBet.bets as unknown as { stake: number };
              stakeLost += Number(betData?.stake || 0);
            }
          });
          
          const totalBets = (createdBets?.length || 0) + (recipientBets?.length || 0);
          const completedBets = betsWon + betsLost;
          const winPercentage = completedBets > 0 ? (betsWon / completedBets) * 100 : 0;
          const netWinnings = stakeWon - stakeLost;
          
          // Calculate overall score using a weighted formula
          // 40% win percentage, 40% net winnings, 20% activity level
          const winPercentWeight = 0.4;
          const netWinningsWeight = 0.4;
          const activityWeight = 0.2;
          
          // Normalize values (0-1 scale)
          const normalizedWinPercentage = winPercentage / 100;
          const normalizedNetWinnings = netWinnings > 0 ? Math.min(netWinnings / 1000, 1) : 0; // Assuming $1000 as a good benchmark
          const normalizedActivity = Math.min(totalBets / 20, 1); // Assuming 20 bets is very active
          
          const score = (
            (normalizedWinPercentage * winPercentWeight) +
            (normalizedNetWinnings * netWinningsWeight) +
            (normalizedActivity * activityWeight)
          ) * 100; // Scale to 0-100
          
          return {
            ...user,
            bets_won: betsWon,
            bets_lost: betsLost,
            total_bets: totalBets,
            stake_won: stakeWon,
            stake_lost: stakeLost,
            win_percentage: winPercentage,
            net_winnings: netWinnings,
            score
          };
        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error);
          return null;
        }
      });
      
      const userStats = await Promise.all(userPromises);
      const validUsers = userStats.filter(u => u !== null) as LeaderboardUser[];
      
      setUsers(validUsers);
    } catch (error) {
      console.error('Error in fetchLeaderboardData:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    // Apply search filter
    let result = [...users];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        u => u.username.toLowerCase().includes(query) || 
             (u.display_name && u.display_name.toLowerCase().includes(query))
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch(sortOption) {
        case SortOption.WIN_RATE:
          return b.win_percentage - a.win_percentage;
        case SortOption.NET_WINNINGS:
          return b.net_winnings - a.net_winnings;
        case SortOption.TOTAL_BETS:
          return b.total_bets - a.total_bets;
        case SortOption.SCORE:
        default:
          return b.score - a.score;
      }
    });
    
    setFilteredUsers(result);
  };

  const renderTimeFilterButton = (filter: TimeFilter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        timeFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => setTimeFilter(filter)}
    >
      <Text 
        style={[
          styles.filterButtonText,
          timeFilter === filter && styles.activeFilterButtonText
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  
  const renderSortButton = (option: SortOption, label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.sortButton,
        sortOption === option && styles.activeSortButton
      ]}
      onPress={() => setSortOption(option)}
    >
      <Ionicons 
        name={icon as any} 
        size={16} 
        color={sortOption === option ? '#FFFFFF' : '#999999'} 
      />
      <Text 
        style={[
          styles.sortButtonText,
          sortOption === option && styles.activeSortButtonText
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item, index }: { item: LeaderboardUser, index: number }) => {
    const rankColors: [string, string] = index === 0 
      ? ['#FFD700', '#FFC107'] // Gold
      : index === 1 
        ? ['#C0C0C0', '#ACACAC'] // Silver
        : index === 2 
          ? ['#CD7F32', '#B36A30'] // Bronze
          : ['#2A2A2A', '#222222']; // Default
          
    const isCurrentUser = item.id === user?.id;
    
    return (
      <LinearGradient
        colors={isCurrentUser ? ['#6B46C1', '#4527A0'] : rankColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.userCard}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {(item.display_name || item.username || '?')[0].toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.display_name || item.username}
            {isCurrentUser && <Text style={styles.youText}> (You)</Text>}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              <Text style={styles.statValue}>{item.win_percentage.toFixed(0)}%</Text> Win Rate
            </Text>
            <Text style={styles.statText}>
              <Text style={styles.statValue}>${item.net_winnings.toFixed(2)}</Text> Net
            </Text>
          </View>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{Math.round(item.score)}</Text>
        </View>
      </LinearGradient>
    );
  };

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.timeFilters}>
        {renderTimeFilterButton(TimeFilter.ALL_TIME, 'All Time')}
        {renderTimeFilterButton(TimeFilter.THIS_MONTH, 'This Month')}
        {renderTimeFilterButton(TimeFilter.THIS_WEEK, 'This Week')}
      </View>
      
      <View style={styles.sortOptions}>
        <Text style={styles.sortByText}>Sort by:</Text>
        {renderSortButton(SortOption.SCORE, 'Score', 'trophy-outline')}
        {renderSortButton(SortOption.WIN_RATE, 'Win %', 'trending-up-outline')}
        {renderSortButton(SortOption.NET_WINNINGS, 'Net $', 'cash-outline')}
        {renderSortButton(SortOption.TOTAL_BETS, 'Activity', 'pulse-outline')}
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <View style={styles.leaderboardHeader}>
        <Text style={styles.topUsersTitle}>Top Bettors</Text>
        <Text style={styles.resultsCount}>{filteredUsers.length} Results</Text>
      </View>
    </View>
  );

  const renderListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={60} color="#666" />
      <Text style={styles.emptyText}>No users found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try a different search term' : 'Start placing bets to appear on the leaderboard!'}
      </Text>
    </View>
  );

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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <TouchableOpacity style={styles.infoButton} onPress={() => {
          // Show info about scoring algorithm
          // This could be implemented as a modal
        }}>
          <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmptyComponent}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  backButton: {
    padding: 8,
  },
  infoButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  timeFilters: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#6B46C1',
  },
  filterButtonText: {
    color: '#999999',
    fontSize: 14,
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sortByText: {
    color: '#999999',
    fontSize: 14,
    marginRight: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
    marginBottom: 8,
  },
  activeSortButton: {
    backgroundColor: '#6B46C1',
  },
  sortButtonText: {
    color: '#999999',
    fontSize: 13,
    marginLeft: 4,
  },
  activeSortButtonText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 10,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topUsersTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsCount: {
    color: '#999999',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarContainer: {
    marginLeft: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  youText: {
    fontStyle: 'italic',
    fontWeight: 'normal',
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginRight: 10,
  },
  statValue: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scoreContainer: {
    alignItems: 'center',
    padding: 8,
  },
  scoreLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginBottom: 2,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});

export default LeaderboardScreen; 