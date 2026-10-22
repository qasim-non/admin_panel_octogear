import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

async function setup(page: Page) {
    const state = { calls: [] as URL[], cities: 0, images: 0, status: 200, detailStatus: 200, delay: '', rows: Array.from({ length: 17 }, (_, i) => ({
        id: 701 + i, order_type: i === 1 ? 'specific' : 'general', status: i === 1 ? 'paid' : 'pending', created_at: '2026-10-21T10:00:00Z', currency: 'SAR', price_scale: 100,
        component_name: 'Side mirror', quantity: i === 1 ? 2 : undefined, offered_price: i === 1 ? 12345 : null, requested_unit_price: 12345, notes: 'Left side mirror, black finish.',
        customer: { id: 101 + i, full_name: i === 0 ? 'Noura Khalid' : `Customer ${i + 1}`, mobile: `+966500000${101 + i}`, city: { id: i === 1 ? 2 : 1, name: i === 1 ? 'Jeddah' : 'Riyadh' } },
        accepted_store: i === 1 ? { id: 501, name: 'Al-Harbi Auto Parts', city: { id: 2, name: 'Jeddah' } } : null, accepted_offer_id: null,
        store_car_component: i === 1 ? { id: 50, component_name: 'Brake pad', part_number: 'BP-2026', car_name: 'Camry', manufacturing_year: 2022 } : null,
        vehicle_details: i === 1 ? null : { car_name: 'Corolla', company_name: 'Toyota', manufacturing_year: 2021, color_name: 'Black', fuel_type_name: 'Petrol', transmission_type: 'automatic' },
        images: i === 0 ? [{ id: 91, url: '/api/media/orders/701/images/91' }] : [],
        offers: i === 0 ? [{ id: 801, price: 14550, notes: 'Available with warranty.', status: 'pending', rejection_reason: null, store: { id: 501, name: 'Al-Harbi Auto Parts' }, images: [], created_at: '2026-10-21T11:00:00Z' }] : [],
        payment: i === 1 ? { id: 90, amount: 24690, payment_method: 'credit_card', payment_status: 'paid' } : null
    })) };
    await page.addInitScript(() => sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'orders-test' })));
    const envelope = (data: unknown) => ({ success: true, data });
    await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        expect(req.headers()['authorization']).toBe('Bearer orders-test');
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, permissions: allPermissions, name: 'Test Admin', status: 'active' }) });
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope(req.postDataJSON()) });
        if (path.endsWith('/admin/cities/options')) { state.cities++; return route.fulfill({ json: envelope([{ id: 1, name_en: 'Riyadh', name_ar: 'الرياض' }, { id: 2, name_en: 'Jeddah', name_ar: 'جدة' }]) }); }
        if (path.endsWith('/admin/orders')) {
            state.calls.push(url); if (state.status !== 200) return route.fulfill({ status: state.status, json: { success: false } });
            const q = url.searchParams, current = Number(q.get('page') || 1);
            const rows = state.rows.filter(row => (!q.get('customer') || row.customer.full_name.includes(q.get('customer')!)) && (!q.get('mobile') || row.customer.mobile.includes(q.get('mobile')!)) && (!q.get('type') || row.order_type === q.get('type')) && (!q.get('status') || row.status === q.get('status')) && (!q.get('city_id') || row.customer.city.id === Number(q.get('city_id'))) && (!q.get('order_id') || row.id === Number(q.get('order_id'))));
            if (state.delay && q.get('customer') === state.delay) await new Promise(resolve => setTimeout(resolve, 600));
            return route.fulfill({ json: { ...envelope(rows.slice((current - 1) * 15, current * 15)), meta: { total: rows.length, current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 15)), per_page: 15 } } });
        }
        const match = path.match(/\/admin\/orders\/(\d+)$/);
        if (match) { const row = state.rows.find(row => row.id === Number(match[1])); return route.fulfill({ status: row ? state.detailStatus : 404, json: envelope(row) }); }
        if (path.startsWith('/api/media/')) { state.images++; return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF/gL+9/3K8QAAAABJRU5ErkJggg==', 'base64') }); }
        return route.abort();
    });
    await page.goto('/orders'); await expect(page.locator('tbody tr')).toHaveCount(15); return state;
}

test('orders paginate, retain URLs through details and refresh, and combine filters', async ({ page }) => {
    const state = await setup(page); expect(state.cities).toBe(0);
    await page.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: '#716', exact: true }).click(); await expect(page).toHaveURL('/orders/716?page=2');
    await page.reload(); await expect(page).toHaveURL('/orders/716?page=2');
    await page.getByRole('link', { name: 'Back to orders' }).click(); await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Order ID', { exact: true }).fill('702'); await page.getByLabel('Customer name', { exact: true }).fill('Customer 2');
    await page.getByLabel('Customer phone number', { exact: true }).fill('102');
    await page.getByRole('combobox', { name: 'Order type', exact: true }).click(); await page.getByRole('option', { name: 'Specific order', exact: true }).click();
    await page.getByRole('combobox', { name: 'Status', exact: true }).click(); await page.getByRole('option', { name: 'Paid', exact: true }).click();
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click(); await page.locator('#order-city').fill('جدة'); await page.getByRole('option', { name: 'Jeddah' }).click();
    await page.getByLabel('Created from (UTC)').fill('2026-10-21'); await page.getByLabel('Created through (UTC)').fill('2026-10-21');
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.calls.at(-1)!.searchParams)).toMatchObject({ customer: 'Customer 2', mobile: '102', type: 'specific', status: 'paid', city_id: '2', order_id: '702', date_from: '2026-10-21', date_to: '2026-10-21', page: '1' });
    expect(state.cities).toBe(1);
});

test('general and specific details preserve money semantics and private media is lazy', async ({ page }) => {
    const state = await setup(page); await page.getByRole('link', { name: '#701', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Offers · 1' })).toBeVisible(); await expect(page.locator('.offer-card')).toContainText('145.50');
    await expect(page.locator('dt').filter({ hasText: /^Quantity$/ })).toHaveCount(0); expect(state.images).toBe(0);
    await page.getByRole('button', { name: 'Request photo 1', exact: true }).click(); await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /^blob:/); expect(state.images).toBe(1);
    await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.goto('/orders/702');
    await expect(page.locator('.payment-card')).toContainText('246.90'); await expect(page.locator('main')).toContainText('123.45'); await expect(page.locator('main')).toContainText('Brake pad');
    await expect(page.getByRole('heading', { name: /^Offers/ })).toHaveCount(0);
});

test('invalid date range stays local, stale reads are cancelled, and a vanished page recovers', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Created from (UTC)').fill('2026-10-22'); await page.getByLabel('Created through (UTC)').fill('2026-10-21');
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.getByText('Enter valid dates. The end date must be on or after the start date.')).toBeVisible(); expect(state.calls).toHaveLength(1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); state.delay = 'Noura';
    await page.getByLabel('Customer name', { exact: true }).fill('Noura'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => state.calls.some(url => url.searchParams.get('customer') === 'Noura')).toBe(true);
    await page.getByLabel('Customer name', { exact: true }).fill('Customer 2'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody')).toContainText('Customer 2'); await page.waitForTimeout(700); await expect(page.locator('tbody')).not.toContainText('Noura');
    await page.goto('/orders?page=2'); await expect(page.locator('tbody tr')).toHaveCount(2); state.rows = state.rows.slice(0, 15);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page).toHaveURL('/orders'); await expect(page.locator('tbody tr')).toHaveCount(15);
});

test('orders handle empty, failed, forbidden, missing, and expired responses', async ({ page }) => {
    const state = await setup(page); await page.getByLabel('Order ID', { exact: true }).fill('99999'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching orders' })).toBeVisible();
    for (const status of [500, 403]) { state.status = status; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible(); }
    state.status = 200; await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByRole('heading', { name: 'No matching orders' })).toBeVisible();
    await page.goto('/orders/99999'); await expect(page.getByRole('heading', { name: 'Order unavailable' })).toBeVisible();
    state.detailStatus = 401; await page.goto('/orders/701'); await expect(page).toHaveURL('/login');
});

test('desktop and Arabic mobile Orders views stay within the viewport', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: 'test-results/orders-desktop.png', fullPage: true });
    await page.getByRole('link', { name: '#701', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Request information' })).toBeVisible();
    await page.screenshot({ path: 'test-results/order-details-desktop.png', fullPage: true }); await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await expect(page.getByRole('heading', { name: 'بيانات الطلب' })).toBeVisible(); await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); await page.screenshot({ path: 'test-results/order-details-mobile-arabic.png', fullPage: true });
    await page.getByRole('link', { name: 'العودة إلى الطلبات' }).click(); await expect(page.locator('tbody tr')).toHaveCount(15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); await page.screenshot({ path: 'test-results/orders-mobile-arabic.png', fullPage: true }); expect(errors).toEqual([]);
});
