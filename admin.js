document.addEventListener("DOMContentLoaded", async () => {
    // 1. Get both the slug and secret key from the URL query OR clean path
    const urlParams = new URLSearchParams(window.location.search);
    let bizSlug = urlParams.get('biz');
    let adminKey = urlParams.get('key');
    if (!bizSlug || !adminKey) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        // Clean URL expected format: /admin/slug-name/secret123
        if (pathParts.length >= 3 && pathParts[0] === 'admin') {
            bizSlug = pathParts[1];
            adminKey = pathParts[2];
        }
    }

    const nameEl = document.getElementById('biz-title-text');
    const statusEl = document.getElementById('business-status');
    const tabsEl = document.getElementById('day-tabs');
    const gridEl = document.getElementById('time-grid');
    const updateEl = document.getElementById('last-updated');

    // Security check: Must have both parameters
    if (!bizSlug || !adminKey) {
        nameEl.textContent = "Oops!";
        statusEl.textContent = "Dashboard link is incomplete.";
        gridEl.innerHTML = '<div class="empty-state">Please use the exact link provided to you.</div>';
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

        if (!response.ok) throw new Error("Connection failed");

        const data = await response.json();

        // 3. If Supabase rejects the key, it returns null
        if (!data) {
            nameEl.textContent = "Access Denied";
            statusEl.textContent = "Dashboard not found.";
            gridEl.innerHTML = '<div class="empty-state">We could not verify this dashboard. Please check your link.</div>';
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

        // Generate a wide range of hours (7 AM to 8 PM) to give owners total freedom
        const standardTimes = [
            '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
            '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
        ];

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
