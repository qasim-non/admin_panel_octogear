import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

// These fixtures intercept every API call; no retained store is activated/deactivated.
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });
async function setup(page: Page) {
    const state = {
        rows: Array.from({ length: 17 }, (_, i) => ({
            id: 501 + i, name: i ? `Parts Store ${i + 1}` : 'Al-Harbi Auto Parts', nick_name: 'Quality spare parts',
            employee_name: 'Nasser Al-Harbi', mobile: `+966500000${501 + i}`, status: i === 1 ? 'inactive' : 'active',
            url_location: 'https://example.test/location', commercial_registration_number: '1234567890',
            owner: { id: i === 16 ? 202 : 201, full_name: 'Nasser Al-Harbi', mobile: '+966500000201' },
            city: { id: i % 2 + 1, name: i % 2 ? 'Jeddah' : 'Riyadh' }, created_at: '2026-10-21T10:00:00Z',
            cars_count: 8, average_rating: i ? null : 4.5, companies: [{ id: 1, name: 'Toyota' }, { id: 2, name: 'Nissan' }],
            pictures: [{ id: 91 + i, url: `/api/media/stores/${501 + i}/pictures/${91 + i}` }],
            commercial_registration_picture: `/api/media/stores/${501 + i}/registration`, pending_change_request_id: i ? null : 301
        })),
        lists: [] as URL[], details: 0, writes: 0, cities: 0, images: 0,
        listStatus: 200, detailStatus: 200, writeStatus: 200, imageStatus: 200, delayName: '', wrongOwner: false
    };
    await page.addInitScript(() => sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'stores-test-token' })));
    await page.route('**/api/**', async route => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const url = new URL(req.url()), path = url.pathname;
        expect(req.headers()['authorization']).toBe('Bearer stores-test-token');
        const ar = req.headers()['accept-language'] === 'ar';
        const localized = (row: typeof state.rows[number]) => ({ ...row, city: { ...row.city, name: ar ? row.city.id === 1 ? 'الرياض' : 'جدة' : row.city.name }, companies: row.companies.map(c => ({ ...c, name: ar ? c.id === 1 ? 'تويوتا' : 'نيسان' : c.name })) });
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope({ preferred_language: route.request().postDataJSON().preferred_language }) });
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, permissions: allPermissions, name: 'Test Administrator', email: 'admin@example.test', assigned_role: 'admin', status: 'active' }) });
        if (path.endsWith('/admin/cities/options')) {
            state.cities++; expect(url.search).toBe('');
            return route.fulfill({ json: envelope([{ id: 1, name_en: 'Riyadh', name_ar: 'الرياض' }, { id: 2, name_en: 'Jeddah', name_ar: 'جدة' }]) });
        }
        if (path.endsWith('/admin/stores')) {
            state.lists.push(url);
            if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { success: false } });
            const q = url.searchParams, current = Number(q.get('page') || 1);
            const rows = state.rows.filter(r => (!q.get('status') || r.status === q.get('status'))
                && (!q.get('name') || r.name.includes(q.get('name')!)) && (!q.get('mobile') || r.mobile.includes(q.get('mobile')!))
                && (!q.get('city_id') || r.city.id === Number(q.get('city_id'))) && (!q.get('owner_id') || r.owner.id === Number(q.get('owner_id'))));
            if (state.delayName && q.get('name') === state.delayName) await new Promise(resolve => setTimeout(resolve, 650));
            return route.fulfill({ json: { ...envelope(rows.slice((current - 1) * 15, current * 15).map(r => ({ ...localized(r), owner: state.wrongOwner ? { ...r.owner, id: 999 } : r.owner }))), meta: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 15)), per_page: 15, total: rows.length } } });
        }
        const match = path.match(/\/admin\/stores\/(\d+)(\/status)?$/);
        if (match) {
            const row = state.rows.find(r => r.id === Number(match[1]));
            if (match[2]) {
                state.writes++; expect(req.method()).toBe('PATCH'); expect(Object.keys(req.postDataJSON())).toEqual(['status']);
                if (state.writeStatus !== 200) return route.fulfill({ status: state.writeStatus, json: { success: false } });
                if (row) row.status = req.postDataJSON().status;
            } else state.details++;
            if (!row || state.detailStatus !== 200) return route.fulfill({ status: row ? state.detailStatus : 404, json: { success: false } });
            return route.fulfill({ json: envelope(localized(row)) });
        }
        if (path.endsWith('/admin/users/201')) return route.fulfill({ json: envelope({ id: 201, full_name: 'Nasser Al-Harbi', mobile: '+966500000201', type: 'service provider', status: 'unblocked', city: { id: 1, name: 'Riyadh' }, created_at: '2026-10-20T10:00:00Z', stores_count: 16, orders_count: 0 }) });
        if (path.startsWith('/api/media/')) {
            state.images++; expect(url.search).toBe('');
            if (state.imageStatus !== 200) return route.fulfill({ status: state.imageStatus });
            return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF/gL+9/3K8QAAAABJRU5ErkJggg==', 'base64') });
        }
        return route.abort();
    });
    await page.goto('/stores');
    await expect(page.locator('tbody tr')).toHaveCount(15);
    return state;
}

test('store directory pagination, combined filters and refresh/back URL retention', async ({ page }) => {
    const state = await setup(page);
    expect(state.lists).toHaveLength(1); expect(state.cities).toBe(0);
    await expect(page.getByRole('link', { name: 'Stores', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: 'Parts Store 16', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Store details', exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL('/stores/516?page=2');
    await page.getByRole('link', { name: 'Back to stores' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Store name', { exact: true }).fill('Parts Store 2');
    await page.getByLabel('Store phone number', { exact: true }).fill('502');
    await page.getByRole('combobox', { name: 'Store activation', exact: true }).click();
    await page.getByRole('option', { name: 'Inactive', exact: true }).click();
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('جدة');
    await page.getByRole('option', { name: 'Jeddah', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.lists.at(-1)!.searchParams)).toEqual({ page: '1', name: 'Parts Store 2', mobile: '502', status: 'inactive', city_id: '2' });
    expect(state.cities).toBe(1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
});

test('activation requires confirmation and reconciles one status write at a time', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await page.getByRole('button', { name: 'Deactivate store', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Existing orders and the owner’s account status remain unchanged.');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(state.writes).toBe(0);
    for (const action of ['Deactivate store', 'Activate store']) {
        await page.getByRole('button', { name: action, exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click();
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: action === 'Deactivate store' ? 'Activate store' : 'Deactivate store', exact: true })).toBeVisible();
    }
    expect(state.writes).toBe(2); expect(state.details).toBe(3); expect(state.images).toBe(0);
    await expect(page.getByRole('link', { name: 'Review request #301' })).toHaveAttribute('href', '/store-requests/301');
});

test('uncertain status response requires refresh and never automatically repeats the write', async ({ page }) => {
    const state = await setup(page);
    state.writeStatus = 503;
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await page.getByRole('button', { name: 'Deactivate store', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Deactivate store', exact: true }).click();
    await expect(dialog).toContainText('Refresh the store before trying again.');
    await expect(dialog.getByRole('button', { name: 'Deactivate store', exact: true })).toHaveCount(0);
    // The server may have committed the change before the connection failed.
    state.rows[0].status = 'inactive';
    await dialog.getByRole('button', { name: 'Refresh store', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Activate store', exact: true })).toBeVisible();
    expect(state.writes).toBe(1); expect(state.details).toBe(2);
});

test('provider stores link to details and an owner-scoped directory', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/providers/201');
    await page.getByRole('button', { name: 'Show stores', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await expect(page).toHaveURL('/stores/501?owner_id=201');
    await page.getByRole('link', { name: 'Back to stores' }).click();
    await expect(page.locator('.owner-scope')).toContainText('#201');
    await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(state.lists.at(-1)!.searchParams.get('owner_id')).toBe('201');
    state.wrongOwner = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('private store photos use authenticated lazy reads and retry errors without exposing tokens', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Store photo 1', exact: true })).toBeVisible();
    expect(state.images).toBe(0);
    state.imageStatus = 404;
    await page.getByRole('button', { name: 'View registration document', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
    state.imageStatus = 200;
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await expect(dialog.getByRole('img', { name: 'View registration document', exact: true })).toHaveAttribute('src', /^blob:/);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Store photo 1', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('img', { name: 'Store photo 1', exact: true })).toBeVisible();
    expect(state.images).toBe(3);
});

test('superseded searches cannot replace newer results and vanished last pages recover', async ({ page }) => {
    const state = await setup(page);
    state.delayName = 'Al-Harbi';
    await page.getByLabel('Store name', { exact: true }).fill('Al-Harbi');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => state.lists.some(url => url.searchParams.get('name') === 'Al-Harbi')).toBe(true);
    await page.getByLabel('Store name', { exact: true }).fill('Parts Store 2');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody')).toContainText('Parts Store 2');
    await page.waitForTimeout(750);
    await expect(page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true })).toHaveCount(0);
    await page.goto('/stores?page=2');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    state.rows = state.rows.slice(0, 15);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page).toHaveURL('/stores');
    await expect(page.locator('tbody tr')).toHaveCount(15);
});

test('empty, denied, unavailable and expired views do not expose stale store controls', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Store name', { exact: true }).fill('Missing store');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching stores' })).toBeVisible();
    for (const status of [500, 403]) {
        state.listStatus = status;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    }
    state.listStatus = 200;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'No matching stores' })).toBeVisible();
    await page.goto('/stores/99999');
    await expect(page.getByRole('heading', { name: 'Store unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deactivate store', exact: true })).toHaveCount(0);
    state.detailStatus = 401;
    await page.goto('/stores/501');
    await expect(page).toHaveURL('/login');
});

test('store desktop and Arabic mobile screens stay readable within the viewport', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'test-results/stores-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Approved store information' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/store-details-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Deactivate store', exact: true }).click();
    await page.screenshot({ path: 'test-results/store-confirmation-desktop.png', animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تفاصيل المتجر' })).toBeVisible();
    await expect(page.locator('.brand-list')).toContainText('تويوتا');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/store-details-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'العودة إلى المتاجر' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/stores-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
});
