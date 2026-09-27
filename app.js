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

    // If no business is specified in the link
    if (!bizSlug) {
        nameEl.textContent = "Welcome";
        statusEl.textContent = "Please use a valid business link.";
        gridEl.innerHTML = '<div class="empty-state">No business specified in link.</div>';
        return;
    }

    let activeDateString = null; // Track which day the user is looking at

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
                nameEl.textContent = "Not Found";
                statusEl.textContent = "We couldn't find this calendar.";
                gridEl.innerHTML = '<div class="empty-state">This business does not exist or is inactive.</div>';
                return;
            }

            // 4. Update the UI with the business data
            nameEl.textContent = data.name || "Booking Calendar";
            statusEl.textContent = ""; 
            
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
                if (icon && icon.href !== data.logo_url) icon.href = data.logo_url;
                
                let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
                if (appleIcon && appleIcon.href !== data.logo_url) appleIcon.href = data.logo_url;
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

            // WhatsApp Button Logic (only attach once)
            const waBtn = document.getElementById('whatsapp-btn');
            if (waBtn && !waBtn.hasAttribute('data-attached')) {
                waBtn.setAttribute('data-attached', 'true');
                waBtn.addEventListener('click', () => {
                    if (data.whatsapp_number) {
                        const cleanNumber = data.whatsapp_number.replace(/[^0-9]/g, '');
                        const message = `Hi! I just saw your available times on your booking calendar. I'd like to book an appointment.`;
                        window.location.href = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
                    } else {
                        const toast = document.createElement('div');
                        toast.innerHTML = "✨ Please reply on WhatsApp to secure your slot!";
                        toast.style.cssText = `
                            position: fixed; bottom: calc(48px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%);
                            background-color: #1E293B; color: #FFF; padding: 14px 24px; border-radius: 100px;
                            font-size: 14px; font-weight: 500; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                            z-index: 9999; opacity: 0; transition: opacity 0.3s ease; text-align: center;
                            width: max-content; max-width: 85%;
                        `;
                        document.body.appendChild(toast);
                        setTimeout(() => toast.style.opacity = '1', 10);
                        setTimeout(() => {
                            toast.style.opacity = '0';
                            setTimeout(() => toast.remove(), 300);
                        }, 3500);
                    }
                });
            }

            const slots = data.slots || [];
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
                    const chip = document.createElement('div');
                    const isTaken = slot.status === 'taken';
                    
                    chip.className = `time-chip ${isTaken ? 'taken' : 'open'}`;
                    chip.textContent = slot.time ? slot.time.substring(0, 5) : "";
                    
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
