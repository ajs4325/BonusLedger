import { defineConfig, devices } from '@playwright/test'

const origin = 'http://127.0.0.1:4175'
const baseURL = `${origin}/BonusLedger/`

export default defineConfig({
  testDir: './browser',
  testMatch: '*.browser.ts',
  use: { baseURL },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: baseURL,
  },
})
