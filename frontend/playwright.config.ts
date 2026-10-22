import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const backend = fileURLToPath(new URL('../backend/', import.meta.url))
const python = join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  timeout: 45000, expect: { timeout: 10000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: [
    { command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8011`, cwd: backend, url: 'http://127.0.0.1:8011/api/health', env: { DATABASE_PATH: 'data/e2e.db', GEMMA_API_KEY: '', ALLOW_RULE_FALLBACK: 'true' }, reuseExistingServer: false },
    { command: 'npm run dev -- --port 5175', url: 'http://127.0.0.1:5175', env: { BACKEND_URL: 'http://127.0.0.1:8011' }, reuseExistingServer: false },
  ],
})
