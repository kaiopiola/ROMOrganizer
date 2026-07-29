import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/out/**', '**/release/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Sintaxe que emite código quebra o type stripping do Node, e com ele a
      // possibilidade de rodar o core e o CLI sem passo de build.
      '@typescript-eslint/parameter-properties': 'error',
      '@typescript-eslint/no-namespace': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Use um union type ou objeto `as const`.' },
      ],
    },
  },
  prettier,
)
