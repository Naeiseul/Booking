// Dependency-free monthly calendar regression checks. Run: node tests/client-monthly-calendar.cjs
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
(async () => {

class E {
    constructor() {
        this.children = []; this.style = {}; this.attrs = {}; this.listeners = {};
        this.dataset = {}; this.hidden = false; this.textContent = ''; this._html = '';
        this.classList = { add() {}, remove() {} };
    }
    set innerHTML(value) { this._html = value; this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(element) { this.children.push(element); }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(key, callback) { this.listeners[key] = callback; }
    focus() { document.activeElement = this; }
}
const ids = {};
for (const match of html.matchAll(/id="([^"]+)"/g)) ids[match[1]] = new E();
const menu = new E();
const steps = ['sessions', 'schedule', 'checkout'].map(step => {
    const button = new E(); button.dataset.step = step; return button;
});
menu.querySelectorAll = () => steps;
let task, poll, offline = false;
let data = { name: 'Test business', services: [], slots: [
    { date: '2026-10-30', time: '09:00:00' },
    { date: '2026-11-01', time: '10:00:00' },
    { date: '2026-11-02', time: '11:00:00', status: 'taken' }
] };
const document = {
    activeElement: null,
    getElementById: id => ids[id] || null,
    createElement: () => new E(),
    querySelector: selector => selector === '.catalogue-menu' ? menu : null,
    querySelectorAll: () => [],
    addEventListener: (_, callback) => { task = callback; }
};
const window = { location: { search: '', pathname: '/logtraq' } };
class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 30, 12])); }
}
class Params {
    constructor(value) { this.value = value || {}; }
    get() { return null; }
    set(key, value) { this.value[key] = value; }
    toString() { return Object.entries(this.value).map(([key, value]) => key + '=' + value).join('&'); }
}
new Function('document', 'window', 'fetch', 'setInterval', 'URLSearchParams', 'Date',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'console', app)(
    document, window,
    async () => { if (offline) throw new Error('Offline'); return { ok: true, json: async () => data }; },
    callback => { poll = callback; }, Params, ClockDate, 'https://test.invalid', 'test', { error() {} }
);
function assert(value, message) { if (!value) throw new Error(message); }
const days = () => ids['day-tabs'].children.filter(day => day.dataset.date);
const day = date => days().find(button => button.dataset.date === date);
const next = () => ids['next-month'].listeners.click();
const previous = () => ids['previous-month'].listeners.click();
await task();
assert(days().length === 31, 'October has 31 days');
assert(ids['day-tabs'].children.indexOf(day('2026-10-01')) === 3, 'Monday-first offset');
assert(day('2026-10-29').disabled && !day('2026-10-30').disabled, 'Past dates disabled');
assert(ids['previous-month'].disabled, 'Cannot browse before current month');
assert(day('2026-10-30').className.includes('has-times'), 'Date/time-only openings marked');
assert(day('2026-10-31').className.includes('no-times'), 'Empty dates marked');
ids['time-grid'].children[0].listeners.click();
assert(!ids['book-selected-slot'].disabled, 'Date/time-only slot selectable');
next();
assert(days().length === 30 && day('2026-11-01'), 'November month boundary');
assert(ids['selected-calendar-date'].textContent.includes('30'), 'Selected date remains explicit while browsing');
assert(!ids['book-selected-slot'].disabled, 'Month browsing preserves selected time');
assert(day('2026-11-02').className.includes('no-times'), 'Taken-only day has no openings');
await poll();
assert(day('2026-11-01') && !ids['book-selected-slot'].disabled, 'Polling preserves viewed month and selection');
day('2026-11-01').listeners.click();
assert(ids['book-selected-slot'].disabled && ids['time-grid'].children[0].textContent === '10:00', 'Date change clears old time and loads real slots');
assert(document.activeElement.dataset.date === '2026-11-01', 'Date selection preserves focus');
const focusedButton = document.activeElement;
await poll();
assert(document.activeElement === focusedButton && days().includes(focusedButton), 'Unchanged polling retains date nodes and focus');
ids['time-grid'].children[0].listeners.click();
ids['book-selected-slot'].listeners.click();
assert(window.location.href.includes('date=2026-11-01&time=10:00'), 'Details URL carries chosen date and time');
steps[0].listeners.click(); steps[1].listeners.click();
assert(!ids['service-catalogue'].hidden && !ids['client-calendar'].hidden && !ids['book-selected-slot'].disabled, 'Step navigation preserves selection');
offline = true; await poll();
assert(ids['book-selected-slot'].disabled, 'Network failure disables continuation');
offline = false; await poll();
assert(!ids['book-selected-slot'].disabled, 'Recovery revalidates selection');
day('2026-11-03').listeners.click();
assert(ids['book-selected-slot'].disabled && ids['time-grid'].innerHTML.includes('No available times'), 'Empty date fabricates no slots');
await poll();
assert(day('2026-11-03').attrs['aria-pressed'] === 'true', 'Empty date survives polling');
day('2026-11-01').listeners.click(); ids['time-grid'].children[0].listeners.click();
data.slots = []; await poll();
assert(ids['book-selected-slot'].disabled && day('2026-11-01').className.includes('no-times'), 'Removed slot clears selection and marker');
previous(); assert(day('2026-10-30'), 'Previous month navigation');
next(); next(); next();
assert(ids['calendar-month'].textContent.includes('2027') && days().length === 31 && day('2027-01-01'), 'Year rollover');
for (let index = 0; index < 13; index++) next();
assert(day('2028-02-29') && days().length === 29, 'Leap-year February');
data.slots = [{ date: '2028-02-29', time: '12:00:00' }]; await poll();
assert(day('2028-02-29').className.includes('has-times'), 'Future openings appear after polling');
day('2028-02-29').listeners.click(); ids['time-grid'].children[0].listeners.click();
assert(!ids['book-selected-slot'].disabled, 'Leap-day slot selectable');
data.slots = [{ date: '2028-02-29', time: '12:00:00', status: 'unknown' }]; await poll();
assert(ids['book-selected-slot'].disabled && ids['time-grid'].children[0].disabled, 'Explicit unknown status rejected');
return 'Monthly calendar regression checks passed';

})().then(message => console.log(message)).catch(error => { console.error(error); process.exitCode = 1; });
