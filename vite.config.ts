import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/BonusLedger/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      scope: base,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'BonusLedger',
        short_name: 'BonusLedger',
        description: 'A private ledger for bank account promotions and bonuses.',
        scope: base,
        start_url: base,
        display: 'standalone',
        theme_color: '#f7f8fc',
        background_color: '#f7f8fc',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackAllowlist: [/^\/BonusLedger\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
