import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - There's an issue with moduleResolution for @react-navigation/native
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase, uploadAvatar } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ProfileAvatar from '../components/ProfileAvatar';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut, refreshUser } = useAuth();
  const theme = useTheme();
  
  // Profile data
  const [displayName, setDisplayName] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // UI states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingVenmo, setIsEditingVenmo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      
      // Request permission for image library
      (async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant photo library permissions to upload a profile picture.');
        }
      })();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('display_name, venmo_username, avatar_url')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      // Set user data
      if (data) {
        setDisplayName(data.display_name || '');
        setVenmoUsername(data.venmo_username || '');
        
        // Set avatar URL from database
        if (data.avatar_url) {
          console.log("Setting avatar URL from database:", data.avatar_url);
          setAvatarUrl(data.avatar_url);
        } else {
          // Try to get avatar URL from AsyncStorage
          console.log("No avatar URL in database, checking AsyncStorage");
          try {
            const storedAvatarUrl = await AsyncStorage.getItem(`user_avatar_${user?.id}`);
            if (storedAvatarUrl) {
              console.log("Setting avatar URL from AsyncStorage:", storedAvatarUrl);
              setAvatarUrl(storedAvatarUrl);
            } else {
              console.log("No avatar URL found in AsyncStorage");
            }
          } catch (error) {
            console.error("Error retrieving avatar URL from AsyncStorage:", error);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        await uploadImageDirectly(selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Unable to select image. Please try again.');
    }
  };
  
  const uploadImageDirectly = async (imageUri: string) => {
    try {
      setUploadingImage(true);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Verify the image file exists
      const fileInfo = await FileSystem.getInfoAsync(imageUri, { size: true });
      
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }
      
      // Create a temporary file
      const tempDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const tempFilePath = `${tempDir}temp_avatar_${Date.now()}.jpg`;
      
      await FileSystem.copyAsync({
        from: imageUri,
        to: tempFilePath
      });
      
      console.log('Starting avatar upload with temp file:', tempFilePath);
      
      // Upload the image - this function now handles database update and AsyncStorage
      const result = await uploadAvatar(tempFilePath, user.id);
      
      // Type assertion for the result
      const uploadResult = result as { success: boolean, url?: string, error?: any };
      
      if (!uploadResult.success || !uploadResult.url) {
        throw uploadResult.error || new Error('Failed to upload image');
      }
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      console.log('Avatar upload successful, URL:', uploadResult.url);
      
      // Update avatar URL in state
      setAvatarUrl(uploadResult.url);
      
      // The uploadAvatar function now handles updating AsyncStorage and the database,
      // so we don't need to duplicate that functionality here
      
      // Refresh user data in context
      await refreshUser();
      
      console.log('Profile avatar updated successfully. Verifying state...');
      
      // Diagnostic check to verify avatar is accessible
      const storedAvatar = await AsyncStorage.getItem(`user_avatar_${user.id}`);
      console.log('Avatar in AsyncStorage:', storedAvatar);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
        
      if (userError) {
        console.error('Error verifying avatar URL in database:', userError);
      } else {
        console.log('Avatar in database:', userData?.avatar_url);
      }
      
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error in upload process:', error);
      Alert.alert('Error', `Failed to update profile picture: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const saveProfileChanges = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to update your profile');
        return;
      }
      
      // Create update object
      const updateData = {
        display_name: displayName,
        venmo_username: venmoUsername
      };
      
      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
      
      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
        return;
      }
      
      // Refresh user data in context
      await refreshUser();
      
      // Exit edit modes
      setIsEditingName(false);
      setIsEditingVenmo(false);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error in saveProfileChanges:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)}>
              <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              <ProfileAvatar 
                size={100}
                avatarUrl={avatarUrl}
                displayName={displayName}
                username={user?.email?.split('@')[0] || ''}
                userId={user?.id}
                isLoading={uploadingImage}
                showEditButton={true}
              />
            </TouchableOpacity>
            
            {/* Display Name - Editable */}
            {isEditingName ? (
              <View style={styles.editField}>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display Name"
                  placeholderTextColor="#888888"
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setIsEditingName(false)}>
                    <Ionicons name="close" size={22} color="#888888" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveProfileChanges}>
                    <Ionicons name="checkmark" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.displayNameContainer} 
                onPress={() => setIsEditingName(true)}
              >
                <Text style={styles.username}>
                  {displayName || user?.email?.split('@')[0] || 'Username'}
                </Text>
                <Ionicons name="pencil" size={16} color="#888888" />
              </TouchableOpacity>
            )}
            
            <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
            
            {/* Venmo Username - Editable */}
            {isEditingVenmo ? (
              <View style={styles.editField}>
                <TextInput
                  style={styles.input}
                  value={venmoUsername}
                  onChangeText={setVenmoUsername}
                  placeholder="Venmo Username"
                  placeholderTextColor="#888888"
                  autoFocus
                  autoCapitalize="none"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setIsEditingVenmo(false)}>
                    <Ionicons name="close" size={22} color="#888888" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveProfileChanges}>
                    <Ionicons name="checkmark" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.venmoContainer} 
                onPress={() => setIsEditingVenmo(true)}
              >
                <View style={styles.venmoRow}>
                  <Ionicons name="logo-venmo" size={18} color="#3D95CE" />
                  <Text style={styles.venmoText}>
                    {venmoUsername ? `@${venmoUsername}` : 'Add Venmo'}
                  </Text>
                  <Ionicons name="pencil" size={16} color="#888888" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => navigation.navigate('Dashboard' as never)}
            >
              <Text style={styles.statTitle}>Dashboard</Text>
              <Ionicons name="stats-chart" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => navigation.navigate('Leaderboard' as never)}
            >
              <Text style={styles.statTitle}>Leaderboard</Text>
              <Ionicons name="trophy" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('FriendsScreen' as never)}
            >
              <Ionicons name="people-outline" size={24} color="#FFFFFF" />
              <Text style={styles.menuText}>Friends</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
              <Text style={styles.menuText}>Payment Methods</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
  },
  email: {
    color: '#AAAAAA',
    fontSize: 16,
    marginBottom: 15,
  },
  venmoContainer: {
    marginTop: 5,
    marginBottom: 10,
  },
  venmoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  venmoText: {
    color: '#DDDDDD',
    fontSize: 16,
    marginLeft: 5,
    marginRight: 8,
  },
  editField: {
    width: '80%',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#333333',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 5,
    gap: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 20,
    width: '48%',
    alignItems: 'center',
  },
  statTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  signOutButton: {
    backgroundColor: '#333333',
    marginHorizontal: 20,
    marginBottom: 50,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen; 