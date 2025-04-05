import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

// Mock data for bets
const MOCK_BETS = [
  {
    id: '1',
    description: "Jake lost to Axel at 1v1 basketball 🏀",
    timestamp: "Mar 25 at 7:35pm",
    reactionCount: 1,
    commentCount: 3,
  },
  {
    id: '2',
    description: "Elliot paid you $5 because he couldn't bench 135 😅",
    timestamp: "Mar 22 at 5:10pm",
    reactionCount: 10,
    commentCount: 8,
  },
  {
    id: '3',
    description: "You won $50 from Mark in the basketball game 🏀",
    timestamp: "Jan 12 at 6:45pm",
    reactionCount: 12,
    commentCount: 5,
  },
  {
    id: '4',
    description: "You paid James $30 because you didn't go to the gym 3x last week 🏋️",
    timestamp: "Jan 15 at 11:30pm",
    reactionCount: 7,
    commentCount: 3,
  },
];

const HomeScreen = () => {
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const theme = useTheme();

  const renderBetCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.betCard}
        onPress={() => navigation.navigate('BetDetails', { betId: item.id })}
      >
        <Text style={styles.betDescription}>{item.description}</Text>
        <Text style={styles.betTimestamp}>{item.timestamp}</Text>
        <View style={styles.betStats}>
          <View style={styles.statItem}>
            <Text style={styles.statText}>{item.reactionCount} ❤️</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statText}>{item.commentCount} 💬</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BetMeNow</Text>
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.issueBetContainer}>
        <TouchableOpacity
          style={styles.issueBetButton}
          onPress={() => navigation.navigate('IssueBet')}
        >
          <Text style={styles.issueBetText}>Issue Bet</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'between_you' && styles.activeTab]}
          onPress={() => setActiveTab('between_you')}
        >
          <Text style={[styles.tabText, activeTab === 'between_you' && styles.activeTabText]}>
            Between You
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={MOCK_BETS}
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
        />
      )}
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
    paddingTop: 10,
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
  issueBetContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  issueBetButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  issueBetText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 15,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    color: '#888888',
    fontSize: 16,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  betCard: {
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  betDescription: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  betTimestamp: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 10,
  },
  betStats: {
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
});

export default HomeScreen; 