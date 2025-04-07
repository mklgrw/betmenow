import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

type Friend = {
  id: string;
  username: string;
  display_name?: string;
  avatarUrl?: string;
};

type FriendshipData = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type FriendsContextType = {
  friends: Friend[];
  isFriend: (userId: string) => boolean;
  addFriend: (userId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  refreshFriends: () => Promise<void>;
  loading: boolean;
};

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refreshFriends = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // First get the friend IDs
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);

      if (friendshipsError) {
        console.error('Error fetching friendships:', friendshipsError);
        return;
      }

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      // Then get the friend details
      const friendIds = friendships.map(f => f.friend_id);
      const { data: friendData, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', friendIds)
        .returns<FriendshipData[]>();

      if (error) {
        console.error('Error fetching friends:', error);
        return;
      }

      if (!friendData) {
        setFriends([]);
        return;
      }

      // Transform the data to match our Friend type
      const friendsList = friendData.map(friend => ({
        id: friend.id,
        username: friend.username || '',
        display_name: friend.display_name || undefined,
        avatarUrl: friend.avatar_url || undefined
      }));

      setFriends(friendsList);
    } catch (error) {
      console.error('Error in refreshFriends:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFriend = (userId: string) => {
    return friends.some(friend => friend.id === userId);
  };

  const addFriend = async (friendId: string) => {
    if (!user) return;
    if (friendId === user.id) {
      console.error('Cannot add yourself as a friend');
      return;
    }
    
    try {
      // Add friendship record - let the RLS policy handle the permission
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId
        });

      if (error) {
        if (error.code === '23505') { // Unique violation error code
          console.log('Friendship already exists');
        } else {
          console.error('Error adding friend:', error);
        }
        return;
      }

      await refreshFriends();
    } catch (error) {
      console.error('Error in addFriend:', error);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    
    try {
      // Remove friendship records in both directions
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`);

      if (error) {
        console.error('Error removing friend:', error);
        return;
      }

      await refreshFriends();
    } catch (error) {
      console.error('Error in removeFriend:', error);
    }
  };

  useEffect(() => {
    if (user) {
      refreshFriends();
    }
  }, [user]);

  return (
    <FriendsContext.Provider value={{
      friends,
      isFriend,
      addFriend,
      removeFriend,
      refreshFriends,
      loading
    }}>
      {children}
    </FriendsContext.Provider>
  );
}; 