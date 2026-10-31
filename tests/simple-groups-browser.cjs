const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try{for(const width of [320,390,820,1440]){
 const c=await b.newContext({viewport:{width,height:1000}}),p=await c.newPage();let cats=[],services=[],v=0;
 await c.route('**/rest/v1/rpc/**',r=>{const n=new URL(r.request().url()).pathname.split('/').at(-1),a=r.request().postDataJSON();let data;
 if(n==='get_admin_page')data={name:'Isolated group check',slots:[]};
 else if(n==='get_admin_business_profile')data={name:'Isolated group check',profile_version:0,gallery_photo_paths:[],delivery_methods:[]};
 else if(n==='get_admin_services')data=services;else if(n==='get_admin_categories')data=cats;else if(n==='get_admin_service_photos')data=[];
 else if(n==='get_public_page')data={name:'Isolated group check',services:[],categories:[],slots:[]};
 else if(n==='save_admin_category'){data={id:a.p_id,label:a.p_label,icon:a.p_icon,enabled:a.p_enabled,sort_order:a.p_sort_order,created_at:'2026-10-31',updated_at:'v'+ ++v};cats=cats.filter(x=>x.id!==data.id).concat(data);}
 else if(n==='save_admin_service'){data={id:a.p_id,name:a.p_name,description:a.p_description,service_type:a.p_service_type,duration_minutes:a.p_duration_minutes,price_amount:a.p_price_amount,currency:'ZAR',price_basis:a.p_price_basis,participant_count:a.p_participant_count,is_published:a.p_is_published,is_active:a.p_is_active,category_id:a.p_category_id,updated_at:'v'+ ++v};services.push(data);}
 else if(n==='reorder_admin_categories'){cats=a.p_ids.map((id,i)=>({...cats.find(x=>x.id===id),sort_order:i,updated_at:'v'+ ++v}));data=cats;}
 else throw Error(n);return r.fulfill({json:data});});
 if(!process.env.CHECK_LIVE_ASSETS)await c.route('https://booking.logtraq.co.za/**',r=>{const u=new URL(r.request().url()),f=path.join('/vercel/booking',u.pathname.startsWith('/admin/')?'admin.html':u.pathname.slice(1));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});});
 await p.goto('https://booking.logtraq.co.za/admin/group-fixture/test-key#services');
 await p.locator('#add-service').click();await p.locator('#service-name').fill('QA service');await p.locator('#service-hours').fill('1');await p.locator('#service-minutes').fill('0');await p.locator('#service-price').fill('100');
 await p.locator('#create-service-category').click();
 assert.equal(await p.locator('#category-options').getAttribute('open'),null);assert.equal(await p.locator('#category-order').isVisible(),false);assert.equal(await p.locator('#category-enabled').isVisible(),false);
 await p.locator('#category-label').fill('First group');await p.locator('#save-category').click();await p.locator('#category-dialog').waitFor({state:'hidden'});assert(cats[0].enabled);await p.locator('#save-service').click();await p.locator('#service-dialog').waitFor({state:'hidden'});
 await p.locator('#add-category').click();await p.locator('#category-label').fill('Second group');await p.locator('#save-category').click();await p.locator('#category-dialog').waitFor({state:'hidden'});
 const moved=p.waitForResponse(r=>r.url().includes('/reorder_admin_categories'));await p.getByRole('button',{name:'Move up Second group',exact:true}).click();await moved;await p.getByText('Group moved.',{exact:true}).waitFor();assert.equal(cats[0].label,'Second group');
 await p.getByRole('button',{name:'Edit group Second group',exact:true}).click();await p.locator('#category-options summary').click();assert.equal(await p.getByLabel('Show to clients',{exact:true}).isVisible(),true);await p.getByRole('button',{name:'Use people icon',exact:true}).click();assert.equal(await p.locator('#category-icon').inputValue(),'people');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.locator('#category-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 console.log('PASS simple groups '+width+'px: name/save only, inline assignment, optional symbol/visibility, move up, no overflow');await c.close();
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});