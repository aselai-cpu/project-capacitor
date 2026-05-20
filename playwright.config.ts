import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'cd backend && DATABASE_URL=postgresql://user:password@localhost:5433/capacitor npm run dev',
      port: 5000,
      reuseExistingServer: true,
      env: {
        DATABASE_URL: 'postgresql://user:password@localhost:5433/capacitor',
      },
    },
    {
      command: 'cd frontend && npm run dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
