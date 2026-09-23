import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'pwa.spec.mjs',
  timeout: 60000,
  use: { channel: 'chrome', headless: true, baseURL: 'http://127.0.0.1:4178/car-drive-3d/' },
  webServer: { command: 'npm run preview -- --port 4178', url: 'http://127.0.0.1:4178/car-drive-3d/', reuseExistingServer: true },
});
