import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileAvatarProps {
  size?: number;
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  userId?: string | null;
  showEditButton?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * ProfileAvatar - A reusable component for displaying user avatars consistently
 * 
 * It will show:
 * 1. An image if avatarUrl is provided
 * 2. A text-based avatar with initials as fallback
 * 3. Optional edit button for profile screens
 */
const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  size = 80,
  avatarUrl,
  displayName,
  username,
  userId,
  showEditButton = false,
  onPress,
  isLoading = false,
  backgroundColor = '#8B5CF6', // Default to purple
  textColor = '#FFFFFF',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Log for debugging
  useEffect(() => {
    console.log('ProfileAvatar props:', { 
      avatarUrl, 
      displayName, 
      username, 
      userId,
      size,
      showEditButton
    });
  }, [avatarUrl, displayName, username, userId, size, showEditButton]);

  // Get first letter for text avatar
  const getInitial = (): string => {
    if (displayName && displayName.length > 0) {
      return displayName.charAt(0).toUpperCase();
    }
    if (username && username.length > 0) {
      return username.charAt(0).toUpperCase();
    }
    if (userId && userId.length > 0) {
      return userId.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const Container = onPress ? TouchableOpacity : View;
  
  // Determine what to render in the avatar
  const renderAvatarContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color={textColor} />;
    }
    
    if (avatarUrl && !imageError) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onLoad={() => {
            console.log('Avatar image loaded successfully:', avatarUrl);
            setImageLoaded(true);
          }}
          onError={(e) => {
            console.error('Avatar image failed to load:', e.nativeEvent.error);
            setImageError(true);
          }}
          resizeMode="cover"
        />
      );
    }
    
    // Fallback to text avatar
    return (
      <Text
        style={[
          styles.initialText,
          {
            fontSize: size * 0.45,
            color: textColor,
          },
        ]}
      >
        {getInitial()}
      </Text>
    );
  };

  return (
    <Container
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor,
        },
      ]}
      onPress={onPress}
      disabled={isLoading || !onPress}
    >
      {renderAvatarContent()}

      {showEditButton && (
        <View
          style={[
            styles.editButton,
            {
              bottom: -5,
              right: -5,
              width: size * 0.35,
              height: size * 0.35,
              borderRadius: (size * 0.35) / 2,
            },
          ]}
        >
          <Ionicons name="camera" size={size * 0.2} color="#FFFFFF" />
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', 
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
  },
  initialText: {
    fontWeight: 'bold',
  },
  editButton: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
});

export default ProfileAvatar; 