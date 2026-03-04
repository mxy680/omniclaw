const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pnpm: enable symlink resolution so Metro follows pnpm's virtual store links
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
