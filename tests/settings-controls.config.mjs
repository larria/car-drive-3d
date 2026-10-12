import { defineConfig } from '@playwright/test';
import browserConfig from '../playwright.config.mjs';

export default defineConfig({
  ...browserConfig,
  testDir: '.',
  testMatch: 'settings-controls.spec.mjs',
});
