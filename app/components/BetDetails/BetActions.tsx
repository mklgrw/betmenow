import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Accept/Reject component
interface AcceptRejectProps {
  onAccept: () => void;
  onReject: () => void;
}

const AcceptReject: React.FC<AcceptRejectProps> = memo(({ onAccept, onReject }) => {
  return (
    <View style={styles.actionContainer}>
      <TouchableOpacity 
        style={styles.acceptButton}
        onPress={onAccept}
      >
        <Ionicons name="checkmark" size={20} color="white" />
        <Text style={styles.actionButtonText}>Accept Bet</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.rejectButton}
        onPress={onReject}
      >
        <Ionicons name="close" size={20} color="white" />
        <Text style={styles.actionButtonText}>Reject Bet</Text>
      </TouchableOpacity>
    </View>
  );
});

// Declare Outcome component
interface DeclareOutcomeProps {
  onDeclareWin: () => void;
  onDeclareLoss: () => void;
  loading: boolean;
}

const DeclareOutcome: React.FC<DeclareOutcomeProps> = memo(({ 
  onDeclareWin, 
  onDeclareLoss,
  loading 
}) => {
  return (
    <View style={styles.actionContainerVertical}>
      <Text style={styles.actionTitle}>Declare Outcome</Text>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.outcomeButton, styles.winButton]} 
          onPress={onDeclareWin}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>I Won</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.outcomeButton, styles.loseButton]} 
          onPress={onDeclareLoss}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>I Lost</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Main BetActions component
const BetActions = {
  AcceptReject,
  DeclareOutcome
};

const styles = StyleSheet.create({
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  actionContainerVertical: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  winButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  loseButton: {
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  outcomeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
});

export default BetActions; 