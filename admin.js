document.addEventListener("DOMContentLoaded", async () => {
    // 1. Get both the slug and secret key from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const bizSlug = urlParams.get('biz');
    const adminKey = urlParams.get('key');

    const nameEl = document.getElementById('biz-title-text');
    const statusEl = document.getElementById('business-status');
    const tabsEl = document.getElementById('day-tabs');
    const gridEl = document.getElementById('time-grid');
    const updateEl = document.getElementById('last-updated');

    // Security check: Must have both parameters
    if (!bizSlug || !adminKey) {
        nameEl.textContent = "Access Denied";
        statusEl.textContent = "Missing secure admin link.";
        gridEl.innerHTML = '<div class="empty-state">Please use the exact secure link provided to you.</div>';
        return;
    }

    try {
        // 2. Knock on the "admin door"
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_page`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ p_slug: bizSlug, p_key: adminKey })
        });

        if (!response.ok) throw new Error("Database connection failed");

        const data = await response.json();

        // 3. If Supabase rejects the key, it returns null
        if (!data) {
            nameEl.textContent = "Access Denied";
            statusEl.textContent = "Invalid key or business.";
            gridEl.innerHTML = '<div class="empty-state">We could not verify your admin key.</div>';
            return;
        }

        // 4. Update UI for the owner
        nameEl.textContent = `${data.name} (Admin)`;
        statusEl.textContent = "Tap a slot to toggle its availability";
        
        if (data.last_updated_at) {
            const updatedTime = new Date(data.last_updated_at).toLocaleString();
            updateEl.textContent = `Last updated: ${updatedTime}`;
        }

        const dbSlots = data.slots || [];
        
        // Map database slots for easy lookup
        const slotMap = {};
        dbSlots.forEach(s => {
            if (!slotMap[s.date]) slotMap[s.date] = {};
            const timeHM = s.time ? s.time.substring(0, 5) : ""; // Fixes "09:00:00" vs "09:00"
            slotMap[s.date][timeHM] = s;
        });

        // Generate the next 7 days dynamically
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(d);
        }

        // Generate business hours based on URL parameters (or default to 8 AM - 5 PM)
        let startHour = parseInt(urlParams.get('start')) || 8;
        let endHour = parseInt(urlParams.get('end')) || 17;
        
        const standardTimes = [];
        for (let i = startHour; i <= endHour; i++) {
            standardTimes.push(i.toString().padStart(2, '0') + ':00');
        }

        // 5. Draw Day Tabs
        tabsEl.innerHTML = '';
        dates.forEach((dateObj, index) => {
            // Need local YYYY-MM-DD format
            const offset = dateObj.getTimezoneOffset() * 60000;
            const isoDate = (new Date(dateObj - offset)).toISOString().split('T')[0];
            
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = dateObj.getDate();
            
            const tab = document.createElement('div');
            tab.className = `day-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = `${dayName} ${dayNum}`;
            
            tab.addEventListener('click', () => {
                document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSlots(isoDate);
            });
            
            tabsEl.appendChild(tab);
        });

        // 6. Draw the Time Grid for the selected day
        function renderSlots(dateString) {
            gridEl.innerHTML = '';
            
            standardTimes.forEach(time => {
                const chip = document.createElement('div');
                
                // Check if this specific time is in the database
                const dbSlot = (slotMap[dateString] && slotMap[dateString][time]) ? slotMap[dateString][time] : null;
                
                // Default to "taken" (grey) if it's not marked open in the DB
                let status = dbSlot ? dbSlot.status : 'taken'; 
                let isTaken = status === 'taken';
                
                chip.className = `time-chip ${isTaken ? 'taken' : 'open'}`;
                
                // Owner superpower: If someone booked it, show their name on the chip!
                if (dbSlot && dbSlot.client_name) {
                    chip.innerHTML = `<strong>${time}</strong><br><small style="font-size: 11px;">${dbSlot.client_name}</small>`;
                    chip.style.lineHeight = '1.2';
                } else {
                    chip.textContent = time;
                }
                
                // 7. Clicking a slot to toggle it
                chip.addEventListener('click', async () => {
                    const newStatus = isTaken ? 'open' : 'taken';
                    
                    // Instantly change color for a smooth experience
                    chip.className = `time-chip ${newStatus === 'taken' ? 'taken' : 'open'}`;
                    isTaken = !isTaken;
                    
                    // Save to Supabase using Claude's set_slot door
                    try {
                        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_slot`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                            },
                            body: JSON.stringify({
                                p_slug: bizSlug,
                                p_key: adminKey,
                                p_date: dateString,
                                p_time: time,
                                p_status: newStatus
                            })
                        });
                        
                        if (!res.ok) throw new Error("Failed to save slot");
                    } catch (err) {
                        console.error(err);
                        alert("Failed to save slot. Please check your connection.");
                    }
                });
                
                gridEl.appendChild(chip);
            });
        }

        // Render the very first day automatically
        const offsetFirst = dates[0].getTimezoneOffset() * 60000;
        renderSlots((new Date(dates[0] - offsetFirst)).toISOString().split('T')[0]);

    } catch (error) {
        console.error(error);
        nameEl.textContent = "Error";
        statusEl.textContent = "Could not load dashboard.";
        gridEl.innerHTML = '<div class="empty-state">Connection failed. Please check your internet.</div>';
    }
});
