const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'admin-services.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');

class Element {
    constructor() {
        this.value = ''; this.checked = false; this.hidden = false; this.disabled = false;
        this.required = false; this.textContent = ''; this.children = []; this.listeners = {};
        this.attributes = {}; this.focused = false;
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { this.focused = true; }
}
function backend() {
    const records = new Map();
    const categories = new Map();
    const state = { records, categories, calls: [], offline: false, failAfterSave: false, conflict: false, pause: null };
    let version = 0;
    state.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        state.calls.push({ url, body });
        if (state.pause) await state.pause;
        if (state.offline) throw Error('offline');
        if (url.endsWith('/get_admin_services')) return { ok: true, json: async () => [...records.values()] };
        if (url.endsWith('/get_admin_categories')) return { ok: true, json: async () => [...categories.values()] };
        if (state.conflict) return { ok: false, json: async () => ({ code: '40001' }) };
        if (url.endsWith('/save_admin_category')) {
            const previous = categories.get(body.p_id);
            const saved = previous && !body.p_expected_updated_at ? previous : {
                id: body.p_id, label: body.p_label, icon: body.p_icon, enabled: body.p_enabled,
                sort_order: body.p_sort_order, created_at: 'created', updated_at: 'category-version-' + ++version
            };
            categories.set(saved.id, saved);
            if (state.failAfterSave) { state.failAfterSave = false; throw Error('lost response'); }
            return { ok: true, json: async () => saved };
        }
        const previous = records.get(body.p_id);
        const saved = previous && !body.p_expected_updated_at ? previous : {
            id: body.p_id, name: body.p_name, description: body.p_description,
            service_type: body.p_service_type, duration_minutes: body.p_duration_minutes,
            price_amount: body.p_price_amount, price_basis: body.p_price_basis,
            participant_count: body.p_participant_count, is_published: body.p_is_published,
            category_id: body.p_category_id, is_active: body.p_is_active,
            currency: 'ZAR', updated_at: 'version-' + ++version
        };
        records.set(saved.id, saved);
        if (state.failAfterSave) { state.failAfterSave = false; throw Error('lost response'); }
        return { ok: true, json: async () => saved };
    };
    return state;
}
async function ui(api) {
    const elements = {};
    for (const match of html.matchAll(/id="([^"]+)"/g)) elements[match[1]] = new Element();
    const get = id => {
        assert(elements[id], 'Referenced element exists: ' + id);
        return elements[id];
    };
    for (const id of ['service-form', 'services-error', 'services-message', 'service-form-error', 'services-empty', 'category-form', 'category-form-error', 'categories-empty']) get(id).hidden = true;
    get('service-form').reset = () => {};
    get('service-form').reportValidity = () => true;
    get('category-form').reset = () => {};
    get('category-form').reportValidity = () => true;
    let uuid = 0;
    const window = {};
    vm.runInNewContext(source, {
        window, document: { getElementById: get, createElement: () => new Element() },
        fetch: api.fetch, SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test',
        AbortController, setTimeout, clearTimeout, Intl,
        crypto: { randomUUID: () => 'draft-' + ++uuid }
    });
    await window.initializeAdminServices({ bizSlug: 'demo', adminKey: 'test-key' });
    return {
        get, submit: () => get('service-form').listeners.submit({ preventDefault() {} }),
        add: () => get('add-service').listeners.click(),
        edit: (index = 0) => get('services-list').children[index].children.at(-1).children[1].listeners.click()
    };
}
function fill(p, values = {}) {
    const defaults = { 'service-name': '  Session  ', 'service-description': '  Details  ',
        'service-type': 'private', 'service-hours': '1', 'service-minutes': '30',
        'service-price': '450.50', 'service-price-basis': 'per_session', 'service-participants': '2' };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) p.get(key).value = value;
}
(async () => {
    let api = backend(), p = await ui(api);
    assert.equal(p.get('add-service').disabled, false);
    assert.equal(p.get('services-empty').hidden, false);
    p.add(); fill(p);
    await p.submit();
    const created = api.calls.at(-1).body;
    assert.equal(created.p_duration_minutes, 90);
    assert.equal(created.p_price_amount, 45050);
    assert.equal(created.p_name, 'Session');
    assert.equal(created.p_description, 'Details');
    assert.equal(created.p_is_published, false);
    assert.equal(created.p_participant_count, 2);
    assert.equal(p.get('service-form').hidden, true);
    assert.equal(p.get('services-message').textContent, 'Service saved.');
    assert.equal(p.get('services-list').children.length, 1);

    p = await ui(api); // A fresh page reads the saved service.
    p.edit();
    assert.equal(p.get('service-hours').value, 1);
    assert.equal(p.get('service-minutes').value, 30);
    assert.equal(p.get('service-price').value, '450.50');
    api.categories.set('cat-a', { id: 'cat-a', label: 'Configured', icon: 'grid', enabled: true, sort_order: 0 });
    p.get('service-category').value = 'cat-a';
    p.get('service-published').checked = true;
    p.get('service-price').value = '100.01';
    await p.submit();
    assert.equal(api.calls.at(-1).body.p_expected_updated_at, 'version-1');
    assert.equal(api.calls.at(-1).body.p_price_amount, 10001);
    assert.equal(api.records.size, 1);
    assert.equal([...api.records.values()][0].is_published, true);

    p.add(); fill(p, { 'service-type': 'class', 'service-price': '0' });
    p.get('service-type').listeners.change();
    assert.equal(p.get('service-participants-field').hidden, true);
    assert.equal(p.get('service-participants').disabled, true);
    assert.equal(p.get('service-price-basis').value, 'per_person');
    await p.submit();
    assert.equal(api.calls.at(-1).body.p_participant_count, null);
    assert.equal(api.calls.at(-1).body.p_price_amount, 0);
    assert.equal(api.calls.at(-1).body.p_price_basis, 'per_person');

    api = backend(); p = await ui(api); p.add(); fill(p);
    const count = api.calls.length;
    for (const values of [
        { 'service-hours': '0', 'service-minutes': '0' },
        { 'service-hours': '24', 'service-minutes': '1' },
        { 'service-hours': '1.5' }, { 'service-minutes': '60' },
        { 'service-price': '12.345' }, { 'service-price': '-1' },
        { 'service-price': '21474836.48' }, { 'service-participants': '0' }
    ]) {
        fill(p, values); await p.submit(); assert.equal(api.calls.length, count);
        assert.equal(p.get('service-form-error').hidden, false);
    }
    fill(p); api.failAfterSave = true;
    await p.submit();
    const id = api.calls.at(-1).body.p_id;
    assert.equal(p.get('service-form').hidden, false);
    assert.equal(p.get('service-price').value, '450.50');
    assert.equal(p.get('service-fields').disabled, false);
    await p.submit();
    assert.equal(api.calls.at(-1).body.p_id, id);
    assert.equal(api.records.size, 1, 'Lost-response retry does not duplicate service');

    p.edit(); api.conflict = true; await p.submit();
    assert.equal(p.get('service-form').hidden, false);
    assert.match(p.get('service-form-error').textContent, /Cancel editing, reload/);
    p.get('cancel-service').listeners.click(); api.conflict = false;

    p.add(); fill(p);
    let resume;
    api.pause = new Promise(resolve => { resume = resolve; });
    const pending = p.submit();
    const submits = api.calls.length;
    await p.submit();
    assert.equal(api.calls.length, submits, 'Repeated submit suppressed while saving');
    assert.equal(p.get('service-fields').disabled, true);
    resume(); await pending; api.pause = null;

    api = backend(); api.offline = true; p = await ui(api);
    assert.equal(p.get('services-error').hidden, false);
    assert.equal(p.get('services-empty').hidden, true, 'Load failure is not an empty catalogue');
    assert.equal(p.get('add-service').disabled, true);
    assert.equal(p.get('reload-services').disabled, false);
    api.offline = false; await p.get('reload-services').listeners.click();
    assert.equal(p.get('add-service').disabled, false);
    p.add(); fill(p, { 'service-name': '<img src=x onerror=alert(1)>' }); await p.submit();
    const card = p.get('services-list').children[0];
    assert.equal(card.children[0].children[0].textContent, '<img src=x onerror=alert(1)>');


    // Categories save independently, restore settings after reload, and never change booking type.
    api = backend(); p = await ui(api);
    const addCategory = () => p.get('add-category').listeners.click();
    const submitCategory = () => p.get('category-form').listeners.submit({ preventDefault() {} });
    addCategory();
    assert.equal(p.get('add-service').disabled, true);
    p.get('category-label').value = '  Consultations  ';
    p.get('category-icon').value = 'calendar';
    p.get('category-order').value = '3';
    p.get('category-enabled').checked = false;
    api.failAfterSave = true;
    await submitCategory();
    const categoryId = api.calls.at(-1).body.p_id;
    assert.equal(p.get('category-form').hidden, false);
    assert.equal(p.get('category-fields').disabled, false);
    assert.equal(p.get('category-label').value, 'Consultations');
    await submitCategory();
    assert.equal(api.calls.at(-1).body.p_id, categoryId);
    assert.equal(api.categories.size, 1);
    assert.equal(p.get('category-form').hidden, true);
    assert.equal(p.get('services-message').textContent, 'Category saved.');
    p = await ui(api);
    p.get('categories-list').children[0].children.at(-1).listeners.click();
    assert.equal(p.get('category-icon').value, 'calendar');
    assert.equal(p.get('category-order').value, 3);
    assert.equal(p.get('category-enabled').checked, false);
    p.get('category-label').value = '<img src=x onerror=alert(1)>';
    p.get('category-enabled').checked = true;
    await submitCategory();
    assert.equal(p.get('categories-list').children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
    assert(api.calls.at(-1).body.p_expected_updated_at);
    p.add(); fill(p);
    assert.equal(p.get('service-active').checked, true);
    assert.equal(p.get('service-category').children.length, 2);
    const beforePublish = api.calls.length;
    p.get('service-published').checked = true;
    await p.submit();
    assert.equal(api.calls.length, beforePublish);
    assert.match(p.get('service-form-error').textContent, /Choose a category/);
    p.get('service-category').value = categoryId;
    p.get('service-active').checked = false;
    await p.submit();
    assert.equal(api.calls.at(-1).body.p_category_id, categoryId);
    assert.equal(api.calls.at(-1).body.p_is_active, false);
    assert.equal(api.calls.at(-1).body.p_service_type, 'private');
    p.edit();
    assert.equal(p.get('service-category').value, categoryId);
    assert.equal(p.get('service-active').checked, false);
    assert.equal(p.get('service-published').checked, true);
    p.get('cancel-service').listeners.click();
    p.get('categories-list').children[0].children.at(-1).listeners.click();
    api.conflict = true;
    await submitCategory();
    assert.match(p.get('category-form-error').textContent, /category changed/);
    p.get('cancel-category').listeners.click();
    api.conflict = false;
    addCategory();
    p.get('category-label').value = 'Another';
    p.get('category-icon').value = 'grid';
    for (const badOrder of ['-1','0.5','2147483648']) {
        p.get('category-order').value = badOrder;
        const before = api.calls.length;
        await submitCategory();
        assert.equal(api.calls.length, before);
    }
    p.get('category-order').value = '0';
    let finishCategory;
    api.pause = new Promise(resolve => { finishCategory = resolve; });
    const categoryPending = submitCategory();
    const categorySubmits = api.calls.length;
    await submitCategory();
    assert.equal(api.calls.length, categorySubmits);
    assert.equal(p.get('category-fields').disabled, true);
    finishCategory(); await categoryPending; api.pause = null;
    assert.equal(p.get('categories-list').children[0].children[0].textContent, 'Another');

    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, 'IDs are unique');
    for (const match of html.matchAll(/for="([^"]+)"/g)) assert(ids.includes(match[1]));
    assert(html.indexOf('src="/admin-services.js?v=2"') < html.indexOf('src="/admin.js"'));
    console.log('PASS: category create/edit/reload/order/enable; one assignment; independent active/publication/type; category validation/stale edits/lost-response retry/duplicate-submit safety;  service create/edit/reload; 90-minute durations; exact cents; visibility; class fields; validation; preserved input; lost-response retry; duplicate-submit prevention; stale edits; network recovery; safe text rendering; form labels and script order.');
})().catch(error => { console.error(error); process.exitCode = 1; });
