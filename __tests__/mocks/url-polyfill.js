// Mock for react-native-url-polyfill
module.exports = {
  __esModule: true,
  default: {},
  URL: global.URL || class URL {},
  URLSearchParams: global.URLSearchParams || class URLSearchParams {}
}; 