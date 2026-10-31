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
        this.attributes = {}; this.focused = false; this.dataset = {}; this.open = false;
        this.className = '';
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
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
        if (url.endsWith('/get_admin_service_photos')) return { ok: true, json: async () => [] };
        if (url.endsWith('/get_admin_categories')) return { ok: true, json: async () => [...categories.values()] };
        if (state.rejectSave && url.endsWith('/save_admin_service')) return {ok:false,json:async()=>({code:'XX000'})};
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
            photo_path: body.p_photo_path, currency: 'ZAR', updated_at: 'version-' + ++version
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
    for (const id of ['service-form', 'services-error', 'services-message', 'service-form-error', 'services-empty', 'category-form', 'category-form-error']) get(id).hidden = true;
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
        edit: id => walk(get('services-list')).find(item => item.dataset.serviceId === id).children.at(-1).listeners.click(),
        editCategory: label => walk(get('services-list')).find(item => item.attributes['aria-label'] === 'Edit group ' + label).listeners.click()
    };
}
function fill(p, values = {}) {
    const defaults = { 'service-name': '  Session  ', 'service-description': '  Details  ',
        'service-type': 'private', 'service-hours': '1', 'service-minutes': '30',
        'service-price': '450.50', 'service-price-basis': 'per_session', 'service-participants': '2' };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) p.get(key).value = value;
}

function walk(node) { return [node,...node.children.flatMap(walk)]; }
const click=(p,id)=>p.get(id).listeners.click();
const categorySubmit=p=>p.get('category-form').listeners.submit({preventDefault(){}});
const categoryFill=(p,label,extra={})=> {
 p.get('category-label').value=label;
 p.get('category-icon').value=extra.icon||'grid';
 p.get('category-order').value=extra.order??'0';
 p.get('category-enabled').checked=extra.enabled??true;
};
const status=(p,value)=>{p.get('service-status').value=value;p.get('service-status').listeners.change();};
(async()=>{
 let api=backend(),p=await ui(api);
 assert.equal(p.get('add-service').disabled,false);
 assert.equal(p.get('services-empty').hidden,false);
 p.add();fill(p);status(p,'published');
 await p.submit();
 assert.equal(api.records.size,0);
 assert.match(p.get('service-category-error').textContent,/Create new group/);
 assert.equal(p.get('service-dialog').open,true);
 p.get('service-category').value='__create__';p.get('service-category').listeners.change();
 assert.equal(p.get('category-dialog').open,true);
 assert.equal(p.get('service-name').value,'Session','Nested group form preserves service draft');
 categoryFill(p,'  Training  ',{icon:'people',order:'2'});
 api.failAfterSave=true;
 await categorySubmit(p);
 assert.equal(p.get('category-dialog').open,true,'Lost group response leaves group form open');
 const categoryId=api.calls.at(-1).body.p_id;
 assert.equal(api.categories.size,1);
 assert.equal(p.get('service-name').value,'Session');
 await categorySubmit(p);
 assert.equal(api.categories.size,1,'Group create retry reuses UUID');
 assert.equal(p.get('category-dialog').open,false);
 assert.equal(p.get('service-dialog').open,true);
 assert.equal(p.get('service-category').value,categoryId);
 assert.equal(p.get('service-type').value,'private');
 api.rejectSave=true;await p.submit();
 assert.match(p.get('service-form-error').textContent,/Your group is saved/);
 assert.equal(p.get('service-category').value,categoryId);
 const serviceId=api.calls.at(-1).body.p_id;
 api.rejectSave=false;api.failAfterSave=true;
 await p.submit();
 assert.equal(api.records.size,1);
 await p.submit();
 assert.equal(api.records.size,1,'Service retry does not duplicate');
 assert.equal(api.calls.at(-1).body.p_id,serviceId);
 assert.equal(api.calls.at(-1).body.p_category_id,categoryId);
 assert.equal(api.calls.at(-1).body.p_price_amount,45050);
 assert.equal(api.calls.at(-1).body.p_duration_minutes,90);
 assert.equal(api.calls.at(-1).body.p_is_active,true);
 assert.equal(api.calls.at(-1).body.p_is_published,true);
 assert.equal(p.get('service-dialog').open,false);
 assert.equal(p.get('services-message').textContent,'Service saved and published.');
 const group=p.get('services-list').children[0],toggle=group.children[0].children[0];
 assert.equal(toggle.children[1].textContent,'Training');
 assert.equal(toggle.children[2].textContent,'1 service');
 toggle.listeners.click();assert.equal(group.children[1].hidden,true);
 toggle.listeners.click();assert.equal(group.children[1].hidden,false);

 // One status control retains both old flags, including both paused combinations.
 p.edit(serviceId);status(p,'paused');await p.submit();
 assert.equal(api.records.get(serviceId).is_active,false);
 assert.equal(api.records.get(serviceId).is_published,true);
 p.edit(serviceId);assert.equal(p.get('service-status').value,'paused');
 await p.submit();assert.equal(api.records.get(serviceId).is_published,true,'Unchanged paused published service retains publication');
 p.edit(serviceId);status(p,'published');await p.submit();
 assert.equal(api.records.get(serviceId).is_active,true);
 p.edit(serviceId);status(p,'draft');await p.submit();
 assert.equal(api.records.get(serviceId).is_published,false);
 p.edit(serviceId);status(p,'paused');await p.submit();
 assert.equal(api.records.get(serviceId).is_active,false);
 assert.equal(api.records.get(serviceId).is_published,false,'Paused draft stays unpublished');

 // Category edits, icons, disabling, ordering and assigned counts all stay inside Services.
 p.editCategory('Training');
 categoryFill(p,'Training edited',{icon:'star',order:'4',enabled:false});
 await categorySubmit(p);
 assert.equal(api.categories.get(categoryId).enabled,false);
 assert.equal(api.categories.get(categoryId).icon,'star');
 p.edit(serviceId);status(p,'published');await p.submit();
 assert.equal(p.get('service-dialog').open,true);
 assert.match(p.get('service-category-error').textContent,/hidden/);
 click(p,'edit-service-category');
 p.get('category-enabled').checked=true;await categorySubmit(p);
 await p.submit();
 assert.equal(api.records.get(serviceId).is_published,true);
 assert.equal(api.records.get(serviceId).is_active,true);
 click(p,'add-category');categoryFill(p,'Earlier',{order:'0'});await categorySubmit(p);
 const earlierId=api.calls.at(-1).body.p_id;
 assert.equal(p.get('services-list').children[0].children[0].children[0].children[1].textContent,'Earlier');
 p.edit(serviceId);p.get('service-category').value=earlierId;p.get('service-category').listeners.change();
 const version=api.records.get(serviceId).updated_at;
 await p.submit();
 assert.equal(api.calls.at(-1).body.p_expected_updated_at,version);
 assert.equal(api.records.size,1,'Moving edits the existing service record');
 assert.equal(api.records.get(serviceId).category_id,earlierId);
 const addTo=walk(p.get('services-list')).find(item=>item.attributes['aria-label']==='Add service to Training edited');
 addTo.listeners.click();assert.equal(p.get('service-category').value,categoryId);
 click(p,'cancel-service');

 // Existing unassigned drafts and service photos/secondary fields round-trip without new IDs.
 const unassigned={...api.records.get(serviceId),id:'unassigned',name:'Existing draft',category_id:null,
 is_published:false,is_active:true,photo_path:'11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png',
 description:'Saved description',price_basis:'per_person',participant_count:3,updated_at:'old'};
 api.records.set(unassigned.id,unassigned);await click(p,'reload-services');
 assert.equal(p.get('services-list').children[0].children[0].children[0].children[1].textContent,'Needs a group');
 p.edit('unassigned');
 assert.equal(p.get('service-description').value,'Saved description');
 assert.equal(p.get('service-advanced').open,true,'Existing per-person settings are visible');
 assert.equal(p.get('service-photo-preview').hidden,false);
 p.get('service-category').value=earlierId;status(p,'published');await p.submit();
 assert.equal(api.records.get('unassigned').photo_path,unassigned.photo_path);
 assert.equal(api.records.get('unassigned').description,'Saved description');
 assert.equal(api.records.get('unassigned').participant_count,3);
 assert.equal(api.records.size,2);
 p.edit('unassigned');api.conflict=true;await p.submit();
 assert.equal(p.get('service-dialog').open,true);
 assert.match(p.get('service-form-error').textContent,/changed/);
 click(p,'cancel-service');api.conflict=false;
 p.editCategory('Earlier');api.conflict=true;await categorySubmit(p);
 assert.equal(p.get('category-dialog').open,true);assert.match(p.get('category-form-error').textContent,/changed/);
 click(p,'cancel-category');api.conflict=false;

 // Cancellation, validation and empty/disabled categories are real records, never fabricated.
 p.add();fill(p);click(p,'create-service-category');categoryFill(p,'Cancelled');click(p,'cancel-category');
 assert.equal(p.get('service-dialog').open,true);assert.equal(p.get('service-category').value,'');
 let count=api.calls.length;
 click(p,'create-service-category');
 for(const bad of ['', ' '.repeat(3)]) {categoryFill(p,bad);await categorySubmit(p);assert.equal(api.calls.length,count);}
 categoryFill(p,'Valid',{order:'-1'});await categorySubmit(p);assert.equal(api.calls.length,count);
 click(p,'cancel-category');
 for(const [values,id] of [
 [{'service-name':''},'service-name-error'],
 [{'service-hours':'0','service-minutes':'0'},'service-duration-error'],
 [{'service-hours':'24','service-minutes':'1'},'service-duration-error'],
 [{'service-price':'12.345'},'service-price-error'],
 [{'service-price':'-1'},'service-price-error'],
 [{'service-price':'21474836.48'},'service-price-error']
 ]) {
  fill(p,values);await p.submit();assert.equal(api.calls.length,count);assert.equal(p.get(id).hidden,false);
 }
 fill(p,{'service-participants':'0'});await p.submit();assert.equal(api.calls.length,count);assert.equal(p.get('service-advanced').open,true);
 fill(p);let resume;api.pause=new Promise(resolve=>{resume=resolve;});
 const pending=p.submit();count=api.calls.length;
 await p.submit();assert.equal(api.calls.length,count,'Duplicate submit suppressed');
 assert.equal(p.get('close-service').disabled,true,'Cannot dismiss an in-flight save');
 p.get('service-dialog').listeners.cancel({preventDefault(){}});assert.equal(p.get('service-dialog').open,true);
 resume();await pending;api.pause=null;

 // Classes stay honestly unbookable and retain per-person/null-participant rules.
 p.add();fill(p,{'service-type':'class','service-price':'0'});
 p.get('service-type').listeners.change();
 p.get('service-category').value=earlierId;status(p,'published');await p.submit();
 const classId=api.calls.at(-1).body.p_id;
 assert.equal(api.records.get(classId).participant_count,null);
 assert.equal(api.records.get(classId).price_basis,'per_person');
 assert(walk(p.get('services-list')).some(item=>item.textContent==='Not bookable yet'));
 assert(!walk(p.get('services-list')).some(item=>item.textContent==='Bookable'));
 api.offline=true;await click(p,'reload-services');
 assert.equal(p.get('services-error').hidden,false);assert.equal(p.get('add-service').disabled,true);
 assert.equal(p.get('services-empty').hidden,true,'Load errors are not empty catalogues');
 api.offline=false;await click(p,'reload-services');assert.equal(p.get('add-service').disabled,false);
 p.add();fill(p,{'service-name':'<script>unsafe</script>'});await p.submit();
 assert(walk(p.get('services-list')).some(item=>item.textContent==='<script>unsafe</script>'));
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const match of html.matchAll(/for="([^"]+)"/g))assert(ids.includes(match[1]));
 assert(!html.includes('nav-categories') && !html.includes('categories-panel'));
 assert(html.includes('+ Create new group'));
 assert(html.indexOf('admin-services.js?v=7')<html.indexOf('admin.js?v=4'));
 console.log('PASS integrated Services: no-group inline creation/publication; group/service lost-response retries and partial failures; no duplicate saves; original IDs/photos/details/pricing; group editing/enable/order/collapse/counts/add/move; draft/published/paused flag preservation; disabled validation; classes unbookable; stale edits; offline recovery; safe text; modal locking; labels/navigation.');
})().catch(error=>{console.error(error);process.exitCode=1;});


