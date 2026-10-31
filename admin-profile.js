window.initializeAdminProfile = function ({bizSlug, adminKey}) {
    const form = document.getElementById('business-profile-form');
    const fields = document.getElementById('profile-fields');
    const feedback = document.getElementById('profile-feedback');
    const reload = document.getElementById('profile-reload');
    const textFields = ['name','tagline','description','email','phone_number','whatsapp_number','instagram_url','facebook_url','tiktok_url','website_url','service_area'];
    const urlFields = ['instagram_url','facebook_url','tiktok_url','website_url'];
    const delivery = ['in_person','online','mobile'];
    let saved = null, busy = false, preparing = 0;
    let logo = null, hero = null, gallery = [];
    const get = key => document.getElementById('profile-' + key);
    const publicUrl = new URL('/' + encodeURIComponent(bizSlug), location.origin).href;
    get('preview').href = publicUrl; get('public-link').value = publicUrl;
    function message(text, error = false) { feedback.textContent = text; feedback.setAttribute('role', error ? 'alert' : 'status'); }
    function notifySaved() {
        const toast = document.createElement('div');
        toast.className = 'profile-save-toast';
        toast.setAttribute('role','status');
        toast.textContent = 'Your changes have been saved!';
        document.querySelectorAll('.profile-save-toast').forEach(el => el.remove());
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }
    const saveButton = get('save');
    const saveLabel = saveButton.textContent;
    function saveState(active) {
        saveButton.replaceChildren();
        if (active) {
            const spinner = document.createElement('span');
            spinner.className = 'profile-save-spinner';
            spinner.setAttribute('aria-hidden','true');
            const logoImage = document.createElement('img');
            logoImage.alt = '';
            logoImage.src = '/final_tax_logo.png';
            spinner.appendChild(logoImage);
            saveButton.append(spinner, document.createTextNode('Saving…'));
            saveButton.setAttribute('aria-busy','true');
        } else {
            saveButton.textContent = saveLabel;
            saveButton.removeAttribute('aria-busy');
        }
    }
    function lock(value) { busy = value; form.classList.toggle('profile-is-busy',value); fields.disabled = value || !saved || preparing > 0; reload.disabled = value || preparing > 0; get('save').disabled = value || preparing > 0; }
    async function request(name, body, multipart = false) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(SUPABASE_URL + (multipart ? '/functions/v1/service-photo-upload' : '/rest/v1/rpc/' + name), {
                method:'POST', cache:'no-store', signal:controller.signal,
                headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer ' + SUPABASE_ANON_KEY,...(multipart ? {} : {'Content-Type':'application/json'})},
                body:multipart ? body : JSON.stringify(body)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || result.error || 'The request failed. Please try again.');
            return result;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('The request timed out. Your edits are retained; try saving again.');
            throw error;
        } finally { clearTimeout(timeout); }
    }
    function dispose(item) { if (item && item.preview) URL.revokeObjectURL(item.preview); }
    function resetImages() {
        [logo,hero,...gallery].forEach(dispose);
        logo = saved.logo_url ? {url:saved.logo_url} : null;
        hero = saved.hero_photo_path ? {path:saved.hero_photo_path} : null;
        gallery = (saved.gallery_photo_paths || []).map(path => ({path}));
    }
    function imagePreview(parent, item, label, fallback = false) {
        parent.replaceChildren();
        if (!item) { parent.textContent = fallback ? (get('name').value.trim()[0] || 'B').toUpperCase() : 'No image'; return; }
        const src = item.preview || BusinessProfile.https(item.url) || BusinessProfile.photo(item.path);
        if (!src) { parent.textContent = 'Image unavailable'; return; }
        const img = document.createElement('img'); img.src = src; img.alt = label;
        img.onerror = () => { parent.textContent = 'Image unavailable'; };
        parent.appendChild(img);
    }
    function renderImages() {
        imagePreview(get('logo-preview'),logo,'Business logo',true);
        imagePreview(get('hero-preview'),hero,'Booking page hero image');
        get('logo-remove').hidden = !logo; get('hero-remove').hidden = !hero;
        get('gallery').replaceChildren();
        gallery.forEach((item,index) => {
            const tile = document.createElement('div'); tile.className = 'profile-gallery-tile';
            const preview = document.createElement('div'); preview.className = 'profile-image-preview';
            imagePreview(preview,item,'Gallery photo ' + (index+1));
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-gallery-remove';
            remove.textContent = '×'; remove.setAttribute('aria-label','Remove gallery photo ' + (index+1));
            remove.addEventListener('click', () => { dispose(item); gallery.splice(index,1); renderImages(); });
            tile.append(preview,remove); get('gallery').appendChild(tile);
        });
    }
    function updateIdentity(data) {
        document.getElementById('admin-business-name').textContent = data.name;
        document.getElementById('biz-title-text').textContent = data.name + ' (Admin)';
        get('sidebar-name').textContent = data.name;
        document.title = data.name + ' (Admin)';
        imagePreview(get('sidebar-avatar'), data.logo_url ? {url:data.logo_url} : null, 'Business logo',true);
        BusinessProfile.render(data,true);
    }
    function populate() {
        for (const key of textFields) { get(key).value = saved[key] || ''; get(key).setCustomValidity(''); }
        get('show_social_icons').checked = saved.show_social_icons !== false;
        delivery.forEach(key => { get('delivery-' + key).checked = (saved.delivery_methods || []).includes(key); });
        resetImages(); renderImages();
        for (const key of ['logo-file','hero-file','gallery-files']) get(key).value = '';
    }
    async function load() {
        if (busy || preparing) return;
        lock(true); message('Loading business profile…');
        try {
            const data = await request('get_admin_business_profile',{p_slug:bizSlug,p_key:adminKey});
            if (!data || !Number.isSafeInteger(data.profile_version)) throw new Error('Business profile could not be loaded. Please try again.');
            saved = data; populate(); updateIdentity(saved); message('');
        } catch (error) { message(error.message || 'Could not load your profile. Please try again.',true); }
        finally { lock(false); }
    }
    async function choose(input, kind) {
        if (busy) return;
        preparing++; lock(false);
        const pending = [];
        try {
            const files = Array.from(input.files || []);
            if (kind === 'gallery' && gallery.length + files.length > 12) throw new Error('Choose up to 12 gallery photos.');
            for (const file of files) {
                if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
                if (!file.size || file.size > 5242880) throw new Error('Choose an image up to 5 MB.');
                const item = {file,id:crypto.randomUUID(),preview:URL.createObjectURL(file)}; pending.push(item);
                const img = new Image(); img.src = item.preview;
                await img.decode().catch(() => { throw new Error('This image could not be read. Choose another JPG, PNG or WebP.'); });
            }
            if (kind === 'gallery') gallery.push(...pending);
            else if (pending.length) { dispose(kind === 'logo' ? logo : hero); if (kind === 'logo') logo=pending[0]; else hero=pending[0]; }
            renderImages(); if (pending.length) message('Image preview ready. Save changes to apply it.');
        } catch (error) { pending.forEach(dispose); message(error.message,true); }
        finally { input.value=''; preparing--; lock(false); }
    }
    for (const kind of ['logo','hero','gallery']) get(kind === 'gallery' ? 'gallery-files' : kind + '-file').addEventListener('change',event => choose(event.target,kind));
    for (const kind of ['logo','hero']) get(kind + '-remove').addEventListener('click',() => {
        dispose(kind === 'logo' ? logo : hero); if (kind === 'logo') logo=null; else hero=null; renderImages();
    });
    async function upload(item) {
        if (!item || !item.file || item.path) return;
        const body = new FormData(); body.set('slug',bizSlug); body.set('key',adminKey); body.set('upload_id',item.id); body.set('file',item.file);
        const result = await request('',body,true);
        if (!BusinessProfile.photo(result.photo_path)) throw new Error('Upload returned an invalid photo. Please try again.');
        item.path = result.photo_path; item.url = BusinessProfile.photo(item.path);
    }
    form.addEventListener('input',event => { if (event.target.setCustomValidity) event.target.setCustomValidity(''); });
    form.addEventListener('submit',async event => {
        event.preventDefault(); if (busy || preparing || !saved) return;
        for (const key of textFields) get(key).setCustomValidity('');
        if (!get('name').value.trim()) get('name').setCustomValidity('Enter your business name.');
        for (const key of urlFields) {
            const raw = get(key).value.trim();
            if (raw && !BusinessProfile.https(raw)) get(key).setCustomValidity('Enter a valid HTTPS website link.');
        }
        for (const key of ['phone_number','whatsapp_number']) if (get(key).value.trim() && !BusinessProfile.phone(get(key).value)) get(key).setCustomValidity('Enter a phone number with 7 to 15 digits.');
        if (!form.reportValidity()) return;
        lock(true); saveState(true); message('Saving changes…');
        try {
            for (const item of [logo,hero,...gallery]) await upload(item);
            const profile = Object.fromEntries(textFields.map(key => [key,get(key).value.trim()]));
            urlFields.forEach(key => { profile[key] = BusinessProfile.https(profile[key]); });
            profile.logo_url = logo ? logo.url || BusinessProfile.photo(logo.path) : '';
            profile.hero_photo_path = hero ? hero.path : '';
            profile.gallery_photo_paths = gallery.map(item => item.path);
            profile.show_social_icons = get('show_social_icons').checked;
            profile.delivery_methods = delivery.filter(key => get('delivery-' + key).checked);
            const result = await request('save_admin_business_profile',{p_slug:bizSlug,p_key:adminKey,p_profile:profile,p_expected_version:saved.profile_version});
            if (!result || !Number.isSafeInteger(result.profile_version)) throw new Error('Save could not be confirmed. Try again to confirm your changes.');
            saved = result; populate(); updateIdentity(saved); message('Your changes have been saved!'); notifySaved();
            // Existing public polling/focus reads remain authoritative; this is only a refresh hint.
            try { localStorage.setItem('booking-availability:' + bizSlug,JSON.stringify({type:'availability-changed',id:crypto.randomUUID()})); } catch (_) {}
        } catch (error) { message((error.message || 'Saving failed. Please try again.') + ' Your edits and uploaded images are retained.',true); }
        finally { saveState(false); lock(false); }
    });
    get('cancel').addEventListener('click',() => { if (!busy && !preparing && saved) { populate(); message('Unsaved changes cancelled.'); } });
    reload.addEventListener('click',load);
    get('copy').addEventListener('click',async () => {
        try { await navigator.clipboard.writeText(publicUrl); message('Booking link copied.'); }
        catch (_) { get('public-link').focus(); get('public-link').select(); message('Select and copy your booking link.'); }
    });
    load();
};
