document.addEventListener('DOMContentLoaded', async () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const bizSlug = parts.length === 2 && parts[1] === 'details' ? decodeURIComponent(parts[0]) : null;
    const query = new URLSearchParams(window.location.search);
    const date = query.get('date') || '';
    const time = query.get('time') || '';
    const serviceId = query.get('service') || '';
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

    let selectedService = null;
    let serviceConfig = null;
    let computedTotal = null;
    let computedPaymentDue = null;
    const form = document.getElementById('booking-form');
    const errorEl = document.getElementById('booking-error');
    const button = document.getElementById('continue-payment');
    const back = document.getElementById('back-to-calendar');
    if (bizSlug) back.href = '/' + encodeURIComponent(bizSlug) + (serviceId ? '?' + new URLSearchParams({ service: serviceId }) : '');

    async function bookingRpc(name,args) {
        const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
            method:'POST',cache:'no-store',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY},
            body:JSON.stringify(args)
        });
        const data=await response.json().catch(()=>null);
        if(!response.ok)throw new Error(data&&data.message||'Could not submit this booking.');
        return data;
    }
    function money(cents) {
        return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((Number(cents)||0)/100);
    }
    function serviceDurationLabel(minutes) {
        const h=Math.floor((Number(minutes)||0)/60),m=(Number(minutes)||0)%60;
        return [h?h+' hr':'',m?m+' min':''].filter(Boolean).join(' ')||'Duration not set';
    }
    function addBookingField(root,labelText,control) {
        const label=document.createElement('label');label.className='booking-field';
        const span=document.createElement('span');span.textContent=labelText;label.append(span,control);root.appendChild(label);return control;
    }
    function renderServiceOptions() {
        const root=document.getElementById('service-booking-fields');root.replaceChildren();root.hidden=!selectedService;
        if(!selectedService)return;
        serviceConfig=selectedService.booking_config||{};
        const cancellation=serviceConfig.requirements?.cancellation_policy||selectedService.booking_policy||'';
        if(cancellation){const note=document.createElement('p');note.className='muted-text';note.textContent='Booking and cancellation policy: '+cancellation;root.appendChild(note);}
        const cap=serviceConfig.capacity||{minimum:1,maximum:1};
        const participants=addBookingField(root,'Number of participants',Object.assign(document.createElement('input'),{
            type:'number',min:String(cap.minimum||1),max:String(cap.maximum||1),step:'1',value:String(cap.minimum||1),required:'required'
        }));
        participants.id='booking-participant-count';participants.name='participant_count';
        participants.addEventListener('input',updatePriceSummary);

        (serviceConfig.pricing?.mode==='custom_quote'?[]:(serviceConfig.addons||[])).forEach(addon=>{
            const label=document.createElement('label');label.className='booking-addon-option';
            const input=document.createElement('input');input.type='checkbox';input.value=addon.id;input.dataset.addonId=addon.id;
            input.addEventListener('change',updatePriceSummary);
            const text=document.createElement('span');text.textContent=addon.name+' ('+money(addon.price_amount)+(addon.price_basis==='per_person'?' per person':'')+')';
            label.append(input,text);root.appendChild(label);
        });

        const location=serviceConfig.location||{modes:['business'],places:[]};
        const modes=location.modes||[];
        if(modes.length>1){
            const select=document.createElement('select');select.id='booking-location-mode';
            modes.forEach(mode=>{const o=document.createElement('option');o.value=mode;o.textContent=({business:'Business premises',customer:'Customer location',online:'Online'})[mode]||mode;select.appendChild(o);});
            addBookingField(root,'Location',select);
        } else {
            const p=document.createElement('p');p.className='muted-text';p.textContent='Location: '+(({business:'Business premises',customer:'Customer location',online:'Online'})[modes[0]]||modes[0]||'To be confirmed');root.appendChild(p);
        }
        if(Array.isArray(location.places)&&location.places.length>0){
            const select=document.createElement('select');select.id='booking-location-place';
            location.places.forEach(place=>{const o=document.createElement('option');o.value=place;o.textContent=place;select.appendChild(o);});
            addBookingField(root,'Choose a location',select);
        }
        if(modes.includes('customer')){
            const address=document.createElement('input');address.id='booking-customer-location';address.maxLength=250;address.autocomplete='street-address';
            addBookingField(root,'Customer address (if needed)',address);
        }
        (serviceConfig.questions||[]).forEach(question=>{
            let control;
            if(question.type==='textarea'){control=document.createElement('textarea');control.rows=3;}
            else if(question.type==='select'){
                control=document.createElement('select');
                const blank=document.createElement('option');blank.value='';blank.textContent='Choose an option';control.appendChild(blank);
                (question.options||[]).forEach(value=>{const o=document.createElement('option');o.value=value;o.textContent=value;control.appendChild(o);});
            } else control=document.createElement('input');
            control.id='booking-question-'+question.id;control.dataset.questionId=question.id;control.maxLength=1000;
            if(question.required)control.required=true;
            addBookingField(root,question.label,control);
        });
        root.addEventListener('input',updatePriceSummary);
        root.addEventListener('change',updatePriceSummary);
        updatePriceSummary();
    }
    function calculateServiceAmounts() {
        const config=serviceConfig||{},pricing=config.pricing||{};
        const participantCount=Math.max(1,Number(document.getElementById('booking-participant-count')?.value)||1);
        let total=null;
        if(pricing.mode==='custom_quote')total=null;
        else if(pricing.mode==='per_person')total=(Number(pricing.amount)||0)*participantCount;
        else if(pricing.mode==='per_hour')total=Math.round((Number(pricing.amount)||0)*(Number(config.duration_minutes)||0)/60);
        else if(pricing.mode==='tiered'){
            const tier=(pricing.tiers||[]).find(t=>participantCount>=t.minimum&&participantCount<=t.maximum);
            total=tier?Number(tier.amount):null;
        } else total=Number(pricing.amount)||0;
        if(total!==null){
            const selected=new Set(Array.from(document.querySelectorAll('[data-addon-id]:checked')).map(x=>x.dataset.addonId));
            (config.addons||[]).filter(a=>selected.has(a.id)).forEach(a=>{
                total+=(Number(a.price_amount)||0)*(a.price_basis==='per_person'?participantCount:1);
            });
        }
        const payment=config.payment||{mode:'full'};
        let due=total;
        if(total!==null&&payment.mode==='fixed_deposit')due=Math.min(total,Number(payment.fixed_deposit_amount)||0);
        else if(total!==null&&payment.mode==='percentage_deposit')due=Math.min(total,Math.round(total*(Number(payment.percentage)||0)/100));
        computedTotal=total;computedPaymentDue=due;
    }
    function updatePriceSummary() {
        if(!selectedService)return;
        calculateServiceAmounts();
        const summary=document.getElementById('service-price-breakdown');summary.hidden=false;
        if(computedTotal===null){summary.textContent='Custom quotation required. The business will provide pricing after your request.';return;}
        const paymentMode=(serviceConfig.payment||{}).mode||'full';
        const dueLabel=paymentMode==='full'?'Amount due': 'Deposit due';
        summary.textContent='Total: '+money(computedTotal)+' · '+dueLabel+': '+money(computedPaymentDue)+' · '+serviceDurationLabel(serviceConfig.duration_minutes);
    }
    function applyCustomerRequirements() {
        const required=serviceConfig?.customer_fields||{};
        const mapping={first_name:'first-name',last_name:'last-name',phone:'phone',email:'email',notes:'notes'};
        Object.entries(mapping).forEach(([name,id])=>{
            const input=document.getElementById(id);if(input)input.required=Boolean(required[name]);
        });
        const location=serviceConfig?.location||{};
        if(!location.modes?.includes('customer')){
            const address=document.getElementById('booking-customer-location');if(address)address.closest('.booking-field').hidden=true;
        }
    }
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
        (serviceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) ||
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
        if (data) {
            const services = data.services || [];
            if (serviceId) {
                selectedService = services.find(service => service.id === serviceId && service.service_type === 'private') || null;
                if (!selectedService) return false;
                document.getElementById('details-service').hidden = false;
                document.getElementById('details-service-name').textContent = selectedService.name;
                const photo=document.getElementById('details-service-photo'), source=servicePhotoUrl(selectedService.photo_path);
                photo.hidden=!source; if(source) photo.src=source;
                serviceConfig=selectedService.booking_config||{};
                document.getElementById('details-service-info').textContent =
                    serviceDurationLabel(serviceConfig.duration_minutes||selectedService.duration_minutes) +
                    ' · '+(serviceConfig.capacity?.minimum||1)+'-'+(serviceConfig.capacity?.maximum||1)+' participants';
                const mode=serviceConfig.pricing?.mode||'fixed';
                document.getElementById('details-service-price').textContent=mode==='custom_quote'
                    ? 'Custom quotation'
                    : 'Starting at '+money(serviceConfig.pricing?.amount??selectedService.price_amount);
                if(serviceOptionsReadyFor!==selectedService.id){
                    renderServiceOptions();applyCustomerRequirements();serviceOptionsReadyFor=selectedService.id;
                    document.getElementById('service-payment-note').hidden=true;
                    button.textContent=(serviceConfig.requirements?.confirmation||'automatic')==='manual'?'Submit booking request':'Book service';
                }
            } else if (services.length) {
                return false;
            }
        }
        if(!data)return false;
        if(serviceId&&selectedService){
            const slots=await bookingRpc('get_service_availability',{p_slug:bizSlug,p_service_id:serviceId,p_from:date,p_to:date});
            return Array.isArray(slots)&&slots.some(slot=>slot.date===date&&String(slot.time||'').slice(0,5)===time&&slotIsFuture(slot));
        }
        return (data.slots||[]).some(slot=>slot.date===date&&slot.time&&slot.time.substring(0,5)===time&&slotIsFuture(slot)&&
            (slot.status===undefined||slot.status==='open'));
    }

    const draftKey = 'booking-draft:' + bizSlug + ':' + date + ':' + time + (serviceId ? ':' + serviceId : '');
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
            showError('This service or time is no longer available. Please return to the calendar and choose again.');
            return;
        }
        form.hidden = false;
        // Demo checkout: published services also proceed to the existing Paystack gate.
        button.disabled = false;
    } catch (_) {
        showError('We could not check this time. Please refresh the page to try again.');
        return;
    }

    // Restore the submit button when returning from checkout using browser Back.
    window.addEventListener('pageshow', () => {
        button.disabled = false;
        button.textContent = 'Continue to secure payment';
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
        if (phone.value && phone.value.replace(/\D/g, '').length < 7) {
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
            if(serviceId&&selectedService){
                button.textContent='Saving booking…';
                const customer={};
                fields.forEach(name=>{const value=form.elements.namedItem(name).value.trim();if(value)customer[name]=value;});
                const locationMode=document.getElementById('booking-location-mode')?.value||serviceConfig.location?.modes?.[0]||'';
                const place=document.getElementById('booking-location-place')?.value||'';
                const address=document.getElementById('booking-customer-location')?.value.trim()||'';
                if(locationMode)customer.location_mode=locationMode;
                if(place)customer.location=place;
                if(address)customer.location_address=address;
                const addons=Array.from(document.querySelectorAll('[data-addon-id]:checked')).map(input=>input.dataset.addonId);
                const answers={};
                document.querySelectorAll('[data-question-id]').forEach(input=>{if(input.value.trim())answers[input.dataset.questionId]=input.value.trim();});
                const idempotencyStorageKey='booking-idempotency:'+draftKey;
                let idempotencyKey='';
                try{idempotencyKey=sessionStorage.getItem(idempotencyStorageKey)||'';}catch(_){}
                if(!idempotencyKey){idempotencyKey=crypto.randomUUID();try{sessionStorage.setItem(idempotencyStorageKey,idempotencyKey);}catch(_){}}
                const result=await bookingRpc('create_service_booking',{
                    p_slug:bizSlug,p_service_id:serviceId,p_idempotency_key:idempotencyKey,p_date:date,p_time:time,
                    p_participant_count:Number(document.getElementById('booking-participant-count').value),
                    p_customer_data:customer,p_selected_addons:addons,p_answers:answers
                });
                const booking=await bookingRpc('get_service_booking',{p_reference:result.payment_reference});
                const draft={business:bizSlug,date,time,service_id:serviceId,booking_reference:result.payment_reference};
                fields.forEach(name=>{draft[name]=form.elements.namedItem(name).value;});
                draft.participant_count=Number(document.getElementById('booking-participant-count').value);
                draft.total_amount=booking?.total_amount??result.total_amount;
                draft.payment_amount=booking?.payment_amount??result.payment_amount;
                draft.addons=addons;
                draft.answers=answers;
                draft.customer=customer;
                try{sessionStorage.setItem(draftKey,JSON.stringify(draft));}catch(_){}
                const payment=new URL('https://paystack.shop/pay/o495iejvn3');
                ['first_name','last_name','email'].forEach(name=>payment.searchParams.set(name,draft[name]||''));
                payment.searchParams.set('amount','1');
                payment.searchParams.set('reference',result.payment_reference);
                payment.searchParams.set('service',selectedService.name);
                window.location.href=payment.href;
                return;
            }
            const draft = { business: bizSlug, date, time, service_id: serviceId || null };
            fields.forEach(name => { draft[name] = form.elements.namedItem(name).value; });
            try {
                // Keep the demo details in this tab only; no booking is confirmed here.
                sessionStorage.setItem(draftKey, JSON.stringify(draft));
            } catch (_) {
                // Storage is optional for the demo payment gate; do not block checkout.
            }
            // Existing live R1 Paystack demo gate; service catalogue prices are illustrative.
            const payment = new URL('https://paystack.shop/pay/o495iejvn3');
            ['first_name', 'last_name', 'email'].forEach(name => payment.searchParams.set(name, draft[name]));
            window.location.href = payment.href;
        } catch (_) {
            showError('We could not check availability. Please try again.');
        } finally {
            button.disabled = false;
            button.textContent = serviceId ? ((serviceConfig?.requirements?.confirmation||'automatic')==='manual'?'Submit booking request':'Book service') : 'Continue to secure payment';
        }
    });
});
