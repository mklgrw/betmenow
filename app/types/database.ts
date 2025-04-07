export type BetStatus = 'pending' | 'completed' | 'cancelled';

export type DatabaseBet = {
  id: string;
  description: string;
  stake: number;
  created_at: string;
  status: BetStatus;
  creator_id: string;
  visibility: 'public' | 'private';
  outcome?: string | null;
  due_date: string;
  creator_user_id: string;
  creator_username: string;
  creator_display_name: string;
  creator_avatar_url: string | null;
};

export type DatabaseBetRecipient = {
  id: string;
  bet_id: string;
  user_id: string;
  created_at: string;
  description: string;
  stake: number;
  status: BetStatus;
  creator_id: string;
  visibility: 'public' | 'private';
  outcome?: string | null;
  due_date: string;
  creator_user_id: string;
  creator_username: string;
  creator_display_name: string;
  creator_avatar_url: string | null;
};

export type DatabaseBetBetween = DatabaseBetRecipient; 