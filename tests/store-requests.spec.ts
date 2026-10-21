import { test, expect, Page } from '@playwright/test';

// Synthetic API fixtures only: no live review decisions or uploaded documents.
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });
async function setup(page: Page) {
    const state = {
        rows: Array.from({ length: 17 }, (_, i) => ({
            id: 301 + i, name: i ? `Parts Store ${i + 1}` : 'Al-Harbi Auto Parts', nick_name: 'Auto parts',
            employee_name: 'Nasser Al-Harbi', mobile: '+966512345678', url_location: 'https://example.test/location',
            commercial_registration_number: '1234567890', company_ids: [1], review_companies: [{ id: 1, name: 'Toyota' }],
            city: { id: i % 2 + 1, name: i % 2 ? 'Jeddah' : 'Riyadh' }, previous_city: { id: 2, name: 'Jeddah' },
            user: { id: 201, full_name: 'Nasser Al-Harbi', mobile: '+966500000201' },
            request_type: i === 1 ? 'store_change' : 'new_store', store_id: i === 1 ? 501 : null,
            request_status: i === 16 ? 'accepted' : 'pending', created_at: '2026-10-21T10:00:00Z',
            processed_at: null as string | null, processed_by: null as number | null, rejection_reason: null as string | null,
            change_reason: 'Updated store details', previous_details: { name: 'Old Store Name', nick_name: 'Auto parts', employee_name: 'Nasser Al-Harbi', mobile: '+966512345678', url_location: 'https://example.test/location', commercial_registration_number: '1234567890', company_ids: [1], city_id: 2 },
            commercial_registration_picture: `/api/media/store-requests/${301 + i}/registration`, pictures: []
        })),
        lists: [] as URL[], details: 0, writes: 0, cities: 0, images: 0,
        listStatus: 200, detailStatus: 200, writeStatus: 200, imageStatus: 200
    };
    await page.addInitScript(() => sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'review-test-token' })));
    await page.route('**/api/**', async route => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const url = new URL(req.url()), path = url.pathname;
        expect(req.headers()['authorization']).toBe('Bearer review-test-token');
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope({ preferred_language: route.request().postDataJSON().preferred_language }) });
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, name: 'Test Administrator', email: 'admin@example.test', assigned_role: 'employee', status: 'active' }) });
        if (path.endsWith('/admin/cities/options')) {
            state.cities++; expect(url.search).toBe('');
            return route.fulfill({ json: envelope([{ id: 1, name_en: 'Riyadh', name_ar: 'الرياض' }, { id: 2, name_en: 'Jeddah', name_ar: 'جدة' }]) });
        }
        if (path.endsWith('/admin/store-requests')) {
            state.lists.push(url);
            if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { success: false } });
            const q = url.searchParams, current = Number(q.get('page') || 1);
            const rows = state.rows.filter(r => (!q.get('status') || r.request_status === q.get('status')) && (!q.get('city_id') || r.city.id === Number(q.get('city_id'))) && (!q.get('request_type') || r.request_type === q.get('request_type')) && (!q.get('search') || r.name.includes(q.get('search')!)));
            return route.fulfill({ json: { ...envelope(rows.slice((current - 1) * 15, current * 15)), meta: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 15)), per_page: 15, total: rows.length } } });
        }
        const match = path.match(/\/admin\/store-requests\/(\d+)(?:\/(accept|reject))?$/);
        if (match) {
            const row = state.rows.find(r => r.id === Number(match[1]));
            if (match[2]) {
                state.writes++; expect(req.method()).toBe('POST');
                if (state.writeStatus !== 200) return route.fulfill({ status: state.writeStatus, json: { success: false } });
                if (row) { row.request_status = match[2] === 'accept' ? 'accepted' : 'rejected'; row.rejection_reason = req.postDataJSON().reason ?? null; row.processed_by = 1; row.processed_at = '2026-10-21T12:00:00Z'; }
            } else state.details++;
            if (!row || state.detailStatus !== 200) return route.fulfill({ status: row ? state.detailStatus : 404, json: { success: false } });
            return route.fulfill({ json: envelope(row) });
        }
        if (path.startsWith('/api/media/')) {
            state.images++;
            expect(url.search).toBe('');
            if (state.imageStatus !== 200) return route.fulfill({ status: state.imageStatus });
            return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
        }
        return route.abort();
    });
    await page.goto('/store-requests');
    await expect(page.locator('tbody tr')).toHaveCount(15);
    return state;
}

test('pending queue, server pagination, URL restoration, and local city filtering', async ({ page }) => {
    const state = await setup(page);
    expect(state.lists).toHaveLength(1); expect(state.cities).toBe(0);
    expect(state.lists[0].searchParams.get('status')).toBe('pending');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: 'Parts Store 16', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Request details' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Request details' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to store requests' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('جدة');
    await expect(page.getByRole('option', { name: 'Jeddah', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('Riy');
    await page.getByRole('option', { name: 'Riyadh', exact: true }).click();
    expect(state.cities).toBe(1);
    await page.getByLabel('Search requests', { exact: true }).fill('Al-Harbi');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.lists.at(-1)!.searchParams)).toEqual({ page: '1', status: 'pending', search: 'Al-Harbi', city_id: '1' });
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(state.lists.at(-1)!.searchParams.has('status')).toBe(false);
});

test('approve needs confirmation, sends one decision, and reconciles fresh state', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    const action = page.getByRole('button', { name: 'Approve request', exact: true });
    await action.click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(state.writes).toBe(0);
    await action.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve request', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(action).toHaveCount(0);
    await expect(page.getByText('The review decision was saved.')).toBeVisible();
    expect(state.writes).toBe(1); expect(state.details).toBe(2);
});

test('rejection requires a useful reason and displays the saved decision', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await page.getByRole('button', { name: 'Reject request', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reject request', exact: true }).click();
    await expect(dialog.getByText('Enter a rejection reason of 1–255 characters.')).toBeVisible();
    expect(state.writes).toBe(0);
    await page.getByLabel('Rejection reason', { exact: true }).fill('  Please provide a legible registration document.  ');
    await dialog.getByRole('button', { name: 'Reject request', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('complementary')).toContainText('Please provide a legible registration document.');
    expect(state.rows[0].rejection_reason).toBe('Please provide a legible registration document.');
    expect(state.writes).toBe(1);
});

test('uncertain decisions and concurrent changes require a fresh read before retry', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    for (const status of [503, 409, 422]) {
        state.writeStatus = status;
        await page.getByRole('button', { name: 'Approve request', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Approve request', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Approve request', exact: true })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Refresh request', exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: 'Refresh request', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Approve request', exact: true })).toBeVisible();
    }
    expect(state.writes).toBe(3); expect(state.details).toBe(4);
});

test('private documents load on demand with auth, reuse their image, and retry failed reads', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View registration document' })).toBeVisible();
    expect(state.images).toBe(0);
    state.imageStatus = 403;
    await page.getByRole('button', { name: 'View registration document' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
    state.imageStatus = 200;
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await expect(dialog.getByRole('img', { name: 'View registration document', exact: true })).toHaveAttribute('src', /^blob:/);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'View registration document' }).click();
    await expect(dialog.getByRole('img', { name: 'View registration document', exact: true })).toBeVisible();
    expect(state.images).toBe(2);
});

test('untrusted document and location URLs are never used', async ({ page }) => {
    const state = await setup(page);
    state.rows[0].commercial_registration_picture = 'https://untrusted.example/document';
    state.rows[0].url_location = 'javascript:alert(1)';
    await page.getByRole('link', { name: 'Al-Harbi Auto Parts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Request details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View registration document' })).toHaveCount(0);
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    expect(state.images).toBe(0);
});

test('empty, failed, forbidden, missing and expired states remain recoverable', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Search requests', { exact: true }).fill('Missing store');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching requests' })).toBeVisible();
    for (const status of [500, 403]) {
        state.listStatus = status;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(0);
    }
    state.listStatus = 200;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'No matching requests' })).toBeVisible();
    await page.goto('/store-requests/99999');
    await expect(page.getByRole('heading', { name: 'Request unavailable' })).toBeVisible();
    state.detailStatus = 401;
    await page.goto('/store-requests/301');
    await expect(page).toHaveURL('/login');
    expect(state.writes).toBe(0);
});

test('desktop and Arabic mobile queue and change comparison fit the viewport', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    await expect(page.getByText('Open a request to review its details and documents.', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'test-results/store-requests-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Parts Store 2', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Compare submitted changes' })).toContainText('Old Store Name');
    await expect(page.locator('.comparison-table tr.changed')).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/store-request-details-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تفاصيل الطلب' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/store-request-details-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'العودة إلى طلبات المتاجر' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/store-requests-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
});
