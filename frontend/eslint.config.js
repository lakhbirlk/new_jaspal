// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Screens fetch their data in an effect and track loading state; the
      // React Compiler rule treats those guarded setters as cascading renders.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
