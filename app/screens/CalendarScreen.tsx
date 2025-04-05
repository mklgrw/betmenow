import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

// Mock data for bets with deadlines
const MOCK_BETS = [
  {
    id: '1',
    description: "Rob bet you can't make it through Dry January 🍾",
    likes: 17,
    stake: 75,
    status: 'In Progress',
    dueDate: '2025-01-31',
  },
  {
    id: '2',
    description: "Bench press challenge with Alex 🏋️",
    likes: 8,
    stake: 50,
    status: 'Upcoming',
    dueDate: '2025-01-15',
  },
  {
    id: '3',
    description: "Run a half marathon with Jake 🏃",
    likes: 12,
    stake: 100,
    status: 'Upcoming',
    dueDate: '2025-02-10',
  },
  {
    id: '4',
    description: "Weight loss challenge with Chris 🥗",
    likes: 9,
    stake: 200,
    status: 'Upcoming',
    dueDate: '2025-03-01',
  },
];

const CalendarScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const theme = useTheme();

  const renderBetItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.betCard}
      onPress={() => navigation.navigate('BetDetails', { betId: item.id })}
    >
      <View style={styles.betContent}>
        <Text style={styles.betDescription}>{item.description}</Text>
        <View style={styles.betStats}>
          <Text style={styles.betStat}>{item.likes}👍</Text>
          <Text style={styles.betStat}>${item.stake} 💸</Text>
          <View style={[
            styles.statusBadge,
            item.status === 'In Progress' ? styles.inProgressBadge : styles.upcomingBadge
          ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
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
        <Text style={styles.headerTitle}>Your Tasks</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TouchableOpacity 
          style={styles.searchInput}
          onPress={() => navigation.navigate('SearchBets')}
        >
          <Text style={styles.searchPlaceholder}>Search for your task...</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_BETS}
        renderItem={renderBetItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.calendarHeader}>
            <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks scheduled</Text>
            <TouchableOpacity
              style={styles.createTaskButton}
              onPress={() => navigation.navigate('IssueBet')}
            >
              <Text style={styles.createTaskText}>Create a Task</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    color: '#6B46C1',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 100,
  },
  betCard: {
    backgroundColor: '#333333',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
  },
  betContent: {
    flex: 1,
  },
  betDescription: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 15,
  },
  betStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betStat: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  inProgressBadge: {
    backgroundColor: '#FFC107',
  },
  upcomingBadge: {
    backgroundColor: '#6B46C1',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 15,
  },
  createTaskButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  createTaskText: {
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
});

export default CalendarScreen; 