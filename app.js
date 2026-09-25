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

    try {
        // 2. Knock on the "public door" in Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_page`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ p_slug: bizSlug })
        });

        if (!response.ok) throw new Error("Failed to connect to database");

        const data = await response.json();

        // 3. If Supabase returns null, the business doesn't exist (Claude's Step 5)
        if (!data) {
            nameEl.textContent = "Not Found";
            statusEl.textContent = "We couldn't find this calendar.";
            gridEl.innerHTML = '<div class="empty-state">This business does not exist or is inactive.</div>';
            return;
        }

        // 4. Update the UI with the business data
        nameEl.textContent = data.name || "Booking Calendar";
        statusEl.textContent = ""; // Removed unnecessary subtitle!

        const slots = data.slots || [];
        
        if (slots.length === 0) {
            gridEl.innerHTML = '<div class="empty-state">No availability posted yet.</div>';
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
            tab.className = `day-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = `${dayName} ${dayNum}`;
            
            tab.addEventListener('click', () => {
                document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSlots(slotsByDate[dateString]);
            });
            
            tabsEl.appendChild(tab);
        });

        // 7. Draw the Time Grid for the selected day
        function renderSlots(daySlots) {
            gridEl.innerHTML = '';
            
            daySlots.forEach(slot => {
                const chip = document.createElement('div');
                const isTaken = slot.status === 'taken';
                
                chip.className = `time-chip ${isTaken ? 'taken' : 'open'}`;
                chip.textContent = slot.time ? slot.time.substring(0, 5) : "";
                
                gridEl.appendChild(chip);
            });
        }

        // Render the very first day automatically
        if (uniqueDates.length > 0) {
            renderSlots(slotsByDate[uniqueDates[0]]);
        }

        // WhatsApp Button Logic
        const waBtn = document.getElementById('whatsapp-btn');
        if (waBtn) {
            waBtn.addEventListener('click', () => {
                if (data.whatsapp_number) {
                    window.location.href = `https://wa.me/${data.whatsapp_number.replace(/[^0-9]/g, '')}`;
                } else {
                    // Create a sleek, cute toast bubble instead of an aggressive alert
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
                    
                    // Fade in
                    setTimeout(() => toast.style.opacity = '1', 10);
                    
                    // Fade out and remove after 3.5 seconds
                    setTimeout(() => {
                        toast.style.opacity = '0';
                        setTimeout(() => toast.remove(), 300);
                    }, 3500);
                }
            });
        }

    } catch (error) {
        console.error(error);
        nameEl.textContent = "Error";
        statusEl.textContent = "Could not load calendar.";
        gridEl.innerHTML = '<div class="empty-state">Something went wrong. Please check your connection.</div>';
    }
});
