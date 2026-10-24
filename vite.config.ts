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
        name: 'AirGap.fm Offline Acoustic Transceiver',
        short_name: 'AirGap.fm',
        description:
          'Offline acoustic alert relay. Phones pass emergency messages across air gaps using sound waves.',
        theme_color: '#f5f3ec',
        background_color: '#f5f3ec',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,wasm,woff2}',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Versioned cache name
        cacheId: 'airgap-fm-v2',
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
