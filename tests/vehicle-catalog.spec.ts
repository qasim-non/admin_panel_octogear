import { test, expect, Page } from '@playwright/test';

async function setup(page: Page, start = '/car-companies') {
    const labels = [
        ['Audi', 'أودي', 'Germany', 'ألمانيا'], ['BMW', 'بي إم دبليو', 'Germany', 'ألمانيا'], ['BYD', 'بي واي دي', 'China', 'الصين'],
        ['Chevrolet', 'شيفروليه', 'United States', 'الولايات المتحدة'], ['Chery', 'شيري', 'China', 'الصين'], ['Dodge', 'دودج', 'United States', 'الولايات المتحدة'],
        ['Ford', 'فورد', 'United States', 'الولايات المتحدة'], ['Geely', 'جيلي', 'China', 'الصين'], ['GMC', 'جي إم سي', 'United States', 'الولايات المتحدة'],
        ['Honda', 'هوندا', 'Japan', 'اليابان'], ['Hyundai', 'هيونداي', 'South Korea', 'كوريا الجنوبية'], ['Isuzu', 'إيسوزو', 'Japan', 'اليابان'],
        ['Jeep', 'جيب', 'United States', 'الولايات المتحدة'], ['Kia', 'كيا', 'South Korea', 'كوريا الجنوبية'], ['Land Rover', 'لاند روفر', 'United Kingdom', 'المملكة المتحدة'],
        ['Lexus', 'لكزس', 'Japan', 'اليابان'], ['Mazda', 'مازدا', 'Japan', 'اليابان'], ['Mercedes-Benz', 'مرسيدس بنز', 'Germany', 'ألمانيا'],
        ['MG', 'إم جي', 'United Kingdom', 'المملكة المتحدة'], ['Mitsubishi', 'ميتسوبيشي', 'Japan', 'اليابان'], ['Nissan', 'نيسان', 'Japan', 'اليابان'],
        ['Peugeot', 'بيجو', 'France', 'فرنسا'], ['Renault', 'رينو', 'France', 'فرنسا'], ['Suzuki', 'سوزوكي', 'Japan', 'اليابان'],
        ['Tesla', 'تسلا', 'United States', 'الولايات المتحدة'], ['Toyota', 'تويوتا', 'Japan', 'اليابان'], ['Volkswagen', 'فولكس واجن', 'Germany', 'ألمانيا']
    ];
    const companies = labels.map(([name_en, name_ar, country_en, country_ar], i) => ({ id: i + 1, name_en, name_ar, country_en, country_ar }));
    const modelLabels = [['Camry', 'كامري'], ['Corolla', 'كورولا'], ['Crown', 'كراون'], ['Fortuner', 'فورتشنر'], ['Hilux', 'هايلكس'], ['Land Cruiser', 'لاند كروزر'], ['Prado', 'برادو'], ['RAV4', 'راف فور'], ['Yaris', 'يارس']];
    const models = Array.from({ length: 27 }, (_, i) => ({ id: 101 + i, company_id: i === 26 ? 21 : 26,
        name_en: i < 9 ? modelLabels[i][0] : i === 26 ? 'Sunny' : `Test model ${i + 1}`, name_ar: i < 9 ? modelLabels[i][1] : i === 26 ? 'صني' : `موديل تجريبي ${i + 1}` }));
    const state = { calls: [] as URL[], options: 0, status: 200, optionsStatus: 200, optionsDelay: 0, malformed: false, delay: '', companies, models };
    await page.addInitScript(() => {
        localStorage.setItem('octogear.locale', 'en');
        sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'catalog-test' }));
    });
    await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        expect(request.headers()['authorization']).toBe('Bearer catalog-test');
        if (path.endsWith('/admin/profile/language')) return route.fulfill({ json: { success: true, data: request.postDataJSON() } });
        expect(request.method()).toBe('GET');
        if (path.endsWith('/admin/profile')) return route.fulfill({ json: { success: true, data: { employee_id: 1, name: 'Test Admin', status: 'active' } } });
        if (path.endsWith('/car-companies/options')) {
            state.options++;
            if (state.optionsDelay) await new Promise(resolve => setTimeout(resolve, state.optionsDelay));
            return route.fulfill({ status: state.optionsStatus, json: { success: state.optionsStatus === 200, data: state.companies.map(({ id, name_en, name_ar }) => ({ id, name_en, name_ar })) } });
        }
        if (path.endsWith('/car-companies') || path.endsWith('/car-names')) {
            state.calls.push(url);
            if (state.status !== 200) return route.fulfill({ status: state.status, json: { success: false } });
            if (state.malformed) return route.fulfill({ json: { success: true, data: [{ id: 1 }] } });
            const arabic = request.headers()['accept-language'] === 'ar', q = url.searchParams, search = (q.get('search') || '').toLowerCase();
            const companyData = (id: number) => {
                const company = state.companies.find(c => c.id === id)!;
                return { id, name: arabic ? company.name_ar : company.name_en, country: { id: 1, name: arabic ? company.country_ar : company.country_en } };
            };
            const rows = path.endsWith('/car-companies')
                ? state.companies.filter(c => `${c.name_en} ${c.name_ar}`.toLowerCase().includes(search)).map(c => ({ ...companyData(c.id), models_count: state.models.filter(m => m.company_id === c.id).length }))
                : state.models.filter(m => (!q.get('company_id') || m.company_id === Number(q.get('company_id'))) && `${m.name_en} ${m.name_ar}`.toLowerCase().includes(search))
                    .map(m => ({ id: m.id, name: arabic ? m.name_ar : m.name_en, company: companyData(m.company_id) }));
            if (state.delay && search === state.delay) await new Promise(resolve => setTimeout(resolve, 700));
            const current = Number(q.get('page') || 1);
            return route.fulfill({ json: { success: true, data: rows.slice((current - 1) * 25, current * 25), meta: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 25)), per_page: 25, total: rows.length } } });
        }
        return route.abort();
    });
    await page.goto(start);
    await expect(page.locator('tbody tr')).toHaveCount(25);
    return state;
}

test('companies use 25 rows and link to scoped models with refresh-safe return navigation', async ({ page }) => {
    const state = await setup(page);
    expect(state.calls).toHaveLength(1); expect(state.options).toBe(0);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: 'View models — Toyota', exact: true }).click();
    await expect(page).toHaveURL('/car-models?company_id=26&companies_page=2');
    await expect(page.getByRole('heading', { name: 'Car models', exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    expect(state.options).toBe(0);
    await page.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.reload(); await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: 'Back to car companies' }).click();
    await expect(page).toHaveURL('/car-companies?page=2'); await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Company name', { exact: true }).fill('تويوتا');
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: 'View models — Toyota', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.getByRole('link', { name: 'Back to car companies' }).click();
    await expect(page.getByLabel('Company name', { exact: true })).toHaveValue('تويوتا');
});

test('company chooser loads once, searches locally in both languages, and combines filters', async ({ page }) => {
    const state = await setup(page, '/car-models'); state.optionsDelay = 350;
    expect(state.options).toBe(0);
    await page.getByRole('combobox', { name: 'Car company', exact: true }).click();
    await expect(page.getByText('Loading companies…', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Toyota', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search companies' }).fill('نيسان');
    await expect(page.getByRole('option', { name: 'Nissan', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search companies' }).fill('toy');
    await page.getByRole('option', { name: 'Toyota', exact: true }).click();
    await page.getByLabel('Model name', { exact: true }).fill('كامري');
    expect(state.calls).toHaveLength(1); expect(state.options).toBe(1);
    await page.getByRole('button', { name: 'Apply filters' }).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(Object.fromEntries(state.calls.at(-1)!.searchParams)).toEqual({ page: '1', search: 'كامري', company_id: '26' });
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(page.locator('tbody')).toContainText('كامري');
    await page.getByRole('combobox', { name: 'شركة السيارات', exact: true }).click();
    await expect(page.getByRole('option', { name: 'تويوتا', exact: true })).toBeVisible();
    expect(state.options).toBe(1);
});

test('company chooser failures retry explicitly and survive navigation using the shared cache', async ({ page }) => {
    const state = await setup(page, '/car-models'); state.optionsStatus = 500;
    await page.getByRole('combobox', { name: 'Car company', exact: true }).click();
    await expect(page.getByText('Companies could not be loaded.', { exact: true })).toBeVisible();
    state.optionsStatus = 200;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('option', { name: 'Toyota', exact: true }).click(); expect(state.options).toBe(2);
    await page.getByRole('link', { name: 'Back to car companies' }).click(); await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.locator('#main-navigation').getByRole('link', { name: 'Car models', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.getByRole('combobox', { name: 'Car company', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Toyota', exact: true })).toBeVisible(); expect(state.options).toBe(2);
});

test('empty, malformed, unavailable, denied and expired responses have useful recovery', async ({ page }) => {
    const state = await setup(page);
    await page.getByLabel('Company name', { exact: true }).fill('absent');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No matching records' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click(); await expect(page.locator('tbody tr')).toHaveCount(25);
    state.malformed = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(0);
    state.malformed = false; state.status = 403; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('You do not have permission to view the vehicle catalog.', { exact: true })).toBeVisible();
    state.status = 422; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('Check the search or clear the company filter. The company may no longer be available.', { exact: true })).toBeVisible();
    state.status = 200; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(25);
    state.status = 401; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page).toHaveURL(/\/login/);
});

test('new filters cancel stale results and vanished last pages recover', async ({ page }) => {
    const state = await setup(page); state.delay = 'audi';
    await page.getByLabel('Company name', { exact: true }).fill('audi'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => state.calls.some(url => url.searchParams.get('search') === 'audi')).toBe(true);
    await page.getByLabel('Company name', { exact: true }).fill('Toyota'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('tbody')).toContainText('Toyota');
    await page.waitForTimeout(800); await expect(page.locator('tbody')).not.toContainText('Audi');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(25);
    state.companies.splice(25);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page).toHaveURL('/car-companies'); await expect(page.locator('tbody tr')).toHaveCount(25);
});

test('catalog layouts support English, Arabic, mobile and keyboard table scrolling', async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: 'test-results/car-companies-desktop.png', fullPage: true });
    await page.locator('#main-navigation').getByRole('link', { name: 'Car models', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.screenshot({ path: 'test-results/car-models-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await expect(page.locator('tbody')).toContainText('كامري');
    await page.screenshot({ path: 'test-results/car-models-arabic.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const table = page.locator('.p-datatable-table-container'); await table.focus();
    const initial = await table.evaluate(element => element.scrollLeft);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).not.toBe(initial);
    await table.evaluate(element => { (element as HTMLElement).blur(); element.scrollLeft = 0; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/car-models-mobile-arabic.png', fullPage: true });
    await page.getByRole('link', { name: 'العودة إلى شركات السيارات' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/car-companies-mobile-arabic.png', fullPage: true });
});
