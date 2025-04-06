import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  
  const [displayName, setDisplayName] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchProfileData();
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
      }
    } catch (error) {
      console.error('Error in fetchProfileData:', error);
    }
  };
  
  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to update your profile');
        return;
      }
      
      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          venmo_username: venmoUsername,
        })
        .eq('id', user.id);
      
      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
        return;
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