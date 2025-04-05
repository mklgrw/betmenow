import React from 'react';
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

const ActivityScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();

  const renderActivityItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => navigation.navigate('ActivityDetails', { activityId: item.id })}
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

      <FlatList
        data={MOCK_ACTIVITIES}
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
});

export default ActivityScreen; 