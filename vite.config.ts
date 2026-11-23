import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      // PWA instalable. Sin modo offline: ventas, stock y correlativos dependen del servidor.
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'logo.png'],
        manifest: {
          name: 'Magazing · Inventario, compras y ventas',
          short_name: 'Magazing',
          description: 'Sistema de inventario, compras y ventas para pymes.',
          lang: 'es-PE',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#038577',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Solo los archivos de la app (JS, CSS, íconos). La API nunca se guarda en caché.
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
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
