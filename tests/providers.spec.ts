import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

// All requests use synthetic fixtures. No retained provider account or store is changed.
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });
const paginate = (rows: unknown[], page: number, size: number) => ({
    ...envelope(rows.slice((page - 1) * size, page * size)),
    meta: { current_page: page, last_page: Math.max(1, Math.ceil(rows.length / size)), per_page: size, total: rows.length }
});

async function setup(page: Page) {
    const names = ['Nasser Al-Harbi', 'Sara Abdullah', 'Omar Al-Qahtani', 'Noura Khalid', 'Faisal Hassan'];
    const state = {
        providers: Array.from({ length: 27 }, (_, i) => ({
            id: 201 + i, full_name: i < 5 ? names[i] : `Provider ${i + 1}`, mobile: `+966500000${201 + i}`,
            type: 'service provider', status: i === 2 ? 'blocked' : 'unblocked',
            city: { id: i % 2 + 1, name: i % 2 ? 'Jeddah' : 'Riyadh' },
            created_at: '2026-10-20T10:30:00Z', orders_count: 0, stores_count: i ? 0 : 16
        })),
        lists: [] as URL[], stores: [] as URL[], cities: 0, details: 0, patches: 0,
        listStatus: 200, storeStatus: 200, detailStatus: 200, patchStatus: 200, wrongOwner: false, emptyStores: false
    };
    await page.addInitScript(() => sessionStorage.setItem('octogear.admin.session', JSON.stringify({
        apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'provider-test-token'
    })));
    await page.route('**/api/**', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const url = new URL(route.request().url());
        const path = url.pathname;
        expect(route.request().headers()['authorization']).toBe('Bearer provider-test-token');
        const ar = route.request().headers()['accept-language'] === 'ar';
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope({ preferred_language: route.request().postDataJSON().preferred_language }) });
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, permissions: allPermissions, name: 'Test Administrator', email: 'admin@example.test', assigned_role: 'admin', status: 'active' }) });
        if (path.endsWith('/admin/cities/options')) {
            state.cities++;
            expect(url.search).toBe('');
            return route.fulfill({ json: envelope([{ id: 1, name_en: 'Riyadh', name_ar: 'الرياض' }, { id: 2, name_en: 'Jeddah', name_ar: 'جدة' }]) });
        }
        if (path.endsWith('/admin/users/providers') || path.endsWith('/admin/users/customers')) {
            state.lists.push(url);
            if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { success: false } });
            const q = url.searchParams;
            const rows = state.providers.filter(row => (!q.get('name') || row.full_name.includes(q.get('name')!))
                && (!q.get('mobile') || row.mobile.includes(q.get('mobile')!)) && (!q.get('status') || row.status === q.get('status'))
                && (!q.get('city_id') || row.city.id === Number(q.get('city_id'))));
            return route.fulfill({ json: paginate(rows.map(row => ({ ...row,
                type: path.endsWith('/customers') ? 'customer' : row.type,
                city: { ...row.city, name: ar ? row.city.id === 1 ? 'الرياض' : 'جدة' : row.city.name }
            })), Number(q.get('page') ?? 1), 25) });
        }
        if (path.endsWith('/admin/stores')) {
            state.stores.push(url);
            expect(url.searchParams.get('owner_id')).toMatch(/^2\d\d$/);
            if (state.storeStatus !== 200) return route.fulfill({ status: state.storeStatus, json: { success: false } });
            const ownerId = Number(url.searchParams.get('owner_id'));
            const rows = state.emptyStores ? [] : Array.from({ length: 16 }, (_, i) => ({
                id: i + 501, name: i === 0 ? 'Al-Harbi Auto Parts' : `Store ${i + 1}`, mobile: '+966512345678',
                city: { id: 1, name: ar ? 'الرياض' : 'Riyadh' }, status: i === 0 ? 'inactive' : 'active',
                owner: { id: state.wrongOwner ? 999 : ownerId, full_name: 'Nasser Al-Harbi', mobile: '+966500000201' }
            }));
            return route.fulfill({ json: paginate(rows, Number(url.searchParams.get('page') ?? 1), 15) });
        }
        const match = path.match(/\/admin\/users\/(\d+)(\/status)?$/);
        if (match) {
            const row = state.providers.find(provider => provider.id === Number(match[1]));
            if (match[2]) {
                state.patches++;
                expect(route.request().method()).toBe('PATCH');
                expect(Object.keys(route.request().postDataJSON())).toEqual(['status']);
                if (state.patchStatus !== 200) return route.fulfill({ status: state.patchStatus, json: { success: false } });
                if (row) row.status = route.request().postDataJSON().status;
            } else state.details++;
            if (!row || state.detailStatus !== 200) return route.fulfill({ status: row ? state.detailStatus : 404, json: { success: false } });
            return route.fulfill({ json: envelope(row) });
        }
        return route.abort();
    });
    await page.goto('/providers');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    return state;
}

test('provider navigation, 25-row pages, combined filters, and URL restoration', async ({ page }) => {
    const state = await setup(page);
    await expect(page.getByRole('link', { name: 'Service providers', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(state.lists).toHaveLength(1);
    expect(state.cities).toBe(0);
    await expect(page.getByText('Showing 1–25 of 27 providers')).toBeVisible();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: 'Provider 26', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Service provider details' })).toBeVisible();
    expect(state.stores).toHaveLength(0);
    await page.reload();
    await expect(page).toHaveURL('/providers/226?page=2');
    await page.getByRole('link', { name: 'Back to service providers' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Provider name', { exact: true }).fill('Omar');
    await page.getByLabel('Phone number', { exact: true }).fill('203');
    await page.getByRole('combobox', { name: 'Account status' }).click();
    await page.getByRole('option', { name: 'Blocked', exact: true }).click();
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await page.getByRole('option', { name: 'Riyadh', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.lists.at(-1)!.searchParams)).toEqual({ page: '1', name: 'Omar', mobile: '203', status: 'blocked', city_id: '1' });
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
});

test('city catalog is shared with customers and city searches never request the API', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Customers', exact: true }).click();
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).press('Escape');
    await page.getByRole('link', { name: 'Service providers', exact: true }).click();
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('جدة');
    await expect(page.getByRole('option', { name: 'Jeddah', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('Riy');
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toBeVisible();
    expect(state.cities).toBe(1);
});

test('provider block/unblock requires confirmation, cancels safely, and reads fresh status', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    const access = page.getByRole('complementary');
    await access.getByRole('button', { name: 'Block provider', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Store activation is unchanged.');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(state.patches).toBe(0);
    for (const action of ['Block provider', 'Unblock provider']) {
        await access.getByRole('button', { name: action, exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click();
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(access.getByRole('button', { name: action === 'Block provider' ? 'Unblock provider' : 'Block provider', exact: true })).toBeVisible();
    }
    expect(state.patches).toBe(2);
    expect(state.details).toBe(3);
    expect(state.stores).toHaveLength(0);
    state.patchStatus = 500;
    await access.getByRole('button', { name: 'Block provider', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Block provider', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Refresh the provider before trying again.');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Block provider', exact: true })).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Refresh provider', exact: true }).click();
    await expect(access.getByRole('button', { name: 'Block provider', exact: true })).toBeVisible();
    expect(state.patches).toBe(3);
});

test('stores load once on demand, are scoped to the provider, and use server pagination', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show stores', exact: true })).toBeVisible();
    expect(state.stores).toHaveLength(0);
    await page.getByRole('button', { name: 'Show stores', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(state.stores).toHaveLength(1);
    expect(Object.fromEntries(state.stores[0].searchParams)).toEqual({ owner_id: '201', page: '1' });
    await expect(page.locator('tbody tr').first()).toContainText('Inactive');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Store 16');
    await page.getByRole('button', { name: 'Previous page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    state.emptyStores = true;
    await page.locator('app-provider-stores').getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('This provider has no stores yet.')).toBeVisible();
});

test('stores retry denied/failed reads and reject unrelated data from older APIs', async ({ page }) => {
    const state = await setup(page);
    state.storeStatus = 403;
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await page.getByRole('button', { name: 'Show stores', exact: true }).click();
    await expect(page.getByText('You do not have permission to view stores.')).toBeVisible();
    state.storeStatus = 200; state.wrongOwner = true;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
    state.wrongOwner = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
});

test('wrong account types and missing providers cannot be managed', async ({ page }) => {
    const state = await setup(page);
    state.providers[0].type = 'customer';
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Service provider unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Block provider', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show stores', exact: true })).toHaveCount(0);
    await page.goto('/providers/99999');
    await expect(page.getByRole('heading', { name: 'Service provider unavailable' })).toBeVisible();
    expect(state.patches).toBe(0);
});

test('empty, denied, recoverable error and expired provider states use truthful feedback', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Provider name', { exact: true }).fill('No matching name');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching providers' })).toBeVisible();
    state.providers = [];
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'No service providers yet' })).toBeVisible();
    for (const [status, message] of [[403, 'You do not have permission to manage service providers.'], [500, 'Something went wrong. Please try again.']] as const) {
        state.listStatus = status;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByText(message)).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(0);
    }
    state.listStatus = 200;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No service providers yet' })).toBeVisible();
    state.listStatus = 401;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page).toHaveURL('/login');
});

test('provider desktop and Arabic mobile layouts, including stores, stay within the viewport', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'test-results/providers-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await page.getByRole('button', { name: 'Show stores', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/provider-details-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تفاصيل مقدم الخدمة' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'عرض المتاجر', exact: true }).click();
    await expect(page.locator('tbody')).toContainText('الرياض');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/provider-details-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'العودة إلى مقدمي الخدمة' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/providers-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
});
