(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { slug:'', key:'', services:[], groups:[], editing:null, groupOnly:false };

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
  async function load() {
    message('Loading services...');
    const [services,groups]=await Promise.all([
      rpc('get_admin_services',{p_slug:state.slug,p_key:state.key}),
      rpc('get_admin_categories',{p_slug:state.slug,p_key:state.key})
    ]);
    state.services=Array.isArray(services)?services:[];
    state.groups=Array.isArray(groups)?groups:[];
    render();message('');
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
    $('service-price').value=state.editing?(state.editing.price_amount/100):'';
    $('service-hours').value=state.editing?Math.floor(state.editing.duration_minutes/60):'';
    $('service-minutes').value=state.editing?state.editing.duration_minutes%60:'';
    $('service-participants').value=state.editing?(state.editing.detail_people_count??state.editing.participant_count??''):'';
    $('service-location').value=state.editing?.location||'';
    $('service-policy').value=state.editing?.booking_policy||'';
    $('service-price-basis').value=state.editing?.price_basis||'per_session';
    $('service-status').value=state.editing?(state.editing.is_published?(state.editing.is_active?'published':'paused'):'draft'):'draft';
    $('service-kind').value=state.editing?.category_id?'group':'individual';
    setGroupSelect(state.editing?.category_id||'');
    $('group-select-wrap').hidden=$('service-kind').value!=='group';
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
    const priceRaw=$('service-price').value.trim();
    const price=priceRaw===''?0:Math.round(Number(priceRaw)*100);
    if(!Number.isFinite(price)||price<0||price>2147483647){formError(errorEl,'Enter a valid price.');return;}
    const hours=Number($('service-hours').value||0),mins=Number($('service-minutes').value||0);
    const duration=hours*60+mins;
    const peopleRaw=$('service-participants').value.trim();
    const detailPeople=peopleRaw===''?null:Math.max(1,Math.min(10000,parseInt(peopleRaw,10)));
    const type=detailPeople===null?'private':'private';
    const basis=$('service-price-basis').value;
    const status=$('service-status').value;
    const id=state.editing?.id||crypto.randomUUID();
    const payload={
      p_slug:state.slug,p_key:state.key,p_id:id,p_name:name,
      p_description:$('service-description').value.trim(),p_service_type:type,
      p_duration_minutes:duration>0?Math.min(1440,duration):30,
      p_price_amount:price,p_price_basis:basis,
      p_participant_count:detailPeople||1,
      p_is_published:status!=='draft',p_expected_updated_at:state.editing?.updated_at||null,
      p_category_id:groupId,p_is_active:status!=='paused',p_photo_path:null
    };
    try {
      await rpc('save_admin_service',payload);
      await rpc('save_admin_service_details',{p_slug:state.slug,p_key:state.key,p_service_id:id,p_duration_minutes:duration||null,p_people_count:detailPeople,p_location:$('service-location').value.trim(),p_booking_policy:$('service-policy').value.trim()});
      closeDialog('service-dialog');await load();message('Service saved.');
    }catch(e){formError(errorEl,e.message||'Could not save service.');}
  }
  async function saveGroup(event){
    event.preventDefault();const err=$('group-form-error');err.hidden=true;
    const label=$('group-label').value.trim();if(!label){formError(err,'Enter a group name.');return;}
    const id=$('group-id').value||crypto.randomUUID();
    try{await categoryRpc(id,label,state.groupOnly?state.groups.find(g=>g.id===id)?.updated_at:null);closeDialog('group-dialog');await load();message('Group saved.');}
    catch(e){formError(err,e.message||'Could not save group.');}
  }
  window.initializeAdminServices = function(credentials) {
    state.slug = credentials.bizSlug;
    state.key = credentials.adminKey;
    $('add-service').disabled=false;
    $('add-service').addEventListener('click',newService);
    $('service-form').addEventListener('submit',saveService);
    $('group-form').addEventListener('submit',saveGroup);
    $('service-kind').addEventListener('change',e=>{$('group-select-wrap').hidden=e.target.value!=='group';});
    $('create-group-inline').addEventListener('click',()=>{state.groupOnly=false;openGroup(null);});
    $('close-service').addEventListener('click',()=>closeDialog('service-dialog'));
    $('cancel-service').addEventListener('click',()=>closeDialog('service-dialog'));
    $('close-group').addEventListener('click',()=>closeDialog('group-dialog'));
    $('cancel-group').addEventListener('click',()=>closeDialog('group-dialog'));
    load().catch(e=>{ $('services-loading').hidden=true;message(e.message||'Could not load services.',true); });
  };
})();