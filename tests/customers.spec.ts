import { test, expect, Page, Route } from '@playwright/test';

// Synthetic fixtures only. Every API request is intercepted; no retained customer is modified.
const names = ['Nasser Al-Harbi', 'Sara Abdullah', 'Omar Al-Qahtani', 'Noura Khalid', 'Faisal Hassan',
    'Maha Al-Salem', 'Abdullah Ibrahim', 'Reem Mohammed', 'Yousef Ahmad', 'Huda Saleh',
    'Khalid Nasser', 'Abeer Ali', 'Ahmed Salem', 'Lina Omar', 'Bader Hassan', 'Salem Ali', 'Hind Saad', 'Majed Saleh', 'Amal Hassan', 'Fahad Ali',
    'Dalia Saad', 'Hani Salem', 'Mona Adel', 'Walid Saleh', 'Salma Nasser', 'Rana Khalid', 'Zaid Ibrahim'];
const fixtures = () => names.map((full_name, index) => ({
    id: 101 + index, full_name, mobile: `+966500000${101 + index}`, type: 'customer',
    status: index === 2 || index === 6 ? 'blocked' : 'unblocked',
    city: { id: index % 3 + 1, name: ['Riyadh', 'Jeddah', 'Dammam'][index % 3] },
    created_at: `2026-10-${String(31 - index).padStart(2, '0')}T10:30:00.000000Z`,
    orders_count: index + 2, stores_count: 0
}));
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });
const cityFixtures = [
    { id: 1, en: 'Riyadh', ar: 'الرياض' }, { id: 2, en: 'Jeddah', ar: 'جدة' }, { id: 3, en: 'Dammam', ar: 'الدمام' },
    ...Array.from({ length: 50 }, (_, index) => ({ id: index + 4, en: `Test City ${index + 4}`, ar: `مدينة تجريبية ${index + 4}` }))
];
type Handler = (route: Route) => Promise<void> | void;

async function setup(page: Page) {
    const state = { customers: fixtures(), calls: [] as URL[], patches: 0,
        listStatus: 200, detailStatus: 200, patchStatus: 200, listOverride: null as Handler | null,
        cityCalls: [] as URL[], cityStatus: 200, cityOverride: null as Handler | null };
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path.endsWith('/auth/admin/login')) return route.fulfill({ json: envelope({ token: 'test-customer-token' }) });
        expect(route.request().headers()['authorization']).toBe('Bearer test-customer-token');
        if (path.endsWith('/admin/cities/options')) {
            state.cityCalls.push(url);
            if (state.cityOverride) return state.cityOverride(route);
            if (state.cityStatus !== 200) return route.fulfill({ status: state.cityStatus, json: { success: false } });
            expect(url.search).toBe('');
            return route.fulfill({ json: envelope(cityFixtures.map(city => ({ id: city.id, name_en: city.en, name_ar: city.ar }))) });
        }
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope({ preferred_language: route.request().postDataJSON().preferred_language }) });
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope({ employee_id: 1, name: 'Test Administrator', email: 'admin@example.test', assigned_role: 'employee', status: 'active' }) });
        if (path.endsWith('/admin/dashboard')) return route.fulfill({ json: envelope({
            users: { total: 27, customers: 27, providers: 0 }, stores: { total: 0, pending_requests: 0 },
            orders: { total: 0, pending: 0, awaiting_payment: 0, paid: 0, completed: 0, cancelled: 0 }
        }) });
        if (path.endsWith('/admin/users/customers')) {
            state.calls.push(url);
            if (state.listOverride) return state.listOverride(route);
            if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { success: false, message: 'Test failure' } });
            const q = url.searchParams;
            const rows = state.customers.filter(row => (!q.get('name') || row.full_name.toLowerCase().includes(q.get('name')!.toLowerCase()))
                && (!q.get('mobile') || row.mobile.includes(q.get('mobile')!))
                && (!q.get('status') || row.status === q.get('status'))
                && (!q.get('city_id') || row.city.id === Number(q.get('city_id'))));
            const current = Number(q.get('page') ?? 1);
            const arabic = route.request().headers()['accept-language'] === 'ar';
            return route.fulfill({ json: { ...envelope(rows.slice((current - 1) * 25, current * 25).map(row => ({
                ...row, city: row.city ? { ...row.city, name: arabic ? ['الرياض', 'جدة', 'الدمام'][row.city.id - 1] : row.city.name } : null
            }))), meta: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 25)), per_page: 25, total: rows.length } } });
        }
        const match = path.match(/\/admin\/users\/(\d+)(\/status)?$/);
        if (match) {
            const row = state.customers.find(customer => customer.id === Number(match[1]));
            if (match[2]) {
                state.patches++;
                expect(route.request().method()).toBe('PATCH');
                const body = route.request().postDataJSON();
                expect(Object.keys(body)).toEqual(['status']);
                expect(['blocked', 'unblocked']).toContain(body.status);
                if (state.patchStatus !== 200) return route.fulfill({ status: state.patchStatus, json: { success: false, message: 'Test failure' } });
                if (row) row.status = body.status;
                return route.fulfill({ json: envelope(row) });
            }
            if (state.detailStatus !== 200 || !row) return route.fulfill({ status: state.detailStatus === 200 ? 404 : state.detailStatus, json: { success: false } });
            return route.fulfill({ json: envelope(row) });
        }
        return route.abort();
    });
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/overview');
    await page.getByRole('link', { name: 'Customers', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    return state;
}

test('real server pagination, combined filters, and clear; no invented query controls', async ({ page }) => {
    const state = await setup(page);
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page.getByText('Showing 1–25 of 27 customers')).toBeVisible();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page).toHaveURL(/page=2/);
    await page.getByLabel('Customer name', { exact: true }).fill('Omar');
    await page.getByLabel('Phone number', { exact: true }).fill('103');
    await page.getByRole('combobox', { name: 'Account status' }).click();
    await page.getByRole('option', { name: 'Blocked', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Omar Al-Qahtani');
    const query = state.calls.at(-1)!.searchParams;
    expect(Object.fromEntries(query)).toEqual({ page: '1', name: 'Omar', mobile: '103', status: 'blocked' });
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page).toHaveURL('/customers');
});

test('detail preserves page, requires confirmation, cancels safely, and reconciles block/unblock', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await page.getByRole('link', { name: 'View details: Rana Khalid' }).click();
    await expect(page.getByRole('heading', { name: 'Rana Khalid' })).toBeVisible();
    await expect(page.getByText('Joined date and time (UTC)')).toBeVisible();
    await page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Rana Khalid');
    expect(state.patches).toBe(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(state.patches).toBe(0);
    await page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Block customer', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Unblock customer', exact: true })).toBeVisible();
    await expect(page.getByText('Account status updated.')).toBeVisible();
    expect(state.patches).toBe(1);
    await page.getByRole('complementary').getByRole('button', { name: 'Unblock customer', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Unblock customer', exact: true }).click();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true })).toBeVisible();
    expect(state.patches).toBe(2);
    await page.getByRole('link', { name: 'Back to customers' }).click();
    await expect(page).toHaveURL('/customers?page=2');
    await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('uncertain status write cannot be repeated until the profile is refreshed', async ({ page }) => {
    const state = await setup(page);
    state.patchStatus = 500;
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Block customer', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('The change could not be confirmed.');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Block customer', exact: true })).toHaveCount(0);
    expect(state.patches).toBe(1);
    // Simulate a server write that succeeded even though its HTTP response failed.
    state.customers[0].status = 'blocked';
    await page.getByRole('dialog').getByRole('button', { name: 'Refresh customer' }).click();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Unblock customer', exact: true })).toBeVisible();
    expect(state.patches).toBe(1);
});

test('empty, error, and forbidden list states remain distinct and recoverable', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Customer name', { exact: true }).fill('No matching fixture');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching customers' })).toBeVisible();
    await page.locator('.empty-state').getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    state.listStatus = 500;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
    state.listStatus = 403;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('You do not have permission to manage customers.')).toBeVisible();
    await expect(page).toHaveURL('/customers');
    state.listStatus = 200;
    state.customers = [];
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'No customers yet' })).toBeVisible();
    await expect(page.getByText('Showing 0–0 of 0 customers')).toBeVisible();
});

test('missing or promoted customers do not expose a mislabeled status action', async ({ page }) => {
    const state = await setup(page);
    state.customers[0].type = 'service provider';
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Customer unavailable' })).toBeVisible();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Block customer' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to customers' }).click();
    state.detailStatus = 404;
    await page.getByRole('link', { name: 'Sara Abdullah', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Customer unavailable' })).toBeVisible();
});

test('server status filtering reconciles a removed last-page row', async ({ page }) => {
    const state = await setup(page);
    state.customers.forEach(row => row.status = 'blocked');
    state.customers = state.customers.slice(0, 26);
    await page.getByRole('combobox', { name: 'Account status' }).click();
    await page.getByRole('option', { name: 'Blocked', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await page.getByRole('link', { name: 'Rana Khalid', exact: true }).click();
    await page.getByRole('complementary').getByRole('button', { name: 'Unblock customer', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Unblock customer', exact: true }).click();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to customers' }).click();
    await expect(page).toHaveURL('/customers?status=blocked');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page.getByText('Showing 1–25 of 25 customers')).toBeVisible();
});

test('session expiry on customer data returns to login', async ({ page }) => {
    const state = await setup(page);
    state.listStatus = 401;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
});

test('a later search wins over an older in-flight response', async ({ page }) => {
    const state = await setup(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    state.listOverride = async route => {
        if (new URL(route.request().url()).searchParams.get('name') === 'old') {
            await gate;
            await route.fulfill({ json: { ...envelope([state.customers[0]]), meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } } });
        } else {
            await route.fulfill({ json: { ...envelope([state.customers[1]]), meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } } });
        }
    };
    await page.getByLabel('Customer name', { exact: true }).fill('old');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading customers' })).toBeVisible();
    await page.getByLabel('Customer name', { exact: true }).fill('new');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody')).toContainText('Sara Abdullah');
    release();
    await expect(page.locator('tbody')).not.toContainText('Nasser Al-Harbi');
});

test('desktop and Arabic mobile customer views stay usable without page overflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await setup(page);
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'test-results/customers-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nasser Al-Harbi' })).toBeVisible();
    await page.screenshot({ path: 'test-results/customer-details-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('complementary').getByRole('button', { name: 'Block customer', exact: true }).click();
    await page.screenshot({ path: 'test-results/customer-confirm-desktop.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('link', { name: 'Back to customers' }).click();
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.locator('tbody')).toContainText('الرياض');
    await page.screenshot({ path: 'test-results/customers-arabic.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('مرّر أفقياً لعرض جميع الأعمدة')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/customers-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Nasser Al-Harbi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تفاصيل العميل' })).toBeVisible();
    await expect(page.getByRole('complementary').getByRole('button', { name: 'حظر العميل', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/customer-details-mobile-arabic.png', fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
});

test('city lookup is lazy, cached, searchable and retained through detail navigation', async ({ page }) => {
    const state = await setup(page);
    expect(state.cityCalls).toHaveLength(0);
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toBeVisible();
    expect(state.cityCalls).toHaveLength(1);
    await page.getByRole('combobox', { name: 'City', exact: true }).press('Escape');
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toBeVisible();
    expect(state.cityCalls).toHaveLength(1);
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('الدمام');
    await expect(page.getByRole('option', { name: 'Dammam', exact: true })).toBeVisible();
    expect(state.cityCalls).toHaveLength(1);
    await page.getByRole('option', { name: 'Dammam', exact: true }).click();
    await page.getByLabel('Customer name', { exact: true }).fill('Omar');
    await page.getByLabel('Phone number', { exact: true }).fill('103');
    await page.getByRole('combobox', { name: 'Account status' }).click();
    await page.getByRole('option', { name: 'Blocked', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.calls.at(-1)!.searchParams)).toEqual({ page: '1', name: 'Omar', mobile: '103', status: 'blocked', city_id: '3' });
    await page.getByRole('link', { name: 'Omar Al-Qahtani', exact: true }).click();
    await page.getByRole('link', { name: 'Back to customers' }).click();
    await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Dammam');
    await expect(page).toHaveURL(/city_id=3/);
    expect(state.cityCalls).toHaveLength(1);
    await page.reload();
    await expect(page).toHaveURL(/city_id=3/);
    await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Dammam');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(state.cityCalls).toHaveLength(1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    expect(state.calls.at(-1)!.searchParams.has('city_id')).toBe(false);
});

test('city chooser searches the complete catalog locally, retries failures, and supports empty results', async ({ page }) => {
    const state = await setup(page);
    state.cityStatus = 500;
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await page.getByRole('button', { name: 'Retry cities', exact: true }).waitFor();
    state.cityStatus = 200;
    await page.getByRole('button', { name: 'Retry cities', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('Test City 53');
    await page.getByRole('option', { name: 'Test City 53', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Test City 53');
    expect(state.cityCalls).toHaveLength(2); // Failed download + explicit retry only.
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching customers' })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('No such city');
    await expect(page.getByText('No matching cities', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'City', exact: true }).fill('Riyadh');
    await page.getByRole('option', { name: 'Riyadh', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(9);
    expect(state.cityCalls).toHaveLength(2);
});

test('one city download and one loading message survive repeated typing and language changes', async ({ page }) => {
    const state = await setup(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    state.cityOverride = async route => {
        await gate;
        await route.fulfill({ json: envelope(cityFixtures.map(city => ({ id: city.id, name_en: city.en, name_ar: city.ar }))) });
    };
    const city = page.getByRole('combobox', { name: 'City', exact: true });
    await page.getByRole('button', { name: 'Browse cities', exact: true }).click();
    await expect.poll(() => state.cityCalls.length).toBe(1);
    await expect(page.getByText('Loading cities…', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Loading cities…', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/city-loading-single.png', fullPage: true });
    await city.fill('Riy');
    await city.fill('Jeddah');
    expect(state.cityCalls).toHaveLength(1);
    release();
    await expect(page.getByRole('option', { name: 'Jeddah', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Riyadh', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Jeddah', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(9);
    state.cityOverride = null;
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'عرض المدن', exact: true }).click();
    await page.getByRole('option', { name: 'الرياض', exact: true }).click();
    await page.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'المدينة', exact: true })).toHaveValue('الرياض');
    await expect(page.locator('tbody tr')).toHaveCount(9);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(state.cityCalls).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: 'test-results/city-filter-arabic-mobile.png', fullPage: true, animations: 'disabled' });
});
