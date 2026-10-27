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

    function updateBookButton() {
        bookButton.disabled = !selectedSlot || !availabilityLoaded;
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
        if (!selectedSlot || !availabilityLoaded) return;
        const query = new URLSearchParams(selectedSlot);
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
                
                let icon = document.querySelector("link[rel~='icon']");
                const faviconUrl = bizSlug === 'logtraq' ? '/logtraq-favicon.svg?v=1' : data.logo_url;
                if (icon) {
                    icon.type = bizSlug === 'logtraq' ? 'image/svg+xml' : '';
                    if (icon.getAttribute('href') !== faviconUrl) icon.href = faviconUrl;
                }
                
                let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
                if (appleIcon && appleIcon.href !== data.logo_url) appleIcon.href = data.logo_url;
            }
            
            // Show TikTok only when this business has a valid TikTok profile URL.
            const tiktokEl = document.getElementById('tiktok-link');
            if (tiktokEl) {
                tiktokEl.style.display = 'none';
                tiktokEl.removeAttribute('href');
                try {
                    const tiktokUrl = new URL(data.tiktok_url);
                    if (tiktokUrl.protocol === 'https:' &&
                        (tiktokUrl.hostname === 'tiktok.com' || tiktokUrl.hostname.endsWith('.tiktok.com'))) {
                        tiktokEl.href = tiktokUrl.href;
                        tiktokEl.style.display = 'block';
                    }
                } catch (_) {
                    // Missing or invalid links stay hidden.
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
