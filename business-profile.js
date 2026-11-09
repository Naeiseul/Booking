// Public-only rendering and validation shared by the existing client and admin.
window.BusinessProfile = (() => {
    function https(value) {
        if (!value || typeof value !== 'string') return '';
        try {
            const raw = value.trim();
            if (/[\s\\\u0000-\u001f]/.test(raw)) return '';
            const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
            return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') ? url.href : '';
        } catch (_) { return ''; }
    }
    function photo(path) {
        return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path || '')
            ? SUPABASE_URL + '/storage/v1/object/public/service-photos/' + path : '';
    }
    function phone(value) {
        const number = String(value || '').trim();
        const dial = number.replace(/[\s().-]/g, '');
        return /^\+?\d[\d\s().-]*$/.test(number) && /^\+?\d{7,15}$/.test(dial) ? dial : '';
    }
    function link(id, href, title) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = href ? 'inline-flex' : 'none';
        if (href) el.href = href;
        else el.removeAttribute('href');
        el.setAttribute('rel', 'noopener noreferrer');
        if (title) { el.title = title; el.setAttribute('aria-label', title); }
    }
    function render(data, admin = false) {
        data = data || {};
        const logo = https(data.logo_url);
        const image = document.getElementById('biz-avatar-img');
        const fallback = document.getElementById('biz-avatar-svg');
        if (image && fallback) {
            image.style.objectFit = 'contain';
            image.style.display = logo ? 'block' : 'none';
            fallback.style.display = logo ? 'none' : 'block';
            if (logo) PhotoTools.set(image,logo,{width:192,lazy:false,priority:true,onError:()=>{image.style.display='none';fallback.style.display='block';}});
            if (!logo) image.removeAttribute('src');

        }
        for (const [id, key] of [['ig-link','instagram_url'],['fb-link','facebook_url'],['tiktok-link','tiktok_url']]) {
            link(id, data.show_social_icons === false ? '' : https(data[key]));
        }
        const dial = phone(data.phone_number === undefined ? data.whatsapp_number : data.phone_number);
        link('business-phone-link', dial ? 'tel:' + dial : '', 'Call business' + (dial ? ' on ' + dial : ''));
        if (admin) return;
        const cover = document.getElementById('business-cover-banner');
        if (cover) {
            const coverUrl = photo(data.hero_photo_path);
            cover.style.backgroundImage = 'none';
            cover.classList.toggle('has-cover-image', !!coverUrl);
            let hero = cover.querySelector('img');
            if (coverUrl) {
                if (!hero) { hero=document.createElement('img'); hero.alt=''; cover.appendChild(hero); }
                PhotoTools.set(hero,coverUrl,{width:960,sizes:'(max-width: 1100px) 100vw, 1100px',maxWidth:1600,lazy:false,priority:true});
            } else if (hero) hero.remove();
        }
        let wa = phone(data.whatsapp_number).replace(/^\+/, '');
        if (/^0\d{9}$/.test(wa)) wa = '27' + wa.slice(1);
        link('business-whatsapp-link', wa ? 'https://wa.me/' + wa : '', 'WhatsApp');
        const tagline = document.getElementById('business-tagline');
        if (tagline) { tagline.textContent = data.tagline || ''; tagline.hidden = !data.tagline; }
        const info = document.getElementById('public-business-profile');
        if (!info) return;
        const signature = JSON.stringify([data.description,data.hero_photo_path,data.gallery_photo_paths,data.email,data.whatsapp_number,data.website_url,data.service_area,data.delivery_methods]);
        if (info.dataset.signature === signature) return;
        info.dataset.signature = signature;
        info.replaceChildren();
        function text(tag, value, cls) {
            if (!value) return;
            const el = document.createElement(tag); el.textContent = value;
            if (cls) el.className = cls;
            info.appendChild(el);
        }
        function addImage(parent, path, alt) {
            const url = photo(path); if (!url) return;
            const img = document.createElement('img'); img.alt = alt;
            PhotoTools.set(img,url,{width:384});

            parent.appendChild(img);
        }
        text('p', data.description, 'public-business-about');
        text('p', data.service_area, 'public-business-location');
        const methods = {in_person:'In person',online:'Online',mobile:'Mobile visits'};
        text('p', (data.delivery_methods || []).map(k => methods[k]).filter(Boolean).join(' · '));
        const contacts = document.createElement('div'); contacts.className = 'public-profile-contacts';
        const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') ? data.email : '';
        for (const [label, href] of [['Email',email ? 'mailto:' + email : ''],['Website',https(data.website_url)]]) {
            if (!href) continue;
            const a = document.createElement('a'); a.textContent = label; a.href = href;
            a.target = '_blank'; a.rel = 'noopener noreferrer'; contacts.appendChild(a);
        }
        if (contacts.children.length) info.appendChild(contacts);
        const gallery = document.createElement('div'); gallery.className = 'public-branding-gallery';
        (data.gallery_photo_paths || []).slice(0,12).forEach((p,i) => addImage(gallery,p,'Business photo ' + (i+1)));
        if (gallery.children.length) info.appendChild(gallery);
        info.hidden = !info.children.length;
    }
    return {https, photo, phone, render};
})();
