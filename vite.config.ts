import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // En desarrollo, /api se reenvía al backend .NET y así no hace falta CORS.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://localhost:5261',
          changeOrigin: true,
        },
      },
    },
  }
})
