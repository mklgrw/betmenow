import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { useBets } from '../context/BetContext';

// Components
import BetHeader from '../components/BetDetails/BetHeader';
import BetDetailsCard from '../components/BetDetails/BetDetailsCard';
import ParticipantsList from '../components/BetDetails/ParticipantsList';
import BetActions from '../components/BetDetails/BetActions';
import PendingOutcomeView from '../components/BetDetails/PendingOutcomeView';

// Hooks
import { useBetDetails } from '../hooks/useBetDetails';
import { useBetActions } from '../hooks/useBetActions';

// Types
import { Bet, BetRecipient, RootStackParamList, BetStatus, RecipientStatus, PendingOutcome } from '../types/betTypes';

type BetDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const BetDetailsScreen = () => {
  const navigation = useNavigation<BetDetailsScreenNavigationProp>();
  const route = useRoute();
  const { user } = useAuth();
  const { fetchBets } = useBets();
  
  // Extract and validate betId
  const params = route.params as { betId?: string; refresh?: number };
  const betId = params?.betId;
  
  // Use custom hook to manage bet details
  const {
    bet,
    recipients,
    loading,
    recipientStatus,
    recipientId,
    isCreator,
    opponentPendingOutcome,
    pendingOutcome,
    hasPendingOutcome,
    fetchBetDetails,
    hasWonOrLostRecipient,
    effectiveBetStatus
  } = useBetDetails(betId, params?.refresh);
  
  // Use custom hook for bet actions
  const {
    handleAcceptBet,
    handleRejectBet,
    handleDeclareWin,
    handleDeclareLoss,
    handleConfirmOutcome,
    handleRejectOutcome,
    handleCancelBet,
    confirmDeleteBet,
    sendReminder
  } = useBetActions({
    betId, 
    recipientId,
    recipients,
    isCreator, 
    opponentPendingOutcome,
    navigation,
    user,
    fetchBetDetails,
    fetchBets
          });
          
  // Calculate action permissions - memoized to avoid recalculations
  const actionPermissions = useMemo((): {
    canDeleteBet: boolean;
    canEditBet: boolean;
    canAcceptRejectBet: boolean;
    canDeclareOutcome: boolean;
    canCancelBet: boolean;
    canConfirmOutcome: boolean;
  } => {
    // Check if any opponent (including creator) has a pending win claim
    const opponentHasPendingWin = recipients.some(r => 
            r.recipient_id !== user?.id && 
      r.pending_outcome === 'won'
    );
    
    // Check if the bet itself is still in its initial pending state (not yet accepted)
    const betRequiresInitialAcceptance = bet?.status === 'pending' && 
                                        recipients.some(r => r.recipient_id === user?.id && r.status === 'pending');
    
    // Check if any outcome is pending confirmation
    const hasOutcomePending = recipients.some(r => r.status === 'pending_outcome');
    
    return {
      canDeleteBet: isCreator && bet?.status === 'pending',
      canEditBet: isCreator && bet?.status === 'pending',
      canAcceptRejectBet: !isCreator && 
                          betRequiresInitialAcceptance && 
                          !pendingOutcome && 
                          effectiveBetStatus !== 'in_progress',
      canDeclareOutcome: effectiveBetStatus === 'in_progress' && 
                        (recipientStatus === 'in_progress' || recipientStatus === 'creator') &&
                        !hasOutcomePending,
      canCancelBet: isCreator && effectiveBetStatus === 'in_progress',
      canConfirmOutcome: (!!opponentPendingOutcome || 
                          recipients.some(r => r.recipient_id !== user?.id && r.status === 'pending_outcome')) && 
                          recipientStatus !== 'pending_outcome' &&
                          effectiveBetStatus !== 'completed',
    };
  }, [isCreator, bet?.status, recipientStatus, effectiveBetStatus, opponentPendingOutcome, pendingOutcome, recipients, user?.id]);
  
  // Navigation handlers with useCallback to prevent recreations
  const handleNavigateBack = useCallback((): void => {
        navigation.goBack();
  }, [navigation]);
  
  const handleNavigateToUser = useCallback((userId: string): void => {
    navigation.navigate('Dashboard', { userId });
  }, [navigation]);
  
  const handleNavigateToEditBet = useCallback((): void => {
          if (bet) {
      navigation.navigate('EditBet', { bet });
    }
  }, [navigation, bet]);
      
  // Loading and error states
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
      </View>
    );
  }

  if (!bet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Bet not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleNavigateBack}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check for pending status (either invitation pending or outcome pending)
  const isPending = recipients.some(r => 
    r.recipient_id === user?.id && 
    (r.status === 'pending' || r.status === 'pending_outcome')
  );

  return (
    <SafeAreaView style={styles.container}>
      <BetHeader 
        title="Bet Details"
        canDelete={actionPermissions.canDeleteBet}
        canCancel={actionPermissions.canCancelBet}
        onBack={handleNavigateBack}
        onDelete={confirmDeleteBet}
        onCancel={handleCancelBet}
      />

      <ScrollView style={styles.content}>
        <BetDetailsCard 
          bet={bet}
          status={effectiveBetStatus}
          hasWonOrLostRecipient={hasWonOrLostRecipient}
        />

        <ParticipantsList 
          bet={bet}
          recipients={recipients}
          isCreator={isCreator}
          onReminder={sendReminder}
          onUserPress={handleNavigateToUser}
        />
        
        {actionPermissions.canAcceptRejectBet && (
          <BetActions.AcceptReject
            onAccept={handleAcceptBet}
            onReject={handleRejectBet}
          />
        )}

        {actionPermissions.canDeclareOutcome && !pendingOutcome && !opponentPendingOutcome && (
          <BetActions.DeclareOutcome
            onDeclareWin={handleDeclareWin}
            onDeclareLoss={handleDeclareLoss}
            loading={loading}
          />
        )}

        {actionPermissions.canConfirmOutcome && effectiveBetStatus !== 'completed' && bet?.status !== 'completed' && (
          <>
            {/* Find any opponent with a pending win claim (including creator) */}
            {recipients.some(r => r.recipient_id !== user?.id && r.pending_outcome === 'won') ? (
              <PendingOutcomeView
                pendingOutcome={'won'} // Opponent claimed victory
                isCreator={isCreator}
                onConfirm={handleConfirmOutcome}
                onReject={handleRejectOutcome}
                loading={loading}
              />
            ) : opponentPendingOutcome ? (
              <PendingOutcomeView
                pendingOutcome={opponentPendingOutcome}
                isCreator={isCreator}
                onConfirm={handleConfirmOutcome}
                onReject={handleRejectOutcome}
                loading={loading}
              />
            ) : null}
          </>
        )}

        {/* Show pending outcomes based on status and pending_outcome field */}
        {pendingOutcome && effectiveBetStatus !== 'completed' && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              {pendingOutcome === 'won' 
                ? 'You claimed victory. Waiting for confirmation...' 
                : 'You claimed a loss. Waiting for confirmation...'}
            </Text>
          </View>
        )}
        
        {/* Display status for users with pending_outcome status */}
        {recipientStatus === 'pending_outcome' && !pendingOutcome && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              Waiting for outcome confirmation...
            </Text>
          </View>
        )}
        
        {/* Show waiting message for opponents still in initial pending state */}
        {recipients.some(r => 
          r.recipient_id !== user?.id && 
          r.status === 'pending' && 
          !r.pending_outcome
        ) && effectiveBetStatus !== 'completed' && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              Waiting for opponent to accept the bet...
            </Text>
          </View>
        )}
        
        {/* Show waiting message for opponents with pending outcomes */}
        {recipients.some(r => 
          r.recipient_id !== user?.id && 
          r.status === 'pending_outcome' && 
          !pendingOutcome
        ) && effectiveBetStatus !== 'completed' && (
          <View style={styles.pendingOutcomeContainer}>
            <Text style={styles.pendingOutcomeTitle}>
              Waiting for outcome to be confirmed...
            </Text>
          </View>
        )}

        {actionPermissions.canEditBet && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleNavigateToEditBet}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.editButtonText}>Edit Bet</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Keeping only the directly used styles in this component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#6B46C1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
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
});

export default BetDetailsScreen; 