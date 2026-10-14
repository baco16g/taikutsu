import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'site',
      'docs/.vitepress/dist',
      'docs/.vitepress/cache',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, prettierConfig],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // React Compiler対応チェック用のルール——このプロジェクトはコンパイラを
      // 導入しておらず、どちらのルールもこのコードベースの意図的な
      // パターン（GSAPを直接制御するためにhooks/props経由で渡すDOM ref、
      // 1つのuseMemo呼び出し内に閉じたローカルPRNG変数）を誤検知する。
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      // アロー省略記法のイベントハンドラ（`onClick={() => doThing()}`）は
      // 標準的なReactのイディオムであり、全箇所で波括弧を必須にしても
      // ここでは実際のミスを防げずノイズが増えるだけ。
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['vite.config.ts', 'docs/.vitepress/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, prettierConfig],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },
)
