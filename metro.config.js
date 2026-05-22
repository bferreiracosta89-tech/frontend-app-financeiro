const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Evita erro "Cannot use import.meta outside a module" no web em alguns pacotes ESM.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
