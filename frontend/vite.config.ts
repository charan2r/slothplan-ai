import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = { '/api': { target: env.BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy, strictPort: true },
    preview: { proxy, strictPort: true },
    test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.{ts,tsx}'], testTimeout: 15000 },
  }
})
