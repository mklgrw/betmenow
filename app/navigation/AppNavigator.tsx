import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainTabNavigator from './MainTabNavigator';
import SelectFriendsScreen from '../screens/SelectFriendsScreen';
import BetDetailsScreen from '../screens/BetDetailsScreen';
import EditBetScreen from '../screens/EditBetScreen';

const Stack = createStackNavigator();

// Auth stack for unauthenticated users
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Main stack for authenticated users
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabNavigator} />
    <Stack.Screen name="SelectFriends" component={SelectFriendsScreen} />
    <Stack.Screen name="BetDetails" component={BetDetailsScreen} />
    <Stack.Screen name="EditBet" component={EditBetScreen} />
  </Stack.Navigator>
);

// App navigator that conditionally renders stacks based on auth status
const AppNavigator = () => {
  const { user } = useAuth();

  return user ? <MainStack /> : <AuthStack />;
};

export default AppNavigator; 