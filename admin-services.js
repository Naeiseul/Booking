window.initializeAdminServices = function ({ bizSlug, adminKey }) {
    const get = id => document.getElementById(id);
    const form = get('service-form'), fields = get('service-fields'), save = get('save-service');
    const add = get('add-service'), reload = get('reload-services'), list = get('services-list');
    const empty = get('services-empty'), loading = get('services-loading');
    const error = get('services-error'), message = get('services-message'), formError = get('service-form-error');
    const categoryForm = get('category-form'), categoryAdd = get('add-category');
    const categoryError = get('category-form-error'), categoryMessage = get('categories-message');
    const serviceDialog = get('service-dialog'), categoryDialog = get('category-dialog');
    let services = [], categories = [], ready = false, saving = false;
    let draftId = null, expectedUpdatedAt = null, categoryDraftId = null, categoryExpectedUpdatedAt = null;
    let inlineCategory = false, selectedCategoryId = '', createdInlineCategory = false;
    let initialPublished = false, initialCategoryId = '', publicationRequested = false;
    function catalogueState() {
        const status=get('service-status').value;
        return status==='paused' ? {published:initialPublished,active:false} : {published:status==='published',active:true};
    }
    const collapsedCategories = new Set();
    function showError(element, text) { element.textContent = text; element.hidden = false; }
    let photoPath = '', selectedPhotoFile = null, photoUploadId = null, uploadedFilePath = null, previewObjectUrl = null;
    let photoLibrary = [];
    const photoInput = get('service-photo');
    const photoPreview = get('service-photo-preview');
    function photoUrl(path) {
        return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path || '')
            ? SUPABASE_URL + '/storage/v1/object/public/service-photos/' + path : '';
    }
    function clearPreviewObject() {
        if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    }
    function renderPhoto() {
        const src = previewObjectUrl || photoUrl(photoPath);
        photoPreview.hidden = !src;
        if (src) photoPreview.src = src;
        else photoPreview.removeAttribute('src');
        get('remove-service-photo').hidden = !src;
        const gallery = get('service-photo-library');
        gallery.replaceChildren();
        photoLibrary.forEach((photo,index) => {
            const src = photoUrl(photo.path);
            if (!src) return;
            const button = document.createElement('button');
            button.type='button'; button.className='photo-choice';
            button.setAttribute('aria-label','Choose uploaded photo ' + (index+1));
            button.setAttribute('aria-pressed',String(!selectedPhotoFile && photoPath === photo.path));
            const image=document.createElement('img');
            image.src=src; image.alt=''; image.loading='lazy';
            button.appendChild(image);
            button.addEventListener('click',()=>{
                clearPreviewObject(); photoInput.value=''; selectedPhotoFile=null;
                photoUploadId=null; uploadedFilePath=null; photoPath=photo.path; renderPhoto();
            });
            gallery.appendChild(button);
        });
    }
    async function loadPhotoLibrary() {
        get('photo-library-error').hidden=true;
        try {
            const data=await rpc('get_admin_service_photos',{});
            if (!Array.isArray(data)) throw Error('Invalid library');
            photoLibrary=data;
            if (!form.hidden) renderPhoto();
        } catch (_) { get('photo-library-error').hidden=false; }
    }
    photoInput.addEventListener('change',()=>{
        const file=photoInput.files && photoInput.files[0];
        if (!file) return;
        if (file.size>5242880 || (file.type && !['image/jpeg','image/png','image/webp'].includes(file.type))) {
            photoInput.value=''; showError(formError,'Choose a JPG, PNG or WebP photo up to 5 MB.'); return;
        }
        clearPreviewObject(); selectedPhotoFile=file; photoUploadId=crypto.randomUUID(); uploadedFilePath=null;
        previewObjectUrl=URL.createObjectURL(file); renderPhoto();
    });
    get('remove-service-photo').addEventListener('click',()=>{
        clearPreviewObject(); photoInput.value=''; selectedPhotoFile=null; photoUploadId=null; uploadedFilePath=null; photoPath=''; renderPhoto();
    });
    async function uploadPhoto() {
        if (!selectedPhotoFile || uploadedFilePath) return;
        const body=new FormData();
        body.append('slug',bizSlug); body.append('key',adminKey);
        body.append('upload_id',photoUploadId); body.append('file',selectedPhotoFile);
        const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),60000);
        try {
            save.textContent='Uploading photo…';
            const response=await fetch(SUPABASE_URL+'/functions/v1/service-photo-upload',{
                method:'POST',body,signal:controller.signal
            });
            const data=await response.json();
            if(!response.ok || !photoUrl(data.photo_path)) {
                const failure=Error('Photo upload failed');
                failure.userMessage=data.error || 'Photo upload failed. Please try again.'; throw failure;
            }
            photoPath=data.photo_path; uploadedFilePath=photoPath;
        } finally { clearTimeout(timeout); }
    }

    async function rpc(name, parameters) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
                method: 'POST', cache: 'no-store', signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ p_slug: bizSlug, p_key: adminKey, ...parameters })
            });
            const data = await response.json();
            if (!response.ok) {
                const failure = new Error('Service request failed');
                failure.code = data && data.code;
                throw failure;
            }
            return data;
        } finally {
            clearTimeout(timeout);
        }
    }

    function requestError(failure, action, noun = 'service') {
        if (failure.userMessage) return failure.userMessage;
        const plural = noun === 'category' ? 'categories' : 'services';
        const reloadLabel = 'Reload services';
        if (failure.code === '28000') return 'We could not verify your dashboard link. Please reopen your admin link.';
        if (failure.code === '40001') return 'This ' + noun + ' changed or is no longer available. Cancel editing, select Reload services and try again.';
        if (['23514', '23502', '22003', '22P02'].includes(failure.code)) return 'Please check the ' + noun + ' details and try again.';
        return action === 'save'
            ? 'We could not confirm the save. Your details are still here. Check your connection and try again, or cancel and select Reload services to check.'
            : 'We could not load your ' + plural + '. Check your connection and select ' + reloadLabel + '.';
    }

    function durationLabel(minutes) {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return [hours ? hours + ' hr' : '', rest ? rest + ' min' : ''].filter(Boolean).join(' ');
    }


    const categoryIcons = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2Z"/>',
        people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3ZM16 4a3 3 0 0 1 0 6M19 14a5 5 0 0 1 3 4v3"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
        book: '<path d="M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16"/>',
        star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>'
    };


    function updateButtons() {
        const editing = !form.hidden || !categoryForm.hidden;
        add.disabled = categoryAdd.disabled = !ready || saving || editing;
        reload.disabled = saving || editing;
        get('close-service').disabled = get('cancel-service').disabled = saving;
        get('close-category').disabled = get('cancel-category').disabled = saving;
    }
    function iconElement(iconName) {
        const icon = document.createElement('span');
        icon.className = 'admin-category-icon';
        icon.setAttribute('aria-hidden', 'true');
        const artwork = Object.hasOwn(categoryIcons, iconName) ? categoryIcons[iconName] : categoryIcons.grid;
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + artwork + '</svg>';
        return icon;
    }
    function button(label, action, className = 'service-text-button') {
        const item = document.createElement('button');
        item.type = 'button'; item.className = className; item.textContent = label;
        item.disabled = !ready || saving || !form.hidden || !categoryForm.hidden;
        item.addEventListener('click', action);
        return item;
    }
    function renderServiceRow(service) {
        const row = document.createElement('article');
        row.className = 'admin-service-row'; row.dataset.serviceId = service.id;
        const src = photoUrl(service.photo_path);
        if (src) {
            const image = document.createElement('img');
            image.src = src; image.alt = ''; image.className = 'admin-service-thumb'; image.loading = 'lazy';
            image.addEventListener('error', () => { image.hidden = true; });
            row.appendChild(image);
        }
        const text = document.createElement('div'); text.className = 'admin-service-text';
        const name = document.createElement('h4'); name.textContent = service.name; text.appendChild(name);
        const details = document.createElement('p'); details.className = 'muted-text';
        const price = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: service.currency }).format(service.price_amount / 100);
        details.textContent = durationLabel(service.duration_minutes) + ' · ' +
            (service.service_type === 'class' ? 'Shared class' : service.participant_count + (service.participant_count === 1 ? ' person' : ' people')) +
            ' · ' + price + (service.price_basis === 'per_person' ? ' per person' : ' per booking');
        text.appendChild(details);
        if (service.price_basis === 'per_person' && service.service_type === 'private' && service.participant_count > 1) {
            const total = document.createElement('p'); total.className = 'service-hint';
            total.textContent = new Intl.NumberFormat('en-ZA', {style:'currency',currency:service.currency})
                .format(service.price_amount * service.participant_count / 100) + ' total per booking';
            text.appendChild(total);
        }
        row.appendChild(text);
        const states = document.createElement('div'); states.className = 'admin-service-states';
        const category = categories.find(item => item.id === service.category_id);
        const visible = service.is_published && service.is_active && category && category.enabled;
        const badge = document.createElement('span'); badge.className = 'service-badge' + (visible ? ' is-visible' : '');
        badge.textContent = visible ? 'Published' : !service.is_active ? 'Paused' : !service.is_published ? 'Draft' : 'Hidden';
        states.appendChild(badge);
        if (service.is_published && (!category || !category.enabled)) {
            const reason = document.createElement('span'); reason.className = 'service-hint';
            reason.textContent = !category ? 'Needs a category' : 'Category disabled'; states.appendChild(reason);
        }
        if (service.service_type === 'class') {
            const pending = document.createElement('span'); pending.className = 'service-hint';
            pending.textContent = 'Not bookable yet'; states.appendChild(pending);
        }
        row.appendChild(states);
        const edit = button('Edit', () => openForm(service));
        edit.setAttribute('aria-label', 'Edit ' + service.name);
        row.appendChild(edit);
        return row;
    }
    function renderServices() {
        list.replaceChildren();
        empty.hidden = !ready || services.length > 0 || categories.length > 0;
        if (!ready) return;
        const ordered = [...categories].sort((a,b) => a.sort_order-b.sort_order ||
            String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
        const groups = ordered.map(category => ({category, items: services.filter(service => service.category_id === category.id)}));
        const unassigned = services.filter(service => !categories.some(category => category.id === service.category_id));
        if (unassigned.length) groups.unshift({category:null,items:unassigned});
        groups.forEach(({category,items}, index) => {
            const key = category ? category.id : '__unassigned__';
            const group = document.createElement('section');
            group.className = 'admin-service-group'; group.dataset.categoryId = key;
            const header = document.createElement('div'); header.className = 'service-group-header';
            const toggle = document.createElement('button');
            toggle.type='button'; toggle.className='service-group-toggle';
            const bodyId='service-group-'+index;
            toggle.setAttribute('aria-controls',bodyId);
            toggle.setAttribute('aria-expanded',String(!collapsedCategories.has(key)));
            toggle.appendChild(iconElement(category ? category.icon : 'grid'));
            const heading = document.createElement('h3'); heading.textContent = category ? category.label : 'Needs a category';
            toggle.appendChild(heading);
            const count = document.createElement('span'); count.className='service-group-count';
            count.textContent=items.length+' '+(items.length===1?'service':'services'); toggle.appendChild(count);
            const chevron=document.createElement('span'); chevron.className='service-group-chevron'; chevron.textContent='⌃';
            chevron.setAttribute('aria-hidden','true'); toggle.appendChild(chevron);
            header.appendChild(toggle);
            if(category) {
                if(!category.enabled) {
                    const disabled=document.createElement('span'); disabled.className='service-badge';
                    disabled.textContent='Disabled'; header.appendChild(disabled);
                }
                const edit=button('Edit category',()=>openCategoryForm(category));
                edit.setAttribute('aria-label','Edit category '+category.label); header.appendChild(edit);
            }
            group.appendChild(header);
            const body=document.createElement('div'); body.id=bodyId; body.className='service-group-body';
            body.hidden=collapsedCategories.has(key);
            toggle.addEventListener('click',()=>{
                if(collapsedCategories.has(key)) collapsedCategories.delete(key); else collapsedCategories.add(key);
                body.hidden=collapsedCategories.has(key);
                toggle.setAttribute('aria-expanded',String(!body.hidden));
            });
            if(!category) {
                const hint=document.createElement('p'); hint.className='service-hint unassigned-help';
                hint.textContent='Edit a service to choose or create its category.'; body.appendChild(hint);
            }
            items.forEach(service=>body.appendChild(renderServiceRow(service)));
            if(!items.length) {
                const hint=document.createElement('p'); hint.className='service-hint unassigned-help';
                hint.textContent='No services in this category yet.'; body.appendChild(hint);
            }
            if(category) {
                const addInCategory=button('+ Add service to this category',()=>openForm(null,category.id),'service-secondary-button category-add-service');
                addInCategory.setAttribute('aria-label','Add service to '+category.label);
                body.appendChild(addInCategory);
            }
            group.appendChild(body); list.appendChild(group);
        });
    }
    function categorySelection() { return categories.find(item=>item.id===get('service-category').value); }
    function updatePublication() {
        const category=categorySelection(), {published,active}=catalogueState();
        get('edit-service-category').hidden=!category;
        let text=!active ? 'Paused — hidden from clients.' : !published ? 'Draft — hidden from clients.' : !category ? 'Choose or create a category to publish.' :
            !category.enabled ? 'This category is disabled. Edit it here to enable it, or choose another.' :
            get('service-type').value==='class' ? 'Shown in the catalogue. Not bookable yet — class scheduling is not ready.' :
            'Shown in the catalogue. Payment checkout is not available yet.';
        get('service-publication-help').textContent=text;
        const raw=Number(get('service-price').value), people=Number(get('service-participants').value)||1;
        const perPerson=get('service-type').value==='class' || get('service-price-basis').value==='per_person';
        const formatted=new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'});
        get('service-price-help').textContent=get('service-price').value!=='' && Number.isFinite(raw) && raw>=0
            ? formatted.format(raw)+(perPerson?' per person':' per booking')+
                (perPerson && get('service-type').value!=='class' && people>1?' · '+formatted.format(raw*people)+' total for '+people+' people':'') : '';
    }
    function updateType() {
        const isClass=get('service-type').value==='class';
        get('service-participants-field').hidden=isClass;
        get('service-participants').disabled=isClass;
        get('service-participants').required=!isClass;
        get('service-price-basis').disabled=isClass;
        if(isClass) get('service-price-basis').value='per_person';
        get('service-type-help').textContent=isClass ? 'Not bookable yet — class scheduling and capacity are not ready.' : 'One appointment for the people included in the booking.';
        updatePublication();
    }
    function renderCategoryOptions(selectedId) {
        const select=get('service-category'); select.replaceChildren();
        const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Choose a category'; select.appendChild(placeholder);
        [...categories].sort((a,b)=>a.sort_order-b.sort_order || a.label.localeCompare(b.label)).forEach(category=>{
            const option=document.createElement('option'); option.value=category.id;
            option.textContent=category.label+(category.enabled?'':' (disabled)'); select.appendChild(option);
        });
        const create=document.createElement('option'); create.value='__create__'; create.textContent='+ Create new category'; select.appendChild(create);
        select.value=selectedId || ''; selectedCategoryId=select.value;
    }
    function clearFieldErrors() {
        ['service-name','service-category','service-duration','service-price'].forEach(id=>{get(id+'-error').hidden=true;});
        ['service-name','service-category','service-hours','service-minutes','service-price','service-participants'].forEach(id=>get(id).removeAttribute('aria-invalid'));
    }
    function fieldError(id,text,input=id) {
        showError(get(id+'-error'),text); get(input).setAttribute('aria-invalid','true'); get(input).focus();
    }
    function openForm(service, categoryId = '') {
        if(saving || !ready || !categoryForm.hidden || !form.hidden) return;
        form.reset(); clearFieldErrors();
        clearPreviewObject(); photoInput.value=''; selectedPhotoFile=null; photoUploadId=null; uploadedFilePath=null;
        photoPath=service ? service.photo_path||'' : ''; createdInlineCategory=false;
        draftId=service ? service.id : crypto.randomUUID();
        expectedUpdatedAt=service ? service.updated_at : null;
        get('service-name').value=service ? service.name : '';
        get('service-description').value=service ? service.description : '';
        get('service-type').value=service ? service.service_type : 'private';
        get('service-hours').value=service ? Math.floor(service.duration_minutes/60) : 0;
        get('service-minutes').value=service ? service.duration_minutes%60 : 0;
        get('service-price').value=service ? (service.price_amount/100).toFixed(2) : '';
        get('service-price-basis').value=service ? service.price_basis : 'per_session';
        get('service-participants').value=service && service.participant_count ? service.participant_count : 1;
        renderCategoryOptions(service ? service.category_id : categoryId);
        get('service-status').value=service && !service.is_active ? 'paused' : service && service.is_published ? 'published' : 'draft';
        initialPublished=Boolean(service && service.is_published); initialCategoryId=service ? service.category_id || '' : categoryId; publicationRequested=false;
        get('service-content').open=false;
        get('service-advanced').open=Boolean(service && (service.price_basis==='per_person' || service.participant_count>1));
        get('service-form-heading').textContent=service ? 'Edit service' : 'Add service';
        formError.hidden=true; message.hidden=true; categoryMessage.hidden=true; form.hidden=false;
        renderPhoto(); loadPhotoLibrary(); updateType(); updateButtons();
        serviceDialog.showModal(); get('service-name').focus();
    }
    function closeForm() {
        clearPreviewObject(); form.hidden=true; serviceDialog.close();
        draftId=null; expectedUpdatedAt=null; updateButtons(); renderServices(); add.focus();
    }
    async function loadServices() {
        if(saving || !form.hidden || !categoryForm.hidden) return;
        error.hidden=true; message.hidden=true; categoryMessage.hidden=true; loading.hidden=false; ready=false;
        updateButtons(); renderServices();
        try {
            const [data,categoryData]=await Promise.all([rpc('get_admin_services',{}),rpc('get_admin_categories',{})]);
            if(!Array.isArray(data)||!Array.isArray(categoryData)) throw Error('Invalid catalogue settings');
            services=data; categories=categoryData; ready=true; renderServices();
        } catch(failure) { showError(error,requestError(failure,'load')); }
        finally { loading.hidden=true; updateButtons(); }
    }
    function openCategoryForm(category, fromService=false) {
        if(saving || !ready || !categoryForm.hidden || (!form.hidden && !fromService)) return;
        inlineCategory=fromService; categoryForm.reset();
        categoryDraftId=category ? category.id : crypto.randomUUID();
        categoryExpectedUpdatedAt=category ? category.updated_at : null;
        get('category-label').value=category ? category.label : '';
        get('category-icon').value=category ? category.icon : 'grid';
        get('category-order').value=category ? category.sort_order : Math.min(2147483647,categories.reduce((max,item)=>Math.max(max,item.sort_order+1),0));
        get('category-enabled').checked=category ? category.enabled : true;
        get('category-form-heading').textContent=category ? 'Edit category' : 'Create category';
        categoryError.hidden=true; categoryMessage.hidden=true; categoryForm.hidden=false;
        updateButtons(); categoryDialog.showModal(); get('category-label').focus();
    }
    function closeCategoryForm() {
        categoryForm.hidden=true; categoryDialog.close();
        categoryDraftId=null; categoryExpectedUpdatedAt=null; updateButtons(); renderServices();
        if(inlineCategory) { get('service-category').focus(); updatePublication(); } else categoryAdd.focus();
    }
    categoryAdd.addEventListener('click',()=>openCategoryForm(null));
    get('create-service-category').addEventListener('click',()=>openCategoryForm(null,true));
    get('edit-service-category').addEventListener('click',()=>openCategoryForm(categorySelection(),true));
    get('service-category').addEventListener('change',()=>{
        if(get('service-category').value==='__create__') {
            get('service-category').value=selectedCategoryId; openCategoryForm(null,true);
        } else { selectedCategoryId=get('service-category').value; get('service-category-error').hidden=true; updatePublication(); }
    });
    categoryForm.addEventListener('submit',async event=>{
        event.preventDefault(); if(saving || categoryForm.hidden) return;
        categoryError.hidden=true;
        get('category-label').value=get('category-label').value.trim();
        if(!get('category-label').value) { showError(categoryError,'Enter a category name.'); get('category-label').focus(); return; }
        if(get('category-label').value.length>80) { showError(categoryError,'Use 80 characters or fewer for the category name.'); get('category-label').focus(); return; }
        const order=Number(get('category-order').value);
        if(get('category-order').value==='' || !Number.isInteger(order)||order<0||order>2147483647) {
            showError(categoryError,'Enter a whole display order between 0 and 2,147,483,647.'); get('category-order').focus(); return;
        }
        if(!categoryForm.reportValidity()) return;
        saving=true; get('category-fields').disabled=true; get('save-category').textContent='Saving…'; updateButtons();
        try {
            const wasNew=categoryExpectedUpdatedAt===null;
            const saved=await rpc('save_admin_category',{p_id:categoryDraftId,p_label:get('category-label').value,
                p_icon:get('category-icon').value,p_enabled:get('category-enabled').checked,p_sort_order:order,p_expected_updated_at:categoryExpectedUpdatedAt});
            if(!saved || saved.id!==categoryDraftId || !saved.updated_at) throw Error('Invalid category save response');
            const index=categories.findIndex(item=>item.id===saved.id);
            if(index===-1) categories.push(saved); else categories[index]=saved;
            if(inlineCategory) {
                renderCategoryOptions(saved.id); createdInlineCategory=createdInlineCategory||wasNew;
                get('service-category-error').hidden=true;
            }
            closeCategoryForm();
            categoryMessage.textContent='Category saved.'; categoryMessage.hidden=false;
            if(inlineCategory) {
                updatePublication();
                if(wasNew) get('service-publication-help').textContent='Category saved and selected. Save the service to finish.';
            }
        } catch(failure) { showError(categoryError,requestError(failure,'save','category')); }
        finally { saving=false; get('category-fields').disabled=false; get('save-category').textContent='Save category'; updateButtons(); renderServices(); }
    });
    add.addEventListener('click',()=>openForm(null));
    reload.addEventListener('click',loadServices);
    ['cancel-service','close-service'].forEach(id=>get(id).addEventListener('click',()=>{if(!saving) closeForm();}));
    ['cancel-category','close-category'].forEach(id=>get(id).addEventListener('click',()=>{if(!saving) closeCategoryForm();}));
    serviceDialog.addEventListener('cancel',event=>{event.preventDefault();if(!saving && categoryForm.hidden) closeForm();});
    categoryDialog.addEventListener('cancel',event=>{event.preventDefault();if(!saving) closeCategoryForm();});
    get('service-type').addEventListener('change',updateType);
    ['service-price','service-price-basis','service-participants','service-status'].forEach(id=>{
        get(id).addEventListener('input',updatePublication); get(id).addEventListener('change',updatePublication);
    });
    get('service-status').addEventListener('change',()=>{ publicationRequested=get('service-status').value==='published'; });
    form.addEventListener('invalid',event=>{
        const target=event.target;
        if(target && target.closest) { const detail=target.closest('details'); if(detail) detail.open=true; }
    },true);
    form.addEventListener('submit',async event=>{
        event.preventDefault(); if(saving || form.hidden || !categoryForm.hidden) return;
        formError.hidden=true; clearFieldErrors();
        get('service-name').value=get('service-name').value.trim();
        if(!get('service-name').value || get('service-name').value.length>120) {
            fieldError('service-name','Enter a service name of 1–120 characters.'); return;
        }
        const category=categorySelection(), {published,active}=catalogueState();
        if(published && !category) { fieldError('service-category','Choose a category or use + Create new category to publish.'); return; }
        if(published && active && !category.enabled && (!initialPublished || publicationRequested || category.id!==initialCategoryId)) { fieldError('service-category','This category is disabled. Use Edit category to enable it, or choose another.'); return; }
        const hours=Number(get('service-hours').value), minutes=Number(get('service-minutes').value), duration=hours*60+minutes;
        if(get('service-hours').value==='' || get('service-minutes').value==='' || !Number.isInteger(hours) ||
            !Number.isInteger(minutes)||hours<0||minutes<0||minutes>59||duration<1||duration>1440) {
            fieldError('service-duration','Enter a duration between 1 minute and 24 hours.','service-hours'); return;
        }
        const rawPrice=get('service-price').value.trim();
        if(!/^\d+(\.\d{1,2})?$/.test(rawPrice)) { fieldError('service-price','Enter a price with no more than two decimal places.'); return; }
        const [rands,cents='']=rawPrice.split('.');
        const priceAmount=Number(rands)*100+Number(cents.padEnd(2,'0'));
        if(!Number.isSafeInteger(priceAmount)||priceAmount>2147483647) { fieldError('service-price','Enter a price up to R21,474,836.47.'); return; }
        const serviceType=get('service-type').value;
        const participantCount=serviceType==='class'?null:Number(get('service-participants').value);
        if(serviceType!=='class' && (!Number.isInteger(participantCount)||participantCount<1||participantCount>10000)) {
            get('service-advanced').open=true; showError(formError,'Enter between 1 and 10,000 people per booking.');
            get('service-participants').setAttribute('aria-invalid','true'); get('service-participants').focus(); return;
        }
        if(!form.reportValidity()) return;
        saving=true; fields.disabled=true; save.textContent='Saving…'; updateButtons();
        try {
            if(selectedPhotoFile && !uploadedFilePath) await uploadPhoto();
            save.textContent='Saving…';
            const saved=await rpc('save_admin_service',{p_id:draftId,p_name:get('service-name').value,
                p_description:get('service-description').value.trim(),p_service_type:serviceType,p_duration_minutes:duration,
                p_price_amount:priceAmount,p_price_basis:serviceType==='class'?'per_person':get('service-price-basis').value,
                p_participant_count:participantCount,p_is_published:published,p_category_id:get('service-category').value||null,
                p_is_active:active,p_photo_path:photoPath,p_expected_updated_at:expectedUpdatedAt});
            if(!saved || saved.id!==draftId || !saved.updated_at) throw Error('Invalid save response');
            const index=services.findIndex(item=>item.id===saved.id);
            if(index===-1) services.push(saved); else services[index]=saved;
            closeForm(); error.hidden=true;
            message.textContent=!saved.is_active ? 'Service saved. Paused — hidden from clients.' : !saved.is_published ? 'Draft saved.' : category && category.enabled ? 'Service saved and published.' : 'Service saved. Category disabled — hidden from clients.';
            message.hidden=false;
        } catch(failure) {
            showError(formError,(createdInlineCategory?'Your category is saved. ':'')+requestError(failure,'save'));
            formError.focus();
        } finally { saving=false; fields.disabled=false; save.textContent='Save service'; updateButtons(); renderServices(); }
    });
    return loadServices();
};
