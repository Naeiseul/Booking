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
    const state = { records, calls: [], offline: false, failAfterSave: false, conflict: false, pause: null };
    let version = 0;
    state.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        state.calls.push({ url, body });
        if (state.pause) await state.pause;
        if (state.offline) throw Error('offline');
        if (url.endsWith('/get_admin_services')) return { ok: true, json: async () => [...records.values()] };
        if (state.conflict) return { ok: false, json: async () => ({ code: '40001' }) };
        const previous = records.get(body.p_id);
        const saved = previous && !body.p_expected_updated_at ? previous : {
            id: body.p_id, name: body.p_name, description: body.p_description,
            service_type: body.p_service_type, duration_minutes: body.p_duration_minutes,
            price_amount: body.p_price_amount, price_basis: body.p_price_basis,
            participant_count: body.p_participant_count, is_published: body.p_is_published,
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
    for (const id of ['service-form', 'services-error', 'services-message', 'service-form-error', 'services-empty']) get(id).hidden = true;
    get('service-form').reset = () => {};
    get('service-form').reportValidity = () => true;
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

    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, 'IDs are unique');
    for (const match of html.matchAll(/for="([^"]+)"/g)) assert(ids.includes(match[1]));
    assert(html.indexOf('src="/admin-services.js"') < html.indexOf('src="/admin.js"'));
    console.log('PASS: service create/edit/reload; 90-minute durations; exact cents; visibility; class fields; validation; preserved input; lost-response retry; duplicate-submit prevention; stale edits; network recovery; safe text rendering; form labels and script order.');
})().catch(error => { console.error(error); process.exitCode = 1; });
