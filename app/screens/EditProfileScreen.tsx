import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase, uploadAvatar } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  
  const [displayName, setDisplayName] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  useEffect(() => {
    fetchProfileData();
    
    // Request permission for image library
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library permissions to upload a profile picture.');
      }
    })();
  }, []);
  
  const fetchProfileData = async () => {
    try {
      if (!user) return;
      
      // Get current profile data
      const { data, error } = await supabase
        .from('users')
        .select('display_name, venmo_username')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (data) {
        setDisplayName(data.display_name || '');
        setVenmoUsername(data.venmo_username || '');
        
        // Load avatar URL from AsyncStorage
        const storedAvatarUrl = await AsyncStorage.getItem(`user_avatar_${user.id}`);
        if (storedAvatarUrl) {
          setAvatarUrl(storedAvatarUrl);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfileData:', error);
    }
  };
  
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: true, // Get EXIF data to help with debugging
      });
      
      console.log('Image picker result:', JSON.stringify({
        canceled: result.canceled,
        assets: result.assets ? 
          result.assets.map(asset => ({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            type: asset.type,
            fileName: asset.fileName
          })) : []
      }));
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('Selected image URI:', selectedAsset.uri);
        console.log('Image dimensions:', selectedAsset.width, 'x', selectedAsset.height);
        
        // Try to access the file to verify it exists
        try {
          const fileInfo = await FileSystem.getInfoAsync(selectedAsset.uri, { size: true });
          console.log('File exists:', fileInfo.exists, 'Size:', fileInfo.exists ? (fileInfo as any).size || 'unknown' : 'unknown');
          
          if (!fileInfo.exists) {
            Alert.alert('Error', 'The selected image file does not exist');
            return;
          }
          
          if (fileInfo.exists && (fileInfo as any).size && (fileInfo as any).size === 0) {
            Alert.alert('Error', 'The selected image file is empty');
            return;
          }
        } catch (fileError) {
          console.error('Error checking file:', fileError);
        }
        
        // Continue with upload - using direct upload without compression
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
      
      console.log('Starting avatar upload with URI:', imageUri);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Verify the image file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(imageUri, { size: true });
      console.log('File info before upload:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }
      
      if ((fileInfo as any).size === 0) {
        throw new Error('Image file is empty (0 bytes)');
      }
      
      // Create a new copy of the image to ensure it's accessible
      const tempDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const tempFilePath = `${tempDir}temp_avatar_${Date.now()}.jpg`;
      
      await FileSystem.copyAsync({
        from: imageUri,
        to: tempFilePath
      });
      
      console.log('Created temp file at:', tempFilePath);
      
      // Check the temp file
      const tempFileInfo = await FileSystem.getInfoAsync(tempFilePath, { size: true });
      console.log('Temp file info:', tempFileInfo);
      
      if ((tempFileInfo as any).size === 0) {
        throw new Error('Temp image file is empty (0 bytes)');
      }
      
      // Upload the image
      console.log('Uploading avatar from temp file');
      const result = await uploadAvatar(tempFilePath, user.id);
      
      // Type assertion for the result
      const uploadResult = result as { success: boolean, url?: string, error?: any };
      
      if (!uploadResult.success || !uploadResult.url) {
        console.error('Upload failed:', uploadResult.error);
        throw uploadResult.error || new Error('Failed to upload image');
      }
      
      console.log('Upload successful, URL:', uploadResult.url);
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      // Update avatar URL in state
      setAvatarUrl(uploadResult.url);
      
      // Store URL in AsyncStorage for persistence
      await AsyncStorage.setItem(`user_avatar_${user.id}`, uploadResult.url);
      
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error in upload process:', error);
      Alert.alert('Error', `Failed to update profile picture: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to update your profile');
        return;
      }
      
      // Create an update object with only the fields we know exist in the database
      const updateData = {
        display_name: displayName,
        venmo_username: venmoUsername
        // avatar_url is intentionally excluded as it may not exist in the database
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
      
      // Save avatar URL to AsyncStorage if it exists
      if (avatarUrl && user.id) {
        await AsyncStorage.setItem(`user_avatar_${user.id}`, avatarUrl);
      }
      
      // Refresh user data in context
      await refreshUser();
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <View style={styles.avatarUploadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : avatarUrl ? (
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(displayName || user?.email || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editIconContainer}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.uploadText}>Tap to upload profile picture</Text>
          </View>
          
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                placeholderTextColor="#888888"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Venmo Username</Text>
              <TextInput
                style={styles.input}
                value={venmoUsername}
                onChangeText={setVenmoUsername}
                placeholder="Enter your Venmo username"
                placeholderTextColor="#888888"
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                This will be used to streamline payments when you lose a bet
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'relative',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUploadingContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107, 70, 193, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#6B46C1',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  uploadText: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 8,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
  },
  helperText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen; 