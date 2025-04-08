import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type PendingOutcomeViewProps = {
  pendingOutcome: string | null;
  isCreator: boolean;
  onConfirm: () => void;
  onReject: () => void;
  loading: boolean;
};

const PendingOutcomeView: React.FC<PendingOutcomeViewProps> = ({
  pendingOutcome,
  isCreator,
  onConfirm,
  onReject,
  loading
}) => {
  if (!pendingOutcome) return null;

  // Memoize the title text based on the outcome and creator status
  const titleText = useMemo(() => {
    if (pendingOutcome === 'won') {
      return isCreator 
        ? 'Your opponent claims they won this bet. Do you agree?' 
        : 'Your opponent claims they won this bet';
    } else {
      return isCreator
        ? 'Your opponent claims they lost this bet. Do you agree?'
        : 'Your opponent claims they lost this bet';
    }
  }, [pendingOutcome, isCreator]);

  // Memoize the confirm button text
  const confirmButtonText = useMemo(() => {
    if (pendingOutcome === 'won') {
      return isCreator ? 'Confirm (They Won)' : 'Confirm (I Lost)';
    } else {
      return isCreator ? 'Confirm (They Lost)' : 'Confirm (I Won)';
    }
  }, [pendingOutcome, isCreator]);

  return (
    <View style={styles.pendingOutcomeContainer}>
      <Text style={styles.pendingOutcomeTitle}>
        {titleText}
      </Text>
      
      <View style={styles.pendingOutcomeButtons}>
        <TouchableOpacity 
          style={[styles.outcomeButton, styles.confirmButton]} 
          onPress={onConfirm}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>
            {confirmButtonText}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.outcomeButton, styles.disputeButton]} 
          onPress={onReject}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Dispute</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pendingOutcomeContainer: {
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#555555',
  },
  pendingOutcomeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  pendingOutcomeButtons: {
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
  confirmButton: {
    backgroundColor: '#4caf50',
  },
  disputeButton: {
    backgroundColor: '#F44336',
    marginLeft: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default memo(PendingOutcomeView); 