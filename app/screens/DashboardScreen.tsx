import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBets } from '../context/BetContext';
import { LinearGradient } from 'expo-linear-gradient';

type StatisticSummary = {
  totalWon: number;
  totalLost: number;
  totalInProgress: number;
  totalPending: number;
  stakeWon: number;
  stakeLost: number;
};

const DashboardScreen = () => {
  const [statistics, setStatistics] = useState<StatisticSummary>({
    totalWon: 0,
    totalLost: 0,
    totalInProgress: 0,
    totalPending: 0,
    stakeWon: 0,
    stakeLost: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();
  const { bets, fetchBets, loading } = useBets();

  useEffect(() => {
    if (user) {
      fetchBets();
    }
  }, [user]);

  useEffect(() => {
    if (!loading && bets.length > 0) {
      calculateStatistics();
    } else if (!loading) {
      setIsLoading(false);
    }
  }, [loading, bets]);

  const calculateStatistics = () => {
    const stats = {
      totalWon: 0,
      totalLost: 0,
      totalInProgress: 0,
      totalPending: 0,
      stakeWon: 0,
      stakeLost: 0,
    };

    bets.forEach(bet => {
      // Count bets by status
      if (bet.status === 'won') {
        stats.totalWon++;
        stats.stakeWon += Number(bet.stake);
      } else if (bet.status === 'lost') {
        stats.totalLost++;
        stats.stakeLost += Number(bet.stake);
      } else if (bet.status === 'in_progress') {
        stats.totalInProgress++;
      } else if (bet.status === 'pending') {
        stats.totalPending++;
      }
    });

    setStatistics(stats);
    setIsLoading(false);
  };

  const renderStatCard = (title: string, value: number | string, icon: string, bgColors: [string, string], textColor: string = '#FFFFFF') => (
    <LinearGradient
      colors={bgColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statCard}
    >
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={24} color={textColor} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: textColor }]}>{title}</Text>
      </View>
    </LinearGradient>
  );

  // Helper function to update the color array typing in the view code
  const toGradientColors = (colors: string[]): [string, string] => {
    return [colors[0] || '#000', colors[1] || '#000'];
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Betting Dashboard</Text>
        <View style={styles.placeholderButton} />
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bet Performance</Text>
        </View>
        
        <View style={styles.statsRow}>
          {renderStatCard('Bets Won', statistics.totalWon, 'trophy-outline', toGradientColors(['#4CAF50', '#2E7D32']))}
          {renderStatCard('Bets Lost', statistics.totalLost, 'close-circle-outline', toGradientColors(['#F44336', '#C62828']))}
        </View>
        
        <View style={styles.statsRow}>
          {renderStatCard('In Progress', statistics.totalInProgress, 'hourglass-outline', toGradientColors(['#6B46C1', '#4527A0']))}
          {renderStatCard('Pending', statistics.totalPending, 'time-outline', toGradientColors(['#FF9800', '#EF6C00']))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
        </View>
        
        <View style={styles.statsRow}>
          {renderStatCard('Stake Won', `$${statistics.stakeWon.toFixed(2)}`, 'trending-up-outline', toGradientColors(['#00BCD4', '#0097A7']))}
          {renderStatCard('Stake Lost', `$${statistics.stakeLost.toFixed(2)}`, 'trending-down-outline', toGradientColors(['#FF5722', '#D84315']))}
        </View>
        
        <View style={styles.totalSection}>
          <LinearGradient
            colors={toGradientColors(['#333333', '#222222'])}
            style={styles.totalCard}
          >
            <Text style={styles.totalLabel}>Net Winnings</Text>
            <Text style={[
              styles.totalValue,
              { color: statistics.stakeWon - statistics.stakeLost >= 0 ? '#4CAF50' : '#F44336' }
            ]}>
              ${(statistics.stakeWon - statistics.stakeLost).toFixed(2)}
            </Text>
          </LinearGradient>
        </View>

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.viewAllButtonText}>View All Bets</Text>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  backButton: {
    padding: 8,
  },
  placeholderButton: {
    width: 40,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionHeader: {
    marginVertical: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  totalSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  totalCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  viewAllButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  viewAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DashboardScreen; 