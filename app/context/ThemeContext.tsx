import React, { createContext, useContext, ReactNode } from 'react';

// Define theme colors based on the dark theme in specs
export const theme = {
  colors: {
    primary: '#6B46C1',
    background: '#000000',
    card: '#333333',
    text: '#FFFFFF',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FFC107',
    inactive: '#888888',
  },
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
    xl: 24,
  },
};

type ThemeContextType = typeof theme;

const ThemeContext = createContext<ThemeContextType>(theme);

export const useTheme = () => useContext(ThemeContext);

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}; 