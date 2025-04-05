import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

type MainStackParamList = {
  Home: undefined;
  IssueBet: undefined;
  SelectFriends: undefined;
};

type IssueBetScreenNavigationProp = StackNavigationProp<MainStackParamList, 'IssueBet'>;

const IssueBetScreen = () => {
  const [description, setDescription] = useState('');
  const [stake, setStake] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recipientType, setRecipientType] = useState<'select' | 'anyone'>('select');
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation<IssueBetScreenNavigationProp>();
  const theme = useTheme();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleIssueBet = async () => {
    if (!description || !stake) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Create bet in Supabase
      const { data, error } = await supabase.from('bets').insert({
        description,
        stake: parseFloat(stake),
        due_date: dueDate.toISOString(),
        visibility: isPublic ? 'public' : 'private',
        status: 'pending',
        // Add other fields like creator_id and recipient_ids
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to create bet');
        return;
      }

      Alert.alert('Success', 'Bet created successfully');
      navigation.navigate('Home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFriends = () => {
    // Navigate to friends selection screen
    navigation.navigate('SelectFriends');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Issue a Bet</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="hand" size={24} color="#AAAAAA" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="What's the bet?"
              placeholderTextColor="#AAAAAA"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="cash-outline" size={24} color="#AAAAAA" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="How much $$$ is on the line?"
              placeholderTextColor="#AAAAAA"
              value={stake}
              onChangeText={setStake}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.recipientContainer}>
            <Text style={styles.sectionTitle}>Who's the recipient?</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.buttonOption,
                  recipientType === 'select' && styles.buttonOptionActive,
                ]}
                onPress={() => setRecipientType('select')}
              >
                <Text style={styles.buttonText}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.buttonOption,
                  recipientType === 'anyone' && styles.buttonOptionActive,
                ]}
                onPress={() => setRecipientType('anyone')}
              >
                <Text style={styles.buttonText}>Anyone</Text>
              </TouchableOpacity>
            </View>

            {recipientType === 'select' && (
              <TouchableOpacity 
                style={styles.selectFriendsButton}
                onPress={handleSelectFriends}
              >
                <Text style={styles.selectFriendsText}>Select Friends</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.dateContainer}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={24} color="#AAAAAA" style={styles.inputIcon} />
            <Text style={styles.dateText}>
              {dueDate ? formatDate(dueDate) : "When does the bet end?"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          <View style={styles.visibilityContainer}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <TouchableOpacity 
              style={styles.visibilitySelector}
              onPress={() => setIsPublic(!isPublic)}
            >
              <Ionicons name="globe" size={20} color="#FFFFFF" />
              <Text style={styles.visibilityText}>
                {isPublic ? 'Public' : 'Private'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.issueButton}
            onPress={handleIssueBet}
            disabled={loading}
          >
            <Text style={styles.issueButtonText}>
              {loading ? 'Creating...' : 'Issue'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingTop: 50,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 30,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 10,
    marginBottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    padding: 15,
    fontSize: 16,
  },
  recipientContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  buttonOption: {
    backgroundColor: '#333333',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 25,
    marginRight: 10,
  },
  buttonOptionActive: {
    backgroundColor: '#6B46C1',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  selectFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
  },
  selectFriendsText: {
    color: '#FFFFFF',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 10,
    marginBottom: 20,
    padding: 15,
  },
  dateText: {
    color: '#FFFFFF',
    marginLeft: 10,
  },
  visibilityContainer: {
    marginBottom: 30,
  },
  visibilitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
  },
  visibilityText: {
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 10,
  },
  issueButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  issueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default IssueBetScreen; 