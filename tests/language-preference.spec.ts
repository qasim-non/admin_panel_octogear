import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

async function setup(page: Page, preferred: 'ar' | 'en' | null = 'ar', restore = true) {
    const state = { preferred, writes: 0, reads: 0, status: 200, delay: 0, dashboardLocales: [] as string[] };
    if (restore) await page.addInitScript(() => { localStorage.setItem('octogear.locale', 'en'); sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'language-test' })); });
    const envelope = (data: unknown) => ({ success: true, data });
    await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path.endsWith('/auth/admin/login')) { state.preferred ??= req.postDataJSON().preferred_language; return route.fulfill({ json: envelope({ token: 'language-test' }) }); }
        expect(req.headers()['authorization']).toBe('Bearer language-test');
        if (path.endsWith('/admin/profile')) { state.reads++; return route.fulfill({ json: envelope({ employee_id: 1, permissions: allPermissions, name: 'Test Admin', email: 'admin@example.test', assigned_role: 'admin', status: 'active', preferred_language: state.preferred }) }); }
        if (path.endsWith('/admin/profile/language')) {
            state.writes++; expect(req.method()).toBe('PATCH');
            expect(Object.keys(req.postDataJSON())).toEqual(['preferred_language']);
            if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
            if (state.status !== 200) return route.fulfill({ status: state.status, json: { success: false } });
            state.preferred = req.postDataJSON().preferred_language;
            return route.fulfill({ json: envelope({ preferred_language: state.preferred }) });
        }
        if (path.endsWith('/admin/dashboard')) { state.dashboardLocales.push(req.headers()['accept-language']); return route.fulfill({ json: envelope({ users: { total: 0, customers: 0, providers: 0 }, stores: { total: 0, pending_requests: 0 }, orders: { total: 0 } }) }); }
        if (path.endsWith('/auth/logout')) return route.fulfill({ json: envelope(null) });
        return route.abort();
    });
    return state;
}

test('database preference wins before the first protected page request and refresh does not write', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/overview'); await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: 'نظرة عامة', exact: true })).toBeVisible();
    expect(state.dashboardLocales).toEqual(['ar']); expect(state.writes).toBe(0);
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(state.reads).toBe(2); expect(state.writes).toBe(0);
});

test('language switch saves once, survives browser preference removal, and serializes clicks', async ({ page }) => {
    const state = await setup(page, 'en'); state.delay = 350;
    await page.goto('/overview');
    const button = page.getByRole('button', { name: 'العربية', exact: true }); await button.click();
    await expect(button).toBeDisabled(); await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(state.writes).toBe(1); expect(state.preferred).toBe('ar');
    await page.evaluate(() => localStorage.removeItem('octogear.locale')); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); expect(state.writes).toBe(1);
});

test('failed preference save retains current language and supports explicit retry', async ({ page }) => {
    const state = await setup(page, 'en'); state.status = 503;
    await page.goto('/overview'); await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Your language preference could not be confirmed.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); expect(state.writes).toBe(1);
    state.status = 200; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); expect(state.writes).toBe(2);
});

test('first successful Arabic login initializes the preference without an extra PATCH', async ({ page }) => {
    const state = await setup(page, null, false);
    await page.goto('/login'); await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await page.locator('#email').fill('admin@example.test'); await page.locator('#password').fill('password');
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL('/overview');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); expect(state.preferred).toBe('ar'); expect(state.writes).toBe(0);
});

test('expired session during preference save cannot apply the stale language', async ({ page }) => {
    const state = await setup(page, 'en'); state.status = 401;
    await page.goto('/overview'); await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page).toHaveURL('/login'); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toBeNull();
});
