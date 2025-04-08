import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bet } from '../../types/betTypes';

type BetDetailsCardProps = {
  bet: Bet;
  status: string;
  hasWonOrLostRecipient: boolean;
};

const BetDetailsCard: React.FC<BetDetailsCardProps> = ({
  bet,
  status,
  hasWonOrLostRecipient
}) => {
  // Helper function to format dates
  const formatDate = (dateString: string) => {
    if (!dateString) return "No date set";
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  
  // Helper function to format dates - memoized to prevent recalculation
  const formattedDueDate = useMemo(() => {
    return formatDate(bet.due_date);
  }, [bet.due_date]);
  
  const formattedCreatedDate = useMemo(() => {
    return formatDate(bet.created_at);
  }, [bet.created_at]);
  
  // Memoized computed status for display
  const displayStatus = useMemo(() => {
    return hasWonOrLostRecipient ? 'Completed' : capitalizeFirstLetter(status);
  }, [hasWonOrLostRecipient, status, capitalizeFirstLetter]);
  
  // Memoized status badge style
  const statusBadgeStyle = useMemo(() => {
    return [
      styles.statusBadge,
      hasWonOrLostRecipient ? styles.completedBadge :
      status === 'pending' ? styles.pendingBadge : 
      status === 'in_progress' ? styles.inProgressBadge :
      status === 'cancelled' ? styles.rejectedBadge :
      styles.completedBadge
    ];
  }, [hasWonOrLostRecipient, status]);
  
  return (
    <View style={styles.betCard}>
      <Text style={styles.betDescription}>{bet.description}</Text>
      
      <View style={styles.betDetail}>
        <Text style={styles.detailLabel}>Status:</Text>
        <View style={statusBadgeStyle}>
          <Text style={styles.statusText}>{displayStatus}</Text>
        </View>
      </View>
      
      <View style={styles.betDetail}>
        <Text style={styles.detailLabel}>Amount:</Text>
        <Text style={styles.detailValue}>${bet.stake}</Text>
      </View>
      
      <View style={styles.betDetail}>
        <Text style={styles.detailLabel}>Due Date:</Text>
        <Text style={styles.detailValue}>{formattedDueDate}</Text>
      </View>
      
      <View style={styles.betDetail}>
        <Text style={styles.detailLabel}>Created:</Text>
        <Text style={styles.detailValue}>{formattedCreatedDate}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  betCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  betDescription: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  betDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  detailValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFC107',
  },
  inProgressBadge: {
    backgroundColor: '#2196F3',
  },
  wonBadge: {
    backgroundColor: '#4CAF50',
  },
  lostBadge: {
    backgroundColor: '#FF5722',
  },
  rejectedBadge: {
    backgroundColor: '#F44336',
  },
  completedBadge: {
    backgroundColor: '#9C27B0',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default memo(BetDetailsCard); 