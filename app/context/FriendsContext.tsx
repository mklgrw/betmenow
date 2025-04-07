import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

type Friend = {
  id: string;
  username: string;
  display_name?: string;
  avatarUrl?: string;
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
      
      // Get all friend relationships for the current user
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          users!friendships_friend_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id);

      if (friendshipsError) {
        console.error('Error fetching friends:', friendshipsError);
        return;
      }

      // Transform the data to match our Friend type
      const friendsList = friendships.map(friendship => ({
        id: friendship.friend_id,
        username: friendship.users.username,
        display_name: friendship.users.display_name,
        avatarUrl: friendship.users.avatar_url
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
    
    try {
      // Add friendship record
      const { error } = await supabase
        .from('friendships')
        .insert([
          { user_id: user.id, friend_id: friendId },
          { user_id: friendId, friend_id: user.id } // Reciprocal friendship
        ]);

      if (error) {
        console.error('Error adding friend:', error);
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
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

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