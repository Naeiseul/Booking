// Admin -> saved availability -> client refresh regression checks.
// Run: node tests/availability-sync.cjs. Fixtures stay in memory; no real writes.
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const clientHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
(async () => {
function assert(value, message) { if (!value) throw new Error(message); }
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 30, 0])); }
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
class Controller {
    constructor() {
        const listeners = [];
        this.signal = { aborted: false, addEventListener: (name, callback) => { if (name === 'abort') listeners.push(callback); } };
        this.abort = () => { this.signal.aborted = true; listeners.forEach(callback => callback()); };
    }
}
class Element {
    constructor(document) {
        this.document = document; this.children = []; this.dataset = {}; this.attrs = {};
        this.style = {}; this.className = ''; this.textContent = ''; this.hidden = false; this._html = ''; this.listeners = {};
        this.classList = {
            add: name => { this.className += ' ' + name; },
            remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); }
        };
    }
    set innerHTML(value) { this._html = value; this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(child) { this.children.push(child); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    focus() { this.document.activeElement = this; }
}
function dom(html, isAdmin = false) {
    const nodes = {}, events = {}, windowEvents = {};
    const document = {
        activeElement: null, visibilityState: 'visible',
        getElementById: id => nodes[id] || null,
        createElement: () => new Element(document),
        addEventListener: (name, callback) => { events[name] = callback; },
        querySelector: selector => selector === '.catalogue-menu' ? stepsMenu : selector === '.catalogue-layout' ? layout : null,
        querySelectorAll: selector => selector === '.day-tab' ? nodes['day-tabs'].children : []
    };
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes[match[1]] = new Element(document);
    const stepsMenu = new Element(document), layout = new Element(document);
    const steps = ['sessions','schedule','checkout'].map(step => {
        const button = new Element(document); button.dataset.step = step; return button;
    });
    stepsMenu.querySelectorAll = () => steps;
    const window = {
        location: { pathname: isAdmin ? '/admin/fixture/fixture-key' : '/fixture', search: '' },
        addEventListener: (name, callback) => { windowEvents[name] = callback; },
        initializeAdminNavigation() {}, initializeAdminServices() {}
    };
    return { nodes, document, window, events, windowEvents };
}
async function setup(options = {}) {
    const client = dom(clientHtml), owner = dom(adminHtml, true);
    const channels = [], messages = [], timers = new Map();
    let timerId = 0, poll;
    const server = {
        open: true, publicCalls: 0, activeReads: 0, peakReads: 0, pauseRead: false, read: null,
        pauseSave: false, finishSave: null, failSave: false, alerts: 0
    };
    function attach(tab) {
        if (options.broadcast !== false) tab.window.BroadcastChannel = class {
            constructor(name) { this.name = name; this.listeners = {}; channels.push(this); }
            addEventListener(name, callback) { this.listeners[name] = callback; }
            postMessage(data) {
                messages.push({ via: 'broadcast', key: this.name, data });
                channels.filter(channel => channel !== this && channel.name === this.name).forEach(channel => {
                    if (channel.listeners.message) channel.listeners.message({ data });
                });
            }
        };
        tab.window.localStorage = {
            setItem(key, value) {
                if (options.storageThrows) throw new Error('Storage denied fixture');
                const data = JSON.parse(value);
                messages.push({ via: 'storage', key, data });
                [client,owner].filter(other => other !== tab).forEach(other => {
                    if (other.windowEvents.storage) other.windowEvents.storage({ key, newValue: value });
                });
            }
        };
    }
    attach(client); attach(owner);
    const publicData = () => ({
        name: 'Fixture', categories: [], services: [],
        slots: server.open ? [{ date: '2026-10-30', time: '07:00:00' }] : []
    });
    const fetchPublic = async (url, request) => {
        assert(url.endsWith('/get_public_page') && JSON.parse(request.body).p_slug === 'fixture', 'Refresh uses existing scoped public RPC');
        assert(request.cache === 'no-store', 'Availability reads bypass browser cache');
        server.publicCalls++; server.activeReads++; server.peakReads = Math.max(server.peakReads, server.activeReads);
        const snapshot = publicData();
        try {
            if (server.pauseRead) {
                server.pauseRead = false;
                await new Promise((resolve, reject) => {
                    server.read = { resolve, signal: request.signal };
                    request.signal.addEventListener('abort', () => reject(new Error('Abort fixture')));
                });
            }
            return { ok: true, json: async () => snapshot };
        } finally { server.activeReads--; }
    };
    new Function('document','window','fetch','setInterval','URLSearchParams','Date','SUPABASE_URL','SUPABASE_ANON_KEY','console','AbortController','setTimeout','clearTimeout',app)(
        client.document, client.window, fetchPublic, callback => { poll = callback; }, Params, ClockDate,
        'https://fixture.invalid', 'test', { error() {} }, Controller,
        (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, id => timers.delete(id)
    );
    await client.events.DOMContentLoaded();
    const fetchAdmin = async (url, request) => {
        if (url.endsWith('/get_admin_page')) return { ok: true, json: async () => ({
            name: 'Fixture', slots: [{ date: '2026-10-30', time: '07:00:00', status: server.open ? 'open' : 'taken' }]
        }) };
        assert(url.endsWith('/set_slot'), 'Existing admin set_slot endpoint');
        const body = JSON.parse(request.body);
        assert(body.p_slug === 'fixture' && body.p_key === 'fixture-key', 'Existing admin scope retained');
        if (server.pauseSave) await new Promise(resolve => { server.finishSave = resolve; });
        if (server.failSave) return { ok: false };
        server.open = body.p_status === 'open';
        return { ok: true };
    };
    new Function('document','window','URLSearchParams','fetch','Date','SUPABASE_URL','SUPABASE_ANON_KEY','console','alert',admin)(
        owner.document, owner.window, Params, fetchAdmin, ClockDate,
        'https://fixture.invalid', 'test', { error() {} }, () => { server.alerts++; }
    );
    await owner.events.DOMContentLoaded();
    return {
        client, owner, server, messages, timers, poll: () => poll(),
        slot: () => owner.nodes['time-grid'].children[0],
        hasTime: () => client.nodes['time-grid'].children.some(node => node.textContent === '07:00'),
        signal(data, key = 'booking-availability:fixture') { client.windowEvents.storage({ key, newValue: JSON.stringify(data) }); }
    };
}
let p = await setup();
assert(p.hasTime(), 'Initial public date/time-only opening appears');
p.client.nodes['time-grid'].children[0].listeners.click();
assert(!p.client.nodes['book-selected-slot'].disabled, 'Opening can be selected');
p.server.pauseSave = true;
const saving = p.slot().listeners.click();
assert(p.messages.length === 0 && p.hasTime(), 'Optimistic admin UI does not announce before the database save succeeds');
p.server.finishSave(); await saving; await flush();
assert(!p.hasTime() && p.client.nodes['book-selected-slot'].disabled, 'Successful admin save immediately removes unavailable time and invalid selection without polling');
assert(p.server.publicCalls === 2, 'Broadcast and storage notifications are deduplicated');
assert(p.messages.every(message => !JSON.stringify(message).includes('fixture-key') && !JSON.stringify(message).includes('p_date') && !JSON.stringify(message).includes('07:00')), 'Cross-tab hints contain no admin key or slot authority');
p.server.pauseSave = false;
await p.slot().listeners.click(); await flush();
assert(p.hasTime() && p.client.nodes['book-selected-slot'].disabled, 'Reopened slot appears immediately without restoring a removed selection');
let calls = p.server.publicCalls;
p.signal({ type: 'availability-changed', id: 'other-business' }, 'booking-availability:other');
p.signal({ type: 'unexpected', id: 'bad-type' });
p.client.windowEvents.storage({ key: 'booking-availability:fixture', newValue: 'not-json' });
await flush(); assert(p.server.publicCalls === calls, 'Malformed/other-business messages ignored');
p.server.open = false; await p.poll(); assert(!p.hasTime(), 'Other-device changes still arrive through polling');
p.server.open = true; await p.client.windowEvents.focus(); assert(p.hasTime(), 'Focus immediately refreshes a background tab');
p.client.document.visibilityState = 'hidden'; calls = p.server.publicCalls;
p.client.events.visibilitychange(); await flush(); assert(p.server.publicCalls === calls, 'Hidden visibility event does not issue a read');
p.server.open = false; p.client.document.visibilityState = 'visible';
p.client.events.visibilitychange(); await flush(); assert(!p.hasTime(), 'Visible tab refreshes immediately');
p.server.open = true; p.client.windowEvents.pageshow({ persisted: true }); await flush(); assert(p.hasTime(), 'Back-forward restored page refreshes');
calls = p.server.publicCalls; p.client.windowEvents.pageshow({ persisted: false }); await flush();
assert(p.server.publicCalls === calls, 'Ordinary initial pageshow avoids duplicate read');
p.client.nodes['day-tabs'].children.find(day => day.dataset.date === '2026-10-31').listeners.click();
await p.slot().listeners.click(); await flush();
assert(p.client.nodes['day-tabs'].children.find(day => day.dataset.date === '2026-10-31').attrs['aria-pressed'] === 'true', 'Admin update does not jump away from the chosen date');

p = await setup(); p.server.pauseRead = true;
const olderRead = p.poll();
assert(p.server.activeReads === 1, 'One public read in flight');
await p.slot().listeners.click(); await p.poll(); await p.client.windowEvents.focus();
assert(p.server.activeReads === 1 && p.server.publicCalls === 2, 'Save/timer/focus queue rather than overlap reads');
p.server.read.resolve(); await olderRead; await flush();
assert(!p.hasTime() && p.server.publicCalls === 3 && p.server.peakReads === 1, 'Queued fresh read wins after the older snapshot; no out-of-order requests');
p.server.pauseRead = true;
const hanging = p.poll();
const timeout = [...p.timers.values()].find(timer => timer.delay === 15000);
assert(timeout, 'Hanging availability read has a bounded timeout');
timeout.callback(); await hanging; await flush();
assert(p.server.read.signal.aborted && p.client.nodes['book-selected-slot'].disabled, 'Timeout aborts a stalled read and disables booking');
assert(!p.client.nodes['business-status'].hidden && p.client.nodes['business-status'].textContent.includes('Could not refresh'), 'Refresh failure is visible instead of silently showing trusted stale data');
p.server.open = true; await p.client.windowEvents.focus(); await flush();
assert(p.hasTime() && p.client.nodes['business-status'].hidden, 'Refresh recovers after timeout');

p = await setup({ broadcast: false }); await p.slot().listeners.click(); await flush();
assert(!p.hasTime(), 'Storage fallback works without BroadcastChannel');
p = await setup({ storageThrows: true }); await p.slot().listeners.click(); await flush();
assert(!p.hasTime(), 'Broadcast works when storage is blocked');
p = await setup({ broadcast: false, storageThrows: true }); await p.slot().listeners.click(); await flush();
assert(p.hasTime(), 'Blocked cross-tab APIs leave the poll fallback intact');
await p.poll(); assert(!p.hasTime(), 'Polling recovers when both cross-tab APIs are unavailable');
p = await setup(); p.server.failSave = true;
await p.slot().listeners.click(); await flush();
assert(p.server.alerts === 1 && p.messages.length === 0 && p.hasTime(), 'Failed admin save never announces a successful availability update');
console.log('PASS: saved admin changes immediately refresh client via deduplicated scoped hints; no credentials/slot payloads; selected-day preservation; polling/focus/visibility/back-forward fallback; serialized queued reads; timeout/error/recovery; blocked-channel/storage fallback; failed saves do not notify.');
})().catch(error => { console.error(error); process.exitCode = 1; });
