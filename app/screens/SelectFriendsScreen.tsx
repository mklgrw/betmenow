import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  FlatList,
  Platform,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { supabase, createUsersTable, createFriendshipsTable } from '../services/supabase';
import ProfileAvatar from '../components/ProfileAvatar';

type AppContact = {
  id: string;
  name: string;
  phoneNumber?: string;
  username?: string;
  isAppUser: boolean;
  isSelected: boolean;
};

type RouteParams = {
  onFriendsSelected?: (friendIds: string[]) => void;
};

interface FriendshipData {
  friend_id: string;
  users: {
    id: string;
    username: string | null;
    phone: string | null;
  };
}

type TabType = 'friends' | 'users';

const SelectFriendsScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [appFriends, setAppFriends] = useState<AppContact[]>([]);
  const [otherUsers, setOtherUsers] = useState<AppContact[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { user } = useAuth();
  const params = route.params as RouteParams;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Check and create tables if needed
        console.log('Checking if users table exists...');
        const { data: usersTableResult, error: usersTableError } = await createUsersTable();
        console.log('Users table check result:', usersTableResult, usersTableError);
        
        console.log('Checking if friendships table exists...');
        const { data: friendshipsTableResult, error: friendshipsTableError } = await createFriendshipsTable();
        console.log('Friendships table check result:', friendshipsTableResult, friendshipsTableError);
        
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
    
    const focusListener = navigation.addListener('focus', () => {
      console.log('SelectFriendsScreen focused - reloading data');
      loadData();
    });

    return () => {
      focusListener();
    };
  }, [navigation, user?.id]);

  // Mock data for when database tables don't exist
  const MOCK_FRIENDS: AppContact[] = [
    {
      id: 'friend-1',
      name: 'Alibek',
      username: '@alibek294',
      isAppUser: true,
      isSelected: false
    },
    {
      id: 'friend-2',
      name: 'Alida',
      username: '@alidabettingallday',
      isAppUser: true,
      isSelected: false
    }
  ];
  
  const MOCK_USERS: AppContact[] = [
    {
      id: 'user-1',
      name: 'Alina',
      username: 'alinaSD213',
      isAppUser: true,
      isSelected: false
    },
    {
      id: 'user-2',
      name: 'Alize',
      username: 'alizewins',
      isAppUser: true,
      isSelected: false
    },
    {
      id: 'user-3',
      name: 'Jake',
      username: 'jake2win',
      isAppUser: true,
      isSelected: false
    }
  ];

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
        
        // If we get a relation does not exist error, attempt to create the table
        if (friendshipsError.message.includes('relation "friendships" does not exist')) {
          console.log('Friendships table does not exist. Creating it...');
          
          const { data: tableResult, error: tableError } = await createFriendshipsTable();
          
          if (tableError) {
            console.error('Error creating friendships table:', tableError);
            setAppFriends([]);
            return;
          }
          
          console.log('Friendships table created successfully:', tableResult);
          
          // We no longer need the test friendship code since we removed contacts functionality
          setAppFriends([]);
          return;
        } else {
          setAppFriends([]);
          return;
        }
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

        console.log(`Successfully loaded ${friendsData?.length || 0} friends:`, 
          JSON.stringify(friendsData?.map(f => ({id: f.id, username: f.username, display_name: f.display_name})) || []));
          
        // Convert to AppContact format with display_name as primary name
        const appContacts: AppContact[] = (friendsData || []).map(friend => ({
          id: friend.id,
          name: friend.display_name || friend.username || 'User',
          username: friend.username,
          phoneNumber: friend.phone,
          isAppUser: true,
          isSelected: false
        }));
        
        setAppFriends(appContacts);
      } else {
        console.log('No friendships found for this user');
        setAppFriends([]);
      }
    } catch (error) {
      console.error('Error in loadAppFriends:', error);
      setAppFriends([]);
    }
  };

  const loadOtherUsers = async () => {
    try {
      console.log(`Loading other users, current user ID: ${user?.id}`);
      setLoading(true);

      // Get real users from Auth users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, username, phone, created_at, display_name')
        .neq('id', user?.id)
        .limit(50);

      if (usersError) {
        console.error('Error loading other users:', usersError);
        
        // Check if error is table not existing
        if (usersError.code === '42P01') { // relation does not exist
          console.log('Users table does not exist in database');
          console.log('Please run SQL in Supabase SQL Editor to create users table from auth.users');
          
          // Just log a message - we don't want to create tables from the app
          console.log(`
            CREATE TABLE IF NOT EXISTS public.users (
              id UUID PRIMARY KEY REFERENCES auth.users(id),
              username TEXT,
              email TEXT,
              phone TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Insert your existing Auth users
            INSERT INTO public.users (id, email, created_at)
            SELECT id, email, created_at 
            FROM auth.users
            ON CONFLICT (id) DO NOTHING;
          `);
          
          // Fall back to using auth table directly
          console.log('Using default users');
          const defaultUsers = [
            { 
              id: '11111111-1111-1111-1111-111111111111',
              username: 'TestUser1', 
              display_name: 'TestUser1',
              email: 'test1@example.com',
              phone: '1234567890' 
            },
            { 
              id: '22222222-2222-2222-2222-222222222222',
              username: 'TestUser2', 
              display_name: 'TestUser2',
              email: 'test2@example.com',
              phone: '0987654321' 
            }
          ];
          
          const contacts: AppContact[] = defaultUsers.map(u => ({
            id: u.id,
            name: u.display_name || u.username || 'User',
            username: u.username,
            phoneNumber: u.phone,
            isAppUser: true,
            isSelected: false
          }));
          
          setOtherUsers(contacts);
          setLoading(false);
          return;
        }
        
        // Some other error occurred
        setOtherUsers([]);
        setLoading(false);
        return;
      }
      
      if (!usersData || usersData.length === 0) {
        console.log('No other users found');
        setOtherUsers([]);
        setLoading(false);
        return;
      }
      
      console.log(`Query successful, found users: ${usersData.length}`);
      console.log(`All users query result: Found ${usersData.length} users: ${JSON.stringify(usersData)}`);
      
      // Map to AppContact format
      const contacts: AppContact[] = usersData.map(u => ({
        id: u.id,
        name: u.display_name || u.username || u.email?.split('@')[0] || 'User',
        username: u.username,
        phoneNumber: u.phone,
        isAppUser: true,
        isSelected: false
      }));
      
      setOtherUsers(contacts);
      setLoading(false);
    } catch (error) {
      console.error('Exception loading other users:', error);
      setOtherUsers([]);
      setLoading(false);
    }
  };

  // Add a refresh function to reload data
  const refreshData = () => {
    if (user) {
      loadAppFriends();
      loadOtherUsers();
    }
  };

  // Add a focus effect to refresh data when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });

    return unsubscribe;
  }, [navigation, user]);

  // Add a refresh trigger on tab change
  useEffect(() => {
    if (activeTab === 'users') {
      loadOtherUsers();
    } else if (activeTab === 'friends') {
      loadAppFriends();
    }
  }, [activeTab]);

  // Updated to handle single selection
  const selectContact = (id: string, name: string) => {
    if (params.onFriendsSelected) {
      params.onFriendsSelected([id]);
    }
    navigation.goBack();
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

  const ContactItem = ({ contact, section }: { contact: AppContact, section: TabType }) => (
    <TouchableOpacity 
      style={styles.contactItem} 
      onPress={() => selectContact(contact.id, contact.name)}
    >
      <ProfileAvatar
        size={48}
        displayName={contact.name}
        username={contact.username}
        userId={contact.id}
      />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactDetail}>
          {contact.username || contact.phoneNumber || '@' + contact.name.toLowerCase().replace(/\s/g, '')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity 
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]} 
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={20} color={activeTab === tab ? "#6B46C1" : "#999"} />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Recipient</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={shareViaMessage}
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" style={styles.shareIcon} />
          <Text style={styles.shareButtonText}>Invite</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 10,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 16,
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
  }
});

export default SelectFriendsScreen;
