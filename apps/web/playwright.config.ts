import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';

/**
 * E2E tests run against a running stack (API :4000 with sandbox providers + web :3000).
 * They never touch real payment or social providers.
 */
const chromium = process.env.PW_CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'off',
    actionTimeout: 15_000,
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(chromium ? { launchOptions: { executablePath: chromium } } : {}) } },
  ],
});
