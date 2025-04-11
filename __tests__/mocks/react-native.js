// Mock for React Native
module.exports = {
  Alert: {
    alert: jest.fn()
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios)
  },
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(() => Promise.resolve(true))
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    hairlineWidth: 1,
  },
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
    })),
  },
}; 