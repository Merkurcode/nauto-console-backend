module.exports = {
  rules: {
    // Allow 'any' type in queue system for Redis clients and generic sorting
    // as this matches the original queue system design
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow console statements for queue system debugging
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }]
  }
};