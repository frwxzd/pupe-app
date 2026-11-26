import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de extremo a extremo de PUPE.
 *
 * Levantan la API real (puerto 3100, base pupe_test, modo prueba) y Vite en el
 * puerto 4173. Requieren PostgreSQL: `npm run db:local` crea uno dentro del proyecto.
 * Las pruebas comparten la base, por eso corren una a la vez y cada una
 * restablece los datos semilla al empezar (ver tests/helpers.ts).
 * Si en tu máquina Chromium está en otra ruta, define PLAYWRIGHT_CHROMIUM_PATH.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/usr/bin/chromium',
          args: ['--no-sandbox'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npx tsx server/index.ts',
      url: 'http://127.0.0.1:3100/api/config',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: '3100',
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://pupe@127.0.0.1:5433/pupe_test',
        PUPE_TEST_MODE: 'true',
        DEMO_MODE: 'true',
        DEMO_PASSWORD: 'PupeDemo2026',
        AUTH_RATE_LIMIT: '1000',
        TURNSTILE_SITE_KEY: '',
        TURNSTILE_SECRET_KEY: '',
      },
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PORT: '3100' },
    },
  ],
})
