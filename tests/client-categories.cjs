// Client category contract and interaction regressions. Run: node tests/client-categories.cjs
// All offerings/categories/slots below are in-memory fixtures; no network or business writes.
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
(async () => {
function assert(value, message) { if (!value) throw new Error(message); }
class Element {
    constructor(document) {
        this.document = document; this.children = []; this.dataset = {}; this.attrs = {};
        this.style = {}; this.listeners = {}; this.hidden = false; this.disabled = false;
        this.textContent = ''; this.className = ''; this._html = '';
        this.classList = {
            add: name => { this.className += ' ' + name; },
            remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); }
        };
    }
    set innerHTML(value) { this._html = value; this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(element) { this.children.push(element); }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    focus() { this.document.activeElement = this; }
}
class Params {
    constructor(value) {
        this.values = {};
        if (typeof value === 'string') value.replace(/^\?/, '').split('&').filter(Boolean).forEach(item => {
            const [key, text = ''] = item.split('='); this.values[decodeURIComponent(key)] = decodeURIComponent(text);
        });
        else Object.assign(this.values, value);
    }
    get(key) { return this.values[key] || null; }
    set(key, value) { this.values[key] = value; }
    toString() { return Object.entries(this.values).map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&'); }
}
class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 30, 12])); }
}
const service = (id, category_id, extra = {}) => ({
    id, category_id, name: 'Service ' + id, description: 'Configured description', service_type: 'private',
    duration_minutes: 90, price_amount: 12050, currency: 'ZAR', price_basis: 'per_person',
    participant_count: 2, ...extra
});
const initial = () => ({
    name: 'Fixture business',
    categories: [
        { id: 'consult', label: 'Consultations', icon: 'calendar', sort_order: 1 },
        { id: 'style', label: 'Styling', icon: 'person', sort_order: 2 },
        { id: 'empty', label: 'Must not be shown', icon: 'grid', sort_order: 3 }
    ],
    services: [
        service('a', 'consult'), service('b', 'style'),
        service('class', 'style', { service_type: 'class', participant_count: null })
    ],
    slots: [{ date: '2026-10-30', time: '10:00:00' }, { date: '2026-10-31', time: '11:00:00' }]
});
async function ui(data = initial(), search = '') {
    let start, poll;
    const state = { data, offline: false, calls: [] }, nodes = {};
    const document = {
        activeElement: null, getElementById: id => nodes[id] || null,
        createElement: () => new Element(document),
        addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') start = callback; },
        querySelector: selector => selector === '.catalogue-menu' ? menu : selector === '.catalogue-layout' ? layout : null
    };
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes[match[1]] = new Element(document);
    const menu = new Element(document), layout = new Element(document);
    const steps = ['sessions', 'schedule', 'checkout'].map(step => {
        const button = new Element(document); button.dataset.step = step; return button;
    });
    menu.querySelectorAll = () => steps;
    const window = { location: { pathname: '/fixture', search }, addEventListener() {} };
    new Function('document', 'window', 'fetch', 'setInterval', 'URLSearchParams', 'Date',
        'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'console', 'AbortController', 'setTimeout', 'clearTimeout', source)(
        document, window, async (url, request) => {
            state.calls.push({ url, body: JSON.parse(request.body) });
            if (state.offline) throw new Error('Offline fixture');
            return { ok: true, json: async () => JSON.parse(JSON.stringify(state.data)) };
        }, callback => { poll = callback; }, Params, ClockDate,
        'https://fixture.invalid', 'test', { error() {} }, class { constructor() { this.signal = {}; } abort() {} }, () => 0, () => {}
    );
    await start();
    return {
        get: id => nodes[id], document, window, state, layout, steps, poll: () => poll(),
        categories: () => nodes['category-buttons'].children,
        cards: () => nodes['client-services'].children,
        category(id) { return this.categories().find(button => button.dataset.categoryId === id); },
        card(id) { return this.cards().find(card => card.dataset.serviceId === id); },
        choose(id) { this.card(id).children[0].children.at(-1).listeners.click(); },
        time() { nodes['time-grid'].children[0].listeners.click(); }
    };
}
let p = await ui();
assert(p.categories().length === 2, 'Empty categories are not rendered');
assert(p.categories()[0].dataset.categoryId === 'consult', 'Configured RPC order preserved');
assert(p.category('consult').attrs['aria-pressed'] === 'true', 'First eligible category is active');
assert(p.get('active-category-heading').textContent === 'Consultations', 'Configured category heading');
assert(p.cards().length === 1 && p.card('a'), 'Initial list filtered by category ID');
assert(p.get('book-selected-slot').disabled, 'Published services require a valid selection');
p.choose('a'); p.time();
assert(p.card('a').className.includes('is-selected'), 'Selected card border class');
assert(p.card('a').children[0].children.at(-1).attrs['aria-pressed'] === 'true', 'Selected service accessible state');
assert(p.get('booking-summary-name').textContent === 'Service a', 'Booking summary retains the selected offering');
assert(!p.get('book-selected-slot').disabled, 'Date/time-only slot remains selectable');
const categoryButton = p.category('style');
categoryButton.focus(); categoryButton.listeners.click();
assert(p.category('style') === categoryButton && p.document.activeElement === categoryButton, 'Browsing preserves category button/focus');
assert(p.cards().length === 2 && p.card('b') && !p.card('a'), 'Filter switches in-page');
assert(p.card('class').children[0].children.at(-1).disabled, 'Class category does not invent scheduling');
assert(p.get('booking-summary-name').textContent === 'Service a' && !p.get('book-selected-slot').disabled, 'Category browsing preserves service/date/time in another category');
assert(p.get('time-grid').children[0].attrs['aria-pressed'] === 'true', 'Selected time remains visibly selected');
const card = p.card('b'), firstDate = p.get('day-tabs').children.find(button => button.dataset.date === '2026-10-30');
await p.poll();
assert(p.card('b') === card && p.category('style') === categoryButton, 'Unchanged polling retains card/category nodes');
assert(p.get('day-tabs').children.includes(firstDate), 'Category refresh does not replace unchanged calendar days');
p.category('consult').listeners.click();
assert(p.card('a').className.includes('is-selected'), 'Returning reveals the selected card');
p.choose('a');
assert(!p.get('book-selected-slot').disabled, 'Reselecting the same service preserves the chosen time');
p.category('style').listeners.click(); p.choose('b');
assert(p.get('book-selected-slot').disabled, 'Choosing a different offering clears time');
assert(p.get('time-grid').children[0].attrs['aria-pressed'] === 'false', 'Different offering clears the time highlight immediately');
p.time(); p.get('book-selected-slot').listeners.click();
assert(p.window.location.href.includes('service=b') && p.window.location.href.includes('time=10%3A00'), 'Details receives the selected service/time independently of category');
p.state.data.categories[1].label = 'Updated label';
p.category('style').focus(); await p.poll();
assert(p.get('active-category-heading').textContent === 'Updated label' && !p.get('book-selected-slot').disabled, 'Category label changes preserve booking selection');
assert(p.document.activeElement === p.category('style'), 'Category edit restores focused category');
p.state.data.services[1].price_amount = 15000; await p.poll();
assert(p.get('book-selected-slot').disabled, 'Selected service edits require time revalidation');
assert(p.get('booking-summary-price').textContent.includes('300'), 'Summary uses current configured per-person total');
p.time();
p.state.data.services = p.state.data.services.filter(item => item.id !== 'b');
await p.poll();
assert(p.get('booking-summary-service').hidden && p.get('book-selected-slot').disabled, 'Server hiding/deactivating/removing service clears selection');
p.choose('class'); assert(p.get('booking-summary-service').hidden, 'Disabled class selection is inert');

p = await ui(initial(), '?service=b');
assert(p.category('style').attrs['aria-pressed'] === 'true' && p.card('b').className.includes('is-selected'), 'Back link restores service and its category');
p.time();
p.category('consult').listeners.click();
p.state.data.categories = p.state.data.categories.filter(item => item.id !== 'consult');
p.state.data.services = p.state.data.services.filter(item => item.category_id !== 'consult');
await p.poll();
assert(p.category('style').attrs['aria-pressed'] === 'true' && !p.get('book-selected-slot').disabled, 'Removed browse category falls back without clearing a different valid service/time');
p.steps[2].listeners.click();
assert(p.get('category-navigation').hidden && p.layout.attrs['data-has-categories'] === 'false', 'Checkout hides category navigation without an empty desktop column');
p.steps[0].listeners.click();
assert(!p.get('category-navigation').hidden && !p.get('book-selected-slot').disabled, 'Step navigation restores categories and preserves booking');
p.state.offline = true; await p.poll();
assert(p.get('book-selected-slot').disabled, 'Failed refresh disables continuation');
p.state.offline = false; await p.poll();
assert(!p.get('book-selected-slot').disabled, 'Recovery revalidates the preserved booking');
p.state.data.categories = [];
p.state.data.services = []; await p.poll();
assert(p.get('category-navigation').hidden && p.get('booking-summary-service').hidden, 'All categories/services removed clears selected service and hides navigation');
assert(p.cards().length === 1 && p.cards()[0].children[0].children[0].textContent === 'No services added yet', 'Honest empty catalogue without invented cards');
p.time(); assert(!p.get('book-selected-slot').disabled, 'Empty catalogue preserves the original slot-only flow');

p = await ui({ name: 'Empty', categories: [], services: [], slots: [] });
assert(p.get('category-navigation').hidden && p.categories().length === 0, 'Empty business does not show hardcoded categories');
assert(p.get('book-selected-slot').disabled && p.get('time-grid').innerHTML.includes('No available times'), 'No fabricated availability');
p.state.data = null; await p.poll();
assert(p.get('booking-summary').hidden && p.get('category-navigation').hidden, 'Missing/inactive business hides catalogue/booking');
p = await ui();
p.choose('a'); p.time();
p.state.data.categories = p.state.data.categories.filter(item => item.id !== 'consult');
await p.poll();
assert(p.get('book-selected-slot').disabled, 'Inconsistent public category response fails closed');
assert(p.state.calls.every(call => call.url.endsWith('/get_public_page') && call.body.p_slug === 'fixture'), 'Only the existing public RPC is used');

const unsafe = initial();
unsafe.categories[0].label = '<img src=x onerror=alert(1)>';
unsafe.categories[0].icon = '__proto__';
unsafe.services[0].name = '<script>service</script>';
p = await ui(unsafe);
assert(p.category('consult').children[1].textContent === unsafe.categories[0].label, 'Category text never becomes markup');
assert(p.card('a').children[0].children[0].textContent === unsafe.services[0].name, 'Service text never becomes markup');
assert(p.category('consult').children[0].innerHTML.includes('<rect') &&
    !p.category('consult').children[0].innerHTML.includes('__proto__'), 'Unknown icons use allowlisted grid artwork');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
assert(ids.length === new Set(ids).size, 'Unique IDs');
assert(html.includes('aria-label="Service categories"'), 'Category navigation has an accessible name');
console.log('PASS: configured categories/order; empty filtering; icons and safe text; in-page filters; selected cards; category/service/type separation; category/step/polling preservation and focus; back links; service/category removal and edits; offline/recovery; fail-closed malformed data; empty slot-only flow; no invented availability.');
})().catch(error => { console.error(error); process.exitCode = 1; });
