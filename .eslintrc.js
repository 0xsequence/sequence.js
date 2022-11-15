const { off } = require("process")

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },

  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'prettier'
  ],

  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-this-alias': 'off',

    'import/no-unresolved': 'off',
    'import/no-default-export': 2,
    'import/no-named-as-default-member': 'off',
    'import/export': 'off'


    // 'import/order': [
    //   'warn',
    //   {
    //     'groups': ['builtin', 'external', 'parent', 'sibling', 'index'],
    //     'alphabetize': {
    //       'order': 'asc', /* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */
    //       'caseInsensitive': true /* ignore case. Options: [true, false] */
    //     }
    //   },
    // ]

  }
}
