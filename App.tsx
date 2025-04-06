import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './app/context/AuthContext';
import { BetProvider } from './app/context/BetContext';
import AppNavigator from './app/navigation/AppNavigator';
import { ThemeProvider } from './app/context/ThemeContext';

export default function App() {
  useEffect(() => {
    console.log('App initialized');
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <BetProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </BetProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
} 