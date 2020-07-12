module.exports = {
    env: {
        browser: true,
        es2020: true,
    },
    extends: [
        'airbnb-base',
    ],
    parserOptions: {
        ecmaVersion: 11,
        sourceType: 'module',
    },
    rules: {
        'no-console': 'off',
        'comma-dangle': 'off',
        'consistent-return': 'off',
        semi: 'off',
        'no-underscore-dangle': 'off',
        indent: ['warn', 4],
        'no-plusplus': 'off',
        'import/no-extraneous-dependencies': ['error', { devDependencies: false, optionalDependencies: false, peerDependencies: false }],
    },
};
