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
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Contacts from 'expo-contacts';
import { useAuth } from '../context/AuthContext';
import { supabase, createUsersTable, createFriendshipsTable } from '../services/supabase';

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

type TabType = 'contacts' | 'friends' | 'users';

const SelectFriendsScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<AppContact[]>([]);
  const [appFriends, setAppFriends] = useState<AppContact[]>([]);
  const [otherUsers, setOtherUsers] = useState<AppContact[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

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

  useEffect(() => {
    if (activeTab === 'contacts' && !hasPermission && contacts.length === 0) {
      checkContactsPermission();
    }
  }, [activeTab]);

  const checkContactsPermission = async () => {
    const { status } = await Contacts.getPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      loadContacts();
    }
  };

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
          
          // Insert a test friendship for demonstration
          if (allUsers && allUsers.length > 0) {
            // Find a user that's not the current user
            const otherUser = allUsers.find(u => u.id !== user.id);
            
            if (otherUser) {
              console.log('Creating test friendship with user:', otherUser.username);
              
              const { data: newFriendship, error: insertError } = await supabase
                .from('friendships')
                .insert([
                  { user_id: user.id, friend_id: otherUser.id }
                ]);
                
              if (insertError) {
                console.error('Error creating test friendship:', insertError);
              } else {
                console.log('Test friendship created successfully:', newFriendship);
              }
            }
          }
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

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        loadContacts();
        setShowPermissionModal(false);
      } else {
        setShowPermissionModal(false);
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (data.length > 0) {
        const contactsList: AppContact[] = data
          .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
          .map(contact => ({
            // Ensure id is always a string
            id: contact.id || `contact-${Math.random().toString(36).substr(2, 9)}`,
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers?.[0]?.number,
            isAppUser: false,
            isSelected: false
          }));
        setContacts(contactsList);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const toggleContactSelection = (id: string, section: TabType) => {
    switch (section) {
      case 'contacts':
        setContacts(prev => 
          prev.map(contact => 
            contact.id === id ? { ...contact, isSelected: !contact.isSelected } : contact
          )
        );
        break;
      case 'friends':
        setAppFriends(prev => 
          prev.map(friend => 
            friend.id === id ? { ...friend, isSelected: !friend.isSelected } : friend
          )
        );
        break;
      case 'users':
        setOtherUsers(prev => 
          prev.map(user => 
            user.id === id ? { ...user, isSelected: !user.isSelected } : user
          )
        );
        break;
    }

    // Update selected contacts
    setSelectedContacts(prev => {
      if (prev.includes(id)) {
        return prev.filter(contactId => contactId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleInvite = () => {
    setShowPermissionModal(true);
  };

  const handleDone = () => {
    if (params.onFriendsSelected) {
      params.onFriendsSelected(selectedContacts);
    }
    navigation.goBack();
  };

  const filteredAppFriends = searchQuery 
    ? appFriends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.username && friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : appFriends;

  const filteredContacts = searchQuery 
    ? contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  const filteredOtherUsers = searchQuery
    ? otherUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : otherUsers;

  const renderPermissionModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>"Bet" Would Like to Access Your Contacts</Text>
        <Text style={styles.modalText}>This lets you select the friends you want to invite.</Text>
        
        <TouchableOpacity style={styles.modalButton} onPress={() => requestContactsPermission()}>
          <Text style={styles.modalButtonText}>Select Contacts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.modalButton} onPress={() => requestContactsPermission()}>
          <Text style={styles.modalButtonText}>Allow Access to all Contacts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.modalButtonOutline} onPress={() => setShowPermissionModal(false)}>
          <Text style={styles.modalButtonOutlineText}>Don't Allow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ContactItem = ({ contact, section }: { contact: AppContact, section: TabType }) => (
    <TouchableOpacity 
      style={styles.contactItem} 
      onPress={() => toggleContactSelection(contact.id, section)}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactDetail}>
          {section === 'contacts'
            ? (contact.phoneNumber || '')
            : (contact.username || contact.phoneNumber || '@' + contact.name.toLowerCase().replace(/\s/g, ''))}
        </Text>
      </View>
      <TouchableOpacity onPress={() => toggleContactSelection(contact.id, section)}>
        <Ionicons 
          name={contact.isSelected ? "person-add" : "person-add-outline"} 
          size={24} 
          color="#fff"
        />
      </TouchableOpacity>
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
    let action = null;
    
    switch (tabType) {
      case 'contacts':
        message = 'No contacts found';
        action = hasPermission ? null : (
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
            <Ionicons name="person-add" size={20} color="#fff" style={styles.inviteIcon} />
            <Text style={styles.inviteButtonText}>Access Contacts</Text>
          </TouchableOpacity>
        );
        break;
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
          <Ionicons name={tabType === 'contacts' ? 'call' : 'people'} size={64} color="#ccc" />
        </View>
        <Text style={styles.emptyText}>{message}</Text>
        {action}
      </View>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#6B46C1" style={styles.loader} />;
    }

    switch (activeTab) {
      case 'contacts':
        if (!hasPermission && contacts.length === 0) {
          return (
            <View style={styles.emptyContainer}>
              <EmptyListMessage tabType="contacts" />
            </View>
          );
        }
        return (
          <View style={styles.listContainer}>
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <ContactItem 
                  key={`contact-${contact.id}`} 
                  contact={contact} 
                  section="contacts" 
                />
              ))
            ) : (
              <EmptyListMessage tabType="contacts" />
            )}
          </View>
        );
      
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
        <Text style={styles.headerTitle}>To</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Name, @handle, Phone"
          placeholderTextColor="#AAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('contacts', 'Contacts', 'call-outline')}
        {renderTabButton('friends', 'Friends', 'people-outline')}
        {renderTabButton('users', 'Users', 'globe-outline')}
      </View>

      {renderTabContent()}

      {selectedContacts.length > 0 && (
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done ({selectedContacts.length})</Text>
        </TouchableOpacity>
      )}

      {showPermissionModal && renderPermissionModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 45,
    backgroundColor: '#222',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  sectionHeader: {
    color: '#999',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#222',
    padding: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  contactAvatar: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  contactInitial: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactDetail: {
    color: '#999',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 30,
  },
  inviteButton: {
    flexDirection: 'row',
    backgroundColor: '#6B46C1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteIcon: {
    marginRight: 8,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 15,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  inviteButtonTextSmall: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#6B46C1',
    padding: 15,
    margin: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  modalButton: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#6B46C1',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtonOutline: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B46C1',
  },
  modalButtonOutlineText: {
    color: '#6B46C1',
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#6B46C1',
  },
  tabButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  activeTabText: {
    color: '#6B46C1',
  },
});

export default SelectFriendsScreen;
