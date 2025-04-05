module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@components': './app/components',
            '@screens': './app/screens',
            '@navigation': './app/navigation',
            '@assets': './app/assets',
            '@hooks': './app/hooks',
            '@utils': './app/utils',
            '@context': './app/context',
            '@services': './app/services',
            '@constants': './app/constants'
          }
        }
      ],
      ['module:react-native-dotenv']
    ]
  };
}; 