const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// pnpm: enable symlink resolution so Metro follows pnpm's virtual store links
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
