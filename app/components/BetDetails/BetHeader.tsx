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

const BetHeader: React.FC<BetHeaderProps> = ({
  title,
  canDelete = false,
  canCancel = false,
  onBack,
  onDelete,
  onCancel
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.actions}>
        {canCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.actionButton}>
            <Ionicons name="close-circle-outline" size={24} color="white" />
          </TouchableOpacity>
        )}
        
        {canDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    backgroundColor: '#121212',
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
  },
  actionButton: {
    padding: 8,
  },
});

export default memo(BetHeader); 