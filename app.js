document.addEventListener("DOMContentLoaded", async () => {
    // 1. Get the business slug from the URL query OR clean path
    const urlParams = new URLSearchParams(window.location.search);
    let bizSlug = urlParams.get('biz');
    if (!bizSlug) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) bizSlug = pathParts[0];
    }

    // UI Elements
    const nameEl = document.getElementById('biz-title-text');
    const statusEl = document.getElementById('business-status');
    const tabsEl = document.getElementById('day-tabs');
    const gridEl = document.getElementById('time-grid');
    const bookButton = document.getElementById('book-selected-slot');

    // Show the last known name immediately while fresh business data loads.
    if (bizSlug) {
        try {
            const cachedName = localStorage.getItem('booking-business-name:' + bizSlug);
            if (cachedName) nameEl.textContent = cachedName;
        } catch (_) {}
    }

    // If no business is specified in the link
    if (!bizSlug) {
        nameEl.textContent = "Welcome";
        statusEl.hidden = false;
        statusEl.textContent = "Please use a valid business link.";
        gridEl.innerHTML = '<div class="empty-state">No business specified in link.</div>';
        return;
    }

    // Booking availability uses South African time, independently of device timezone.
    const bookingClock = new Intl.DateTimeFormat('en-CA', {
        timeZone:'Africa/Johannesburg', year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    });
    function slotIsFuture(slot) {
        if (!slot || !/^\d{4}-\d{2}-\d{2}$/.test(slot.date || '') || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(slot.time || '')) return false;
        const parts=Object.fromEntries(bookingClock.formatToParts(new Date()).map(part=>[part.type,part.value]));
        const now=parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute+':'+parts.second;
        return slot.date+'T'+slot.time.slice(0,5)+':'+(slot.time.slice(6,8)||'00') > now;
    }
    function servicePhotoUrl(path) {
        return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path || '')
            ? SUPABASE_URL+'/storage/v1/object/public/service-photos/'+path : '';
    }
    async function loadServiceOpenings(service, force = false) {
        if (!service) return slotsByDate;
        const cached=serviceSlotsCache.get(service.id);
        if (!force&&cached&&Date.now()-cached.loadedAt<15000) {slotsByDate=cached.byDate;return slotsByDate;}
        const from=localDateString(new Date());
        const untilDate=new Date(from+'T12:00:00');untilDate.setDate(untilDate.getDate()+89);
        const to=localDateString(untilDate);
        const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_service_availability',{
            method:'POST',cache:'no-store',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY},
            body:JSON.stringify({p_slug:bizSlug,p_service_id:service.id,p_from:from,p_to:to})
        });
        if(!response.ok)throw new Error('Could not load times for this service.');
        const openings=await response.json(),byDate={};
        (Array.isArray(openings)?openings:[]).forEach(slot=>{
            if(!byDate[slot.date])byDate[slot.date]=[];
            byDate[slot.date].push(slot);
        });
        serviceSlotsCache.set(service.id,{loadedAt:Date.now(),byDate});
        slotsByDate=byDate;
        return byDate;
    }

    let activeDateString = null;
    let viewedMonth = null;
    let slotsByDate = {};
    const serviceSlotsCache = new Map();
    let monthSignature = null;

    let selectedSlot = null;
    let availabilityLoaded = false;
    let loadingData = false;
    let refreshQueued = false;
    let services = [];
    let categories = [];
    let activeCategoryId = null;
    let categorySignature = null;
    const categoryButtons = new Map();
    let selectedService = null;
    let currentServiceIndex = 0;
    let requestedServiceId = urlParams.get('service') || '';
    let catalogueSignature = null;
    let activeStep = 'sessions';
    const stepMenu = document.querySelector('.catalogue-menu');
    const stepButtons = stepMenu ? Array.from(stepMenu.querySelectorAll('button[data-step]')) : [];
    const categoryNavigation = document.getElementById('category-navigation');
    const categoryList = document.getElementById('category-buttons');
    const catalogueLayout = document.querySelector('.catalogue-layout');
    const catalogueEl = document.getElementById('service-catalogue');
    const serviceList = document.getElementById('client-services');
    const calendarEl = document.getElementById('client-calendar');
    const checkoutEl = document.getElementById('client-checkout');
    const galleryEl = document.getElementById('client-gallery');
    const galleryGrid = document.getElementById('client-gallery-grid');

    const continueBtn = document.getElementById('luxury-continue-btn');
    const previousServiceBtn = document.getElementById('previous-service');
    const nextServiceBtn = document.getElementById('next-service');
    const navServices = document.getElementById('nav-services');
    const navGallery = document.getElementById('nav-gallery');
    if (navServices) {
        navServices.addEventListener('click', () => showStep('sessions', true));
    }
    if (navGallery) {
        navGallery.addEventListener('click', () => {
            window.location.href = '/' + encodeURIComponent(bizSlug) + '/gallery';
        });
    }
    function moveService(direction) {
        if (!services.length) return;
        currentServiceIndex = (currentServiceIndex + direction + services.length) % services.length;
        selectedService = null;
        selectedSlot = null;
        availabilityLoaded = true;
        requestedServiceId = '';
        renderCatalogue();
        updateBookButton();
        updateContinueButton();
    }
    if (previousServiceBtn) previousServiceBtn.addEventListener('click', () => moveService(-1));
    if (nextServiceBtn) nextServiceBtn.addEventListener('click', () => moveService(1));
    const backToServices = document.getElementById('back-to-services');
    if (backToServices) backToServices.addEventListener('click', () => showStep('sessions', true));


    function advanceToSchedule() {
        if (!selectedService) return;
        const selectedDayHasOpenSlots = (slotsByDate[activeDateString] || []).some(slot => (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot));
        if (!selectedDayHasOpenSlots) {
            const firstOpenDate = Object.keys(slotsByDate).sort().find(date => slotsByDate[date].some(slot => (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot)));
            if (firstOpenDate) { activeDateString = firstOpenDate; viewedMonth = firstOpenDate.slice(0, 7); monthSignature = ''; }
        }
        renderMonth();
        renderSlots(slotsByDate[activeDateString] || []);
        showStep('schedule', true);
    }

    if (continueBtn) {
        continueBtn.addEventListener('click', advanceToSchedule);
    }

    function updateContinueButton() {
        if (continueBtn) {
            continueBtn.disabled = !selectedService;
        }
    }

    function showStep(step, moveFocus = false) {
        if (step === 'checkout') {
            updateBookButton();
            if (!bookButton.disabled) goToDetails();
            else showStep('schedule', true);
            return;
        }
        activeStep = step;
        const heroTitle = document.getElementById('luxury-hero-title');
        if (heroTitle) {
            heroTitle.innerHTML = step === 'sessions' ? 'Our<br>Services' : step === 'gallery' ? 'Our<br>Work' : 'Our<br>Schedule';
        }
        if (navServices) navServices.classList.toggle('active', step === 'sessions');
        if (navGallery) navGallery.classList.toggle('active', step === 'gallery');
        catalogueEl.hidden = services.length > 0 ? step !== 'sessions' : false;
        categoryNavigation.hidden = step !== 'sessions' || categories.length === 0;
        if (catalogueLayout) catalogueLayout.setAttribute('data-has-categories', String(step === 'sessions' && categories.length > 0));
        calendarEl.hidden = services.length > 0 ? step !== 'schedule' : step === 'checkout';
        galleryEl.hidden = step !== 'gallery';
        checkoutEl.hidden = step !== 'checkout';
        stepButtons.forEach(button => {
            const isCurrent = button.dataset.step === step;
            button.setAttribute('aria-pressed', String(isCurrent));
            if (isCurrent) button.setAttribute('aria-current', 'step');
            else if (button.removeAttribute) button.removeAttribute('aria-current');
        });
        if (moveFocus) {
            const target = step === 'sessions' ? catalogueEl : document.getElementById(step === 'schedule' ? 'calendar-heading' : step === 'gallery' ? 'gallery-heading' : 'checkout-heading');
            if (target && target.focus) {
                target.focus({ preventScroll: true });
                if (target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    stepButtons.forEach(button => {
        button.addEventListener('click', () => showStep(button.dataset.step, true));
    });

    function serviceDuration(service) {
        const duration = Number(service.booking_config?.duration_minutes || service.duration_minutes);
        if (!Number.isFinite(duration) || duration <= 0) return '';
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        return [hours ? hours + ' hr' : '', minutes ? minutes + ' min' : ''].filter(Boolean).join(' ');
    }

    function servicePrice(service, total = false) {
        const pricing = service.booking_config?.pricing || {};
        const mode = pricing.mode || (service.price_basis === 'per_person' ? 'per_person' : 'fixed');
        let amount = Number(pricing.amount ?? service.price_amount) || 0;
        if (mode === 'custom_quote') return 'Custom quotation';
        if (mode === 'tiered') {
            const tier = (pricing.tiers || []).slice().sort((a,b)=>a.amount-b.amount)[0];
            if (!tier) return 'Custom quotation';
            amount = Number(tier.amount) || 0;
        }
        const formatted = new Intl.NumberFormat('en-ZA', { style:'currency', currency:service.currency||'ZAR' }).format(amount/100);
        return mode === 'per_person' ? formatted + ' per person'
            : mode === 'per_hour' ? formatted + ' per hour'
            : formatted;
    }

    function serviceDetails(service) {
        const duration = serviceDuration(service);
        const capacity = service.booking_config?.capacity;
        const low = Number(capacity?.minimum || 1), high = Number(capacity?.maximum || service.participant_count || 1);
        const people = low === high ? low + (low === 1 ? ' person' : ' people') : low + '-' + high + ' participants';
        return [duration, people].filter(Boolean).join(' · ');
    }

    function renderBookingSummary() {
        const summary = document.getElementById('booking-summary');
        const empty = document.getElementById('booking-summary-empty');
        const selected = document.getElementById('booking-summary-service');
        summary.hidden = false;
        empty.hidden = Boolean(selectedService);
        selected.hidden = !selectedService;
        const photo=document.getElementById('booking-summary-photo');
        const source=selectedService ? servicePhotoUrl(selectedService.photo_path) : '';
        photo.hidden=!source;
        if(source) PhotoTools.set(photo,source,{width:192,lazy:false});
        const fields = {
            'booking-summary-name': selectedService ? selectedService.name : '',
            'booking-summary-details': selectedService ? serviceDetails(selectedService) : '',
            'booking-summary-price': selectedService ? servicePrice(selectedService, true) : ''
        };
        Object.entries(fields).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element.textContent !== text) element.textContent = text;
        });
    }


    // Fixed icon artwork, independent of business category names and booking rules.
    const categoryIcons = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2Z"/>',
        people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3ZM16 4a3 3 0 0 1 0 6M19 14a5 5 0 0 1 3 4v3"/>',
        stretch: '<circle cx="14" cy="4" r="2"/><path d="m13 7-3 5 4 3 5 5M10 12l-6 2M14 15l-6 5M17 10l4 2"/>',
        run: '<circle cx="15" cy="4" r="2"/><path d="m13 8-4 4 4 3 3 6M9 12l-6 2M13 15l-5 6M16 9l5 2"/>',
        dumbbell: '<path d="m6.5 6.5 11 11M3 8l5-5M5 10l5-5M14 19l5-5M16 21l5-5"/>',
        activity: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
        book: '<path d="M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16"/>',
        star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>'
    };
    function categoryArtwork(category) {
        const name = (category.label || '').toLowerCase();
        if (/mobility|stretch|flexib|pilates|yoga/.test(name)) return categoryIcons.activity;
        if (/cardio|running|run|hiit|aerobic|spin|cycling/.test(name)) return categoryIcons.heart;
        if (/strength|weight|lifting|gym|resistance/.test(name)) return categoryIcons.dumbbell;
        if (/group|class|team/.test(name)) return categoryIcons.people;
        if (/recovery|rehab|rest/.test(name)) return categoryIcons.activity;
        if (/personal|one.on.one|private/.test(name)) return categoryIcons.person;
        if (/boxing|combat|conditioning/.test(name)) return categoryIcons.activity;
        return Object.hasOwn(categoryIcons,category.icon) ? categoryIcons[category.icon] : categoryIcons.grid;
    }

    function renderCategoryNavigation() {
        const signature = JSON.stringify(categories);
        if (signature !== categorySignature) {
            const focusedId = document.activeElement && document.activeElement.dataset &&
                document.activeElement.dataset.categoryId;
            categoryList.innerHTML = '';
            categoryButtons.clear();
            categories.forEach(category => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'category-button';
                button.dataset.categoryId = category.id;
                button.setAttribute('aria-controls', 'client-services');
                const icon = document.createElement('span');
                icon.className = 'category-icon';
                icon.setAttribute('aria-hidden', 'true');
                // The SVG body is allowlisted artwork, never business-supplied markup.
                const artwork = categoryArtwork(category);
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + artwork + '</svg>';
                const label = document.createElement('span');
                label.className = 'category-label';
                label.textContent = category.label;
                button.appendChild(icon);
                button.appendChild(label);
                button.addEventListener('click', () => {
                    if (activeCategoryId === category.id) return;
                    activeCategoryId = category.id;
                    renderCatalogue();
                });
                categoryList.appendChild(button);
                categoryButtons.set(category.id, button);
            });
            categorySignature = signature;
            if (focusedId) {
                const target = categoryButtons.get(focusedId) || categoryButtons.get(activeCategoryId);
                if (target) target.focus({ preventScroll: true });
            }
        }
        categoryButtons.forEach((button, id) => {
            button.setAttribute('aria-pressed', String(id === activeCategoryId));
        });
        if (catalogueLayout) catalogueLayout.setAttribute('data-has-categories', String(categories.length > 0));
        const heading = document.getElementById('active-category-heading');
        const category = categories.find(item => item.id === activeCategoryId);
        const label = category ? category.label : '';
        if (heading.textContent !== label) heading.textContent = label;
        heading.hidden = !category;
    }

    function renderCatalogue() {
        const service = services[currentServiceIndex] || null;
        const signature = JSON.stringify([currentServiceIndex, service, selectedService && selectedService.id]);
        const position = document.getElementById('service-position');
        if (position) position.textContent = services.length ? (currentServiceIndex + 1) + ' of ' + services.length : '0 services';
        if (previousServiceBtn) previousServiceBtn.disabled = services.length < 2;
        if (nextServiceBtn) nextServiceBtn.disabled = services.length < 2;
        const categoryLabel = document.getElementById('service-category-label');
        const category = service && categories.find(item => item.id === service.category_id);
        if (categoryLabel) categoryLabel.textContent = category ? category.label : 'Individual service';
        if (stepMenu) stepMenu.hidden = false;
        if (categoryNavigation) categoryNavigation.hidden = true;
        if (signature !== catalogueSignature) {
            serviceList.replaceChildren();
            if (service) {
                const card = document.createElement('article');
                const isSelected = Boolean(selectedService && selectedService.id === service.id);
                card.className = 'luxury-service-item client-service-card' + (isSelected ? ' is-selected' : '');
                card.dataset.serviceId = service.id;
                const body = document.createElement('div');
                body.className = 'luxury-service-body service-card-body';
                const title = document.createElement('h3');
                title.className = 'luxury-service-name';
                title.textContent = service.name;
                body.appendChild(title);
                const meta = document.createElement('div');
                meta.className = 'luxury-service-meta';
                const durationText = serviceDuration(service);
                meta.textContent = [durationText ? durationText.toUpperCase() : '', servicePrice(service)].filter(Boolean).join(' · ');
                body.appendChild(meta);
                if (service.description) {
                    const description = document.createElement('p');
                    description.className = 'luxury-service-desc client-service-description';
                    description.textContent = service.description;
                    body.appendChild(description);
                }
                const choose = document.createElement('button');
                choose.type = 'button';
                choose.className = 'luxury-select-btn catalogue-service-button' + (isSelected ? ' selected' : '');
                choose.disabled = service.service_type === 'class';
                choose.textContent = choose.disabled ? 'Unavailable' : isSelected ? 'Selected' : 'Select';
                choose.setAttribute('aria-pressed', String(isSelected));
                choose.setAttribute('aria-label', (choose.disabled ? 'Class times not available for ' : 'Select ') + service.name);
                choose.addEventListener('click', async () => {
                    if (choose.disabled) return;
                    if (!selectedService || selectedService.id !== service.id) {
                        selectedSlot = null;
                        selectedService = service;
                        requestedServiceId = '';
                        availabilityLoaded = false;
                        updateBookButton();
                        try {
                            await loadServiceOpenings(service, true);
                            availabilityLoaded = true;
                            renderCatalogue();
                            updateBookButton();
                            updateContinueButton();
                            renderMonth();
                            renderSlots(slotsByDate[activeDateString] || []);
                        } catch (error) {
                            statusEl.hidden = false;
                            statusEl.textContent = error.message || 'Could not load service availability.';
                        }
                    } else {
                        advanceToSchedule();
                    }
                });
                body.appendChild(choose);
                card.appendChild(body);
                serviceList.appendChild(card);
            } else {
                const empty = document.createElement('article');
                empty.className = 'client-service-card service-card-empty';
                const body = document.createElement('div');
                body.className = 'service-card-body';
                const title = document.createElement('h3');
                title.textContent = 'No services added yet';
                const message = document.createElement('p');
                message.className = 'muted-text';
                message.textContent = 'Published services will appear here.';
                body.append(title, message);
                empty.appendChild(body);
                serviceList.appendChild(empty);
            }
            catalogueSignature = signature;
        }
        renderBookingSummary();
        showStep(activeStep);
        updateContinueButton();
        document.getElementById('calendar-service').hidden = true;
        if (selectedService) {
            document.getElementById('calendar-service-name').textContent = selectedService.name;
            document.getElementById('calendar-service-details').textContent =
                serviceDetails(selectedService) + ' · ' + servicePrice(selectedService, true);
        }
    }

    function renderGallery(photoPaths) {
        if (!galleryGrid) return;
        galleryGrid.replaceChildren();
        const paths = Array.isArray(photoPaths) ? photoPaths.slice(0, 12) : [];
        paths.forEach((path, index) => {
            const url = window.BusinessProfile ? BusinessProfile.photo(path) : '';
            if (!url) return;
            const image = document.createElement('img');
            image.alt = 'Portfolio photo ' + (index + 1);
            image.loading = 'lazy';
            PhotoTools.set(image, url, { width: 640, sizes: '(max-width: 768px) 50vw, 320px' });
            galleryGrid.appendChild(image);
        });
        if (!galleryGrid.children.length) {
            const message = document.createElement('p');
            message.className = 'luxury-gallery-empty';
            message.textContent = 'Portfolio photos will appear here soon.';
            galleryGrid.appendChild(message);
        }
    }

    function updateBookButton() {
        if (selectedSlot && !slotIsFuture(selectedSlot)) selectedSlot=null;
        bookButton.disabled = !selectedSlot || !availabilityLoaded || (services.length > 0 && !selectedService);
        bookButton.textContent = 'Confirm Booking';
        const checkoutButton=stepButtons.find(button=>button.dataset.step==='checkout');
        if(checkoutButton) checkoutButton.disabled=bookButton.disabled;
    }

    function goToDetails() {
        updateBookButton();
        if (bookButton.disabled) return;
        const query = new URLSearchParams(selectedSlot);
        if (selectedService) query.set('service', selectedService.id);
        window.location.href = `/${encodeURIComponent(bizSlug)}/details?${query}`;
    }
    bookButton.addEventListener('click', goToDetails);

    function localDateString(day) {
        return day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' +
            String(day.getDate()).padStart(2, '0');
    }

    function renderMonth(focusDate = null) {
        const today = localDateString(new Date());
        if (!activeDateString || activeDateString < today) {
            activeDateString = today;
            selectedSlot = null;
            updateBookButton();
        }
        if (!viewedMonth) viewedMonth = activeDateString.slice(0, 7);
        const month = new Date(viewedMonth + '-01T12:00:00');
        const monthLabel = month.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
        const monthHeading = document.getElementById('calendar-month');
        if (monthHeading && monthHeading.textContent !== monthLabel) monthHeading.textContent = monthLabel;
        const prevBtn = document.getElementById('previous-month');
        if (prevBtn) prevBtn.disabled = viewedMonth <= today.slice(0, 7);
        const nextBtn = document.getElementById('next-month');
        if (nextBtn) nextBtn.disabled = false;
        const selDateEl = document.getElementById('selected-calendar-date');
        if (selDateEl) {
            selDateEl.textContent =
                new Date(activeDateString + 'T12:00:00').toLocaleDateString('en-ZA', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                });
        }

        const monthTabsEl = document.getElementById('luxury-month-tabs');
        if (monthTabsEl) {
            monthTabsEl.innerHTML = '';
            const viewedBase = new Date(viewedMonth + '-01T12:00:00');
            const todayBase = new Date(today.slice(0, 7) + '-01T12:00:00');
            let startOffset = 0;
            if (viewedBase > todayBase) {
                startOffset = Math.max(0, Math.round((viewedBase.getTime() - todayBase.getTime()) / (30 * 24 * 3600 * 1000)) - 1);
            }
            for (let i = 0; i < 3; i++) {
                const mDate = new Date(todayBase.getFullYear(), todayBase.getMonth() + startOffset + i, 1, 12);
                const mKey = localDateString(mDate).slice(0, 7);
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'luxury-month-tab' + (mKey === viewedMonth ? ' active' : '');
                tab.textContent = mDate.toLocaleDateString('en-ZA', { month: 'long' }).toUpperCase();
                tab.addEventListener('click', () => {
                    if (viewedMonth !== mKey) {
                        viewedMonth = mKey;
                        renderMonth();
                    }
                });
                monthTabsEl.appendChild(tab);
            }
        }
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
        const openings = Object.keys(slotsByDate).filter(date => date.startsWith(viewedMonth) &&
            slotsByDate[date].some(slot => (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot))).sort();
        const signature = JSON.stringify([viewedMonth, activeDateString, today, openings]);
        if (signature === monthSignature) return;
        const focusedDate = focusDate || (document.activeElement && document.activeElement.dataset &&
            document.activeElement.dataset.date);
        tabsEl.innerHTML = '';
        // Monday is the first column.
        const offset = (month.getDay() + 6) % 7;
        for (let index = 0; index < offset; index++) {
            const blank = document.createElement('span');
            blank.setAttribute('aria-hidden', 'true');
            tabsEl.appendChild(blank);
        }
        for (let number = 1; number <= days; number++) {
            const day = new Date(month.getFullYear(), month.getMonth(), number, 12);
            const date = localDateString(day);
            const past = date < today;
            const available = !past && openings.includes(date);
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.date = date;
            button.className = 'month-day' + (available ? ' has-times' : ' no-times');
            button.textContent = String(number);
            button.disabled = past;
            button.setAttribute('aria-pressed', String(date === activeDateString));
            if (date === today) button.setAttribute('aria-current', 'date');
            button.setAttribute('aria-label', day.toLocaleDateString('en-ZA', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            }) + (past ? ', past date' : available ? ', available times' : ', no available times'));
            button.addEventListener('click', () => {
                if (button.disabled) return;
                if (activeDateString !== date) selectedSlot = null;
                activeDateString = date;
                updateBookButton();
                renderMonth(date);
                renderSlots(slotsByDate[date] || []);
            });
            tabsEl.appendChild(button);
        }
        monthSignature = signature;
        if (focusedDate) {
            const target = Array.from(tabsEl.children).find(button => button.dataset && button.dataset.date === focusedDate);
            if (target && !target.disabled) target.focus({ preventScroll: true });
        }
    }

    function changeMonth(offset) {
        if (!availabilityLoaded || !viewedMonth) return;
        const day = new Date(viewedMonth + '-01T12:00:00');
        day.setMonth(day.getMonth() + offset);
        const next = localDateString(day).slice(0, 7);
        if (next < localDateString(new Date()).slice(0, 7)) return;
        viewedMonth = next;
        renderMonth();
    }
    document.getElementById('previous-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    // 7. Draw the Time Grid for the selected day
    function renderSlots(daySlots) {
        if (!daySlots || daySlots.length === 0) {
            gridEl.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    No available times for this date.
                </div>`;
            return;
        }
        
        gridEl.innerHTML = '';
        daySlots.forEach(slot => {
            const chip = document.createElement('button');
            // The public API already filters to open slots and omits status.
            const isOpen = (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot);
            const time = slot.time ? slot.time.substring(0, 5) : "";

            chip.type = 'button';
            chip.disabled = !isOpen;
            chip.className = `time-chip ${isOpen ? 'open' : 'taken'}`;
            const isSelected = Boolean(isOpen && selectedSlot &&
                selectedSlot.date === slot.date && selectedSlot.time === time);
            if (isSelected) chip.classList.add('selected');
            chip.setAttribute('aria-pressed', String(isSelected));
            chip.textContent = time;
            chip.setAttribute('aria-label', `${slot.date} at ${time}${isOpen ? '' : ', unavailable'}`);
            if (isOpen) {
                chip.addEventListener('click', () => {
                    if(!slotIsFuture(slot)) { selectedSlot=null; updateBookButton(); loadData(); return; }
                    selectedSlot = { date: slot.date, time };
                    updateBookButton();
                    renderSlots(daySlots);
                });
            }

            gridEl.appendChild(chip);
        });
    }


    async function loadData() {
        // Keep requests ordered; a save/focus signal during a read queues one fresh read.
        if (loadingData) {
            refreshQueued = true;
            return;
        }
        loadingData = true;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = controller && typeof setTimeout === 'function' ? setTimeout(() => controller.abort(), 15000) : null;
        try {
            // 2. Knock on the "public door" in Supabase
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_page`, {
                method: 'POST',
                signal: controller ? controller.signal : undefined,
                cache: 'no-store', // Force browser to always fetch fresh data
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                },
                body: JSON.stringify({ p_slug: bizSlug })
            });

            if (!response.ok) throw new Error("Failed to connect to database");

            const data = await response.json();

            // 3. If Supabase returns null, the business doesn't exist
            if (!data) {
                selectedSlot = null;
                selectedService = null;
                renderBookingSummary();
                document.getElementById('booking-summary').hidden = true;
                services = [];
                catalogueEl.hidden = true;
                categories = [];
                activeCategoryId = null;
                stepMenu.hidden = true;
                categoryNavigation.hidden = true;
                if (catalogueLayout) catalogueLayout.setAttribute('data-has-categories', 'false');
                checkoutEl.hidden = true;
                calendarEl.hidden = false;
                availabilityLoaded = false;
                updateBookButton();
                if (window.BusinessProfile) BusinessProfile.render(null);
                nameEl.textContent = "Not Found";
                statusEl.hidden = false;
                statusEl.textContent = "We couldn't find this calendar.";
                gridEl.innerHTML = '<div class="empty-state">This business does not exist or is inactive.</div>';
                return;
            }

            // 4. Update the UI with the business data
            nameEl.textContent = data.name || "Booking Calendar";
            try { localStorage.setItem('booking-business-name:' + bizSlug, nameEl.textContent); } catch (_) {}
            statusEl.textContent = '';
            statusEl.hidden = true;
            
            // Logo and PWA injection
            if (data.name) {
                document.title = data.name + " Booking";
            }
            if (data.logo_url) {
                const imgEl = document.getElementById('biz-avatar-img');
                const svgEl = document.getElementById('biz-avatar-svg');
                if (imgEl && svgEl) {
                    PhotoTools.set(imgEl,data.logo_url,{width:192,lazy:false,priority:true});
                    imgEl.style.display = 'block';
                    svgEl.style.display = 'none';
                }
                
                // Keep the shared transparent tab icon when the business logo loads.
                let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
                if (appleIcon && appleIcon.href !== data.logo_url) appleIcon.href = data.logo_url;
            }
            
            // Show TikTok only when this business has a valid TikTok profile URL.
            const tiktokEl = document.getElementById('tiktok-link');
            if (tiktokEl) {
                tiktokEl.style.display = 'none';
                if (tiktokEl.removeAttribute) tiktokEl.removeAttribute('href');
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
                if (phoneEl.removeAttribute) {
                    phoneEl.removeAttribute('href');
                    phoneEl.removeAttribute('title');
                }
                phoneEl.setAttribute('aria-label', 'Call business');
                const phone = typeof data.whatsapp_number === 'string' ? data.whatsapp_number.trim() : '';
                const dialNumber = phone.replace(/[\s().-]/g, '');
                if (/^\+?\d[\d\s().-]*$/.test(phone) && /^\+?\d{7,15}$/.test(dialNumber)) {
                    phoneEl.href = 'tel:' + dialNumber;
                    phoneEl.title = 'Call ' + phone;
                    phoneEl.setAttribute('aria-label', 'Call business on ' + phone);
                    phoneEl.style.display = 'block';
                }
            }

            // Social links injection
            if (data.instagram_url) {
                const igEl = document.getElementById('ig-link');
                if (igEl) { igEl.href = data.instagram_url; igEl.style.display = 'block'; }
            }
            if (data.facebook_url) {
                const fbEl = document.getElementById('fb-link');
                if (fbEl) { fbEl.href = data.facebook_url; fbEl.style.display = 'block'; }
            }

            if (window.BusinessProfile) BusinessProfile.render(data);
            renderGallery(data.gallery_photo_paths || []);
            const nextServices = data.services || [];
            const publicCategories = data.categories || [];
            // The RPC enforces published + active + enabled, scoped to this business.
            // Fail closed on an inconsistent response rather than expose the slot-only fallback.
            if (!Array.isArray(nextServices) || !Array.isArray(publicCategories) ||
                nextServices.some(service => service.category_id && !publicCategories.some(category => category.id === service.category_id))) {
                throw new Error('Invalid catalogue category response');
            }
            categories = publicCategories.filter(category =>
                nextServices.some(service => service.category_id === category.id));
            if(nextServices.some(service=>!service.category_id))categories.push({id:'__individual__',label:'Individual services',icon:'grid',sort_order:999999});
            if (selectedService) {
                const fresh = nextServices.find(service => service.id === selectedService.id && service.service_type === 'private');
                if (!fresh || JSON.stringify(fresh) !== JSON.stringify(selectedService)) selectedSlot = null;
                selectedService = fresh || null;
            }
            services = nextServices;
            currentServiceIndex = selectedService ? Math.max(0, services.findIndex(service => service.id === selectedService.id)) : 0;
            if (requestedServiceId) {
                selectedService = services.find(service => service.id === requestedServiceId && service.service_type === 'private') || null;
                if (selectedService) {
                    currentServiceIndex = Math.max(0, services.findIndex(service => service.id === selectedService.id));
                    activeStep = 'schedule';
                    activeCategoryId = selectedService.category_id || '__individual__';
                    requestedServiceId = '';
                }
            }
            if (!categories.some(category => category.id === activeCategoryId)) {
                activeCategoryId = selectedService && selectedService.category_id
                    ? selectedService.category_id
                    : categories.length ? categories[0].id : '__individual__';
            }
            renderCatalogue();
            const baseSlots=(data.slots||[]).filter(slotIsFuture);
            availabilityLoaded=true;
            slotsByDate={};
            baseSlots.forEach(slot=>{
                if(!slotsByDate[slot.date])slotsByDate[slot.date]=[];
                slotsByDate[slot.date].push(slot);
            });
            if(selectedService) await loadServiceOpenings(selectedService);
            if(selectedSlot&&!((slotsByDate[selectedSlot.date]||[]).some(slot=>
                slot.time&&slot.time.substring(0,5)===selectedSlot.time&&slotIsFuture(slot)))){
                selectedSlot=null;
            }
            updateBookButton();
            if (selectedService && !selectedSlot && !((slotsByDate[activeDateString] || []).some(slot => (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot)))) {
                const firstOpenDate = Object.keys(slotsByDate).sort().find(date => slotsByDate[date].some(slot => (slot.status === undefined || slot.status === 'open') && slotIsFuture(slot)));
                if (firstOpenDate) { activeDateString = firstOpenDate; viewedMonth = firstOpenDate.slice(0,7); monthSignature = ''; }
            }
            renderMonth();

            // Keep an empty selected date visible through availability refreshes.
            renderSlots(slotsByDate[activeDateString] || []);

        } catch (error) {
            availabilityLoaded = false;
            updateBookButton();
            console.error(error);
            // Only show error state if we don't already have slots loaded on the screen
            if (gridEl.innerHTML.includes('skeleton') || gridEl.innerHTML.trim() === '') {
                nameEl.textContent = "Error";
                statusEl.hidden = false;
                statusEl.textContent = "Could not load calendar.";
                gridEl.innerHTML = '<div class="empty-state">Something went wrong. Please check your connection.</div>';
            } else {
                statusEl.hidden = false;
                statusEl.textContent = 'Could not refresh availability. Please check your connection.';
            }
        } finally {
            if (timeout && typeof clearTimeout === 'function') clearTimeout(timeout);
            loadingData = false;
            if (refreshQueued) {
                refreshQueued = false;
                loadData();
            }
        }
    }

    // Cross-tab hints contain no credentials or slots: always fetch current public data.
    const updateKey = 'booking-availability:' + bizSlug;
    let lastUpdateId = null;
    function availabilityChanged(message) {
        if (!message || message.type !== 'availability-changed' ||
            typeof message.id !== 'string' || message.id === lastUpdateId) return;
        lastUpdateId = message.id;
        loadData();
    }
    try {
        if (typeof window.BroadcastChannel === 'function') {
            const channel = new window.BroadcastChannel(updateKey);
            channel.addEventListener('message', event => availabilityChanged(event.data));
        }
    } catch (_) { /* Polling/storage/focus refresh remain available. */ }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('storage', event => {
            if (event.key !== updateKey || !event.newValue) return;
            try { availabilityChanged(JSON.parse(event.newValue)); } catch (_) {}
        });
        window.addEventListener('focus', () => loadData());
        window.addEventListener('pageshow', event => { if (event.persisted) loadData(); });
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') loadData();
    });

    // Initial load
    await loadData();
    
    // LIVE UPDATES: Poll the server silently every 3 seconds to update the UI
    setInterval(loadData, 3000);
});
