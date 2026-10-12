import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import browserConfig from '../playwright.config.mjs';

export default defineConfig({
  ...browserConfig,
  testDir: '.',
  testMatch: 'pwa.spec.mjs',
  use: {
    ...browserConfig.use,
    baseURL: process.env.E2E_URL || 'http://127.0.0.1:4178/car-drive-3d/',
  },
  webServer: process.env.E2E_URL ? undefined : {
    command: 'npm run preview -- --port 4178 --strictPort',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://127.0.0.1:4178/car-drive-3d/',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
