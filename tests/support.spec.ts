import { test, expect, Page, WebSocketRoute } from '@playwright/test';

const timestamp = '2026-10-22T10:00:00Z';
const msg = (id: number, content = `Message ${id}`, sender_kind = 'user') => ({ id, content, sender_kind, client_message_id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, created_at: timestamp });
function chat(id: number) {
    return { id, version: 1, status: id === 24 ? 'closed' : 'open', unread_count: 1, user_read_through_id: 0, support_read_through_id: 0,
        user: { id: id + 100, name: id === 1 ? 'Noura Khalid' : `Account ${id}`, mobile: `+96650000${String(id).padStart(4, '0')}`, type: id % 2 ? 'customer' : 'service provider' },
        last_message: msg(id === 1 ? 45 : 1), created_at: timestamp, updated_at: timestamp, last_activity_at: timestamp, closed_at: id === 24 ? timestamp : null, reopened_at: null as string | null, closed_by: id === 24 ? 1 : null as number | null };
}
async function setup(page: Page, live = false, options: {configStatus?: number; configDelay?: number} = {}) {
    const state = { configStatus: options.configStatus ?? 0, configDelay: options.configDelay ?? 0, rows: Array.from({length: 24}, (_, i) => chat(i + 1)), messages: Array.from({length:45}, (_,i) => msg(i+1)),
        calls: [] as {url: URL; method: string; body: any}[], sends: [] as any[], reads: [] as number[], statuses: [] as any[], events: [] as any[],
        failList: 0, delayList: 0, malformed: false, failRead: false, uncertainSend: false, rejectSend: 0, statusConflict: false, delayTimeline: 0, failTimeline: 0,
        socketAuth: [] as any[], sockets: [] as WebSocketRoute[], receipts: new Map<string, ReturnType<typeof msg>>() };
    await page.route('**/app-config.json', route => route.fulfill({json:{apiBaseUrl:'http://127.0.0.1:8000/api'}}));
    await page.addInitScript(() => { localStorage.setItem('octogear.locale', 'en'); sessionStorage.setItem('octogear.admin.session', JSON.stringify({apiBaseUrl:'http://127.0.0.1:8000/api',token:'support-test'})); });
    await page.routeWebSocket('ws://127.0.0.1:8080/app/**', socket => {
        state.sockets.push(socket);
        socket.send(JSON.stringify({event:'pusher:connection_established', data: JSON.stringify({socket_id:'123.456',activity_timeout:120})}));
        socket.onMessage(raw => {
            const frame = JSON.parse(String(raw));
            if (frame.event === 'pusher:subscribe') { expect(frame.data).toEqual({channel:'private-support.admin.sessions.10',auth:'test:signature'}); socket.send(JSON.stringify({event:'pusher_internal:subscription_succeeded',channel:frame.data.channel,data:'{}'})); }
            if (frame.event === 'pusher:ping') socket.send(JSON.stringify({event:'pusher:pong',data:'{}'}));
        });
    });
    await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({status:204});
        expect(req.headers()['authorization']).toBe('Bearer support-test');
        const body = req.postData() ? req.postDataJSON() : null;
        state.calls.push({url,method:req.method(),body});
        const ok = (data: unknown, meta?: unknown) => route.fulfill({json:{success:true,data,...(meta ? {meta} : {})}});
        const fail = (status: number) => route.fulfill({status,json:{success:false,message:'Rejected'}});
        if (path.endsWith('/admin/profile/language')) return ok(body);
        if (path.endsWith('/admin/profile')) return ok({employee_id:1,name:'Test Admin',status:'active'});
        if (path.endsWith('/admin/support/realtime/auth')) { state.socketAuth.push(body); return ok({auth:'test:signature'}); }
        if (path.endsWith('/admin/support/realtime')) {
            if (state.configDelay) await new Promise(resolve=>setTimeout(resolve,state.configDelay));
            if (state.configStatus) return fail(state.configStatus);
            return ok(live ? {enabled:true,url:'ws://127.0.0.1:8080/app/test',channel:'private-support.admin.sessions.10'} : {enabled:false});
        }
        if (path.endsWith('/admin/dashboard')) return ok({users:{total:0,customers:0,providers:0,blocked:0},stores:{total:0,active:0,inactive:0,pending_requests:0},orders:{total:0,pending:0,awaiting_payment:0,paid:0,completed:0,cancelled:0}});
        if (path.endsWith('/admin/support/conversations')) {
            if (state.failList) return fail(state.failList);
            if (state.malformed) return ok([{id:1}]);
            const q = url.searchParams, current = Number(q.get('page') || 1), status = q.get('status') || 'open';
            const rows = state.rows.filter(c => (status === 'all' || c.status === status) && (!q.get('type') || c.user.type === q.get('type')) && (!q.get('unread') || c.unread_count > 0) && (!q.get('search') || `${c.id} ${c.user.name} ${c.user.mobile}`.includes(q.get('search')!)));
            if (state.delayList) await new Promise(resolve=>setTimeout(resolve,state.delayList));
            return ok(rows.slice((current-1)*20,current*20),{current_page:current,last_page:Math.max(1,Math.ceil(rows.length/20)),total:rows.length,per_page:20});
        }
        const match = path.match(/\/admin\/support\/conversations\/(\d+)\/(timeline|messages|read|status|events)$/);
        if (!match) throw new Error(`Unexpected request ${req.method()} ${path}`);
        const c = state.rows.find(c => c.id === Number(match[1])); if (!c) return fail(404);
        if (match[2] === 'timeline') {
            if (state.failTimeline) return fail(state.failTimeline);
            const messages = c.id === 1 ? state.messages : [c.last_message];
            const after = url.searchParams.get('after_id'), before = url.searchParams.get('before_id');
            let selected = messages.filter(m => (after === null || m.id > Number(after)) && (before === null || m.id < Number(before)));
            if (after === null) selected = [...selected].reverse();
            const data = {conversation:{...c},messages:selected.slice(0,40).sort((a,b) => b.id-a.id),has_more:selected.length>40};
            if (state.delayTimeline) await new Promise(resolve => setTimeout(resolve,state.delayTimeline));
            return ok(data);
        }
        if (match[2] === 'messages') {
            state.sends.push(body); if (state.rejectSend) return fail(state.rejectSend);
            let message = state.receipts.get(body.client_message_id);
            if (!message) {
                if (c.status === 'closed') return fail(409);
                message = {...msg((state.messages.at(-1)?.id ?? 0)+1,body.content,'admin'),client_message_id:body.client_message_id};
                state.receipts.set(body.client_message_id,message); state.messages.push(message); c.last_message = message; c.version++;
            }
            if (state.uncertainSend) { state.uncertainSend = false; return route.abort(); }
            return ok({conversation:c,message});
        }
        if (match[2] === 'read') { state.reads.push(body.through_id); if (state.failRead) return fail(500); c.support_read_through_id = Math.max(c.support_read_through_id,body.through_id); c.unread_count = 0; c.version++; return ok(c); }
        if (match[2] === 'status') {
            state.statuses.push(body); if (state.statusConflict || body.version !== c.version) { c.version++; return fail(409); }
            state.events.unshift({id:state.events.length+1,actor_kind:'admin',actor_id:1,from_status:c.status,to_status:body.status,created_at:'2026-10-22 10:00:00'});
            c.status=body.status; c.version++; c.closed_at=c.status==='closed'?timestamp:null; c.closed_by=c.status==='closed'?1:null; c.reopened_at=c.status==='open'?timestamp:null;
            return ok(c);
        }
        return ok(state.events,{current_page:1,last_page:1,total:state.events.length,per_page:20});
    });
    await page.goto('/chats'); await expect(page.locator('tbody tr')).toHaveCount(20); return state;
}
async function open(page: Page) { await page.getByRole('link',{name:'Open chat #1',exact:true}).click(); await expect(page.locator('[data-message-id]')).toHaveCount(40); await page.locator('.support-latest-edge').scrollIntoViewIfNeeded(); }
async function select(page: Page, label: string, option: string) { await page.getByRole('combobox',{name:label,exact:true}).click(); await page.getByRole('option',{name:option,exact:true}).click(); await expect(page.getByRole('listbox')).toBeHidden(); }
function broadcast(state: Awaited<ReturnType<typeof setup>>, kind = 'message', conversation = state.rows[0], message: unknown = conversation.last_message) {
    state.sockets.at(-1)!.send(JSON.stringify({event:'support.updated',channel:'private-support.admin.sessions.10',data:JSON.stringify({kind,conversation,message})}));
}

test('support defaults to open, filters and paginates on the server, and retains the queue on return', async ({page}) => {
    const s = await setup(page);
    expect(s.calls.find(c => c.url.pathname.endsWith('/conversations'))?.url.searchParams.get('status')).toBe('open');
    expect(s.reads).toEqual([]);
    await page.getByRole('button',{name:'Next page',exact:true}).click(); await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.getByRole('link',{name:'Open chat #21',exact:true}).click(); await page.getByRole('link',{name:'Back to chats'}).click(); await expect(page).toHaveURL('/chats?page=2');
    await select(page,'Conversation status','Closed'); await page.getByRole('button',{name:'Apply filters'}).click(); await expect(page.locator('tbody tr')).toHaveCount(1);
    await select(page,'Conversation status','All conversations'); await select(page,'Account','Customers and providers');
    await page.getByLabel('Name, mobile or conversation ID').fill('Noura'); await page.getByRole('button',{name:'Apply filters'}).click();
    await expect(page.locator('tbody')).toContainText('Noura Khalid'); await open(page); await page.reload(); await expect(page.locator('[data-message-id]')).toHaveCount(40);
    await page.getByRole('link',{name:'Back to chats'}).click(); await expect(page).toHaveURL('/chats?search=Noura&status=all');
    await expect(page.getByLabel('Name, mobile or conversation ID')).toHaveValue('Noura');
});

test('history pages remain ordered, message text is escaped, and drafts survive navigation and language changes', async ({page}) => {
    const s = await setup(page); s.messages[44].content='<img src=x onerror=alert(1)> مرحباً'; await open(page);
    await expect(page.locator('.support-message img')).toHaveCount(0); await expect(page.locator('[data-message-id="45"]')).toContainText('<img src=x');
    await page.getByRole('button',{name:'Load earlier messages'}).click(); await expect(page.locator('[data-message-id]')).toHaveCount(45);
    expect(await page.locator('[data-message-id]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('data-message-id'))))).toEqual(Array.from({length:45},(_,i)=>i+1));
    await page.getByLabel('Reply to this account').fill('Saved draft'); await page.getByRole('link',{name:'Back to chats'}).click(); await open(page);
    await expect(page.getByLabel('Reply to this account')).toHaveValue('Saved draft');
    await page.getByRole('button',{name:'العربية',exact:true}).click(); await expect(page.getByLabel('الرد على صاحب الحساب')).toHaveValue('Saved draft');
    expect(s.sends).toHaveLength(0);
});

test('reply validation and successful send use one UUID and update the thread', async ({page}) => {
    const s = await setup(page); await open(page);
    await page.getByLabel('Reply to this account').fill(' '); await expect(page.getByRole('button',{name:'Send reply',exact:true})).toBeDisabled();
    await page.getByLabel('Reply to this account').fill('a'.repeat(2001)); await expect(page.getByRole('button',{name:'Send reply',exact:true})).toBeDisabled();
    await page.getByLabel('Reply to this account').fill('  We can help you.  '); await page.getByRole('button',{name:'Send reply',exact:true}).click();
    await expect(page.locator('.support-message').last()).toContainText('We can help you.'); await expect(page.getByLabel('Reply to this account')).toHaveValue('');
    expect(s.sends).toHaveLength(1); expect(s.sends[0].content).toBe('We can help you.'); expect(s.sends[0].client_message_id).toMatch(/^[\da-f-]{36}$/);
});

test('uncertain delivery keeps the retry identity across navigation and can replay after closure', async ({page}) => {
    const s = await setup(page); await open(page); s.uncertainSend=true;
    await page.getByLabel('Reply to this account').fill('Receipt may be lost'); await page.getByRole('button',{name:'Send reply',exact:true}).click();
    await expect(page.getByRole('button',{name:'Retry reply'})).toBeVisible(); await expect(page.getByLabel('Reply to this account')).toHaveAttribute('readonly','');
    await page.getByRole('link',{name:'Back to chats'}).click(); await expect(page.getByRole('link',{name:'Open chat #1',exact:true})).toBeVisible(); s.rows[0].status='closed'; s.rows[0].version++;
    await page.getByRole('link',{name:'Open chat #1',exact:true}).click(); await expect(page.getByRole('button',{name:'Retry reply'})).toBeVisible();
    await page.getByRole('button',{name:'Retry reply'}).click(); await expect(page.getByLabel('Reply to this account')).toHaveCount(0);
    expect(s.sends).toHaveLength(2); expect(s.sends[0]).toEqual(s.sends[1]); expect(s.messages.filter(m=>m.content==='Receipt may be lost')).toHaveLength(1);
});

test('closing is confirmed, preserves history, removes the open row, and reopening is audited', async ({page}) => {
    const s = await setup(page); await open(page); await expect.poll(()=>s.reads.length).toBe(1);
    await page.getByRole('button',{name:'Close conversation',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click(); await expect(page.getByRole('dialog')).toBeHidden(); expect(s.statuses).toHaveLength(0);
    await page.getByRole('button',{name:'Close conversation',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Close conversation'}).click();
    await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('button',{name:'Reopen conversation',exact:true})).toBeVisible(); await expect(page.locator('[data-message-id]')).toHaveCount(40); await expect(page.getByLabel('Reply to this account')).toHaveCount(0);
    await page.getByRole('link',{name:'Back to chats'}).click(); await expect(page.getByRole('link',{name:'Open chat #1',exact:true})).toHaveCount(0);
    await select(page,'Conversation status','Closed'); await page.getByRole('button',{name:'Apply filters'}).click(); await open(page);
    await page.getByRole('button',{name:'Reopen conversation',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Reopen conversation'}).click(); await expect(page.getByLabel('Reply to this account')).toBeVisible();
    await page.getByRole('button',{name:'Status history'}).click(); await expect(page.locator('.support-audit li')).toHaveCount(2); expect(s.statuses.map(b=>b.status)).toEqual(['closed','open']);
});

test('a stale status mutation is not retried automatically', async ({page}) => {
    const s = await setup(page); await open(page); await expect.poll(()=>s.reads.length).toBe(1); s.statusConflict=true;
    await page.getByRole('button',{name:'Close conversation',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Close conversation'}).click();
    await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('alert')).toContainText('The conversation changed'); await expect(page.getByRole('button',{name:'Close conversation',exact:true})).toBeEnabled();
    expect(s.statuses).toHaveLength(1); expect(s.rows[0].status).toBe('open');
});

test('read acknowledgements wait for the latest visible messages and retain unread counts on failure', async ({page}) => {
    const s = await setup(page); s.failRead=true; await open(page);
    const timeline=page.getByRole('region',{name:'Message history',exact:true}); await expect.poll(()=>timeline.evaluate(e=>e.scrollTop)).toBeGreaterThan(0); await timeline.evaluate(e => {e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});
    await page.waitForTimeout(1800); expect(s.reads).toHaveLength(0);
    await page.getByRole('button',{name:'Go to latest messages'}).click(); await expect.poll(()=>s.reads.length).toBe(1); await expect(page.getByRole('alert')).toContainText('read receipt');
    await expect(page.locator('.support-chat-bar')).toContainText('Unread messages: 1'); await page.waitForTimeout(1800); expect(s.reads).toHaveLength(1);
    s.failRead=false; await page.getByRole('button',{name:'Try again',exact:true}).click(); await expect(page.locator('.support-chat-bar')).toContainText('Unread messages: 0'); expect(s.reads).toEqual([45,45]);
});

test('live events authenticate privately, recover every HTTP gap, deduplicate and reject stale summaries', async ({page}) => {
    const s=await setup(page,true); await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible(); await open(page);
    expect(s.socketAuth[0]).toEqual({socket_id:'123.456',channel_name:'private-support.admin.sessions.10'});
    s.messages.push(...Array.from({length:85},(_,i)=>msg(i+46))); s.rows[0].last_message=s.messages.at(-1)!; s.rows[0].version=200; s.rows[0].unread_count=86;
    broadcast(s); broadcast(s); await expect(page.locator('[data-message-id]')).toHaveCount(125);
    const cursors=s.calls.filter(c=>c.url.pathname.endsWith('/timeline')).map(c=>c.url.searchParams.get('after_id'));
    expect(cursors).toEqual(expect.arrayContaining(['45','85','125'])); await expect(page.locator('[data-message-id="130"]')).toHaveCount(1);
    s.rows[0].status='closed';s.rows[0].version=300;broadcast(s,'status',s.rows[0],null); await expect(page.getByLabel('Reply to this account')).toHaveCount(0);
    broadcast(s,'status',{...s.rows[0],status:'open',version:1},null); await expect(page.getByLabel('Reply to this account')).toHaveCount(0);
    s.sockets.at(-1)!.close(); s.messages.push(msg(131,'Recovered after disconnect'));s.rows[0].last_message=s.messages.at(-1)!;s.rows[0].version=301;
    await expect(page.locator('[data-message-id="131"]')).toBeVisible(); expect(s.sockets.length).toBeGreaterThan(1);expect(s.calls.filter(c=>c.url.pathname.endsWith('/support/realtime'))).toHaveLength(1);
});

test('live queue refresh does not erase unapplied search text', async ({page}) => {
    const s=await setup(page,true); await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();
    await page.getByLabel('Name, mobile or conversation ID').fill('Draft filter'); broadcast(s); await page.waitForTimeout(700);
    await expect(page.getByLabel('Name, mobile or conversation ID')).toHaveValue('Draft filter');
    await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByLabel('Name, mobile or conversation ID')).toHaveValue('');
});

test('a busy live queue still completes slow reads without starving the results', async ({page}) => {
    const s=await setup(page,true);await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();s.delayList=800;s.rows[0].user.name='Updated account';
    const stream=setInterval(()=>broadcast(s),100);
    try { await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('tbody')).toContainText('Updated account',{timeout:2000}); }
    finally { clearInterval(stream); }
});

test('definitive reply rejection preserves editable text and a later send uses a fresh identity', async ({page}) => {
    const s=await setup(page);await open(page);s.rejectSend=422;
    await page.getByLabel('Reply to this account').fill('Please check the order.');await page.getByRole('button',{name:'Send reply',exact:true}).click();
    await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Reply to this account')).toBeEditable();
    s.rejectSend=0;await page.getByLabel('Reply to this account').fill('Please check order 123.');await page.getByRole('button',{name:'Send reply',exact:true}).click();
    await expect(page.getByLabel('Reply to this account')).toHaveValue('');expect(s.sends).toHaveLength(2);expect(s.sends[0].client_message_id).not.toBe(s.sends[1].client_message_id);
});

test('hidden conversations are not read and reconnect catches up before acknowledging', async ({page}) => {
    const s=await setup(page,true);await open(page);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    s.messages.push(msg(46,'Arrived while hidden'));s.rows[0].last_message=s.messages.at(-1)!;s.rows[0].version=10;
    await page.waitForTimeout(1800);expect(s.reads).toHaveLength(0);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.locator('[data-message-id="46"]')).toBeVisible();await expect.poll(()=>s.reads.at(-1)).toBe(46);
});

test('messages outside the viewport are not acknowledged merely because the thread is open', async ({page}) => {
    await page.setViewportSize({width:1280,height:480});const s=await setup(page);await open(page);
    await page.evaluate(()=>window.scrollTo(0,0));await expect(page.locator('.support-latest-edge')).not.toBeInViewport();
    await page.waitForTimeout(1800);expect(s.reads).toHaveLength(0);
    await page.locator('.support-latest-edge').scrollIntoViewIfNeeded();await expect.poll(()=>s.reads.at(-1)).toBe(45);
});

test('combined role and unread filters reach the API and a vanished last page returns to valid results', async ({page}) => {
    const s=await setup(page);await select(page,'Account','Service providers');await select(page,'Read status','Unread only');await page.getByRole('button',{name:'Apply filters'}).click();
    await expect(page.locator('tbody tr')).toHaveCount(11);expect(Object.fromEntries(s.calls.filter(c=>c.url.pathname.endsWith('/conversations')).at(-1)!.url.searchParams)).toMatchObject({type:'service provider',unread:'true',status:'open'});
    await page.getByRole('button',{name:'Clear filters'}).click();await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(3);
    s.rows=s.rows.slice(0,20);await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page).toHaveURL('/chats');await expect(page.locator('tbody tr')).toHaveCount(20);
});

test('empty, malformed, forbidden, failed and expired responses have explicit recovery', async ({page}) => {
    const s=await setup(page); await page.getByLabel('Name, mobile or conversation ID').fill('Unknown'); await page.getByRole('button',{name:'Apply filters'}).click();
    await expect(page.getByRole('heading',{name:'No matching conversations'})).toBeVisible();
    for (const status of [403,404,500]) { s.failList=status; await page.getByRole('button',{name:'Refresh',exact:true}).click(); await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible(); }
    s.failList=0;s.malformed=true;await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
    s.malformed=false;s.failList=401;await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page).toHaveURL('/login');
});

test('English and Arabic support layouts work on desktop and mobile', async ({page}) => {
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1600,height:1000});
    await setup(page);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'test-results/support-queue-desktop.png',fullPage:true});await open(page);
    await page.getByLabel('Reply to this account').fill('We are reviewing your request.');await page.screenshot({path:'test-results/support-thread-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'العربية',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await page.screenshot({path:'test-results/support-thread-arabic.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('الرد على صاحب الحساب')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/support-thread-mobile-arabic.png',fullPage:true});await page.getByRole('link',{name:'العودة إلى المحادثات'}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/support-queue-mobile-arabic.png',fullPage:true});expect(errors).toEqual([]);
});

test('realtime settings survive leaving Chats and visibility resumes without another GET', async ({page}) => {
    const s=await setup(page,true);await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();
    const configurations=()=>s.calls.filter(c=>c.url.pathname.endsWith('/support/realtime')).length;
    await page.getByRole('link',{name:'Overview',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Chats',exact:true}).click();await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();
    expect(configurations()).toBe(1);expect(s.sockets.length).toBe(2);
    await page.getByRole('button',{name:'العربية',exact:true}).click();
    expect(configurations()).toBe(1);
});

test('disabled realtime settings reload only on explicit reconnect or page reload', async ({page}) => {
    const s=await setup(page);await expect(page.getByText('Live updates are unavailable. Refresh to check for new messages.',{exact:true})).toBeVisible();
    const configurations=()=>s.calls.filter(c=>c.url.pathname.endsWith('/support/realtime')).length;
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});
    await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);expect(configurations()).toBe(1);
    await page.getByRole('button',{name:'Reconnect',exact:true}).click();await expect.poll(configurations).toBe(2);
    await page.reload();await expect(page.locator('tbody tr')).toHaveCount(20);await expect.poll(configurations).toBe(3);
});

test('failed configuration requests wait for manual recovery instead of retrying the API', async ({page}) => {
    const s=await setup(page,true,{configStatus:503});await expect(page.getByText('Live updates disconnected. Refresh to check for new messages.',{exact:true})).toBeVisible();
    const configurations=()=>s.calls.filter(c=>c.url.pathname.endsWith('/support/realtime')).length;
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});
    await page.waitForTimeout(3500);expect(configurations()).toBe(1);expect(s.sockets).toHaveLength(0);
    s.configStatus=0;await page.getByRole('button',{name:'Reconnect',exact:true}).click();await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();expect(configurations()).toBe(2);
});

test('visibility events during a slow configuration request share the same in-flight GET', async ({page}) => {
    const s=await setup(page,true,{configDelay:1000});
    await page.evaluate(()=>{for(let i=0;i<5;i++){document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));}});
    await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();expect(s.calls.filter(c=>c.url.pathname.endsWith('/support/realtime'))).toHaveLength(1);expect(s.sockets).toHaveLength(1);
});
