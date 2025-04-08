import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bet, BetRecipient, Profile } from '../../types/betTypes';
import ProfileAvatar from '../ProfileAvatar';
import { getAvatarUrl } from '../../services/supabase';

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
  // State to store resolved avatar URLs
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState<string | null>(null);
  const [recipientAvatarUrls, setRecipientAvatarUrls] = useState<Record<string, string | null>>({});

  // Load creator avatar when bet changes
  useEffect(() => {
    if (bet?.creator_id) {
      getAvatarUrl(bet.creator_id).then(url => {
        if (url) setCreatorAvatarUrl(url);
      });
    }
  }, [bet?.creator_id]);

  // Load recipient avatars when recipients change
  useEffect(() => {
    if (recipients && recipients.length > 0) {
      const loadAvatars = async () => {
        const avatarPromises = recipients.map(async recipient => {
          if (recipient.recipient_id) {
            const url = await getAvatarUrl(recipient.recipient_id);
            return { id: recipient.recipient_id, url };
          }
          return { id: '', url: null };
        });

        const results = await Promise.all(avatarPromises);
        const urlMap: Record<string, string | null> = {};
        results.forEach(result => {
          if (result.id) urlMap[result.id] = result.url;
        });

        setRecipientAvatarUrls(urlMap);
      };

      loadAvatars();
    }
  }, [recipients]);

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = useCallback((string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }, []);

  // Helper function to get consistent user display name
  const getUserDisplayName = useCallback((
    profile?: Profile | null, 
    userId?: string
  ): string => {
    if (profile?.display_name) return profile.display_name;
    if (profile?.username) return profile.username;
    return userId ? `User ${userId.slice(0, 8)}` : 'Unknown User';
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
    
    // Get consistent creator name
    const creatorName = getUserDisplayName(bet.creator, bet.creator_id);
    
    // Use resolved avatar URL from state if available, otherwise fall back to the profile
    const avatarUrl = creatorAvatarUrl || bet.creator?.avatar_url;
    
    return (
      <TouchableOpacity 
        key="creator" 
        style={styles.participantItem}
        onPress={handleUserPress(bet.creator_id)}
        activeOpacity={0.7}
      >
        <ProfileAvatar
          size={40}
          avatarUrl={avatarUrl}
          displayName={bet.creator?.display_name}
          username={bet.creator?.username}
          userId={bet.creator_id}
          backgroundColor="#2196F3"
        />
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
  }, [bet, creatorAvatarUrl, handleUserPress, getUserDisplayName]);

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
    
    // Get consistent display name using preferred 'profile' field
    const username = getUserDisplayName(item.profile || item.profiles, item.recipient_id);
    
    // Use resolved avatar URL from state if available, otherwise fall back to the profile
    const avatarUrl = item.recipient_id ? 
      recipientAvatarUrls[item.recipient_id] || item.profile?.avatar_url || item.profiles?.avatar_url :
      null;
    
    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.participantItem}
        onPress={item.recipient_id ? handleUserPress(item.recipient_id) : undefined}
        activeOpacity={0.7}
      >
        <ProfileAvatar
          size={40}
          avatarUrl={avatarUrl}
          displayName={item.profile?.display_name || item.profiles?.display_name}
          username={item.profile?.username || item.profiles?.username}
          userId={item.recipient_id}
          backgroundColor="#6B46C1"
        />
        <View style={styles.recipientInfo}>
          <View style={styles.recipientNameContainer}>
            <Text style={styles.recipientName}>{username}</Text>
            <Text style={[styles.participantLabel, styles.recipientLabel]}>Recipient</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        {isCreator && item.status === 'pending' && (
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
  }, [bet, capitalizeFirstLetter, handleUserPress, handleReminder, isCreator, getUserDisplayName, recipientAvatarUrls]);

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
    paddingHorizontal: 4,
  },
  recipientInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 12,
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