module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      isolatedModules: true,
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  setupFilesAfterEnv: ['./__tests__/setupTests.js'],
  moduleNameMapper: {
    // Map path aliases if you have any in your tsconfig.json
    '^@/(.*)$': '<rootDir>/$1',
    // Mock problematic modules
    'react-native-url-polyfill/.*': '<rootDir>/__tests__/mocks/url-polyfill.js',
    'react-native': '<rootDir>/__tests__/mocks/react-native.js',
    '@env': '<rootDir>/__tests__/mocks/env.js',
  },
  transformIgnorePatterns: [
    // Transform all files in node_modules except problematic ones
    "node_modules/(?!(@react-native|react-native|react-native-url-polyfill|@supabase/supabase-js|expo-file-system|@react-native-async-storage)/)"
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
      },
    },
  },
}; 