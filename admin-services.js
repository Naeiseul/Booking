(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { slug:'', key:'', services:[], groups:[], bookings:[], defaults:{}, defaultsEditor:null, editing:null, groupOnly:false, configEditor:null };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function message(text, error) {
    const el=$('services-message'); if (!el) return;
    el.textContent=text || ''; el.hidden=!text;
    el.classList.toggle('is-error',!!error);
  }
  async function rpc(name, args) {
    const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method:'POST', cache:'no-store',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY},
      body:JSON.stringify(args)
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok) throw new Error(payload && payload.message || 'Could not save service data.');
    return payload;
  }
  function categoryRpc(id,label,updated) {
    return rpc('save_admin_category',{
      p_slug:state.slug,p_key:state.key,p_id:id,p_label:label,p_icon:'grid',
      p_enabled:true,p_sort_order:0,p_expected_updated_at:updated || null
    });
  }
  const configSections = ['pricing','duration','capacity','availability','addons','location','requirements','payment','customer_fields','questions'];
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const selectOptions = (items,value) => items.map(([v,l])=>[v,l]);
  function makeControl(type,value,attrs={}) {
    const node=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');
    if(type!=='select'&&type!=='textarea') node.type=type;
    if(type==='textarea') node.rows=attrs.rows||3;
    if(type==='select') (attrs.options||[]).forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;node.appendChild(o);});
    if(type==='checkbox') node.checked=Boolean(value); else if(value!==undefined&&value!==null) node.value=value;
    Object.entries(attrs).forEach(([k,v])=>{if(k!=='options'&&k!=='rows'&&k!=='min'&&k!=='max')node.setAttribute(k,v);});
    if(attrs.min!==undefined)node.min=attrs.min;if(attrs.max!==undefined)node.max=attrs.max;
    return node;
  }
  function addField(parent,labelText,control) {
    const label=document.createElement('label');label.className='booking-field';
    const span=document.createElement('span');span.textContent=labelText;label.appendChild(span);label.appendChild(control);parent.appendChild(label);return control;
  }
  function addCheckGroup(parent,title,items,values,keyPrefix) {
    const wrap=document.createElement('fieldset');wrap.className='service-config-checks';
    const legend=document.createElement('legend');legend.textContent=title;wrap.appendChild(legend);
    items.forEach(([value,label])=>{const l=document.createElement('label');l.className='service-config-check';
      const c=makeControl('checkbox',values.includes(value));c.dataset.configKey=keyPrefix+':'+value;l.appendChild(c);l.appendChild(document.createTextNode(label));wrap.appendChild(l);});
    parent.appendChild(wrap);
  }
  function addRowsEditor(parent,title,rows,kind) {
    const box=document.createElement('div');box.className='service-config-list';
    const heading=document.createElement('div');heading.className='service-config-list-heading';heading.textContent=title;box.appendChild(heading);
    const list=document.createElement('div');list.dataset.rows=kind;box.appendChild(list);
    const add=document.createElement('button');add.type='button';add.className='service-secondary-button';add.textContent=kind==='addons'?'Add extra':kind==='tiers'?'Add price tier':'Add question';box.appendChild(add);
    function rowEditor(row={}) {
      const rowEl=document.createElement('div');rowEl.className='service-config-row';rowEl.dataset.rowKind=kind;
      const addInput=(label,key,type,value,attrs={})=>{const c=makeControl(type,value,attrs);c.dataset.rowKey=key;return addField(rowEl,label,c);};
      if(kind==='addons'){
        addInput('Extra name','name','text',row.name||'',{maxlength:80,required:true});
        addInput('Price in ZAR','price','number',row.price_amount!=null?(row.price_amount/100):'',{min:0,step:'0.01'});
        addInput('Price applies to','basis','select',row.price_basis||'per_booking',{options:[['per_booking','Per booking'],['per_person','Per person']]});
      } else if(kind==='tiers'){
        addInput('Minimum people','minimum','number',row.minimum||1,{min:1,step:1});
        addInput('Maximum people','maximum','number',row.maximum||1,{min:1,step:1});
        addInput('Package price (ZAR)','amount','number',row.amount!=null?(row.amount/100):'',{min:0,step:'0.01'});
      } else {
        addInput('Question','label','text',row.label||'',{maxlength:160,required:true});
        addInput('Answer type','type','select',row.type||'text',{options:[['text','Short answer'],['textarea','Long answer'],['select','Choose an option']]});
        addInput('Options (comma separated)','options','text',(row.options||[]).join(', '),{maxlength:500});
        addInput('Required','required','checkbox',Boolean(row.required));
      }
      const idInput=document.createElement('input');idInput.type='hidden';idInput.dataset.rowKey='id';idInput.value=row.id||crypto.randomUUID();rowEl.appendChild(idInput);
      const remove=document.createElement('button');remove.type='button';remove.className='service-text-button';remove.textContent='Remove';remove.addEventListener('click',()=>rowEl.remove());rowEl.appendChild(remove);
      list.appendChild(rowEl);
    }
    (rows||[]).forEach(rowEditor);
    add.addEventListener('click',()=>rowEditor());
    parent.appendChild(box);
  }
  function buildConfigEditor(container,config,defaults,inheritedMode) {
    container.replaceChildren();
    const inherited=new Set(Array.isArray(config?.inherit)?config.inherit:(inheritedMode?configSections:[]));
    const effective={...(defaults||{})};
    Object.entries(config||{}).forEach(([key,value])=>{if(key!=='inherit'&&!inherited.has(key))effective[key]=value;});
    const sectionData={};
    function createSection(key,title) {
      const section=document.createElement('fieldset');section.className='service-config-section';section.dataset.section=key;
      const legend=document.createElement('legend');legend.textContent=title;section.appendChild(legend);
      if(inheritedMode){const label=document.createElement('label');label.className='service-config-inherit';
        const cb=makeControl('checkbox',inherited.has(key));cb.dataset.inherit=key;
        label.appendChild(cb);label.appendChild(document.createTextNode('Use business default'));section.appendChild(label);}
      const body=document.createElement('div');body.className='service-config-body';section.appendChild(body);container.appendChild(section);
      sectionData[key]=body;
      if(inheritedMode){const cb=section.querySelector('[data-inherit]');
        const toggle=()=>{body.querySelectorAll('input,select,textarea,button').forEach(c=>c.disabled=cb.checked);};
        cb.addEventListener('change',toggle);toggle();}
      return body;
    }
    const pricing=effective.pricing||{};
    const p=createSection('pricing','Pricing');
    addField(p,'Pricing type',makeControl('select',pricing.mode||'fixed',{options:[
      ['fixed','Fixed price'],['per_person','Per person'],['per_hour','Per hour'],['per_session','Per session'],
      ['tiered','Tiered packages'],['custom_quote','Custom quotation']
    ]})).dataset.configKey='pricing:mode';
    addField(p,'Price in ZAR',makeControl('number',pricing.amount!=null?pricing.amount/100:'',{min:0,step:'0.01',inputmode:'decimal'})).dataset.configKey='pricing:amount';
    addRowsEditor(p,'Price tiers',pricing.tiers||[],'tiers');
    p.querySelector('[data-config-key="pricing:mode"]').addEventListener('change',e=>{
      p.querySelector('[data-rows="tiers"]').parentElement.hidden=e.target.value!=='tiered';
      p.querySelector('[data-config-key="pricing:amount"]').parentElement.hidden=e.target.value==='tiered'||e.target.value==='custom_quote';
    });
    p.querySelector('[data-config-key="pricing:mode"]').dispatchEvent(new Event('change'));

    const duration=effective.duration_minutes||60, d=createSection('duration','Duration');
    addField(d,'Hours',makeControl('number',Math.floor(duration/60),{min:0,max:24,step:1})).dataset.configKey='duration:hours';
    addField(d,'Minutes',makeControl('number',duration%60,{min:0,max:59,step:1})).dataset.configKey='duration:minutes';

    const cap=effective.capacity||{}, c=createSection('capacity','Participant capacity');
    addField(c,'Minimum participants',makeControl('number',cap.minimum??1,{min:1,max:10000,step:1})).dataset.configKey='capacity:minimum';
    addField(c,'Maximum participants',makeControl('number',cap.maximum??1,{min:1,max:10000,step:1})).dataset.configKey='capacity:maximum';

    const av=effective.availability||{}, a=createSection('availability','Availability');
    addCheckGroup(a,'Available days',dayLabels.map((label,i)=>[i,label]),av.days||[0,1,2,3,4,5,6],'availability:day');
    const window=(av.windows||[])[0]||{};
    addField(a,'Available from',makeControl('time',window.start||'')).dataset.configKey='availability:start';
    addField(a,'Available until',makeControl('time',window.end||'')).dataset.configKey='availability:end';
    addField(a,'Booking interval (minutes)',makeControl('number',av.interval_minutes||60,{min:5,max:1440,step:5})).dataset.configKey='availability:interval_minutes';
    addField(a,'Buffer before (minutes)',makeControl('number',av.buffer_before_minutes||0,{min:0,max:1440,step:5})).dataset.configKey='availability:buffer_before_minutes';
    addField(a,'Buffer after (minutes)',makeControl('number',av.buffer_after_minutes||0,{min:0,max:1440,step:5})).dataset.configKey='availability:buffer_after_minutes';
    addField(a,'Advance notice (minutes)',makeControl('number',av.advance_notice_minutes||0,{min:0,max:525600,step:15})).dataset.configKey='availability:advance_notice_minutes';

    const ad=createSection('addons','Optional extras');
    addRowsEditor(ad,'Customer-selectable extras',effective.addons||[],'addons');

    const loc=effective.location||{}, l=createSection('location','Location');
    addCheckGroup(l,'Available location types',[['business','Business premises'],['customer','Customer location'],['online','Online']],loc.modes||['business'],'location:mode');
    addField(l,'Location details (one per line)',makeControl('textarea',(loc.places||[]).join('\n'),{rows:3,maxlength:1000})).dataset.configKey='location:places';

    const req=effective.requirements||{}, r=createSection('requirements','Booking requirements');
    addField(r,'Cancellation rules',makeControl('textarea',req.cancellation_policy||'',{rows:3,maxlength:2000})).dataset.configKey='requirements:cancellation_policy';
    addField(r,'Booking confirmation',makeControl('select',req.confirmation||'automatic',{options:[['automatic','Automatic'],['manual','Manual approval']]})).dataset.configKey='requirements:confirmation';

    const pay=effective.payment||{}, payRoot=createSection('payment','Payment');
    addField(payRoot,'Payment required',makeControl('select',pay.mode||'full',{options:[['full','Full payment'],['fixed_deposit','Fixed deposit'],['percentage_deposit','Percentage deposit']]})).dataset.configKey='payment:mode';
    addField(payRoot,'Fixed deposit (ZAR)',makeControl('number',pay.fixed_deposit_amount!=null?pay.fixed_deposit_amount/100:'',{min:0,step:'0.01'})).dataset.configKey='payment:fixed_deposit_amount';
    addField(payRoot,'Deposit percentage',makeControl('number',pay.percentage??0,{min:0,max:100,step:'0.1'})).dataset.configKey='payment:percentage';

    const cf=effective.customer_fields||{}, f=createSection('customer_fields','Customer information');
    addCheckGroup(f,'Required booking fields',[['first_name','First name'],['last_name','Surname'],['phone','Phone'],['email','Email'],['notes','Additional notes']],
      Object.keys(cf).filter(k=>cf[k]===true),'customer_fields:field');

    const q=createSection('questions','Custom questions');addRowsEditor(q,'Questions for the customer',effective.questions||[],'questions');

    return {
      inherited,
      collect() {
        const result={inherit:[]};
        if(inheritedMode) container.querySelectorAll('[data-inherit]').forEach(cb=>{if(cb.checked)result.inherit.push(cb.dataset.inherit);});
        const read=(key)=>container.querySelector('[data-config-key="'+key+'"]');
        const readChecks=(prefix)=>Array.from(container.querySelectorAll('[data-config-key^="'+prefix+':"]')).filter(x=>x.checked).map(x=>Number(x.dataset.configKey.split(':').at(-1))||x.dataset.configKey.split(':').at(-1));
        const readRows=(kind)=>Array.from(container.querySelectorAll('[data-rows="'+kind+'"] .service-config-row')).map(row=>{
          const out={};row.querySelectorAll('[data-row-key]').forEach(x=>{
            if(x.dataset.rowKey==='required')out.required=x.checked;
            else if(x.dataset.rowKey==='options')out.options=x.value.split(',').map(v=>v.trim()).filter(Boolean);
            else if(x.dataset.rowKey==='price')out.price_amount=Math.round(Number(x.value||0)*100);
            else if(x.dataset.rowKey==='amount')out.amount=Math.round(Number(x.value||0)*100);
            else if(['minimum','maximum'].includes(x.dataset.rowKey))out[x.dataset.rowKey]=parseInt(x.value||'0',10);
            else out[x.dataset.rowKey]=x.value;
          });return out;
        }).filter(row=>kind==='tiers'?row.minimum>0&&row.maximum>=row.minimum&&row.amount>=0:kind==='addons'?row.name&&row.price_amount>=0:row.label);
        const mode=read('pricing:mode').value,price=read('pricing:amount').value;
        const config={
          pricing:{mode,amount:Math.round(Number(price||0)*100),tiers:readRows('tiers')},
          duration_minutes:(parseInt(read('duration:hours').value||'0',10)*60)+parseInt(read('duration:minutes').value||'0',10),
          capacity:{minimum:parseInt(read('capacity:minimum').value||'1',10),maximum:parseInt(read('capacity:maximum').value||'1',10)},
          availability:{
            days:readChecks('availability:day'),
            windows:read('availability:start').value&&read('availability:end').value?[{start:read('availability:start').value,end:read('availability:end').value}]:[],
            interval_minutes:parseInt(read('availability:interval_minutes').value||'60',10),
            buffer_before_minutes:parseInt(read('availability:buffer_before_minutes').value||'0',10),
            buffer_after_minutes:parseInt(read('availability:buffer_after_minutes').value||'0',10),
            advance_notice_minutes:parseInt(read('availability:advance_notice_minutes').value||'0',10)
          },
          addons:readRows('addons'),
          location:{modes:readChecks('location:mode'),places:read('location:places').value.split('\n').map(v=>v.trim()).filter(Boolean)},
          requirements:{cancellation_policy:read('requirements:cancellation_policy').value.trim(),confirmation:read('requirements:confirmation').value},
          payment:{mode:read('payment:mode').value,fixed_deposit_amount:Math.round(Number(read('payment:fixed_deposit_amount').value||0)*100),percentage:Number(read('payment:percentage').value||0)},
          customer_fields:Object.fromEntries(['first_name','last_name','phone','email','notes'].map(k=>[k,container.querySelector('[data-config-key="customer_fields:field:'+k+'"]')?.checked||false])),
          questions:readRows('questions')
        };
        if(inheritedMode) config.inherit=result.inherit;
        config.questions.forEach(q=>{if(!q.id)q.id=crypto.randomUUID();});
        return config;
      }
    };
  }
  function render() {
    const list=$('services-list'), loading=$('services-loading'), empty=$('services-empty');
    if (!list) return;
    loading.hidden=true;
    list.replaceChildren();
    const byGroup=new Map(state.groups.map(g=>[g.id,[]]));
    const individuals=[];
    state.services.forEach(s=>s.category_id && byGroup.has(s.category_id) ? byGroup.get(s.category_id).push(s) : individuals.push(s));
    state.groups.forEach(group=>{
      const section=document.createElement('section'); section.className='service-group';
      section.innerHTML='<header class="service-group-header"><div><h3>'+esc(group.label)+'</h3><span>'+byGroup.get(group.id).length+' services</span></div><div class="service-group-actions"><button type="button" data-edit-group="'+esc(group.id)+'">Edit group</button><button type="button" data-delete-group="'+esc(group.id)+'">Delete group</button></div></header><div class="service-group-items"></div>';
      const items=section.querySelector('.service-group-items');
      byGroup.get(group.id).forEach(s=>items.appendChild(serviceCard(s)));
      if(!byGroup.get(group.id).length){const p=document.createElement('p');p.className='muted-text';p.textContent='No services in this group yet.';items.appendChild(p);}
      list.appendChild(section);
    });
    if(individuals.length){
      const section=document.createElement('section');section.className='service-group';
      section.innerHTML='<header class="service-group-header"><div><h3>Individual services</h3><span>'+individuals.length+' services</span></div></header><div class="service-group-items"></div>';
      individuals.forEach(s=>section.querySelector('.service-group-items').appendChild(serviceCard(s)));
      list.appendChild(section);
    }
    empty.hidden=state.groups.length+state.services.length>0;
    list.onclick=e=>{
      const edit=e.target.closest('[data-edit-service]'), del=e.target.closest('[data-delete-service]');
      const eg=e.target.closest('[data-edit-group]'), dg=e.target.closest('[data-delete-group]');
      if(edit) openService(edit.dataset.editService);
      if(del) deleteService(del.dataset.deleteService);
      if(eg) editGroup(eg.dataset.editGroup);
      if(dg) deleteGroup(dg.dataset.deleteGroup);
    };
  }
  function serviceCard(s) {
    const card=document.createElement('article');card.className='service-admin-card';
    const status=s.is_published&&s.is_active?'Published':s.is_published?'Paused':'Draft';
    card.innerHTML='<div class="service-admin-copy"><h4>'+esc(s.name)+'</h4><p>'+esc(s.description||'No description')+'</p><p class="muted-text">'+esc(status)+' · '+esc(new Intl.NumberFormat('en-ZA',{style:'currency',currency:s.currency||'ZAR'}).format((s.price_amount||0)/100))+' · '+esc(s.price_basis==='per_person'?'Per person':'Whole booking')+'</p></div><div class="service-admin-actions"><button type="button" data-edit-service="'+esc(s.id)+'">Edit</button><button type="button" data-delete-service="'+esc(s.id)+'">Delete</button></div>';
    return card;
  }
  async function updateBooking(id,action){
    if(action==='cancel'&&!confirm('Cancel this booking and release its service capacity?'))return;
    try{await rpc('admin_update_service_booking',{p_slug:state.slug,p_key:state.key,p_booking_id:id,p_action:action});await load();message(action==='confirm'?'Booking confirmed.':'Booking cancelled.');}
    catch(e){message(e.message||'Could not update this booking.',true);}
  }
  async function load() {
    message('Loading services...');
    const [services,groups,defaults,bookings]=await Promise.all([
      rpc('get_admin_services',{p_slug:state.slug,p_key:state.key}),
      rpc('get_admin_categories',{p_slug:state.slug,p_key:state.key}),
      rpc('get_service_booking_defaults',{p_slug:state.slug,p_key:state.key}),
      rpc('get_admin_service_bookings',{p_slug:state.slug,p_key:state.key})
    ]);
    state.services=Array.isArray(services)?services:[];
    state.groups=Array.isArray(groups)?groups:[];
    state.defaults=defaults||{};
    state.bookings=Array.isArray(bookings)?bookings:[];
    render();renderBookings();message('');
  }
  function renderBookings(){
    const root=$('service-bookings-list');if(!root)return;root.replaceChildren();
    if(!state.bookings.length){const p=document.createElement('p');p.className='muted-text';p.textContent='No upcoming service bookings.';root.appendChild(p);return;}
    state.bookings.forEach(b=>{
      const row=document.createElement('article');row.className='service-booking-row';
      const customer=b.customer||{};const who=[customer.first_name,customer.last_name].filter(Boolean).join(' ')||customer.email||'Customer';
      const info=document.createElement('div');
      const title=document.createElement('strong');title.textContent=b.service_name+' - '+who;info.appendChild(title);
      const detail=document.createElement('p');detail.textContent=b.date+' at '+String(b.time).slice(0,5)+' · '+b.participants+' participant(s) · '+(b.status||'').replaceAll('_',' ');info.appendChild(detail);
      if(b.total_amount!==null&&b.total_amount!==undefined){const money=document.createElement('p');money.textContent='Total '+new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(b.total_amount/100)+' · due '+new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((b.payment_amount||0)/100);info.appendChild(money);}
      row.appendChild(info);
      const actions=document.createElement('div');actions.className='service-booking-actions';
      if(b.status==='pending_confirmation'){
        const approve=document.createElement('button');approve.type='button';approve.className='service-secondary-button';approve.textContent='Confirm booking';
        approve.addEventListener('click',()=>updateBooking(b.id,'confirm'));actions.appendChild(approve);
      }
      if(!['cancelled','expired'].includes(b.status)){
        const cancel=document.createElement('button');cancel.type='button';cancel.className='service-text-button';cancel.textContent='Cancel booking';
        cancel.addEventListener('click',()=>updateBooking(b.id,'cancel'));actions.appendChild(cancel);
      }
      row.appendChild(actions);root.appendChild(row);
    });
  }
  function showDialog(id){const d=$(id);if(d&&!d.open)d.showModal();}
  function closeDialog(id){const d=$(id);if(d&&d.open)d.close();}
  function setGroupSelect(value) {
    const select=$('service-category');select.replaceChildren();
    const blank=document.createElement('option');blank.value='';blank.textContent='No group (individual service)';select.appendChild(blank);
    state.groups.forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.label;select.appendChild(o);});
    select.value=value||'';
  }
  function openService(id) {
    state.editing=state.services.find(s=>s.id===id)||null;
    $('service-form').reset();
    $('service-form-heading').textContent=state.editing?'Edit service':'Add service';
    $('service-description').value=state.editing?.description||'';
    $('service-name').value=state.editing?.name||'';
    $('service-status').value=state.editing?(state.editing.is_published?(state.editing.is_active?'published':'paused'):'draft'):'draft';
    $('service-kind').value=state.editing?.category_id?'group':'individual';
    setGroupSelect(state.editing?.category_id||'');
    $('group-select-wrap').hidden=$('service-kind').value!=='group';
    const raw=state.editing?.booking_config||{inherit:configSections};
    const effective=state.editing?.resolved_booking_config||state.defaults;
    state.configEditor=buildConfigEditor($('service-booking-settings'),raw,effective,true);
    $('service-form-error').hidden=true;
    showDialog('service-dialog');
  }
  function newService(){state.editing=null;openService(null);}
  function openGroup(id) {
    const group=state.groups.find(g=>g.id===id)||null;
    state.groupOnly=Boolean(group);
    $('group-form').reset();$('group-id').value=group?.id||'';
    $('group-label').value=group?.label||'';
    $('group-form-heading').textContent=group?'Edit group':'Create group';
    $('group-form-error').hidden=true;showDialog('group-dialog');
  }
  async function editGroup(id){openGroup(id);}
  async function deleteGroup(id){
    const group=state.groups.find(g=>g.id===id);if(!group)return;
    const count=state.services.filter(s=>s.category_id===id).length;
    if(!confirm('Delete group "'+group.label+'"? Its '+count+' service(s) will be kept as unpublished individual drafts.'))return;
    try{await rpc('delete_admin_category',{p_slug:state.slug,p_key:state.key,p_id:id,p_expected_updated_at:group.updated_at});await load();message('Group deleted. Its services are saved as drafts.');}
    catch(e){message(e.message||'Could not delete group.',true);}
  }
  async function deleteService(id){
    const service=state.services.find(s=>s.id===id);if(!service)return;
    if(!confirm('Delete service "'+service.name+'"?'))return;
    try{await rpc('delete_admin_service',{p_slug:state.slug,p_key:state.key,p_id:id,p_expected_updated_at:service.updated_at});await load();message('Service deleted.');}
    catch(e){message(e.message||'Could not delete service.',true);}
  }
  function formError(el,error){el.textContent=error;el.hidden=false;}
  async function saveService(event){
    event.preventDefault();
    const errorEl=$('service-form-error');errorEl.hidden=true;
    const name=$('service-name').value.trim();
    const groupId=$('service-kind').value==='group'?$('service-category').value:null;
    if(!name){formError(errorEl,'Enter a service name.');return;}
    if($('service-kind').value==='group'&&!groupId){formError(errorEl,'Choose a group, or create one below.');return;}
    const config=state.configEditor.collect();
    const inherited=new Set(config.inherit||[]);
    const effective={...state.defaults};
    Object.entries(config).forEach(([key,value])=>{if(key!=='inherit'&&!inherited.has(key))effective[key]=value;});
    configSections.forEach(key=>{if(inherited.has(key)&&state.defaults[key]!==undefined)effective[key]=state.defaults[key];});
    const duration=Number(effective.duration_minutes||0),cap=effective.capacity||{};
    if(!Number.isInteger(duration)||duration<1||duration>1440){formError(errorEl,'Set a duration between 1 minute and 24 hours.');return;}
    if(!Number.isInteger(cap.minimum)||!Number.isInteger(cap.maximum)||cap.minimum<1||cap.maximum<cap.minimum||cap.maximum>10000){formError(errorEl,'Maximum participants must be at least the minimum.');return;}
    if(!Array.isArray(effective.availability?.days)||!effective.availability.days.length){formError(errorEl,'Choose at least one available day.');return;}
    const pricing=effective.pricing||{},mode=pricing.mode||'fixed';
    let price=Number(pricing.amount)||0;
    if(mode==='tiered'){
      const tier=(pricing.tiers||[]).slice().sort((a,b)=>a.minimum-b.minimum)[0];price=tier?.amount||0;
      const tiers=(pricing.tiers||[]).slice().sort((a,b)=>a.minimum-b.minimum);
      if(!tiers.length||tiers[0].minimum>cap.minimum||tiers.at(-1).maximum<cap.maximum){formError(errorEl,'Add price tiers that cover the service participant range.');return;}
    }
    if(!Number.isFinite(price)||price<0||price>2147483647){formError(errorEl,'Enter a valid price.');return;}
    const id=state.editing?.id||crypto.randomUUID(),status=$('service-status').value;
    const payload={
      p_slug:state.slug,p_key:state.key,p_id:id,p_name:name,
      p_description:$('service-description').value.trim(),p_service_type:'private',
      p_duration_minutes:duration,p_price_amount:Math.round(price),
      p_price_basis:mode==='per_person'?'per_person':'per_session',
      p_participant_count:cap.maximum,p_is_published:status!=='draft',
      p_expected_updated_at:state.editing?.updated_at||null,p_category_id:groupId,
      p_is_active:status!=='paused',p_photo_path:null
    };
    try{
      const saved=await rpc('save_admin_service',payload);
      state.editing={...(state.editing||{}),...(saved||{}),id};
      const places=(effective.location?.places||[]).join(', ');
      await rpc('save_admin_service_details',{p_slug:state.slug,p_key:state.key,p_service_id:id,
        p_duration_minutes:duration,p_people_count:cap.maximum,p_location:[(effective.location?.modes||[]).join(', '),places].filter(Boolean).join(' - '),
        p_booking_policy:effective.requirements?.cancellation_policy||''});
      await rpc('save_service_booking_config',{p_slug:state.slug,p_key:state.key,p_service_id:id,p_config:config});
      closeDialog('service-dialog');await load();message('Service and booking settings saved.');
    }catch(e){formError(errorEl,e.message||'Could not save service settings. Reload Services if the service itself was saved.');}
  }
  async function saveGroup(event){
    event.preventDefault();const err=$('group-form-error');err.hidden=true;
    const label=$('group-label').value.trim();if(!label){formError(err,'Enter a group name.');return;}
    const id=$('group-id').value||crypto.randomUUID();
    try{await categoryRpc(id,label,state.groupOnly?state.groups.find(g=>g.id===id)?.updated_at:null);closeDialog('group-dialog');await load();message('Group saved.');}
    catch(e){formError(err,e.message||'Could not save group.');}
  }
  window.initializeAdminServices = function(credentials) {
    state.slug=credentials.bizSlug;state.key=credentials.adminKey;
    $('add-service').disabled=false;
    $('add-service').addEventListener('click',newService);
    $('edit-booking-defaults').addEventListener('click',()=>{
      state.defaultsEditor=buildConfigEditor($('business-booking-default-settings'),state.defaults,state.defaults,false);
      showDialog('booking-defaults-dialog');
    });
    $('booking-defaults-form').addEventListener('submit',async event=>{
      event.preventDefault();const err=$('booking-defaults-error');err.hidden=true;
      try{
        const config=state.defaultsEditor.collect();
        delete config.inherit;
        if(!config.duration_minutes||config.duration_minutes<1)throw new Error('Set a default duration of at least one minute.');
        if(config.capacity.maximum<config.capacity.minimum)throw new Error('Default maximum participants must be at least the minimum.');
        await rpc('save_business_booking_defaults',{p_slug:state.slug,p_key:state.key,p_config:config});
        closeDialog('booking-defaults-dialog');await load();message('Business booking defaults saved.');
      }catch(e){formError(err,e.message||'Could not save business defaults.');}
    });
    $('service-form').addEventListener('submit',saveService);
    $('group-form').addEventListener('submit',saveGroup);
    $('service-kind').addEventListener('change',e=>{$('group-select-wrap').hidden=e.target.value!=='group';});
    $('create-group-inline').addEventListener('click',()=>{state.groupOnly=false;openGroup(null);});
    $('close-service').addEventListener('click',()=>closeDialog('service-dialog'));
    $('cancel-service').addEventListener('click',()=>closeDialog('service-dialog'));
    $('close-group').addEventListener('click',()=>closeDialog('group-dialog'));
    $('cancel-group').addEventListener('click',()=>closeDialog('group-dialog'));
    $('close-booking-defaults').addEventListener('click',()=>closeDialog('booking-defaults-dialog'));
    $('cancel-booking-defaults').addEventListener('click',()=>closeDialog('booking-defaults-dialog'));
    load().catch(e=>{$('services-loading').hidden=true;message(e.message||'Could not load Services settings.',true);});
  };
})();