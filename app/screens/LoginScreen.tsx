import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn } = useAuth();
  const theme = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    console.log('Login attempt with:', email);
    setLoading(true);
    
    try {
      // Using email for authentication with Supabase
      const { error } = await signIn(email, password);
      
      if (error) {
        console.error('Login error:', error);
        Alert.alert('Error', error.message || 'Failed to login');
      } else {
        console.log('Login successful');
      }
    } catch (error: any) {
      console.error('Login exception:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Implement Google login
    Alert.alert('Info', 'Google login not implemented yet');
  };

  const handleAppleLogin = () => {
    // Implement Apple login
    Alert.alert('Info', 'Apple login not implemented yet');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>BetMeNow</Text>
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.socialContainer}>
        <Text style={styles.orText}>OR</Text>
        
        <View style={styles.socialButtonsRow}>
          <TouchableOpacity 
            style={styles.socialButton} 
            onPress={handleGoogleLogin}
          >
            <Ionicons name="logo-google" size={24} color="white" />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.socialButton} 
            onPress={handleAppleLogin}
          >
            <Ionicons name="logo-apple" size={24} color="white" />
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerLink}>Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#333333',
    borderRadius: 8,
    color: '#FFFFFF',
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loginButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  socialContainer: {
    marginBottom: 30,
  },
  orText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialButton: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6B46C1',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.48,
  },
  socialButtonText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    color: '#FFFFFF',
  },
  registerLink: {
    color: '#6B46C1',
    fontWeight: 'bold',
  },
});

export default LoginScreen; 