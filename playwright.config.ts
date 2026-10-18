import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests', fullyParallel: false, workers: 1, timeout: 30000,
    reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:4200', ...devices['Desktop Chrome'], channel: 'chrome', trace: 'retain-on-failure' },
    webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4200', reuseExistingServer: false, timeout: 120000 }
});
