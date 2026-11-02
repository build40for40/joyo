import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { fakeApi } from './dev/fake-api'

// https://vite.dev/config/
export default defineConfig({
  base: '/joyo/',
  build: {
    outDir: 'dist/joyo',
  },
  server: {
    proxy: {
      '/joyo/api': 'http://localhost:8787',
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    fakeApi(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
