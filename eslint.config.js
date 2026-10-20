import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist', 'design'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
  },
  {
    files: ['tools/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Pages only show things: data comes through src/data/hooks.ts, UI from src/components/.
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/data/mock', '**/data/mock/**'], message: 'Pages get data only through src/data/hooks.ts.' },
            { group: ['**/auth', '**/auth/**'], message: 'Use useCurrentUser() from src/data/hooks.ts.' },
            { group: ['**/dev/**', '**/styles/**'], message: 'Pages use only components from src/components/.' },
          ],
        },
      ],
    },
  },
);
