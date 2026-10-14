import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages はこのアプリを https://baco16g.github.io/taikutsu/ から配信する。
// 本番ビルドと vite preview のみサブパス base が必要（vite dev は root のまま）。
const basePath = '/taikutsu/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? basePath : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
}))
