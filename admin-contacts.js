// Admin contact links use only public business data.
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const parts = window.location.pathname.split('/').filter(Boolean);
    const bizSlug = params.get('biz') || (parts[0] === 'admin' ? parts[1] : '');
    if (!bizSlug) return;
    let refreshing = false;
    async function refreshContacts() {
        if (refreshing) return;
        refreshing = true;
        try {
            const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_public_page', {
                method: 'POST', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
                body: JSON.stringify({ p_slug: bizSlug })
            });
            if (!response.ok) throw new Error('Contact request failed');
            const data = await response.json() || {};
            // Show TikTok only when this business has a valid TikTok profile URL.
            const tiktokEl = document.getElementById('tiktok-link');
            if (tiktokEl) {
                tiktokEl.style.display = 'none';
                tiktokEl.removeAttribute('href');
                try {
                    const rawTikTok = typeof data.tiktok_url === 'string' ? data.tiktok_url.trim() : '';
                    const tiktokUrl = new URL(/^(?:[a-z0-9-]+\.)*tiktok\.com\//i.test(rawTikTok)
                        ? 'https://' + rawTikTok : rawTikTok);
                    if (tiktokUrl.protocol === 'https:' &&
                        (tiktokUrl.hostname === 'tiktok.com' || tiktokUrl.hostname.endsWith('.tiktok.com'))) {
                        tiktokEl.href = tiktokUrl.href;
                        tiktokEl.style.display = 'block';
                    }
                } catch (_) {
                    // Missing or invalid links stay hidden.
                }
            }

            // The existing WhatsApp field stores the business contact number.
            const phoneEl = document.getElementById('business-phone-link');
            if (phoneEl) {
                phoneEl.style.display = 'none';
                phoneEl.removeAttribute('href');
                phoneEl.removeAttribute('title');
                phoneEl.setAttribute('aria-label', 'Call business');
                const phone = String(data.phone_number === undefined ? data.whatsapp_number || '' : data.phone_number || '').trim();
                const dialNumber = phone.replace(/[\s().-]/g, '');
                if (/^\+?\d[\d\s().-]*$/.test(phone) && /^\+?\d{7,15}$/.test(dialNumber)) {
                    phoneEl.href = 'tel:' + dialNumber;
                    phoneEl.title = 'Call ' + phone;
                    phoneEl.setAttribute('aria-label', 'Call business on ' + phone);
                    phoneEl.style.display = 'block';
                }
            }


            if (window.BusinessProfile) BusinessProfile.render(data,true);
        } catch (_) {
            // Contact failures must not interrupt calendar or service controls.
        } finally {
            refreshing = false;
        }
    }
    refreshContacts();
    setInterval(refreshContacts, 3000);
});

