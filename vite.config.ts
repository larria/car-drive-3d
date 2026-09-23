import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  base: '/car-drive-3d/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [VitePWA({
    strategies: 'generateSW',
    registerType: 'prompt',
    injectRegister: false,
    scope: '/car-drive-3d/',
    manifest: {
      id: '/car-drive-3d/',
      name: 'Larria的3d驾照考试练习场',
      short_name: 'LARRIA',
      description: '交互式 3D 驾照考试练习场，支持离线低速驾驶练习。非专业驾驶仿真。',
      lang: 'zh-CN',
      dir: 'ltr',
      start_url: '/car-drive-3d/',
      scope: '/car-drive-3d/',
      display: 'standalone',
      orientation: 'any',
      theme_color: '#2d493c',
      background_color: '#e8e7e3',
      categories: ['education', 'simulation'],
      icons: [192, 512].flatMap(size => [
        { src: `icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' },
        { src: `icons/maskable-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' },
      ]),
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css,ico,png,svg,woff,woff2,glb,gltf,bin,wasm}'],
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/\/(?:models|draco|assets|icons)\//],
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: true,
    },
    devOptions: { enabled: false },
  })],
});
