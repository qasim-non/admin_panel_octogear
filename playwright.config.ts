import { defineConfig, devices } from '@playwright/test';

const port = process.env['OCTOGEAR_TEST_PORT'] || '4201';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests', fullyParallel: false, workers: 1, timeout: 30000,
    reporter: 'list',
    use: { baseURL, ...devices['Desktop Chrome'], channel: 'chrome', trace: 'retain-on-failure' },
    webServer: { command: 'npm run preview', url: baseURL, env: { OCTOGEAR_PREVIEW_PORT: port }, reuseExistingServer: false, timeout: 120000 }
});
