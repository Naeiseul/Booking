// Admin navigation/calendar regressions. Run: node tests/admin-navigation.cjs
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'admin-navigation.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
(async () => {
function assert(value, message) { if (!value) throw new Error(message); }
class Element {
    constructor(document) {
        this.document = document; this.children = []; this.attrs = {}; this.listeners = {};
        this.style = {}; this.className = ''; this.hidden = false; this.textContent = '';
        this.value = ''; this._html = '';
        this.classList = {
            add: name => { this.className += ' ' + name; },
            remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); }
        };
    }
    set innerHTML(value) { this._html = value; this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(element) { this.children.push(element); }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    focus() { this.document.activeElement = this; }
}
class Params {
    constructor(value) {
        this.values = {};
        (value || '').replace(/^\?/, '').split('&').filter(Boolean).forEach(item => {
            const [key, text = ''] = item.split('='); this.values[decodeURIComponent(key)] = decodeURIComponent(text);
        });
    }
    get(key) { return this.values[key] || null; }
}
class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 30, 12])); }
}
async function page(options = {}) {
    const nodes = {}, events = {}, calls = [];
    let ready, serviceArguments;
    const document = {
        activeElement: null, getElementById: id => {
            assert(nodes[id], 'Existing element: ' + id); return nodes[id];
        },
        createElement: () => new Element(document),
        querySelector: () => null,
        querySelectorAll: selector => selector === '.day-tab' ? nodes['day-tabs'].children : [],
        addEventListener: (_, callback) => { ready = callback; }
    };
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes[match[1]] = new Element(document);
    for (const id of ['admin-sidebar','services-panel','category-form','service-form','admin-view-business']) nodes[id].hidden = true;
    const window = {
        location: {
            pathname: options.pathname || '/admin/fixture/fixture-key',
            search: options.search || '', hash: options.hash || ''
        },
        addEventListener: (event, callback) => { events[event] = callback; },
        initializeAdminServices: args => { serviceArguments = args; }
    };
    new Function('window', 'document', navigation)(window, document);
    new Function('window','document','URLSearchParams','fetch','Date','SUPABASE_URL','SUPABASE_ANON_KEY','console','alert',admin)(
        window, document, Params, async (url, request) => {
            calls.push({ url, body: JSON.parse(request.body) });
            if (options.offline) throw new Error('Offline fixture');
            return { ok: true, json: async () => options.denied ? null : {
                name: '<img src=x onerror=alert(1)>', logo_url: 'https://fixture.invalid/logo.png',
                slots: [{ date: '2026-10-30', time: '07:00:00', status: 'open' }]
            } };
        }, ClockDate, 'https://fixture.invalid', 'test', { error() {} },
        () => { throw new Error('Unexpected slot error'); }
    );
    await ready();
    return {
        nodes, document, window, calls, serviceArguments,
        go(hash) { window.location.hash = hash; events.hashchange(); }
    };
}
let p = await page({ hash: '#categories' });
assert(!p.nodes['admin-sidebar'].hidden, 'Sidebar appears after successful existing admin lookup');
assert(!p.nodes['services-panel'].hidden && p.nodes['calendar-panel'].hidden, 'Old Categories hash opens Services');
assert(!p.nodes['nav-categories'] && p.nodes['nav-services'].attrs['aria-current'] === 'page', 'Only Calendar and Services navigation remain');
assert(p.nodes['admin-business-name'].textContent === '<img src=x onerror=alert(1)>', 'Business name uses safe text');
assert(p.nodes['admin-view-business'].href === '/fixture' && !p.nodes['admin-view-business'].href.includes('fixture-key'), 'View business never includes the admin key');
assert(p.nodes['biz-avatar-img'].src === 'https://fixture.invalid/logo.png', 'Configured business logo still loads in sidebar');
assert(p.serviceArguments.bizSlug === 'fixture' && p.serviceArguments.adminKey === 'fixture-key', 'Existing service initialisation is preserved');
const day = p.nodes['day-tabs'].children[0];
const slot = p.nodes['time-grid'].children[0];
assert(p.nodes['day-tabs'].children.length === 7 && slot.className.includes('open'), 'Calendar renders the existing week and stored opening');
p.nodes['category-form'].hidden = false;
p.nodes['category-label'].value = 'Unsaved category';
p.go('#services');
assert(!p.nodes['services-panel'].hidden, 'Services navigation works');
assert(p.nodes['category-label'].value === 'Unsaved category' && !p.nodes['category-form'].hidden, 'Cross-section navigation preserves an unsaved category draft');
assert(p.document.activeElement === p.nodes['services-heading'], 'Section navigation focuses its heading');
p.go('#calendar');
assert(!p.nodes['calendar-panel'].hidden && p.nodes['nav-calendar'].attrs['aria-current'] === 'page', 'Calendar navigation works');
assert(p.nodes['day-tabs'].children[0] === day && p.nodes['time-grid'].children[0] === slot, 'Navigation does not rebuild or lose calendar state');
assert(p.calls.length === 1, 'Navigation makes no extra admin/calendar RPC calls');
await slot.listeners.click();
assert(p.calls.at(-1).url.endsWith('/set_slot') && p.calls.at(-1).body.p_status === 'taken', 'Existing slot toggle still saves through set_slot');
assert(p.calls.at(-1).body.p_slug === 'fixture' && p.calls.at(-1).body.p_key === 'fixture-key', 'Slot request scope preserved');
p.go('#categories'); p.go('#calendar');
assert(p.nodes['time-grid'].children[0] === slot && slot.className.includes('taken'), 'Returning to calendar preserves edited slot');
p.go('#unknown');
assert(!p.nodes['calendar-panel'].hidden, 'Unknown section safely defaults to Calendar');
p.go('#categories'); p.go('#services'); p.go('#categories');
assert(!p.nodes['services-panel'].hidden, 'Old category hashes keep routing to Services');
p = await page({ pathname: '/admin.html', search: '?biz=query-business&key=fixture-key', hash: '#services' });
assert(p.serviceArguments.bizSlug === 'query-business' && p.nodes['admin-view-business'].href === '/query-business', 'Query-format links retain supported navigation/public destination');
assert(!p.nodes['services-panel'].hidden, 'Direct Services hash still works');
p = await page({ denied: true, hash: '#categories' });
assert(p.nodes['admin-sidebar'].hidden && !p.serviceArguments, 'Denied access does not reveal sidebar or initialise category/service controls');
assert(p.nodes['time-grid'].innerHTML.includes('could not verify'), 'Denied dashboard feedback retained');
p = await page({ offline: true });
assert(p.nodes['admin-sidebar'].hidden && !p.serviceArguments && p.nodes['time-grid'].innerHTML.includes('Connection failed'), 'Offline dashboard feedback retained');
p = await page({ pathname: '/admin/incomplete' });
assert(p.calls.length === 0 && p.nodes['admin-sidebar'].hidden && p.nodes['business-status'].textContent.includes('incomplete'), 'Incomplete admin links fail before any RPC');
assert(!html.includes('user-scalable=no'), 'Admin pinch zoom remains enabled');
assert(!html.includes('id="categories-panel"') && html.includes('id="category-dialog"'), 'Categories are managed only inside Services');
console.log('PASS: Services/Calendar and legacy category direct links and hash navigation; draft and calendar state preservation; existing slot saves; query links; public link excludes admin key; business identity; focus; denied/offline/incomplete access; zoom and table accessibility.');
})().catch(error => { console.error(error); process.exitCode = 1; });
