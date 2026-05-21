import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        // Bilingual: longer Hebrew name as primary, English short_name as fallback
        // for OSes that truncate. iOS Safari's home-screen label uses short_name.
        name: 'טוטו מונדיאל 26',
        short_name: 'Toto WC26',
        description: 'משחק ניחושים חברתי למונדיאל 2026 — בקבוצות פרטיות עם החברים.',
        theme_color: '#0a1f14',
        background_color: '#0a1f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'he',
        dir: 'rtl',
        categories: ['sports', 'games', 'social'],
        // SVG icon is universally supported by modern PWA installers (Android
        // Chrome 79+, iOS Safari 15+, Edge, desktop Chrome). The 'any' purpose
        // means it works for the launcher icon; we also declare a maskable
        // variant so Android can crop it into its adaptive shape.
        icons: [
          {
            src: '/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
