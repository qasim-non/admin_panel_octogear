import { allPermissions } from './fixtures';
import { test, expect, Page } from './fixtures';

async function setup(page: Page, start = '/car-companies') {
    const state = { reads: 0, options: 0, countries: 0, status: 200, writes: [] as { method: string; body: any }[],
        companies: [{ id: 1, name_en: 'Toyota', name_ar: 'تويوتا', country_id: 1, version: 'a'.repeat(64) }],
        models: [{ id: 2, name_en: 'Camry', name_ar: 'كامري', car_company_id: 1, version: 'a'.repeat(64) }] };
    await page.addInitScript(() => {
        localStorage.setItem('octogear.locale', 'en');
        sessionStorage.setItem('octogear.admin.session', JSON.stringify({ apiBaseUrl: 'http://127.0.0.1:8000/api', token: 'crud-test' }));
    });
    await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname, method = request.method(), ar = request.headers()['accept-language'] === 'ar';
        if (method === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path.endsWith('/profile/language')) return route.fulfill({ json: { success: true, data: request.postDataJSON() } });
        if (path.endsWith('/profile')) return route.fulfill({ json: { success: true, data: { employee_id: 1, permissions: allPermissions, name: 'Admin', status: 'active' } } });
        if (path.endsWith('/catalog-countries/options')) { state.countries++; return route.fulfill({ json: { success: true, data: [{ id: 1, name_en: 'Japan', name_ar: 'اليابان' }] } }); }
        if (path.endsWith('/car-companies/options')) { state.options++; return route.fulfill({ json: { success: true, data: state.companies } }); }
        const companies = path.includes('car-companies'), rows: any[] = companies ? state.companies : state.models;
        if (method !== 'GET') {
            const body = request.postDataJSON(); state.writes.push({ method, body });
            if (state.status === 0) return route.abort('failed');
            if (state.status !== 200) return route.fulfill({ status: state.status, json: { success: false, message: state.status === 409 ? 'This record is in use.' : 'Validation failed.', errors: { name_en: ['This name already exists.'] } } });
            const id = Number(path.split('/').at(-1));
            if (method === 'DELETE') rows.splice(rows.findIndex(row => row.id === id), 1);
            else if (method === 'PATCH') Object.assign(rows.find(row => row.id === id), body, { version: 'b'.repeat(64) });
            else rows.push({ ...body, id: 100, version: 'a'.repeat(64) });
            return route.fulfill({ status: method === 'POST' ? 201 : 200, json: { success: true, data: null } });
        }
        state.reads++;
        const companyData = (c: any) => ({ ...c, name: ar ? c.name_ar : c.name_en, country: c.country_id ? { id: 1, name: ar ? 'اليابان' : 'Japan' } : null, models_count: state.models.filter(m => m.car_company_id === c.id).length });
        return route.fulfill({ json: { success: true, data: rows.map(row => companies ? companyData(row) : { ...row, name: ar ? row.name_ar : row.name_en, company: companyData(state.companies.find(c => c.id === row.car_company_id)) }), meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length } } });
    });
    await page.goto(start); await expect(page.locator('tbody tr')).toHaveCount(1);
    return state;
}

test('company CRUD validates both names, uses cached local country search and confirms deletion', async ({ page }) => {
    const state = await setup(page);
    await page.getByRole('button', { name: 'Add company', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByText('Enter a name of 1 to 100 characters.')).toHaveCount(2); expect(state.writes).toHaveLength(0);
    await dialog.getByLabel('English name').fill('Test Motors'); await dialog.getByLabel('Arabic name').fill('شركة اختبار');
    await dialog.getByRole('combobox').click(); await page.getByRole('searchbox', { name: 'Search countries' }).fill('اليابان');
    await page.getByRole('option', { name: 'Japan', exact: true }).click(); expect(state.countries).toBe(1);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toHaveCount(0); await expect(page.locator('tbody')).toContainText('Test Motors');
    expect(state.writes).toEqual([{ method: 'POST', body: { name_en: 'Test Motors', name_ar: 'شركة اختبار', country_id: 1 } }]);
    const reads = state.reads;
    await page.getByRole('button', { name: 'Edit — Test Motors', exact: true }).click();
    await expect(dialog.getByLabel('English name')).toHaveValue('Test Motors'); expect(state.reads).toBe(reads);
    await dialog.getByRole('combobox').click(); await page.getByRole('option', { name: 'Japan', exact: true }).click(); expect(state.countries).toBe(1);
    await dialog.getByLabel('English name').fill('Renamed Motors'); await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('tbody')).toContainText('Renamed Motors'); expect(state.writes.at(-1)?.method).toBe('PATCH');
    await page.getByRole('button', { name: 'Delete — Renamed Motors', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(state.writes).toHaveLength(2);
    await page.getByRole('button', { name: 'Delete — Renamed Motors', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('tbody')).not.toContainText('Renamed Motors'); expect(state.writes.at(-1)?.body).toEqual({ version: 'b'.repeat(64) });
});

test('model names can be created and edited without moving existing vehicle assignments', async ({ page }) => {
    const state = await setup(page, '/car-models'); const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add model', exact: true }).click();
    await dialog.getByLabel('English name').fill('Corolla'); await dialog.getByLabel('Arabic name').fill('كورولا');
    await dialog.getByRole('button', { name: 'Save changes' }).click(); expect(state.writes).toHaveLength(0);
    await dialog.getByRole('combobox').click(); await page.getByRole('searchbox', { name: 'Search companies' }).fill('تويوتا');
    await page.getByRole('option', { name: 'Toyota', exact: true }).click(); expect(state.options).toBe(1);
    await dialog.getByRole('button', { name: 'Save changes' }).click(); await expect(page.locator('tbody')).toContainText('Corolla');
    await page.getByRole('button', { name: 'Edit — Corolla', exact: true }).click(); await expect(dialog.getByRole('combobox')).toHaveCount(0);
    await dialog.getByLabel('Arabic name').fill('كورولا معدلة'); await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toHaveCount(0); expect(state.writes.at(-1)?.body.car_company_id).toBe(1);
    await page.getByRole('button', { name: 'Delete — Corolla', exact: true }).click(); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('validation stays editable but conflicts and uncertain writes require a refreshed list', async ({ page }) => {
    const state = await setup(page); const dialog = page.getByRole('dialog');
    state.status = 422; await page.getByRole('button', { name: 'Edit — Toyota', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click(); await expect(dialog.getByText('This name already exists.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    state.status = 409; await page.getByRole('button', { name: 'Delete — Toyota', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(dialog.getByText('This record is in use.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect.poll(() => state.reads).toBe(2);
    state.status = 0; await page.getByRole('button', { name: 'Edit — Toyota', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click(); await expect(dialog.getByText(/The result could not be confirmed/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled(); expect(state.writes).toHaveLength(3);
});

test('company writes invalidate shared options and dialogs fit Arabic mobile layouts', async ({ page }) => {
    const state = await setup(page, '/car-models');
    await page.getByRole('combobox', { name: 'Car company', exact: true }).click(); await page.getByRole('option', { name: 'Toyota', exact: true }).click(); expect(state.options).toBe(1);
    await page.getByRole('link', { name: 'Back to car companies' }).click();
    await page.getByRole('button', { name: 'Edit — Toyota', exact: true }).click();
    await page.getByLabel('English name').fill('Updated Toyota'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.locator('tbody')).toContainText('Updated Toyota');
    await page.locator('#main-navigation').getByRole('link', { name: 'Car models', exact: true }).click();
    await page.getByRole('combobox', { name: 'Car company', exact: true }).click(); await expect(page.getByRole('option', { name: 'Updated Toyota', exact: true })).toBeVisible(); expect(state.options).toBe(2);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'العربية' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'إضافة موديل', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('الاسم بالعربية')).toBeVisible();
    const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await expect(dialog).toHaveCSS('opacity', '1');
    await page.screenshot({ path: 'test-results/catalog-create-model-ar-mobile.png', fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: 'English' }).click();
    await page.getByRole('button', { name: 'Edit — Camry', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: 'test-results/catalog-edit-model-desktop.png', fullPage: true, animations: 'disabled' });
});
