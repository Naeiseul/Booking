document.addEventListener('DOMContentLoaded', async () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const bizSlug = parts.length === 2 && parts[1] === 'details' ? decodeURIComponent(parts[0]) : null;
    const query = new URLSearchParams(window.location.search);
    const date = query.get('date') || '';
    const time = query.get('time') || '';
    const form = document.getElementById('booking-form');
    const errorEl = document.getElementById('booking-error');
    const button = document.getElementById('continue-payment');
    const back = document.getElementById('back-to-calendar');
    if (bizSlug) back.href = '/' + encodeURIComponent(bizSlug);

    function showError(message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
    }

    const dateObj = new Date(date + 'T12:00:00');
    if (!bizSlug || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() !== Number(date.slice(0, 4)) ||
        dateObj.getMonth() + 1 !== Number(date.slice(5, 7)) ||
        dateObj.getDate() !== Number(date.slice(8, 10)) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        document.getElementById('selected-date').textContent = 'Choose an available time';
        showError('Please return to the calendar and select an available slot.');
        return;
    }

    document.getElementById('selected-date').textContent = dateObj.toLocaleDateString('en-ZA', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    document.getElementById('selected-time').textContent = time;

    async function checkAvailability() {
        const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_public_page', {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ p_slug: bizSlug })
        });
        if (!response.ok) throw new Error('Calendar request failed');
        const data = await response.json();
        if (data) document.getElementById('booking-business').textContent = data.name || '';
        return Boolean(data && (data.slots || []).some(slot =>
            slot.date === date && slot.time && slot.time.substring(0, 5) === time && slot.status === 'open'
        ));
    }

    const draftKey = 'booking-draft:' + bizSlug + ':' + date + ':' + time;
    const fields = ['first_name', 'last_name', 'phone', 'email', 'notes'];
    try {
        const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        if (draft) {
            fields.forEach(name => {
                if (typeof draft[name] === 'string') form.elements.namedItem(name).value = draft[name];
            });
        }
    } catch (_) {
        // A missing draft must not prevent someone from filling in their details.
    }

    try {
        if (!await checkAvailability()) {
            showError('This time is no longer available. Please choose another slot from the calendar.');
            return;
        }
        form.hidden = false;
    } catch (_) {
        showError('We could not check this time. Please refresh the page to try again.');
        return;
    }

    // Restore the submit button when returning from checkout using browser Back.
    window.addEventListener('pageshow', () => {
        button.disabled = false;
        button.textContent = 'Continue to payment';
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        fields.forEach(name => {
            const input = form.elements.namedItem(name);
            input.value = input.value.trim();
        });
        if (!form.reportValidity()) return;
        const phone = form.elements.namedItem('phone');
        if (phone.value.replace(/\D/g, '').length < 7) {
            showError('Please enter a valid phone number, including your area or country code.');
            phone.focus();
            return;
        }
        errorEl.hidden = true;
        button.disabled = true;
        button.textContent = 'Checking availability…';
        try {
            if (!await checkAvailability()) {
                showError('This time is no longer available. Please choose another slot from the calendar.');
                return;
            }
            const draft = { business: bizSlug, date, time };
            fields.forEach(name => { draft[name] = form.elements.namedItem(name).value; });
            try {
                // Keep the demo details in this tab only; no booking is confirmed here.
                sessionStorage.setItem(draftKey, JSON.stringify(draft));
            } catch (_) {
                showError('We could not keep your details in this browser. Please allow site storage and try again.');
                return;
            }
            const payment = new URL('https://paystack.shop/pay/o495iejvn3');
            ['first_name', 'last_name', 'email'].forEach(name => payment.searchParams.set(name, draft[name]));
            window.location.href = payment.href;
        } catch (_) {
            showError('We could not check availability. Please try again.');
        } finally {
            button.disabled = false;
            button.textContent = 'Continue to payment';
        }
    });
});
