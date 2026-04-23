import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: 'chrome',
    proxy: {
      '/generate':           'http://localhost:3000',
      '/generate-post':      'http://localhost:3000',
      '/health':             'http://localhost:3000',
      '/audience-targeting': 'http://localhost:3000',
      '/campaign-ideation':  'http://localhost:3000',
      '/custom-flow':        'http://localhost:3000',
      '/creator-studio':     'http://localhost:3000',
      '/send-invite':        'http://localhost:3000',
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
