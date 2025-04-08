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

export interface Bet {
  id: string;
  description: string;
  stake: number;
  status: string;
  due_date?: string | null;
  created_at: string;
  creator_id: string;
  creator?: Profile;
  bet_recipients?: BetRecipient[];
  recipients?: BetRecipient[];
  is_recipient?: boolean;
  has_activity?: boolean;
}

export type BetRecipient = {
  id: string;
  bet_id: string;
  recipient_id?: string;
  user_id?: string;
  status: string;
  created_at?: string;
  display_name?: string;
  profiles?: Profile | null;
  pending_outcome?: string | null;
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
};

export type RecipientUpdate = {
  status?: string;
  pending_outcome?: string | null;
  outcome_claimed_by?: string | null;
  outcome_claimed_at?: string | null;
};

export type BetActionParams = {
  betId?: string;
  recipientId: string | null;
  recipients: BetRecipient[];
  isCreator: boolean;
  opponentPendingOutcome: string | null;
  navigation: any;
  user: any;
  fetchBetDetails: () => Promise<void>;
  fetchBets: () => Promise<void>;
}; 