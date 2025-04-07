import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase, createBetRecipientsTable, createTableWithSQL, addBetRecipients } from '../services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type MainStackParamList = {
  Home: { activeTab?: 'in_progress' | 'pending' | 'lost' | 'won' };
  IssueBet: { preselectedFriendIds?: string[] };
  SelectFriends: { onFriendsSelected: (friendIds: string[]) => void };
};

type IssueBetScreenNavigationProp = StackNavigationProp<MainStackParamList, 'IssueBet'>;

const IssueBetScreen = () => {
  const [description, setDescription] = useState('');
  const [stake, setStake] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [recipientType, setRecipientType] = useState<'select' | 'anyone'>('select');
  const [loading, setLoading] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('AM');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');

  const navigation = useNavigation<IssueBetScreenNavigationProp>();
  const route = useRoute();
  const theme = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    const params = route.params as { preselectedFriendIds?: string[] } | undefined;
    if (params?.preselectedFriendIds && params.preselectedFriendIds.length > 0) {
      console.log('Preselected friends received:', params.preselectedFriendIds);
      setSelectedFriendIds(params.preselectedFriendIds);
      
      const fetchFriendDetails = async () => {
        try {
          const friendId = params.preselectedFriendIds[0];
          if (!friendId) return;
          
          const { data, error } = await supabase
            .from('users')
            .select('display_name, username')
            .eq('id', friendId)
            .single();
            
          if (error) {
            console.error('Error fetching friend details:', error);
          } else if (data) {
            setSelectedRecipientName(data.display_name || data.username || 'User');
          }
        } catch (e) {
          console.error('Exception fetching friend details:', e);
        }
      };
      
      fetchFriendDetails();
    }
  }, [route.params]);

  useEffect(() => {
    const fetchSelectedFriendDetails = async () => {
      if (selectedFriendIds.length === 0) {
        setSelectedFriends([]);
        setSelectedRecipientName('');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, display_name, email')
          .in('id', selectedFriendIds);
        
        if (error) {
          console.error('Error fetching selected friend details:', error);
          return;
        }
        
        setSelectedFriends(data || []);
        
        if (data && data.length > 0) {
          const friend = data[0];
          setSelectedRecipientName(friend.display_name || friend.username || friend.email?.split('@')[0] || 'User');
        }
      } catch (e) {
        console.error('Exception fetching friend details:', e);
      }
    };
    
    fetchSelectedFriendDetails();
  }, [selectedFriendIds]);

  useEffect(() => {
    // Check if bet_recipients table exists and create it if not
    const initializeTables = async () => {
      console.log('Checking if bet_recipients table exists...');
      const { data, error } = await createBetRecipientsTable();
      console.log('Bet recipients table check result:', data, error);
    };
    
    initializeTables();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateTime = (date: Date) => {
    return `${formatDate(date)} at ${formatTime(date)}`;
  };

  const handleIssueBet = async () => {
    if (!description || !stake || !dueDate) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (selectedFriendIds.length === 0) {
      Alert.alert('Error', 'Please select at least one friend to bet with');
      return;
    }

    try {
      setLoading(true);
      console.log('Creating bet with:', { description, stake, dueDate, recipientType });

      // Basic bet data - matching the actual database schema
      const betData = {
        description,
        stake: parseFloat(stake),
        due_date: dueDate.toISOString(),
        status: 'pending',
        creator_id: user?.id,
        visibility: isPublic ? 'public' : 'private'
      };

      console.log('Bet data to insert:', betData);

      // Create the bet
      const { data, error } = await supabase
        .from('bets')
        .insert([betData])
        .select();

      if (error) {
        console.error('Error creating bet:', error);
        Alert.alert('Error', 'Failed to create bet: ' + error.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No data returned after bet creation');
        Alert.alert('Error', 'Failed to create bet: No data returned');
        setLoading(false);
        return;
      }

      const newBetId = data[0].id;
      console.log(`Created bet with ID: ${newBetId}`);
      
      // Now add the recipients separately if we have selected friends
      if (recipientType === 'select' && selectedFriendIds.length > 0) {
        console.log(`Adding ${selectedFriendIds.length} recipients to bet ${newBetId}`);
        
        // Add recipients using the imported function
        const { success, error } = await addBetRecipients(newBetId, selectedFriendIds);
        
        if (!success) {
          console.error('Error adding recipients:', error);
          Alert.alert('Warning', 'Bet created, but failed to add some recipients.');
        } else {
          console.log('Recipients added successfully');
        }
      }

      Alert.alert('Success', 'Bet created successfully');
      
      // Small delay before navigation to make sure the database has time to process
      setTimeout(() => {
        console.log("⏱️ Navigating to Home with refresh param:", Date.now());
        // Navigate back to Home with simpler parameters
        navigation.navigate('Home', { 
          activeTab: 'pending'  // Tell Home screen to switch to pending tab
        });
      }, 500);
    } catch (e) {
      console.error('Exception in bet creation:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectRecipient = () => {
    navigation.navigate('SelectFriends', {
      onFriendsSelected: (friendIds: string[]) => {
        setSelectedFriendIds(friendIds);
      }
    });
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(dueDate);
    newDate.setFullYear(selectedYear);
    newDate.setMonth(selectedMonth);
    newDate.setDate(day);
    setDueDate(newDate);
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(dueDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setDueDate(newDate);
    }
  };

  const renderCalendarHeader = () => {
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    
    return (
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => {
          if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(selectedYear - 1);
          } else {
            setSelectedMonth(selectedMonth - 1);
          }
        }}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.calendarMonthYear}>
          {months[selectedMonth]}
          <Text style={styles.calendarYear}>{"\n"}{selectedYear}</Text>
        </Text>
        <TouchableOpacity onPress={() => {
          if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(selectedYear + 1);
          } else {
            setSelectedMonth(selectedMonth + 1);
          }
        }}>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCalendarDays = () => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    return (
      <View style={styles.calendarDaysRow}>
        {days.map((day, index) => (
          <View key={index} style={styles.calendarDayCell}>
            <Text style={[
              styles.calendarDayText, 
              index === 0 || index === 6 ? styles.calendarWeekendText : {}
            ]}>
              {day}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCalendarDates = () => {
    // Get the first day of the month
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    // Get the last day of the month
    const lastDate = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    // Get the last day of the previous month
    const prevMonthLastDate = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Create an array for all calendar cells
    const calendarDates = [];
    
    // Previous month dates
    for (let i = 0; i < firstDay; i++) {
      calendarDates.push({
        day: prevMonthLastDate - firstDay + i + 1,
        currentMonth: false,
        prevMonth: true,
      });
    }
    
    // Current month dates
    for (let i = 1; i <= lastDate; i++) {
      calendarDates.push({
        day: i,
        currentMonth: true,
        prevMonth: false,
      });
    }
    
    // Next month dates to fill the last row
    const remainingCells = 7 - (calendarDates.length % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        calendarDates.push({
          day: i,
          currentMonth: false,
          prevMonth: false,
        });
      }
    }
    
    // Current date
    const currentDate = new Date();
    const isToday = (date: number) => 
      currentDate.getDate() === date && 
      currentDate.getMonth() === selectedMonth && 
      currentDate.getFullYear() === selectedYear;

    const isSelectedDate = (date: number) =>
      dueDate.getDate() === date &&
      dueDate.getMonth() === selectedMonth &&
      dueDate.getFullYear() === selectedYear;
    
    // Render weeks
    const weeks = [];
    for (let i = 0; i < calendarDates.length; i += 7) {
      const week = calendarDates.slice(i, i + 7);
      weeks.push(
        <View key={i} style={styles.calendarWeekRow}>
          {week.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.calendarDateCell,
                item.currentMonth ? styles.currentMonthCell : styles.otherMonthCell,
                isToday(item.day) && item.currentMonth ? styles.todayCell : {},
                isSelectedDate(item.day) && item.currentMonth ? styles.selectedDateCell : {},
              ]}
              onPress={() => item.currentMonth ? handleDateSelect(item.day) : null}
              disabled={!item.currentMonth}
            >
              <Text style={[
                styles.calendarDateText,
                !item.currentMonth ? styles.otherMonthText : {},
                isToday(item.day) && item.currentMonth ? styles.todayText : {},
                isSelectedDate(item.day) && item.currentMonth ? styles.selectedDateText : {},
                (index === 0 || index === 6) && item.currentMonth ? styles.calendarWeekendText : {},
              ]}>
                {item.day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    
    return <View style={styles.calendarDatesContainer}>{weeks}</View>;
  };

  const renderHourSelector = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    
    return (
      <View style={styles.timeSelector}>
        <Text style={styles.timeSelectorLabel}>Choose Time</Text>
        <View style={styles.timeSelectorContainer}>
          {/* Hour picker */}
          <ScrollView 
            style={styles.timePickerScrollView}
            contentContainerStyle={styles.timePickerScrollContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={50}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              const y = event.nativeEvent.contentOffset.y;
              const index = Math.round(y / 50);
              const hour = hours[index % hours.length];
              setSelectedHour(hour);
            }}
          >
            {/* Add empty items at top for padding */}
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            
            {hours.map((hour) => (
              <TouchableOpacity 
                key={`hour-${hour}`} 
                style={styles.timePickerItemWrapper}
                onPress={() => setSelectedHour(hour)}
              >
                <Text style={[
                  styles.timePickerItem,
                  selectedHour === hour ? styles.selectedTimeItem : styles.unselectedTimeItem
                ]}>
                  {hour.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Add empty items at bottom for padding */}
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
          </ScrollView>
          
          <Text style={styles.timePickerSeparator}>:</Text>
          
          {/* Minute picker */}
          <ScrollView 
            style={styles.timePickerScrollView}
            contentContainerStyle={styles.timePickerScrollContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={50}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              const y = event.nativeEvent.contentOffset.y;
              const index = Math.round(y / 50);
              const minute = minutes[index % minutes.length];
              setSelectedMinute(minute);
            }}
          >
            {/* Add empty items at top for padding */}
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            
            {minutes.map((minute) => (
              <TouchableOpacity 
                key={`minute-${minute}`} 
                style={styles.timePickerItemWrapper}
                onPress={() => setSelectedMinute(minute)}
              >
                <Text style={[
                  styles.timePickerItem,
                  selectedMinute === minute ? styles.selectedTimeItem : styles.unselectedTimeItem
                ]}>
                  {minute.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Add empty items at bottom for padding */}
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
            <View style={styles.timePickerItemWrapper}>
              <Text style={[styles.timePickerItem, styles.unselectedTimeItem]}>{''}</Text>
            </View>
          </ScrollView>
          
          {/* AM/PM selector */}
          <View style={styles.amPmSelectorContainer}>
            <TouchableOpacity 
              style={[
                styles.amPmButton,
                selectedAmPm === 'AM' ? styles.activeAmPmButton : {}
              ]}
              onPress={() => setSelectedAmPm('AM')}
            >
              <Text style={[
                styles.amPmButtonText,
                selectedAmPm === 'AM' ? styles.activeAmPmButtonText : {}
              ]}>
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.amPmButton,
                selectedAmPm === 'PM' ? styles.activeAmPmButton : {}
              ]}
              onPress={() => setSelectedAmPm('PM')}
            >
              <Text style={[
                styles.amPmButtonText,
                selectedAmPm === 'PM' ? styles.activeAmPmButtonText : {}
              ]}>
                PM
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Selection indicator */}
        <View style={styles.timePickerSelectionIndicator} />
      </View>
    );
  };

  const renderDatePicker = () => (
    <Modal
      transparent={true}
      visible={showDatePicker}
      animationType="fade"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.calendarContainer}>
          {renderCalendarHeader()}
          {renderCalendarDays()}
          {renderCalendarDates()}
          <View style={styles.calendarFooter}>
            <TouchableOpacity 
              style={styles.calendarFooterButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.calendarFooterButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.calendarFooterButton, styles.calendarChooseButton]}
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(true);
              }}
            >
              <Text style={styles.calendarChooseButtonText}>Choose Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTimePicker = () => (
    Platform.OS === 'ios' ? (
      <Modal
        transparent={true}
        visible={showTimePicker}
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerContainer}>
            <Text style={styles.timeSelectorLabel}>Choose Time</Text>
            <View style={styles.iosPickerContainer}>
              <DateTimePicker
                value={dueDate}
                mode="time"
                display="spinner"
                onChange={handleTimeSelect}
                style={{ width: 250 }}
                textColor="white"
                themeVariant="dark"
              />
            </View>
            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.timePickerButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ) : (
      showTimePicker && (
        <DateTimePicker
          value={dueDate}
          mode="time"
          display="default"
          onChange={handleTimeSelect}
        />
      )
    )
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issue Bet</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.visibilityCard} onPress={() => setIsPublic(!isPublic)}>
          <View style={styles.visibilityLeftContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="globe-outline" size={22} color="white" />
            </View>
            <Text style={styles.visibilityText}>Public</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#777" />
        </TouchableOpacity>

        <View style={styles.formCard}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bet</Text>
            <View style={styles.inputContainer}>
              <View style={styles.emojiContainer}>
                <Text style={styles.inputEmoji}>🤝</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="What's the bet?"
                placeholderTextColor="#777"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Stake</Text>
            <View style={styles.inputContainer}>
              <View style={styles.emojiContainer}>
                <Text style={styles.inputEmoji}>💰</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="How much $$$ is on the line?"
                placeholderTextColor="#777"
                value={stake}
                onChangeText={setStake}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recipient</Text>
            <TouchableOpacity
              style={styles.selectFriendsButton}
              onPress={selectRecipient}
            >
              <View style={styles.selectFriendsLeftContent}>
                <View style={styles.iconContainer}>
                  <Ionicons name="person-outline" size={20} color="white" />
                </View>
                <Text style={styles.selectFriendsText}>
                  {selectedRecipientName ? selectedRecipientName : 'Select a recipient for your bet'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#777" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Due Date</Text>
            <TouchableOpacity 
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.emojiContainer}>
                <Text style={styles.inputEmoji}>📅</Text>
              </View>
              <Text style={styles.dateText}>
                {dueDate ? formatDateTime(dueDate) : "When does the bet end?"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {renderDatePicker()}
      {renderTimePicker()}

      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          style={styles.issueButton}
          onPress={handleIssueBet}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.issueButtonText}>Issue Bet</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  visibilityLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 70, 193, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  visibilityText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#292929',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputEmoji: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    padding: 4,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    padding: 4,
  },
  selectFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#292929',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectFriendsLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectFriendsText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  buttonWrapper: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 10,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  issueButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  issueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: '90%',
    backgroundColor: '#242424',
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  calendarMonthYear: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  calendarYear: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'normal',
  },
  calendarDaysRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  calendarDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarDayText: {
    color: 'white',
    fontSize: 14,
  },
  calendarWeekendText: {
    color: '#FF6B6B',
  },
  calendarDatesContainer: {
    paddingVertical: 10,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  calendarDateCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    borderRadius: 5,
  },
  currentMonthCell: {
    backgroundColor: '#333',
  },
  otherMonthCell: {
    backgroundColor: '#222',
  },
  todayCell: {
    backgroundColor: '#444',
  },
  selectedDateCell: {
    backgroundColor: '#6B46C1',
  },
  calendarDateText: {
    color: 'white',
    fontSize: 16,
  },
  otherMonthText: {
    color: '#666',
  },
  todayText: {
    fontWeight: 'bold',
  },
  selectedDateText: {
    fontWeight: 'bold',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  calendarFooterButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  calendarFooterButtonText: {
    color: '#6B46C1',
    fontSize: 16,
  },
  calendarChooseButton: {
    backgroundColor: '#6B46C1',
  },
  calendarChooseButtonText: {
    color: 'white',
    fontSize: 16,
  },
  timePickerContainer: {
    width: '90%',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  timeSelector: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  timeSelectorLabel: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  timeSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
    position: 'relative',
    width: '100%',
  },
  timePickerScrollView: {
    height: 150,
    width: 60,
  },
  timePickerScrollContent: {
    paddingVertical: 25,
  },
  timePickerItemWrapper: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerItem: {
    fontSize: 24,
    width: '100%',
    textAlign: 'center',
  },
  selectedTimeItem: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  unselectedTimeItem: {
    color: '#999',
  },
  timePickerSeparator: {
    color: 'white',
    fontSize: 30,
    marginHorizontal: 10,
  },
  amPmSelectorContainer: {
    height: 150,
    justifyContent: 'center',
    marginLeft: 20,
  },
  amPmButton: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    width: 60,
    alignItems: 'center',
  },
  activeAmPmButton: {
    backgroundColor: '#6B46C1',
  },
  amPmButtonText: {
    color: '#999',
    fontSize: 20,
  },
  activeAmPmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timePickerSelectionIndicator: {
    position: 'absolute',
    height: 50,
    left: 70,
    right: 70,
    backgroundColor: 'rgba(107, 70, 193, 0.2)',
    borderRadius: 8,
    top: 85,
    zIndex: -1,
  },
  timePickerButton: {
    backgroundColor: '#6B46C1',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
  },
  timePickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iosPickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    marginBottom: 20,
  },
});

export default IssueBetScreen; 