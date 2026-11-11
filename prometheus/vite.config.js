import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/wrkt/prometheus/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'flame.png', 'foods.json'],
      manifest: {
        name: 'Prometheus',
        short_name: 'Prometheus',
        description: 'Mind, Body, Soul. One fire.',
        theme_color: '#ECE8E1',
        background_color: '#ECE8E1',
        display: 'standalone',
        start_url: '/wrkt/prometheus/',
        scope: '/wrkt/prometheus/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
