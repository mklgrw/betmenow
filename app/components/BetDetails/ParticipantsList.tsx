import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bet, BetRecipient } from '../../types/betTypes';

type ParticipantsListProps = {
  bet: Bet;
  recipients: BetRecipient[];
  isCreator: boolean;
  onReminder: (recipientId: string) => void;
  onUserPress: (userId: string) => void;
};

const ParticipantsList: React.FC<ParticipantsListProps> = ({
  bet,
  recipients,
  isCreator,
  onReminder,
  onUserPress
}) => {
  // Helper function to capitalize first letter
  const capitalizeFirstLetter = useCallback((string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }, []);

  // Memoized empty state view
  const emptyStateView = useMemo(() => (
    <View style={styles.noRecipientContainer}>
      <Text style={styles.noRecipientText}>No participants for this bet</Text>
    </View>
  ), []);

  // Handle reminder with useCallback to prevent recreation
  const handleReminder = useCallback((recipientId: string) => (e: any) => {
    e.stopPropagation(); // Prevent navigating to profile when clicking remind
    onReminder(recipientId);
  }, [onReminder]);

  // Handle user press with useCallback
  const handleUserPress = useCallback((userId: string) => () => {
    onUserPress(userId);
  }, [onUserPress]);

  // Early return for empty state
  if (!recipients || recipients.length === 0) {
    return emptyStateView;
  }

  // Render creator/challenger - memoized to avoid recreation
  const renderCreator = useCallback(() => {
    if (!bet) return null;
    
    // Get creator data from the first recipient's creator property
    const creatorData = recipients[0]?.creator;
    
    // Get creator name with better fallbacks
    const creatorName = creatorData?.display_name || 
                       creatorData?.username || 
                       `Challenger ${bet.creator_id?.slice(0, 8) || ''}`;
    
    // Get avatar initial
    const creatorInitial = (creatorData?.display_name?.charAt(0) || 
                           creatorData?.username?.charAt(0) || 
                           creatorName.charAt(0) || 'C').toUpperCase();
    
    return (
      <TouchableOpacity 
        key="creator" 
        style={styles.participantItem}
        onPress={handleUserPress(bet.creator_id)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, styles.challengerAvatar]}>
          <Text style={styles.avatarText}>{creatorInitial}</Text>
        </View>
        <View style={styles.recipientInfo}>
          <View style={styles.recipientNameContainer}>
            <Text style={styles.recipientName}>{creatorName}</Text>
            <Text style={[styles.participantLabel, styles.challengerLabel]}>Challenger</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: "#2196F3" }]}>
            <Text style={styles.statusText}>Creator</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [bet, recipients, handleUserPress]);

  // Render a recipient - with useCallback for optimization
  const renderRecipient = useCallback((item: BetRecipient) => {
    if (item.recipient_id === bet.creator_id) return null;
    
    // Format the recipient status for display
    const statusText = capitalizeFirstLetter(item.status || 'pending');
    
    // Get the correct color based on status
    let statusColor = "#FFC107"; // Default yellow for pending
    if (item.status === 'in_progress') statusColor = "#2196F3";
    else if (item.status === 'won') statusColor = "#4CAF50";
    else if (item.status === 'lost') statusColor = "#FF5722";
    else if (item.status === 'rejected') statusColor = "#F44336";
    
    // Get the username from users data with better fallbacks
    const displayName = item.profiles?.display_name || item.profiles?.username;
    const username = displayName || `User ${item.recipient_id?.slice(0, 8) || ''}`;
    
    // Get first initial for avatar
    const firstInitial = (displayName?.charAt(0) || username.charAt(0) || 'U').toUpperCase();
    
    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.participantItem}
        onPress={item.recipient_id ? handleUserPress(item.recipient_id) : undefined}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, styles.recipientAvatarStyle]}>
          <Text style={styles.avatarText}>{firstInitial}</Text>
        </View>
        <View style={styles.recipientInfo}>
          <View style={styles.recipientNameContainer}>
            <Text style={styles.recipientName}>{username}</Text>
            <Text style={[styles.participantLabel, styles.recipientLabel]}>Recipient</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        {bet.creator_id === bet.creator_id && item.status === 'pending' && (
          <View style={styles.reminderContainer}>
            <TouchableOpacity
              style={styles.reminderButton}
              onPress={item.recipient_id ? handleReminder(item.recipient_id) : undefined}
            >
              <Ionicons name="notifications-outline" size={20} color="white" />
              <Text style={styles.reminderText}>Remind</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [bet, capitalizeFirstLetter, handleUserPress, handleReminder]);

  // Memoized list of recipients
  const recipientItems = useMemo(() => {
    return recipients.map(renderRecipient);
  }, [recipients, renderRecipient]);

  return (
    <View style={styles.recipientsList}>
      {renderCreator()}
      {recipientItems}
    </View>
  );
};

const styles = StyleSheet.create({
  recipientsList: {
    marginBottom: 16,
  },
  noRecipientContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  noRecipientText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  challengerAvatar: {
    backgroundColor: '#2196F3',
  },
  recipientAvatarStyle: {
    backgroundColor: '#6B46C1',
  },
  recipientInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipientNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  participantLabel: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  challengerLabel: {
    color: '#E0F7FA',
  },
  recipientLabel: {
    color: '#F3E5F5',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  reminderButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default memo(ParticipantsList); 