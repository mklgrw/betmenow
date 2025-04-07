import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase, createUsersTable, createFriendshipsTable } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppContact = {
  id: string;
  name: string;
  phoneNumber?: string;
  username?: string;
  avatarUrl?: string;
  isAppUser: boolean;
  isFriend: boolean;
};

type TabType = 'friends' | 'users';

// Define navigator type
type NavigationProps = {
  navigate: (screen: string, params?: any) => void;
};

const FriendsScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [appFriends, setAppFriends] = useState<AppContact[]>([]);
  const [otherUsers, setOtherUsers] = useState<AppContact[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [loading, setLoading] = useState(true);
  
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Check and create tables if needed
        await createUsersTable();
        await createFriendshipsTable();
        
        // Load friends and other users
        await loadAppFriends();
        await loadOtherUsers();
      } catch (error) {
        console.error('Error in loadData:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  // Load app friends from database
  const loadAppFriends = async () => {
    try {
      if (!user) return;
      console.log('Loading app friends for user ID:', user.id);

      // Check if friendships table exists and has data
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);

      if (friendshipsError) {
        console.error('Error loading friendships:', friendshipsError);
        setAppFriends([]);
        return;
      }

      // If we have friendships, fetch the friend details
      if (friendships && friendships.length > 0) {
        console.log(`Found ${friendships.length} friendships, fetching user details...`);
        
        const friendIds = friendships.map(f => f.friend_id);
        const { data: friendsData, error: friendsError } = await supabase
          .from('users')
          .select('id, username, phone, display_name')
          .in('id', friendIds);

        if (friendsError) {
          console.error('Error loading friend details:', friendsError);
          setAppFriends([]);
          return;
        }

        // Load avatar URLs from AsyncStorage
        const friendsWithAvatars = await Promise.all((friendsData || []).map(async (friend) => {
          let avatarUrl = null;
          try {
            avatarUrl = await AsyncStorage.getItem(`user_avatar_${friend.id}`);
          } catch (storageError) {
            console.error('Error fetching avatar from storage:', storageError);
          }
          
          return {
            id: friend.id,
            name: friend.display_name || friend.username || 'User',
            username: friend.username,
            phoneNumber: friend.phone,
            avatarUrl: avatarUrl || undefined,
            isAppUser: true,
            isFriend: true
          };
        }));
        
        setAppFriends(friendsWithAvatars);
      } else {
        console.log('No friendships found for this user');
        setAppFriends([]);
      }
    } catch (error) {
      console.error('Error in loadAppFriends:', error);
      setAppFriends([]);
    }
  };

  // Load other users from database
  const loadOtherUsers = async () => {
    try {
      if (!user) return;
      
      // First, get the IDs of current friends to exclude them
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);
      
      const friendIds = friendshipsError ? [] : (friendships?.map(f => f.friend_id) || []);
      
      // Get users who are not the current user and not already friends
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, phone, display_name')
        .neq('id', user.id)
        .limit(50);
      
      if (usersError) {
        console.error('Error loading other users:', usersError);
        setOtherUsers([]);
        return;
      }
      
      // Load avatar URLs from AsyncStorage
      const usersWithAvatars = await Promise.all((usersData || []).map(async (otherUser) => {
        let avatarUrl = null;
        try {
          avatarUrl = await AsyncStorage.getItem(`user_avatar_${otherUser.id}`);
        } catch (storageError) {
          console.error('Error fetching avatar from storage:', storageError);
        }
        
        const isFriend = friendIds.includes(otherUser.id);
        
        return {
          id: otherUser.id,
          name: otherUser.display_name || otherUser.username || 'User',
          username: otherUser.username,
          phoneNumber: otherUser.phone,
          avatarUrl: avatarUrl || undefined,
          isAppUser: true,
          isFriend
        };
      }));
      
      // Only include users who are not already friends
      setOtherUsers(usersWithAvatars.filter(user => !user.isFriend));
    } catch (error) {
      console.error('Error in loadOtherUsers:', error);
      setOtherUsers([]);
    }
  };

  // Add friend to database
  const addFriend = async (friendId: string) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add friends');
        return;
      }

      // Add friendship record
      const { error } = await supabase
        .from('friendships')
        .insert([
          { user_id: user.id, friend_id: friendId }
        ]);

      if (error) {
        console.error('Error adding friend:', error);
        Alert.alert('Error', 'Failed to add friend');
        return;
      }

      // Refresh lists
      await loadAppFriends();
      await loadOtherUsers();

      Alert.alert('Success', 'Friend added successfully');
    } catch (error) {
      console.error('Error in addFriend:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Remove friend from database
  const removeFriend = async (friendId: string) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to remove friends');
        return;
      }
      
      // Delete friendship
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendId);
      
      if (deleteError) {
        console.error('Error removing friend:', deleteError);
        Alert.alert('Error', 'Failed to remove friend');
        return;
      }
      
      // Delete reciprocal friendship
      const { error: reciprocalError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', user.id);
      
      if (reciprocalError) {
        console.error('Error removing reciprocal friendship:', reciprocalError);
        // Not showing alert as the main friendship was deleted successfully
      }
      
      // Refresh lists
      await loadAppFriends();
      await loadOtherUsers();
      
      Alert.alert('Success', 'Friend removed successfully');
    } catch (error) {
      console.error('Error in removeFriend:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Share app via message
  const shareViaMessage = async () => {
    try {
      const message = `download the BET app https://betmenow.app`;
      const url = `sms:&body=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'SMS is not supported on this device');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      Alert.alert('Error', 'Failed to open messages app');
    }
  };

  // View user profile
  const viewUserProfile = (userId: string) => {
    navigation.navigate('Dashboard', { userId });
  };

  // Filter lists based on search query
  const filteredAppFriends = searchQuery 
    ? appFriends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.username && friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : appFriends;

  const filteredOtherUsers = searchQuery
    ? otherUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : otherUsers;

  // Render tab button
  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity 
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]} 
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={20} color={activeTab === tab ? "#6B46C1" : "#999"} />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

  // Render contact/user item
  const ContactItem = ({ contact, section }: { contact: AppContact, section: TabType }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleAction = async () => {
      setIsLoading(true);
      try {
        if (section === 'friends') {
          await removeFriend(contact.id);
        } else {
          await addFriend(contact.id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const getButtonStyle = () => {
      if (section === 'friends') return styles.unfriendButton;
      return styles.addFriendButton;
    };

    const getButtonTextStyle = () => {
      if (section === 'friends') return styles.unfriendButtonText;
      return styles.addFriendButtonText;
    };

    const getButtonText = () => {
      if (isLoading) return '';
      if (section === 'friends') return 'Friends';
      return 'Add Friend';
    };

    const getIconName = () => {
      if (section === 'friends') return 'checkmark-circle';
      return 'person-add-outline';
    };

    return (
      <TouchableOpacity 
        style={styles.contactItem} 
        onPress={() => viewUserProfile(contact.id)}
      >
        <View style={styles.contactAvatar}>
          {contact.avatarUrl ? (
            <Image 
              source={{ uri: contact.avatarUrl }} 
              style={styles.avatarImage} 
            />
          ) : (
            <Text style={styles.contactInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.contactDetail}>
            {contact.username || '@' + contact.name.toLowerCase().replace(/\s/g, '')}
          </Text>
        </View>
        <TouchableOpacity 
          style={[getButtonStyle(), isLoading && styles.buttonLoading]}
          onPress={handleAction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons 
                name={getIconName()} 
                size={16} 
                color="#FFFFFF" 
                style={styles.buttonIcon} 
              />
              <Text style={getButtonTextStyle()}>{getButtonText()}</Text>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render empty list message
  const EmptyListMessage = ({ tabType }: { tabType: TabType }) => {
    let message = '';
    
    switch (tabType) {
      case 'friends':
        message = 'You have no friends yet';
        break;
      case 'users':
        message = 'No other users found';
        break;
    }
    
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="people" size={64} color="#ccc" />
        </View>
        <Text style={styles.emptyText}>{message}</Text>
      </View>
    );
  };

  // Render tab content
  const renderTabContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#6B46C1" style={styles.loader} />;
    }

    switch (activeTab) {
      case 'friends':
        return (
          <View style={styles.listContainer}>
            {filteredAppFriends.length > 0 ? (
              filteredAppFriends.map(friend => (
                <ContactItem 
                  key={`friend-${friend.id}`} 
                  contact={friend} 
                  section="friends" 
                />
              ))
            ) : (
              <EmptyListMessage tabType="friends" />
            )}
          </View>
        );
      
      case 'users':
        return (
          <View style={styles.listContainer}>
            {filteredOtherUsers.length > 0 ? (
              filteredOtherUsers.map(otherUser => (
                <ContactItem 
                  key={`user-${otherUser.id}`} 
                  contact={otherUser} 
                  section="users" 
                />
              ))
            ) : (
              <EmptyListMessage tabType="users" />
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={shareViaMessage}
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" style={styles.shareIcon} />
          <Text style={styles.shareButtonText}>Invite Friends</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabsContainer}>
        {renderTabButton('friends', 'Friends', 'people')}
        {renderTabButton('users', 'Users', 'globe')}
      </View>

      {renderTabContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  shareIcon: {
    marginRight: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    margin: 16,
    padding: 10,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    marginHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#3A3A3A',
    borderColor: '#6B46C1',
    borderWidth: 1,
  },
  tabButtonText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactInitial: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#AAAAAA',
    marginBottom: 24,
  },
  buttonIcon: {
    marginRight: 6,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 110,
    justifyContent: 'center',
  },
  unfriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 110,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6B46C1',
  },
  addFriendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unfriendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonLoading: {
    opacity: 0.7,
  },
});

export default FriendsScreen;
