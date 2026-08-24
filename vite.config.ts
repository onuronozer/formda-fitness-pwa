import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'

const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react'
          if (/[\\/]node_modules[\\/](dexie|dexie-react-hooks|zustand|zod|date-fns)[\\/]/.test(id)) return 'vendor-data'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('node_modules/@firebase/firestore')) return 'firebase-firestore'
          if (id.includes('node_modules/@firebase/auth')) return 'firebase-auth'
          if (id.includes('node_modules/@firebase')) return 'firebase-core'
          if (id.includes('node_modules/firebase')) return 'firebase-entry'
          return 'vendor-misc'
        },
      },
    },
  },
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Formda - Fitness ve Sağlık Takibi',
        short_name: 'Formda',
        description: 'Kişisel, local-first fitness ve sağlık takip uygulaması.',
        lang: 'tr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#101414',
        theme_color: '#101414',
        orientation: 'portrait-primary',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
        globIgnores: ['assets/firebase-*.js'],
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    exclude: ['firebase-tests/**', 'node_modules/**', 'dist/**'],
    clearMocks: true
  }
})
