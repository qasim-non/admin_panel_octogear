import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

const profile = { employee_id: 1, permissions: allPermissions, name: 'Test Administrator', email: 'admin@example.test', assigned_role: 'admin', status: 'active' };
const overview = { users: {total: 38, customers: 31, providers: 7, blocked: 0}, stores: {total: 9, active: 8, inactive: 1, pending_requests: 3}, orders: {total: 26, pending: 5, awaiting_payment: 3, paid: 7, completed: 10, cancelled: 1} };
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });

async function mockApi(page: Page, dashboardStatus = 200) {
    await page.route('http://127.0.0.1:8000/api/**', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const path = new URL(route.request().url()).pathname;
        const headers = route.request().headers();
        if (path.endsWith('/auth/admin/login')) {
            expect(route.request().postDataJSON()).toEqual({ email: 'admin@example.test', password: 'password', preferred_language: 'en' });
            return route.fulfill({ json: envelope({token: 'test-only-token'}) });
        }
        expect(headers['authorization']).toBe('Bearer test-only-token');
        expect(['en', 'ar']).toContain(headers['accept-language']);
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: envelope({ preferred_language: route.request().postDataJSON().preferred_language }) });
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: envelope(profile) });
        if (path.endsWith('/admin/dashboard')) return route.fulfill({ status: dashboardStatus, json: envelope(overview) });
        if (path.endsWith('/auth/logout')) return route.fulfill({ json: envelope(null) });
        return route.abort();
    });
}

async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email address', {exact: true}).fill('admin@example.test');
    await page.getByLabel('Password', {exact: true}).fill('password');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
}

test('validates locally, reveals password, and explains recovery honestly', async ({page}) => {
    let requests = 0;
    await page.route('**/api/**', route => { requests++; return route.abort(); });
    await page.goto('/login');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Enter your password (at least 6 characters).')).toBeVisible();
    expect(requests).toBe(0);
    await page.getByRole('button', {name: 'Show password', exact: true}).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', {name: 'Forgot password?'}).click();
    await expect(page.getByRole('dialog')).toContainText('Self-service password recovery is not available yet.');
    await page.getByRole('button', {name: 'Got it'}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('Arabic layout, mobile sizing, and persisted language', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/login');
    await page.getByRole('button', {name: 'العربية'}).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', {name: 'أهلاً بعودتك'})).toBeVisible();
    await expect(page.locator('#email')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('login uses the contract, shows API data, and logout clears access', async ({page}) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL('/overview');
    await expect(page.getByText('Test Administrator')).toBeVisible();
    await expect(page.locator('table')).toContainText('Completed');
    await expect(page.locator('.metric').first()).toContainText('31');
    expect(await page.evaluate(() => JSON.stringify({...localStorage}))).not.toContain('test-only-token');
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toContain('test-only-token');
    await page.getByRole('button', {name: 'Sign out', exact: true}).click();
    await expect(page).toHaveURL('/login');
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toBeNull();
    await page.goto('/overview');
    await expect(page).toHaveURL('/login');
});

test('401 during an authenticated request ends the session', async ({page}) => {
    await mockApi(page, 401);
    await login(page);
    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
});

test('incorrect credentials are shown without granting access', async ({page}) => {
    await page.route('**/api/auth/admin/login', route => route.fulfill({status: 401, json: {success:false, message:'Invalid credentials'}}));
    await login(page);
    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL('/login');
});

test('network failure offers a clear error and allows another attempt', async ({page}) => {
    await page.route('**/api/auth/admin/login', route => route.abort('connectionrefused'));
    await login(page);
    await expect(page.getByText('Cannot connect right now. Check your connection and try again.')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeEnabled();
});

test('blocked accounts and rate limits have distinct feedback', async ({page}) => {
    for (const [status, message] of [[403, 'This account cannot access the admin panel. Contact your administrator.'], [429, 'Too many attempts. Please wait a minute and try again.']] as const) {
        await page.route('**/api/auth/admin/login', route => route.fulfill({status, json:{success:false, message:'Denied'}}));
        await login(page);
        await expect(page.getByText(message)).toBeVisible();
        await page.unroute('**/api/auth/admin/login');
    }
});

test('dashboard errors are recoverable and never render fake counts', async ({page}) => {
    await mockApi(page, 500);
    await login(page);
    await expect(page).toHaveURL('/overview');
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
    await expect(page.locator('.metric')).toHaveCount(0);
    await page.route('**/api/admin/dashboard', route => route.fulfill({json: envelope(overview)}));
    await page.getByRole('button', {name:'Try again'}).click();
    await expect(page.locator('.metric')).toHaveCount(4);
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:'test-results/overview-desktop.png',fullPage:true});
    await page.getByRole('button', {name:'العربية'}).click();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({path:'test-results/overview-mobile-arabic.png',fullPage:true});
});

test('configuration failure does not fall back to another API', async ({page}) => {
    let requests = 0;
    await page.route('**/app-config.json', route => route.fulfill({json:{apiBaseUrl:'https://example.test/api?secret=x'}}));
    await page.route('**/api/**', route => {requests++; return route.abort();});
    await page.goto('/login');
    await expect(page.getByText('The application could not load its connection settings. Please contact your administrator.')).toBeVisible();
    await expect(page.getByRole('button', {name:'Sign in', exact:true})).toHaveCount(0);
    expect(requests).toBe(0);
});

test('runtime API URL routes requests and tokens only to the configured server', async ({page}) => {
    const requests: string[] = [];
    await page.route('**/app-config.json', route => route.fulfill({json:{apiBaseUrl:'https://api.example.test/api'}}));
    await page.route('https://api.example.test/api/**', route => {
        requests.push(route.request().url());
        if (route.request().url().endsWith('/login')) return route.fulfill({json:envelope({token:'alternate-token'})});
        expect(route.request().headers()['authorization']).toBe('Bearer alternate-token');
        return route.fulfill({json:envelope(route.request().url().endsWith('/profile') ? profile : overview)});
    });
    await login(page);
    await expect(page).toHaveURL('/overview');
    await expect(page.locator('table')).toBeVisible();
    expect(requests.length).toBe(3);
    expect(requests.every(url => url.startsWith('https://api.example.test/api/'))).toBeTruthy();
});

test('desktop and mobile screenshots have no horizontal overflow', async ({page}) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('/login');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:'test-results/login-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'العربية'}).click();
    await page.screenshot({path:'test-results/login-arabic.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(consoleErrors).toEqual([]);
});

test('refresh verifies the saved session once and keeps the current URL', async ({page}) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL('/overview');
    let profiles = 0;
    let loginCalls = 0;
    await page.route('**/api/admin/profile', route => { profiles++; return route.fulfill({json: envelope(profile)}); });
    await page.route('**/api/auth/admin/login', route => { loginCalls++; return route.abort(); });
    await page.reload();
    await expect(page.getByText('Test Administrator')).toBeVisible();
    await expect(page).toHaveURL('/overview');
    expect(profiles).toBe(1);
    expect(loginCalls).toBe(0);
    expect(await page.evaluate(() => JSON.stringify({...sessionStorage}))).not.toContain('password');
});

test('revoked or blocked saved sessions are removed before rendering protected content', async ({page}) => {
    for (const status of [401, 403]) {
        await mockApi(page);
        await login(page);
        await expect(page).toHaveURL('/overview');
        await page.route('**/api/admin/profile', route => route.fulfill({status, json: {success:false}}));
        await page.reload();
        await expect(page).toHaveURL('/login');
        await expect(page.getByText('Test Administrator')).toHaveCount(0);
        expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toBeNull();
        await page.unroute('**/api/admin/profile');
    }
});

test('temporary session verification failure preserves login and retries without a password', async ({page}) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL('/overview');
    await page.route('**/api/admin/profile', route => route.fulfill({status:503, json:{success:false}}));
    await page.reload();
    await expect(page.getByRole('heading', {name:'Unable to verify your session'})).toBeVisible();
    await expect(page.getByText('Test Administrator')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toContain('test-only-token');
    await page.unroute('**/api/admin/profile');
    await page.getByRole('button', {name:'Try again', exact:true}).click();
    await expect(page).toHaveURL('/overview');
    await expect(page.getByText('Test Administrator')).toBeVisible();
});

test('changing API configuration never sends an old saved token to the new server', async ({page}) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL('/overview');
    await page.route('**/app-config.json', route => route.fulfill({json:{apiBaseUrl:'https://different.example.test/api'}}));
    const requests: string[] = [];
    await page.route('https://different.example.test/api/**', route => { requests.push(route.request().url()); return route.abort(); });
    await page.reload();
    await expect(page).toHaveURL('/login');
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toBeNull();
});

test('storage denial still permits an in-memory login', async ({page}) => {
    await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
        Storage.prototype.getItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
        Storage.prototype.removeItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    });
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL('/overview');
    await expect(page.getByText('Test Administrator')).toBeVisible();
});

test('malformed saved session is discarded without an API request', async ({page}) => {
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.setItem('octogear.admin.session', '{broken'));
    let requests = 0;
    await page.route('**/api/**', route => { requests++; return route.abort(); });
    await page.reload();
    await expect(page.getByRole('button', {name:'Sign in', exact:true})).toBeVisible();
    expect(requests).toBe(0);
    expect(await page.evaluate(() => sessionStorage.getItem('octogear.admin.session'))).toBeNull();
});
