import { SupabaseClient } from '@supabase/supabase-js';

export type RootStackParamList = {
  Home: undefined;
  BetDetails: { betId: string; refresh?: number };
  EditBet: { bet: Bet };
  Dashboard: { userId: string };
};

export type Profile = {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  venmo_username?: string;
};

// Define literal types for bet statuses
export type BetStatus = 
  | 'pending'      // waiting for recipients to accept
  | 'in_progress'  // bet is active and ongoing
  | 'completed'    // bet has been resolved
  | 'cancelled';   // bet was cancelled

// Define literal types for recipient statuses
export type RecipientStatus = 
  | 'pending'      // recipient hasn't accepted/rejected yet
  | 'in_progress'  // recipient has accepted, bet is active
  | 'rejected'     // recipient rejected the bet
  | 'creator'      // special status for bet creator
  | 'won'          // recipient won the bet
  | 'lost';        // recipient lost the bet

// Define literal types for pending outcomes
export type PendingOutcome = 'won' | 'lost' | null;

export interface Bet {
  id: string;
  description: string;
  stake: number;
  status: BetStatus;
  due_date?: string | null;
  created_at: string;
  creator_id: string;
  creator?: Profile;
  bet_recipients?: BetRecipient[];
  recipients?: BetRecipient[];
  is_recipient?: boolean;
  has_activity?: boolean;
}

export interface BetRecipient {
  id: string;
  bet_id: string;
  recipient_id?: string;
  user_id?: string;
  status: RecipientStatus;
  created_at?: string;
  display_name?: string;
  profiles?: Profile | null;
  profile?: Profile | null;
  pending_outcome?: PendingOutcome;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
  recipient?: {
    id: string;
    username: string;
    display_name: string;
  };
  // Keep user for backward compatibility 
  user?: {
    id: string;
    username: string;
    display_name: string;
  };
  // Add creator property to store creator profile info
  creator?: {
    id: string;
    username?: string;
    display_name?: string;
  };
}

export type RecipientUpdate = {
  status?: RecipientStatus;
  pending_outcome?: PendingOutcome;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
};

export type BetActionParams = {
  betId?: string;
  recipientId: string | null;
  recipients: BetRecipient[];
  isCreator: boolean;
  opponentPendingOutcome: PendingOutcome;
  navigation: any;
  user: any;
  fetchBetDetails: () => Promise<void>;
  fetchBets: () => Promise<void>;
}; 