import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/beemo/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'audio/*.wav'],
      manifest: {
        id: '/beemo/',
        name: 'Beemo Pocket',
        short_name: 'Beemo',
        description: 'An expressive pocket robot and a tiny falling-block game.',
        start_url: '/beemo/',
        scope: '/beemo/',
        display: 'standalone',
        background_color: '#65b7b0',
        theme_color: '#65b7b0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'beemo-pocket',
        globPatterns: ['**/*.{js,css,html,png,svg,wav,webmanifest}'],
        navigateFallback: '/beemo/index.html',
        navigateFallbackAllowlist: [/^\/beemo(?:\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
