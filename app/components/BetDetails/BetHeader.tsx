import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type BetHeaderProps = {
  title: string;
  canDelete?: boolean;
  canCancel?: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
};

const BetHeader: React.FC<BetHeaderProps> = memo(({
  title,
  canDelete = false,
  canCancel = false,
  onBack,
  onDelete,
  onCancel
}) => {
  return (
    <View style={styles.header}>
      {/* Left side */}
      <View style={styles.sideContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* Title */}
      <Text style={styles.title}>{title}</Text>
      
      {/* Right side - maintain same width as left side for balance */}
      <View style={styles.sideContainer}>
        <View style={styles.actions}>
          {canCancel && onCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.actionButton}>
              <Ionicons name="close-circle-outline" size={24} color="white" />
            </TouchableOpacity>
          )}
          
          {canDelete && onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#121212',
  },
  sideContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
});

export default BetHeader; 