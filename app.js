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

    // If no business is specified in the link
    if (!bizSlug) {
        nameEl.textContent = "Welcome";
        statusEl.hidden = false;
        statusEl.textContent = "Please use a valid business link.";
        gridEl.innerHTML = '<div class="empty-state">No business specified in link.</div>';
        return;
    }

    let activeDateString = null;
    let viewedMonth = null;
    let slotsByDate = {};
    let monthSignature = null;

    let selectedSlot = null;
    let availabilityLoaded = false;
    let services = [];
    let categories = [];
    let activeCategoryId = null;
    let categorySignature = null;
    const categoryButtons = new Map();
    let selectedService = null;
    let requestedServiceId = urlParams.get('service') || '';
    let catalogueSignature = null;
    let activeStep = 'sessions';
    const stepMenu = document.querySelector('.catalogue-menu');
    const stepButtons = Array.from(stepMenu.querySelectorAll('button[data-step]'));
    const categoryNavigation = document.getElementById('category-navigation');
    const categoryList = document.getElementById('category-buttons');
    const catalogueLayout = document.querySelector('.catalogue-layout');
    const catalogueEl = document.getElementById('service-catalogue');
    const serviceList = document.getElementById('client-services');
    const calendarEl = document.getElementById('client-calendar');
    const checkoutEl = document.getElementById('client-checkout');

    function showStep(step, moveFocus = false) {
        activeStep = step;
        catalogueEl.hidden = step === 'checkout';
        categoryNavigation.hidden = step === 'checkout' || categories.length === 0;
        if (catalogueLayout) catalogueLayout.setAttribute('data-has-categories', String(step !== 'checkout' && categories.length > 0));
        calendarEl.hidden = step === 'checkout';
        checkoutEl.hidden = step !== 'checkout';
        stepButtons.forEach(button => {
            const isCurrent = button.dataset.step === step;
            button.setAttribute('aria-pressed', String(isCurrent));
            if (isCurrent) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
        });
        if (moveFocus) {
            const target = step === 'sessions' ? catalogueEl : document.getElementById(step === 'schedule' ? 'calendar-heading' : 'checkout-heading');
            target.focus();
        }
    }

    stepButtons.forEach(button => {
        button.addEventListener('click', () => showStep(button.dataset.step, true));
    });

    function serviceDuration(service) {
        const hours = Math.floor(service.duration_minutes / 60);
        const minutes = service.duration_minutes % 60;
        return [hours ? hours + ' hr' : '', minutes ? minutes + ' min' : ''].filter(Boolean).join(' ');
    }

    function servicePrice(service, total = false) {
        const multiplier = total && service.price_basis === 'per_person' ? service.participant_count : 1;
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: service.currency })
            .format(service.price_amount * multiplier / 100);
    }

    function serviceDetails(service) {
        return serviceDuration(service) + ' · ' + (service.service_type === 'class'
            ? 'Shared class' : service.participant_count + (service.participant_count === 1 ? ' person' : ' people') + ' per booking');
    }

    function renderBookingSummary() {
        const summary = document.getElementById('booking-summary');
        const empty = document.getElementById('booking-summary-empty');
        const selected = document.getElementById('booking-summary-service');
        summary.hidden = false;
        empty.hidden = Boolean(selectedService);
        selected.hidden = !selectedService;
        const fields = {
            'booking-summary-name': selectedService ? selectedService.name : '',
            'booking-summary-details': selectedService ? serviceDetails(selectedService) : '',
            'booking-summary-price': selectedService ? servicePrice(selectedService, true) + ' per booking' : ''
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
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
        book: '<path d="M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16"/>',
        star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>'
    };

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
                const artwork = Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon] : categoryIcons.grid;
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
        const visibleServices = services.filter(service => service.category_id === activeCategoryId);
        stepMenu.hidden = false;
        renderCategoryNavigation();
        const signature = JSON.stringify([activeCategoryId, visibleServices, selectedService && selectedService.id]);
        if (signature !== catalogueSignature) {
            serviceList.innerHTML = '';
            visibleServices.forEach(service => {
                const card = document.createElement('article');
                const isSelected = Boolean(selectedService && selectedService.id === service.id);
                card.className = 'client-service-card' + (isSelected ? ' is-selected' : '');
                card.dataset.serviceId = service.id;
                const body = document.createElement('div');
                body.className = 'service-card-body';
                const title = document.createElement('h3');
                title.textContent = service.name;
                body.appendChild(title);
                if (service.description) {
                    const description = document.createElement('p');
                    description.className = 'client-service-description';
                    description.textContent = service.description;
                    body.appendChild(description);
                }
                const details = document.createElement('p');
                details.className = 'muted-text';
                details.textContent = serviceDetails(service);
                body.appendChild(details);
                const price = document.createElement('p');
                price.className = 'client-service-price';
                price.textContent = servicePrice(service) + (service.price_basis === 'per_person' ? ' per person' : ' per booking');
                body.appendChild(price);
                if (service.price_basis === 'per_person' && service.service_type === 'private' && service.participant_count > 1) {
                    const total = document.createElement('p');
                    total.className = 'muted-text';
                    total.textContent = servicePrice(service, true) + ' total for ' + service.participant_count + ' people';
                    body.appendChild(total);
                }
                const choose = document.createElement('button');
                choose.type = 'button';
                choose.className = 'catalogue-service-button';
                choose.disabled = service.service_type === 'class';
                choose.textContent = choose.disabled ? 'Class times not available yet' : isSelected ? 'Selected' : 'View available times';
                choose.setAttribute('aria-pressed', String(isSelected));
                choose.setAttribute('aria-label', (choose.disabled ? 'Class times not available for ' : 'View available times for ') + service.name);
                choose.addEventListener('click', () => {
                    if (choose.disabled) return;
                    if (!selectedService || selectedService.id !== service.id) selectedSlot = null;
                    selectedService = service;
                    requestedServiceId = '';
                    renderCatalogue();
                    updateBookButton();
                    renderSlots(slotsByDate[activeDateString] || []);
                    showStep('schedule', true);
                });
                body.appendChild(choose);
                card.appendChild(body);
                serviceList.appendChild(card);
            });
            if (!visibleServices.length) {
                const empty = document.createElement('article');
                empty.className = 'client-service-card service-card-empty';
                const body = document.createElement('div');
                body.className = 'service-card-body';
                const title = document.createElement('h3');
                title.textContent = 'No services added yet';
                const message = document.createElement('p');
                message.className = 'muted-text';
                message.textContent = 'Published services will appear here.';
                body.appendChild(title);
                body.appendChild(message);
                empty.appendChild(body);
                serviceList.appendChild(empty);
            }
            catalogueSignature = signature;
        }
        renderBookingSummary();
        showStep(activeStep);
        document.getElementById('calendar-service').hidden = !selectedService;
        if (selectedService) {
            document.getElementById('calendar-service-name').textContent = selectedService.name;
            document.getElementById('calendar-service-details').textContent = serviceDetails(selectedService) + ' · ' +
                servicePrice(selectedService, true) + ' per booking';
        }
    }

    function updateBookButton() {
        bookButton.disabled = !selectedSlot || !availabilityLoaded || (services.length > 0 && !selectedService);
        if (!selectedSlot) {
            bookButton.textContent = 'Select a time to book';
            return;
        }
        const date = new Date(selectedSlot.date + 'T12:00:00');
        const label = date.toLocaleDateString('en-ZA', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
        bookButton.textContent = 'Book ' + label + ' at ' + selectedSlot.time;
    }

    bookButton.addEventListener('click', () => {
        if (!selectedSlot || !availabilityLoaded || (services.length > 0 && !selectedService)) return;
        const query = new URLSearchParams(selectedSlot);
        if (selectedService) query.set('service', selectedService.id);
        window.location.href = `/${encodeURIComponent(bizSlug)}/details?${query}`;
    });

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
        if (monthHeading.textContent !== monthLabel) monthHeading.textContent = monthLabel;
        document.getElementById('previous-month').disabled = viewedMonth <= today.slice(0, 7);
        document.getElementById('next-month').disabled = false;
        document.getElementById('selected-calendar-date').textContent =
            new Date(activeDateString + 'T12:00:00').toLocaleDateString('en-ZA', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            });
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
        const openings = Object.keys(slotsByDate).filter(date => date.startsWith(viewedMonth) &&
            slotsByDate[date].some(slot => slot.status === undefined || slot.status === 'open')).sort();
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
            const isOpen = slot.status === undefined || slot.status === 'open';
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
                    selectedSlot = { date: slot.date, time };
                    updateBookButton();
                    renderSlots(daySlots);
                });
            }

            gridEl.appendChild(chip);
        });
    }


    async function loadData() {
        try {
            // 2. Knock on the "public door" in Supabase
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_page`, {
                method: 'POST',
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
                nameEl.textContent = "Not Found";
                statusEl.hidden = false;
                statusEl.textContent = "We couldn't find this calendar.";
                gridEl.innerHTML = '<div class="empty-state">This business does not exist or is inactive.</div>';
                return;
            }

            // 4. Update the UI with the business data
            nameEl.textContent = data.name || "Booking Calendar";
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
                    if (imgEl.src !== data.logo_url) imgEl.src = data.logo_url;
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

            const nextServices = data.services || [];
            const publicCategories = data.categories || [];
            // The RPC enforces published + active + enabled, scoped to this business.
            // Fail closed on an inconsistent response rather than expose the slot-only fallback.
            if (!Array.isArray(nextServices) || !Array.isArray(publicCategories) ||
                nextServices.some(service => !publicCategories.some(category => category.id === service.category_id))) {
                throw new Error('Invalid catalogue category response');
            }
            categories = publicCategories.filter(category =>
                nextServices.some(service => service.category_id === category.id));
            if (selectedService) {
                const fresh = nextServices.find(service => service.id === selectedService.id && service.service_type === 'private');
                if (!fresh || JSON.stringify(fresh) !== JSON.stringify(selectedService)) selectedSlot = null;
                selectedService = fresh || null;
            }
            services = nextServices;
            if (requestedServiceId) {
                selectedService = services.find(service => service.id === requestedServiceId && service.service_type === 'private') || null;
                if (selectedService) {
                    activeStep = 'schedule';
                    activeCategoryId = selectedService.category_id;
                    requestedServiceId = '';
                }
            }
            if (!categories.some(category => category.id === activeCategoryId)) {
                activeCategoryId = selectedService ? selectedService.category_id : categories.length ? categories[0].id : null;
            }
            renderCatalogue();
            const slots = data.slots || [];
            availabilityLoaded = true;
            if (selectedSlot && !slots.some(slot =>
                slot.date === selectedSlot.date && slot.time &&
                slot.time.substring(0, 5) === selectedSlot.time &&
                (slot.status === undefined || slot.status === 'open')
            )) {
                selectedSlot = null;
            }
            updateBookButton();
            // 5. Group ONLY the slots returned by the database
            slotsByDate = {};
            slots.forEach(slot => {
                if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
                slotsByDate[slot.date].push(slot);
            });

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
            }
        }
    }

    // Initial load
    await loadData();
    
    // LIVE UPDATES: Poll the server silently every 3 seconds to update the UI
    setInterval(loadData, 3000);
});
