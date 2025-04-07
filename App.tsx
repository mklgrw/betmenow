import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './app/context/AuthContext';
import { BetProvider } from './app/context/BetContext';
import { FriendsProvider } from './app/context/FriendsContext';
import AppNavigator from './app/navigation/AppNavigator';
import { ThemeProvider } from './app/context/ThemeContext';
import { ensureAvatarUrlColumn } from './app/services/supabase';

export default function App() {
  useEffect(() => {
    console.log('App initialized');
    
    // Initialize avatar_url column
    ensureAvatarUrlColumn()
      .catch(error => console.error('Error initializing avatar column:', error));
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FriendsProvider>
            <BetProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <AppNavigator />
              </NavigationContainer>
            </BetProvider>
          </FriendsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
} 