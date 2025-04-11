// Add any global setup code for Jest here

// Mock environment variables
jest.mock('react-native-dotenv', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Expo FileSystem
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  documentDirectory: 'file://document-directory/',
}));

// This is to silence the warnings about URL polyfills in jest environment
global.URL = require('url').URL;

// Add a dummy test to avoid "Your test suite must contain at least one test" error
describe('Test setup', () => {
  test('setupTests is working', () => {
    expect(true).toBe(true);
  });
}); 