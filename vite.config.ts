import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'fonts/**/*.woff2',
      ],
      manifest: {
        name: 'EchoNet',
        short_name: 'EchoNet',
        description:
          'Offline acoustic alert relay. Phones pass messages using only sound.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,wasm,woff2}',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Versioned cache name
        cacheId: 'echonet-v1',
      },
    }),
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    host: true, // accessible on LAN for phone testing
    port: 5173,
  },
});
