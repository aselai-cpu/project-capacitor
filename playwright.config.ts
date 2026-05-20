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
        // Pass through whichever LLM key is set in the environment
        ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY && { GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY }),
        ...(process.env.OPENAI_API_KEY && { OPENAI_API_KEY: process.env.OPENAI_API_KEY }),
        ...(process.env.ANTHROPIC_API_KEY && { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
        ...(process.env.MOONSHOT_API_KEY && { MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY }),
        ...(process.env.LLM_PROVIDER && { LLM_PROVIDER: process.env.LLM_PROVIDER }),
        ...(process.env.LLM_MODEL && { LLM_MODEL: process.env.LLM_MODEL }),
      },
    },
    {
      command: 'cd frontend && npm run dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
