import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.mjs',
  timeout: 60000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    baseURL: process.env.E2E_URL || 'http://127.0.0.1:5173/car-drive-3d/',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_URL ? undefined : {
    command: 'npm run dev -- --port 5173 --strictPort',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:5173/car-drive-3d/',
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: 'list',
});
