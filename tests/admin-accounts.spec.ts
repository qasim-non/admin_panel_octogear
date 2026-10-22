import { allPermissions, expect, Page, test } from './fixtures';

const timestamp = '2026-10-22T10:00:00Z';
const account = (id = 2) => ({ employee_id: id, name: `Team member ${id}`, email: `team${id}@example.test`, mobile: '+966501234567', assigned_role: 'developer', status: 'active', preferred_language: 'en', must_change_password: true, temporary_password_expires_at: timestamp, last_login_at: null, version: 1, created_at: timestamp });
const roles = [{ value: 'admin', permissions: allPermissions }, { value: 'developer', permissions: ['catalog.view', 'catalog.manage'] }, { value: 'hr', permissions: ['admins.view'] }, { value: 'employee', permissions: ['users.view', 'stores.view', 'orders.view', 'support.access'] }];

async function setup(page: Page, permissions = allPermissions, signedIn = true) {
    const state = { rows: Array.from({length:26}, (_,i)=>account(i+2)), calls: [] as {path:string;method:string;body:any}[], failWrite: 0, loginSetup: false, setupFail: false, profileMissingPermissions: false };
    await page.addInitScript(({signedIn}) => {
        localStorage.setItem('octogear.locale', 'en');
        if (signedIn) sessionStorage.setItem('octogear.admin.session', JSON.stringify({apiBaseUrl:'http://127.0.0.1:8000/api',token:'admin-account-test'}));
    }, {signedIn});
    await page.route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
        if (method === 'OPTIONS') return route.fulfill({status:204});
        const body = request.postData() ? request.postDataJSON() : null;
        state.calls.push({path,method,body});
        const ok = (data: unknown, meta?: unknown, status=200) => route.fulfill({status,json:{success:true,data,...(meta ? {meta} : {})}});
        if (path.endsWith('/auth/admin/login')) return ok(state.loginSetup ? {requires_password_change:true,challenge:'a'.repeat(64),expires_in:600} : {token:'admin-account-test'});
        if (path.endsWith('/auth/admin/password-setup')) {
            expect(request.headers()['authorization']).toBeUndefined();
            return state.setupFail ? route.fulfill({status:422,json:{success:false,message:'Password setup has expired. Sign in again.'}}) : ok({token:'admin-account-test'});
        }
        expect(request.headers()['authorization']).toBe('Bearer admin-account-test');
        if (path.endsWith('/admin/profile/language')) return ok(body);
        if (path.endsWith('/admin/profile/password')) return ok(null);
        if (path.endsWith('/admin/profile')) return ok({employee_id:1,name:'Test Administrator',email:'admin@example.test',assigned_role:permissions === allPermissions ? 'admin' : 'developer',status:'active',preferred_language:'en',...(!state.profileMissingPermissions ? {permissions} : {})});
        if (path.endsWith('/admin/accounts/roles')) return ok(roles);
        if (path.endsWith('/events')) return ok([{id:1,actor_id:1,action:'created',created_at:timestamp}],{current_page:1,last_page:1,per_page:25,total:1});
        if (path.endsWith('/admin/accounts') && method === 'GET') {
            const search = url.searchParams.get('search') ?? ''; const role = url.searchParams.get('role');
            const rows = state.rows.filter(row=>(!search || row.name.includes(search)) && (!role || row.assigned_role === role));
            const page = Number(url.searchParams.get('page') ?? 1);
            return ok(rows.slice((page-1)*25,page*25),{current_page:page,last_page:Math.max(1,Math.ceil(rows.length/25)),per_page:25,total:rows.length});
        }
        if (path.includes('/admin/accounts') && method !== 'GET') {
            if (state.failWrite) return route.fulfill({status:state.failWrite,json:{success:false,message:'Refresh this account before trying again.'}});
            expect(body.current_password).toBe('operator-password');
            if (method === 'POST' && path.endsWith('/accounts')) { const row={...account(50),...body}; delete row.password; delete row.current_password; state.rows.unshift(row); return ok(row,undefined,201); }
            if (method === 'DELETE') { state.rows=state.rows.filter(row=>!path.endsWith('/'+row.employee_id)); return ok(null); }
            return ok({...account(),version:2});
        }
        if (path.endsWith('/admin/car-companies')) return ok([],{current_page:1,last_page:1,per_page:25,total:0});
        if (path.endsWith('/auth/logout')) return ok(null);
        return route.abort();
    });
    return state;
}

test('directory keeps 25-row pages, filters, security details and requested menu order', async ({page}) => {
    const state=await setup(page); await page.goto('/sub-admins');
    await expect(page.getByRole('heading',{name:'Sub-admins',exact:true})).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(25);
    expect(await page.locator('.octogear-menu a').allTextContents()).toEqual(expect.arrayContaining(['Chats','Sub-admins','Car companies','Car models']));
    const labels=await page.locator('.octogear-menu a').allTextContents(); expect(labels.slice(-4)).toEqual(['Chats','Sub-admins','Car companies','Car models']);
    await page.getByRole('button',{name:'Next page',exact:true}).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Search team').fill('Team member 2'); await page.getByRole('button',{name:'Apply filters'}).click();
    await expect(page).toHaveURL(/search=Team%20member%202/);
    await page.getByRole('button',{name:'Team member 2',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('Allowed pages and actions');
    expect(state.calls.filter(c=>c.path.endsWith('/events'))).toHaveLength(0);
    await page.getByRole('button',{name:'View security history'}).click(); await expect(page.getByRole('dialog')).toContainText('Account created');
});

test('creation generates exactly 16 characters, previews permissions and preserves password only until closing', async ({page}) => {
    const state=await setup(page); await page.goto('/sub-admins'); await page.getByRole('button',{name:'Add administrator',exact:true}).click();
    await page.getByLabel('Full name',{exact:true}).fill('New colleague'); await page.getByLabel('Email address',{exact:true}).fill('new@example.test'); await page.getByLabel('Mobile number',{exact:true}).fill('0501234567');
    await page.locator('#staff-role').click(); await page.getByRole('option',{name:'Developer',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('Add, edit and delete car companies and models');
    await page.getByRole('button',{name:'Generate 16-character password'}).click();
    const password=await page.locator('#temporary-password').inputValue(); expect(password).toHaveLength(16); expect(password).toMatch(/[A-Z]/); expect(password).toMatch(/[a-z]/); expect(password).toMatch(/[0-9]/); expect(password).toMatch(/[!@#$%*_-]/);
    await page.getByLabel('Your current password',{exact:true}).fill('operator-password');
    await page.getByRole('button',{name:'Save account',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('No email or SMS was sent.');
    expect(state.calls.filter(c=>c.method==='POST' && c.path.endsWith('/accounts'))).toHaveLength(1);
    expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain(password);
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible(); await page.getByRole('button',{name:'Add administrator',exact:true}).click(); await expect(page.locator('#temporary-password')).toHaveValue('');
});

test('access edits use existing row data, current password and version; conflicts require refresh', async ({page}) => {
    const state=await setup(page); await page.goto('/sub-admins'); await page.getByRole('button',{name:'Edit administrator — Team member 2',exact:true}).click();
    await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Team member 2');
    await page.getByLabel('Your current password',{exact:true}).fill('operator-password'); state.failWrite=409;
    await page.getByRole('button',{name:'Save account',exact:true}).click(); await expect(page.getByRole('button',{name:'Save account',exact:true})).toBeDisabled();
    const write=state.calls.find(c=>c.method==='PATCH' && c.path.includes('/accounts/')); expect(write?.body.version).toBe(1); expect(write?.body.password).toBeUndefined();
    expect(state.calls.filter(c=>c.method==='GET' && /accounts\/\d+$/.test(c.path))).toHaveLength(0);
});

test('temporary password starts setup without profile requests, storage or a bearer token', async ({page},testInfo) => {
    const state=await setup(page,['catalog.view','catalog.manage'],false); state.loginSetup=true;
    await page.goto('/login'); await page.getByLabel('Email address',{exact:true}).fill('new@example.test'); await page.getByLabel('Password',{exact:true}).fill('Temporary-123456!'); await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Choose your password'})).toBeVisible(); expect(state.calls.filter(c=>c.path.endsWith('/profile'))).toHaveLength(0);
    expect(await page.evaluate(()=>sessionStorage.getItem('octogear.admin.session'))).toBeNull(); await expect(page.locator('#password')).toHaveCount(0);
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('password-setup.png'),fullPage:true});
    await page.getByLabel('New password',{exact:true}).fill('My-new-password-2026!'); await page.getByLabel('Confirm new password',{exact:true}).fill('Different-password!');
    await page.getByRole('button',{name:'Set password and continue'}).click(); await expect(page.getByText('The passwords do not match.')).toBeVisible();
    await page.getByLabel('Confirm new password',{exact:true}).fill('My-new-password-2026!'); await page.getByRole('button',{name:'Set password and continue'}).click();
    await expect(page).toHaveURL('/car-companies'); expect(state.calls.filter(c=>c.path.endsWith('/password-setup'))).toHaveLength(1);
});

test('expired setup remains outside the application and refresh discards the challenge', async ({page}) => {
    const state=await setup(page,allPermissions,false); state.loginSetup=true; state.setupFail=true;
    await page.goto('/login'); await page.getByLabel('Email address',{exact:true}).fill('new@example.test'); await page.getByLabel('Password',{exact:true}).fill('Temporary-123456!'); await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByLabel('New password',{exact:true}).fill('My-new-password-2026!'); await page.getByLabel('Confirm new password',{exact:true}).fill('My-new-password-2026!'); await page.getByRole('button',{name:'Set password and continue'}).click();
    await expect(page.getByText('Password setup has expired. Sign in again.')).toBeVisible();
    await page.reload(); await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible(); expect(state.calls.filter(c=>c.path.endsWith('/profile'))).toHaveLength(0);
});

test('developer sees only catalog pages and cannot navigate directly to staff or payments', async ({page}) => {
    const state=await setup(page,['catalog.view','catalog.manage']); await page.goto('/car-companies');
    await expect(page.locator('.octogear-menu a')).toHaveCount(2); await expect(page.locator('.octogear-menu')).not.toContainText('Sub-admins');
    await page.goto('/sub-admins'); await expect(page).toHaveURL('/access-denied'); expect(state.calls.filter(c=>c.path.endsWith('/accounts'))).toHaveLength(0);
    await page.goto('/payments'); await expect(page).toHaveURL('/access-denied');
});

test('HR directory has no creation or mutation controls', async ({page}) => {
    await setup(page,['admins.view']); await page.goto('/sub-admins'); await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page.getByRole('button',{name:'Add administrator',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:/Edit administrator/})).toHaveCount(0); await expect(page.getByRole('button',{name:/Reset temporary/})).toHaveCount(0);
});

test('settings changes password and clears the old session', async ({page},testInfo) => {
    const state=await setup(page); await page.goto('/settings');
    await expect(page.getByLabel('New password',{exact:true})).toBeVisible();
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('account-settings.png'),fullPage:true});
    await page.getByLabel('Your current password',{exact:true}).fill('old-password'); await page.getByLabel('New password',{exact:true}).fill('New-private-password!'); await page.getByLabel('Confirm new password',{exact:true}).fill('New-private-password!');
    await page.getByRole('button',{name:'Change password',exact:true}).click(); await expect(page).toHaveURL('/login?passwordChanged=1');
    await expect(page.getByText('Your password was changed and all sessions were signed out. Sign in with your new password.')).toBeVisible();
    expect(state.calls.filter(c=>c.path.endsWith('/profile/password'))).toHaveLength(1); expect(await page.evaluate(()=>sessionStorage.getItem('octogear.admin.session'))).toBeNull();
});

test('desktop and Arabic mobile staff forms stay within the viewport', async ({page},testInfo) => {
    await setup(page); await page.goto('/sub-admins'); await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('staff-desktop.png'),fullPage:true});
    await page.getByRole('button',{name:'العربية',exact:true}).click(); await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'إضافة مسؤول',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('staff-create-ar-mobile.png')});
    await page.locator('#operator-password').scrollIntoViewIfNeeded();
    await expect(page.locator('#temporary-password')).toBeVisible();
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('staff-password-ar-mobile.png')});
});
