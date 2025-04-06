import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

// Calendar components imports
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Bet = {
  id: string;
  description: string;
  stake: number;
  dueDate: string;
};

const EditBetScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { bet } = route.params as { bet: Bet };
  
  const [description, setDescription] = useState(bet.description);
  const [stake, setStake] = useState(bet.stake.toString());
  const [dueDate, setDueDate] = useState(new Date(bet.dueDate));
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const handleSave = async () => {
    if (!description || !stake) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    if (isNaN(parseFloat(stake)) || parseFloat(stake) <= 0) {
      Alert.alert('Error', 'Please enter a valid stake amount');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update the bet in Supabase
      const { error } = await supabase
        .from('bets')
        .update({
          description,
          stake: parseFloat(stake),
          due_date: dueDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bet.id)
        .eq('creator_id', user?.id) // Ensure only creator can edit
        .eq('status', 'pending'); // Only pending bets can be edited
      
      if (error) {
        console.error('Error updating bet:', error);
        Alert.alert('Error', 'Failed to update bet. Please try again.');
        return;
      }
      
      Alert.alert(
        'Success',
        'Bet updated successfully',
        [{ text: 'OK', onPress: () => navigation.navigate('BetDetails', { betId: bet.id }) }]
      );
    } catch (error) {
      console.error('Unexpected error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Keep the time from the current dueDate
      const newDate = new Date(selectedDate);
      if (dueDate) {
        newDate.setHours(dueDate.getHours());
        newDate.setMinutes(dueDate.getMinutes());
      }
      setDueDate(newDate);
    }
  };
  
  const handleTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime && dueDate) {
      // Keep the date but update the time
      const newDate = new Date(dueDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setDueDate(newDate);
    }
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Bet</Text>
          <View style={{ width: 28 }} /> {/* Empty view for spacing */}
        </View>
        
        <ScrollView style={styles.content}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What's the bet?"
              placeholderTextColor="#777"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Stake Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="How much is on the line?"
              placeholderTextColor="#777"
              value={stake}
              onChangeText={setStake}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Due Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerText}>
                {formatDate(dueDate)}
              </Text>
              <Ionicons name="calendar-outline" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Due Time</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.datePickerText}>
                {formatTime(dueDate)}
              </Text>
              <Ionicons name="time-outline" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
        
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        
        {showTimePicker && (
          <DateTimePicker
            value={dueDate}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 15,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  datePickerButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  datePickerText: {
    color: 'white',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditBetScreen; 