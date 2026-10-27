window.initializeAdminServices = function ({ bizSlug, adminKey }) {
    const get = id => document.getElementById(id);
    const form = get('service-form');
    const fields = get('service-fields');
    const add = get('add-service');
    const reload = get('reload-services');
    const list = get('services-list');
    const empty = get('services-empty');
    const loading = get('services-loading');
    const error = get('services-error');
    const message = get('services-message');
    const formError = get('service-form-error');
    const save = get('save-service');
    let services = [];
    let draftId = null;
    let expectedUpdatedAt = null;
    let saving = false;

    function showError(element, text) {
        element.textContent = text;
        element.hidden = false;
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

    function requestError(failure, action) {
        if (failure.code === '28000') return 'We could not verify your dashboard link. Please reopen your admin link.';
        if (failure.code === '40001') return 'This service changed or is no longer available. Cancel editing, reload services and try again.';
        if (['23514', '23502', '22003', '22P02'].includes(failure.code)) return 'Please check the service details and try again.';
        return action === 'save'
            ? 'We could not confirm the save. Your details are still here. Check your connection and try again, or cancel and reload services to check.'
            : 'We could not load your services. Check your connection and select Reload services.';
    }

    function durationLabel(minutes) {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return [hours ? hours + ' hr' : '', rest ? rest + ' min' : ''].filter(Boolean).join(' ');
    }

    function renderServices() {
        list.replaceChildren();
        empty.hidden = services.length !== 0;
        services.forEach(service => {
            const card = document.createElement('article');
            card.className = 'service-card';
            const heading = document.createElement('div');
            heading.className = 'service-card-heading';
            const title = document.createElement('h3');
            title.textContent = service.name;
            heading.appendChild(title);
            card.appendChild(heading);
            if (service.description) {
                const description = document.createElement('p');
                description.textContent = service.description;
                card.appendChild(description);
            }
            const details = document.createElement('p');
            details.textContent = durationLabel(service.duration_minutes) + ' · ' +
                (service.service_type === 'class' ? 'Shared class' :
                    service.participant_count + (service.participant_count === 1 ? ' person' : ' people') + ' per booking');
            card.appendChild(details);
            const price = document.createElement('p');
            price.className = 'service-price';
            price.textContent = new Intl.NumberFormat('en-ZA', {
                style: 'currency', currency: service.currency
            }).format(service.price_amount / 100) +
                (service.price_basis === 'per_person' ? ' per person' : ' per booking');
            card.appendChild(price);
            const footer = document.createElement('div');
            footer.className = 'service-card-footer';
            const badge = document.createElement('span');
            badge.className = 'service-badge' + (service.is_published ? ' is-visible' : '');
            badge.textContent = service.is_published ? 'Visible in catalogue' : 'Hidden from catalogue';
            footer.appendChild(badge);
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'service-text-button';
            edit.textContent = 'Edit';
            edit.setAttribute('aria-label', 'Edit ' + service.name);
            edit.disabled = !form.hidden;
            edit.addEventListener('click', () => openForm(service));
            footer.appendChild(edit);
            card.appendChild(footer);
            list.appendChild(card);
        });
    }

    function updateType() {
        const isClass = get('service-type').value === 'class';
        get('service-participants-field').hidden = isClass;
        get('service-participants').disabled = isClass;
        get('service-participants').required = !isClass;
        get('service-price-basis').disabled = isClass;
        if (isClass) get('service-price-basis').value = 'per_person';
        get('service-type-help').textContent = isClass
            ? 'Clients book places in a shared class. Space limits belong to each scheduled class.'
            : 'One booking covers the people included below.';
    }

    function openForm(service) {
        if (saving) return;
        form.reset();
        draftId = service ? service.id : crypto.randomUUID();
        expectedUpdatedAt = service ? service.updated_at : null;
        get('service-name').value = service ? service.name : '';
        get('service-description').value = service ? service.description : '';
        get('service-type').value = service ? service.service_type : 'private';
        get('service-hours').value = service ? Math.floor(service.duration_minutes / 60) : 0;
        get('service-minutes').value = service ? service.duration_minutes % 60 : 0;
        get('service-price').value = service ? (service.price_amount / 100).toFixed(2) : '';
        get('service-price-basis').value = service ? service.price_basis : 'per_session';
        get('service-participants').value = service && service.participant_count ? service.participant_count : 1;
        get('service-published').checked = service ? service.is_published : false;
        get('service-form-heading').textContent = service ? 'Edit service' : 'Add service';
        formError.hidden = true;
        message.hidden = true;
        form.hidden = false;
        add.disabled = true;
        reload.disabled = true;
        updateType();
        renderServices();
        get('service-name').focus();
    }

    function closeForm() {
        form.hidden = true;
        draftId = null;
        expectedUpdatedAt = null;
        add.disabled = false;
        reload.disabled = false;
        renderServices();
        add.focus();
    }

    async function loadServices() {
        if (saving || !form.hidden) return;
        error.hidden = true;
        message.hidden = true;
        loading.hidden = false;
        add.disabled = true;
        reload.disabled = true;
        try {
            const data = await rpc('get_admin_services', {});
            if (!Array.isArray(data)) throw new Error('Invalid service list');
            services = data;
            renderServices();
            add.disabled = false;
        } catch (failure) {
            showError(error, requestError(failure, 'load'));
        } finally {
            loading.hidden = true;
            reload.disabled = false;
        }
    }

    add.addEventListener('click', () => openForm(null));
    reload.addEventListener('click', loadServices);
    get('cancel-service').addEventListener('click', () => {
        if (!saving) closeForm();
    });
    get('service-type').addEventListener('change', updateType);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || form.hidden) return;
        formError.hidden = true;
        get('service-name').value = get('service-name').value.trim();
        if (!form.reportValidity()) return;
        const hours = Number(get('service-hours').value);
        const minutes = Number(get('service-minutes').value);
        const duration = hours * 60 + minutes;
        if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 ||
            minutes < 0 || minutes > 59 || duration < 1 || duration > 1440) {
            showError(formError, 'Enter a duration between 1 minute and 24 hours.');
            get('service-hours').focus();
            return;
        }
        // Convert decimal rands to integer cents without floating-point arithmetic.
        const rawPrice = get('service-price').value.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(rawPrice)) {
            showError(formError, 'Enter a price with no more than two decimal places.');
            get('service-price').focus();
            return;
        }
        const [rands, cents = ''] = rawPrice.split('.');
        const priceAmount = Number(rands) * 100 + Number(cents.padEnd(2, '0'));
        if (!Number.isSafeInteger(priceAmount) || priceAmount > 2147483647) {
            showError(formError, 'Enter a price up to R21,474,836.47.');
            return;
        }
        const serviceType = get('service-type').value;
        const participantCount = serviceType === 'class' ? null : Number(get('service-participants').value);
        if (serviceType !== 'class' && (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 10000)) {
            showError(formError, 'Enter between 1 and 10,000 people per booking.');
            return;
        }
        saving = true;
        fields.disabled = true;
        save.textContent = 'Saving…';
        try {
            const saved = await rpc('save_admin_service', {
                p_id: draftId,
                p_name: get('service-name').value,
                p_description: get('service-description').value.trim(),
                p_service_type: serviceType,
                p_duration_minutes: duration,
                p_price_amount: priceAmount,
                p_price_basis: serviceType === 'class' ? 'per_person' : get('service-price-basis').value,
                p_participant_count: participantCount,
                p_is_published: get('service-published').checked,
                p_expected_updated_at: expectedUpdatedAt
            });
            if (!saved || saved.id !== draftId || !saved.updated_at) throw new Error('Invalid save response');
            const index = services.findIndex(service => service.id === saved.id);
            if (index === -1) services.push(saved);
            else services[index] = saved;
            closeForm();
            error.hidden = true;
            message.textContent = 'Service saved.';
            message.hidden = false;
        } catch (failure) {
            showError(formError, requestError(failure, 'save'));
        } finally {
            saving = false;
            fields.disabled = false;
            save.textContent = 'Save service';
        }
    });
    return loadServices();
};
