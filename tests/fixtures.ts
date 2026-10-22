import { test as base } from '@playwright/test';
export { expect } from '@playwright/test';
export type { Page, Route, WebSocketRoute } from '@playwright/test';

// Never let a hosted app-config.json send browser regression traffic to retained data.
export const test = base.extend({ page: async ({ page }, use) => {
    await page.route('**/app-config.json', route => route.fulfill({ json: { apiBaseUrl: 'http://127.0.0.1:8000/api' } }));
    await use(page);
} });
export const allPermissions = ['dashboard.view', 'users.view', 'users.manage', 'stores.view', 'stores.manage', 'requests.view', 'requests.manage', 'orders.view', 'orders.manage', 'payments.view', 'payments.manage', 'support.access', 'catalog.view', 'catalog.manage', 'admins.view', 'admins.manage'];
