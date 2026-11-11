import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/wrkt/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Prometheus lives at /wrkt/prometheus/ with its own service worker
        navigateFallbackDenylist: [/^\/wrkt\/prometheus/],
        // the font, so the app looks right offline too
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'WRKT',
        short_name: 'WRKT',
        description: 'Workouts, meals, streaks.',
        theme_color: '#0A090B',
        background_color: '#0A090B',
        display: 'standalone',
        start_url: '/wrkt/',
        scope: '/wrkt/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
