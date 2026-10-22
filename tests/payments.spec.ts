import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

async function setup(page: Page) {
    const state = { calls: [] as URL[], cities: 0, status: 200, malformed: false, delay: '', rows: Array.from({ length: 27 }, (_, i) => ({
        id: 901 + i, order_id: 701 + i, amount: i === 0 ? 12345 : 24690, currency: 'SAR', price_scale: 100,
        payment_status: ['paid', 'pending', 'failed', 'refunded'][i % 4], payment_method: i === 1 ? 'cash' : 'credit_card', archived: i === 2,
        created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T11:00:00Z',
        order: { id: 701 + i, available: i !== 2, type: i === 1 ? 'specific' : 'general', part_name: i === 1 ? 'Brake pads' : 'Side mirror',
            customer: { name: i === 0 ? 'Noura Khalid' : `Customer ${i + 1}`, mobile: `+966500000${101 + i}`, city: { id: i === 1 ? 2 : 1, name: i === 1 ? 'Jeddah' : 'Riyadh' } },
            store: { id: 501, name: 'Al-Harbi Auto Parts' } }
    })) };
    await page.addInitScript(() => { localStorage.setItem('octogear.locale', 'en'); sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'payments-test' })); });
    const envelope = (data: unknown) => ({ success: true, data });
    await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        expect(req.headers()['authorization']).toBe('Bearer payments-test');
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope(req.postDataJSON()) });
        expect(req.method()).toBe('GET');
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, permissions: allPermissions, name: 'Test Admin', status: 'active' }) });
        if (path.endsWith('/admin/cities/options')) { state.cities++; return route.fulfill({ json: envelope([{ id: 1, name_en: 'Riyadh', name_ar: 'الرياض' }, { id: 2, name_en: 'Jeddah', name_ar: 'جدة' }]) }); }
        if (path.endsWith('/admin/payments')) {
            state.calls.push(url);
            if (state.status !== 200) return route.fulfill({ status: state.status, json: { success: false } });
            if (state.malformed) return route.fulfill({ json: envelope([{ amount: 12345 }]) });
            const q = url.searchParams, current = Number(q.get('page') || 1);
            const rows = state.rows.filter(row => (!q.get('search') || `${row.order.customer.name} ${row.order.customer.mobile} ${row.order.store.name}`.includes(q.get('search')!)) &&
                (!q.get('order_id') || row.order_id === Number(q.get('order_id'))) && (!q.get('city_id') || row.order.customer.city.id === Number(q.get('city_id'))) &&
                (!q.get('status') || row.payment_status === q.get('status')) && (!q.get('method') || row.payment_method === q.get('method')) && (!q.get('type') || row.order.type === q.get('type')));
            if (state.delay && q.get('search') === state.delay) await new Promise(resolve => setTimeout(resolve, 600));
            return route.fulfill({ json: { ...envelope(rows.slice((current - 1) * 25, current * 25)), meta: { total: rows.length, current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 25)), per_page: 25 } } });
        }
        const match = path.match(/\/admin\/orders\/(\d+)$/);
        if (match) return route.fulfill({ json: envelope({ id: Number(match[1]), order_type: 'general', status: 'paid', created_at: '2026-10-21T10:00:00Z', currency: 'SAR', price_scale: 100,
            component_name: 'Side mirror', offered_price: 12345, customer: null, accepted_store: null, images: [], offers: [], vehicle_details: null, store_car_component: null, payment: null }) });
        return route.abort();
    });
    await page.goto('/payments'); await expect(page.locator('tbody tr')).toHaveCount(25); return state;
}

test('payments paginate 25 records and preserve filters through order details and refresh', async ({ page }) => {
    const state = await setup(page); expect(state.cities).toBe(0);
    await page.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: 'View order #726', exact: true }).click(); await expect(page).toHaveURL('/orders/726?page=2&source=payments');
    await page.reload(); await expect(page.getByRole('link', { name: 'Back to payments' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to payments' }).click(); await expect(page).toHaveURL('/payments?page=2'); await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: 'View order #726', exact: true }).click(); await page.getByRole('link', { name: 'View all payment records for this order' }).click();
    await expect(page).toHaveURL('/payments?order_id=726'); await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('payment filters combine and city searches stay local', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Customer or store', { exact: true }).fill('Customer 2'); await page.getByLabel('Order ID', { exact: true }).fill('702');
    for (const [label, option] of [['Payment status', 'Pending'], ['Payment method', 'Cash'], ['Order type', 'Specific order']]) {
        await page.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click(); await page.locator('#payment-city').fill('جدة');
    await page.getByRole('option', { name: 'Jeddah', exact: true }).click(); expect(state.cities).toBe(1); expect(state.calls).toHaveLength(1);
    await page.getByLabel('Recorded from (UTC)').fill('2026-10-21'); await page.getByLabel('Recorded through (UTC)').fill('2026-10-21');
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.calls.at(-1)!.searchParams)).toMatchObject({ search: 'Customer 2', order_id: '702', city_id: '2', status: 'pending', method: 'cash', type: 'specific', date_from: '2026-10-21', date_to: '2026-10-21', page: '1' });
    await page.reload(); await expect(page.locator('tbody tr')).toHaveCount(1); expect(state.cities).toBe(1);
});

test('recorded amounts and archived records remain clear without payment actions', async ({ page }) => {
    await setup(page);
    await expect(page.locator('tbody tr').first()).toContainText('123.45');
    await expect(page.locator('tbody tr').nth(2)).toContainText('Archived record'); await expect(page.locator('tbody tr').nth(2)).toContainText('Order unavailable');
    await expect(page.locator('tbody tr').nth(2).getByRole('link')).toHaveCount(0);
    for (const [index, status] of ['Paid', 'Pending', 'Failed', 'Refunded'].entries()) await expect(page.locator('tbody tr').nth(index).locator('p-tag')).toHaveText(status);
    await expect(page.getByRole('button', { name: /Refund|Charge|Delete/ })).toHaveCount(0);
    await expect(page.getByText('Pending and failed amounts do not mean money was collected.', { exact: false })).toBeVisible();
});

test('invalid dates stay local, superseded reads cannot win, and a vanished page recovers', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Recorded from (UTC)').fill('2026-10-22'); await page.getByLabel('Recorded through (UTC)').fill('2026-10-21');
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.getByText('Enter valid dates. The end date must be on or after the start date.')).toBeVisible(); expect(state.calls).toHaveLength(1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); state.delay = 'Noura';
    await page.getByLabel('Customer or store', { exact: true }).fill('Noura'); await page.getByRole('button', { name: 'Apply filters' }).click(); await expect.poll(() => state.calls.some(url => url.searchParams.get('search') === 'Noura')).toBe(true);
    await page.getByLabel('Customer or store', { exact: true }).fill('Customer 2'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody')).toContainText('Customer 2'); await page.waitForTimeout(700); await expect(page.locator('tbody')).not.toContainText('Noura');
    await page.goto('/payments?page=2'); await expect(page.locator('tbody tr')).toHaveCount(2); state.rows = state.rows.slice(0, 25);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page).toHaveURL('/payments'); await expect(page.locator('tbody tr')).toHaveCount(25);
});

test('empty, denied, old API, malformed response, retry and expired states are explicit', async ({ page }) => {
    const state = await setup(page); await page.getByLabel('Order ID', { exact: true }).fill('99999'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching payment records' })).toBeVisible();
    for (const status of [500, 403, 404, 422]) {
        state.status = status; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(0);
    }
    state.status = 200; state.malformed = true; await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByRole('alert')).toBeVisible();
    state.malformed = false; await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByRole('heading', { name: 'No matching payment records' })).toBeVisible();
    state.status = 401; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page).toHaveURL('/login');
});

test('English desktop and Arabic desktop/mobile payment tables remain usable', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.setViewportSize({ width: 1600, height: 1000 });
    const state = await setup(page); state.rows = state.rows.slice(0, 4); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: 'test-results/payments-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'العربية', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'المدفوعات', exact: true })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(4);
    await page.screenshot({ path: 'test-results/payments-arabic.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/payments-mobile-arabic.png', fullPage: true });
    const scroll = page.locator('p-table').getByRole('region', { name: 'سجلات الدفع', exact: true });
    await scroll.focus(); await expect(scroll).toBeFocused();
    const start = await scroll.evaluate(el => el.scrollLeft);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeLessThan(start);
    await page.locator('tbody tr').first().locator('p-tag').scrollIntoViewIfNeeded(); await expect(page.locator('tbody tr').first().locator('p-tag')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); expect(errors).toEqual([]);
});
