import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/generate':           'http://localhost:3000',
      '/health':             'http://localhost:3000',
      '/audience-targeting': 'http://localhost:3000',
      '/campaign-ideation':  'http://localhost:3000',
      '/custom-flow':        'http://localhost:3000',
      '/creator-studio':     'http://localhost:3000',
      '/send-invite':        'http://localhost:3000',
      // ── Grok fallback proxy ───────────────────────────────────────────────
      // All frontend Grok calls are routed through this backend endpoint.
      // Reason: xAI (api.x.ai) blocks direct browser requests with CORS errors.
      // The backend makes the actual fetch server-side where CORS doesn't apply.
      '/ai-generate':        'http://localhost:3000',
    }
  }
})
