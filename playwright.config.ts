/**
 * E2E-тесты интерфейса (Playwright): адаптив на наборе экранов от ПК
 * до маленького телефона. Гоняются на dev-сервере — там включён отладочный
 * хук `window.__slot` и параметры `?force=`.
 *
 *   npm run test:e2e
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // Спины с экраном крупного выигрыша длятся десятки секунд.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Один поток: без видеокарты Chromium рисует WebGL на процессоре,
  // и несколько вкладок с игрой разом заметно тормозят машину.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],

  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium' }],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
