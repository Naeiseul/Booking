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
        statusEl.textContent = "Please use a valid business link.";
        gridEl.innerHTML = '<div class="empty-state">No business specified in link.</div>';
        return;
    }

    let activeDateString = null; // Track which day the user is looking at

    let selectedSlot = null;
    let availabilityLoaded = false;
    let services = [];
    let selectedService = null;
    let requestedServiceId = urlParams.get('service') || '';
    let catalogueSignature = null;
    let activeCategory = 'all';
    const categoryMenu = document.querySelector('.catalogue-menu');
    const categoryButtons = Array.from(categoryMenu.querySelectorAll('button[data-category]'));
    const categoryLabels = { all: 'Our services', group: 'Group sessions', private: 'Private sessions', class: 'Classes' };

    function serviceCategory(service) {
        if (service.service_type === 'class') return 'class';
        return service.participant_count > 1 ? 'group' : 'private';
    }

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.category;
            renderCatalogue();
        });
    });
    const catalogueEl = document.getElementById('service-catalogue');
    const serviceList = document.getElementById('client-services');
    const calendarEl = document.getElementById('client-calendar');

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

    function createPhotoPlaceholder() {
        const photo = document.createElement('div');
        photo.className = 'service-photo-placeholder';
        photo.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = 'No photo yet';
        photo.appendChild(label);
        return photo;
    }

    function renderCatalogue() {
        const visibleServices = services.filter(service => activeCategory === 'all' || serviceCategory(service) === activeCategory);
        categoryMenu.hidden = false;
        categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
        document.getElementById('catalogue-heading').textContent = categoryLabels[activeCategory];
        const signature = JSON.stringify([services, selectedService && selectedService.id, activeCategory]);
        if (signature !== catalogueSignature) {
            serviceList.innerHTML = '';
            visibleServices.forEach(service => {
                const card = document.createElement('article');
                card.className = 'client-service-card';
                card.appendChild(createPhotoPlaceholder());
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
                const isSelected = Boolean(selectedService && selectedService.id === service.id);
                choose.textContent = choose.disabled ? 'Class times not available yet' : isSelected ? 'Selected' : 'View available times';
                choose.setAttribute('aria-pressed', String(isSelected));
                choose.setAttribute('aria-label', (choose.disabled ? 'Class times not available for ' : 'View available times for ') + service.name);
                choose.addEventListener('click', () => {
                    if (choose.disabled) return;
                    selectedService = service;
                    requestedServiceId = '';
                    selectedSlot = null;
                    renderCatalogue();
                    updateBookButton();
                    document.getElementById('calendar-heading').focus();
                });
                body.appendChild(choose);
                card.appendChild(body);
                serviceList.appendChild(card);
            });
            if (!visibleServices.length) {
                const empty = document.createElement('article');
                empty.className = 'client-service-card service-card-empty';
                empty.appendChild(createPhotoPlaceholder());
                const body = document.createElement('div');
                body.className = 'service-card-body';
                const title = document.createElement('h3');
                title.textContent = 'No services added yet';
                const message = document.createElement('p');
                message.className = 'muted-text';
                message.textContent = activeCategory === 'all'
                    ? 'Published services will appear here.'
                    : 'Services in this category will appear here.';
                body.appendChild(title);
                body.appendChild(message);
                empty.appendChild(body);
                serviceList.appendChild(empty);
            }
            catalogueSignature = signature;
        }
        catalogueEl.hidden = false;
        document.getElementById('catalogue-message').textContent = visibleServices.length
            ? (requestedServiceId ? 'This service is no longer listed. Please choose another.' : 'Choose a service to see what is included.')
            : activeCategory !== 'all' ? 'No services are listed in this category yet.'
            : services.length ? 'No services are listed in this category yet.'
            : 'Services will be listed here soon. You can view available times below.';
        calendarEl.hidden = services.length > 0 ? !selectedService : activeCategory !== 'all';
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
                services = [];
                catalogueEl.hidden = true;
                categoryMenu.hidden = true;
                calendarEl.hidden = false;
                availabilityLoaded = false;
                updateBookButton();
                nameEl.textContent = "Not Found";
                statusEl.textContent = "We couldn't find this calendar.";
                gridEl.innerHTML = '<div class="empty-state">This business does not exist or is inactive.</div>';
                return;
            }

            // 4. Update the UI with the business data
            nameEl.textContent = data.name || "Booking Calendar";
            statusEl.textContent = "Select an available time to continue."; 
            
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
            if (selectedService) {
                const fresh = nextServices.find(service => service.id === selectedService.id && service.service_type === 'private');
                if (!fresh || JSON.stringify(fresh) !== JSON.stringify(selectedService)) selectedSlot = null;
                selectedService = fresh || null;
            }
            services = nextServices;
            if (requestedServiceId) {
                selectedService = services.find(service => service.id === requestedServiceId && service.service_type === 'private') || null;
                if (selectedService) requestedServiceId = '';
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
            if (slots.length === 0) {
                gridEl.innerHTML = `
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Check back soon for new openings.
                    </div>`;
                tabsEl.innerHTML = '';
                return;
            }

            // 5. Group ONLY the slots returned by the database
            const slotsByDate = {};
            slots.forEach(slot => {
                if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
                slotsByDate[slot.date].push(slot);
            });

            const uniqueDates = Object.keys(slotsByDate).sort();

            // 6. Draw the Day Tabs
            tabsEl.innerHTML = '';
            uniqueDates.forEach((dateString, index) => {
                const dateObj = new Date(dateString);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }); 
                const dayNum = dateObj.getDate();
                
                const tab = document.createElement('div');
                
                // Keep the previously active tab selected, or default to the first one
                const isActive = (activeDateString === dateString) || (!activeDateString && index === 0);
                if (isActive && !activeDateString) activeDateString = dateString;
                
                tab.className = `day-tab ${isActive ? 'active' : ''}`;
                tab.textContent = `${dayName} ${dayNum}`;
                
                tab.addEventListener('click', () => {
                    if (activeDateString !== dateString) {
                        selectedSlot = null;
                        updateBookButton();
                    }
                    activeDateString = dateString;
                    document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderSlots(slotsByDate[dateString]);
                });
                
                tabsEl.appendChild(tab);
            });

            // 7. Draw the Time Grid for the selected day
            function renderSlots(daySlots) {
                if (!daySlots || daySlots.length === 0) {
                    gridEl.innerHTML = `
                        <div class="empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            Fully booked on this day.
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

            // Re-render the slots for the currently active day
            if (activeDateString && slotsByDate[activeDateString]) {
                renderSlots(slotsByDate[activeDateString]);
            } else if (uniqueDates.length > 0) {
                activeDateString = uniqueDates[0];
                renderSlots(slotsByDate[uniqueDates[0]]);
            }

        } catch (error) {
            availabilityLoaded = false;
            updateBookButton();
            console.error(error);
            // Only show error state if we don't already have slots loaded on the screen
            if (gridEl.innerHTML.includes('skeleton') || gridEl.innerHTML.trim() === '') {
                nameEl.textContent = "Error";
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
