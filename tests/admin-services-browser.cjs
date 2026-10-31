// Run: PLAYWRIGHT_MODULE=/path/to/playwright SERVICE_FIXTURE_JSON='…' node tests/admin-services-browser.cjs
// Fixture mode intercepts RPCs in memory. QA_CONTEXT_JSON enables an isolated real test business.
// Never pass a real business as QA_CONTEXT_JSON. The runner does not delete database fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),origin=process.env.BROWSER_BASE_URL||'https://booking.logtraq.co.za';
const qa=process.env.QA_CONTEXT_JSON?JSON.parse(process.env.QA_CONTEXT_JSON):null;
const fixture=process.env.SERVICE_FIXTURE_JSON?JSON.parse(process.env.SERVICE_FIXTURE_JSON):null;
const slug=qa?qa.slug:'fixture',key=qa?qa.admin_key:'test-key';
const widths=qa?[390]:[320,390,820,1440];
const check=async(page)=>{
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
 for(const dialog of await page.locator('dialog[open]').all()) assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog overflow');
};
const fill=async(page,name)=>{
 await page.locator('#service-name').fill(name);
 await page.locator('#service-hours').fill('1');await page.locator('#service-minutes').fill('30');
 await page.locator('#service-price').fill('123.45');
};
const saveService=async page=>{
 await page.locator('#save-service').click();
 await page.locator('#service-dialog').waitFor({state:'hidden'});
};
const saveCategory=async page=>{
 await page.locator('#save-category').click();
 await page.locator('#category-dialog').waitFor({state:'hidden'});
};
const row=(page,name)=>page.locator('.admin-service-row').filter({has:page.getByRole('heading',{name,exact:true})});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--no-sandbox']});
 try {
  for(const width of widths) {
   const context=await browser.newContext({viewport:{width,height:1000}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let records=fixture?[{...fixture,is_published:false,is_active:true,category_id:null}]:[],categories=[],version=0;
   if(!qa) await context.route('**/rest/v1/rpc/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1),p=route.request().postDataJSON();
    let data;
    if(name==='get_admin_page') data={name:'Isolated UI fixture',slots:[]};
    else if(name==='get_admin_business_profile') data={name:'Isolated UI fixture',slug,profile_version:0,gallery_photo_paths:[],delivery_methods:[],show_social_icons:true};
    else if(name==='get_admin_services') data=records;
    else if(name==='get_admin_categories') data=categories;
    else if(name==='get_admin_service_photos') data=fixture?[{path:fixture.photo_path}]:[];
    else if(name==='save_admin_category') {
     data={id:p.p_id,label:p.p_label,icon:p.p_icon,enabled:p.p_enabled,sort_order:p.p_sort_order,created_at:'created',updated_at:'v'+ ++version};
     categories=categories.filter(c=>c.id!==data.id).concat(data);
    } else if(name==='save_admin_service') {
     data={id:p.p_id,name:p.p_name,description:p.p_description,service_type:p.p_service_type,duration_minutes:p.p_duration_minutes,
     price_amount:p.p_price_amount,currency:'ZAR',price_basis:p.p_price_basis,participant_count:p.p_participant_count,
     is_active:p.p_is_active,is_published:p.p_is_published,category_id:p.p_category_id,photo_path:p.p_photo_path,updated_at:'v'+ ++version};
     records=records.filter(s=>s.id!==data.id).concat(data);
    } else if(name==='get_public_page') {
     const visible=records.filter(s=>s.is_published&&s.is_active&&categories.some(c=>c.id===s.category_id&&c.enabled));
     data={name:'Isolated UI fixture',slots:[],services:visible,categories:categories.filter(c=>c.enabled&&visible.some(s=>s.category_id===c.id))};
    } else throw Error('Unexpected test RPC '+name);
    await route.fulfill({json:data});
   });
   if(!process.env.CHECK_LIVE_ASSETS) await context.route(origin+'/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const asset=pathname.startsWith('/admin/')?'admin.html':pathname==='/'+slug?'index.html':pathname.slice(1);
    const file=path.join(root,asset);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();
    await route.fulfill({body:fs.readFileSync(file),contentType:asset.endsWith('.html')?'text/html':asset.endsWith('.js')?'application/javascript':
      asset.endsWith('.css')?'text/css':asset.endsWith('.svg')?'image/svg+xml':'image/png'});
   });
   await page.goto(origin+'/admin/'+slug+'/'+key+'#services');
   await page.locator('#add-service:enabled').waitFor();
   assert.equal(await page.locator('.admin-navigation a').count(),2);
   assert.equal(await page.locator('#nav-categories').count(),0);
   await page.locator('#add-service').click();
   await fill(page,'QA Workflow Service');
   await page.locator('#service-status').selectOption('published');
   await page.locator('#save-service').click();
   await page.locator('#service-category-error').waitFor();
   await page.locator('#service-category').selectOption('__create__');
   await page.locator('#category-label').fill('QA Training');
   await page.locator('#category-options summary').click();await page.getByRole('button',{name:'Use people icon',exact:true}).click();
   
   await check(page);await saveCategory(page);
   assert.equal(await page.locator('#service-name').inputValue(),'QA Workflow Service');
   await page.locator('#service-content summary').click();
   await page.locator('#service-description').fill('Isolated QA description');
   await page.locator('#service-advanced summary').click();
   await page.locator('#service-price-basis').selectOption('per_person');
   await page.locator('#service-participants').fill('2');
   await check(page);await saveService(page);
   await row(page,'QA Workflow Service').getByText('Published',{exact:true}).waitFor();
   const originalId=await row(page,'QA Workflow Service').getAttribute('data-service-id');
   const group=page.locator('.admin-service-group').filter({has:page.getByRole('button',{name:'Edit group QA Training',exact:true})});
   await group.locator('.service-group-toggle').click();assert.equal(await row(page,'QA Workflow Service').isVisible(),false);
   await group.locator('.service-group-toggle').click();
   await row(page,'QA Workflow Service').getByRole('button',{name:'Edit QA Workflow Service',exact:true}).click();
   await page.locator('#service-status').selectOption('paused');await saveService(page);
   await row(page,'QA Workflow Service').getByText('Paused',{exact:true}).waitFor();
   await page.reload();
   await row(page,'QA Workflow Service').getByRole('button',{name:'Edit QA Workflow Service',exact:true}).click();
   assert.equal(await page.locator('#service-status').inputValue(),'paused');
   assert.equal(await page.locator('#service-price-basis').inputValue(),'per_person');
   assert.equal(await page.locator('#service-participants').inputValue(),'2');
   assert.equal(await page.locator('#service-description').inputValue(),'Isolated QA description');
   await page.locator('#service-status').selectOption('published');await saveService(page);
   await page.getByRole('button',{name:'Edit group QA Training',exact:true}).click();
   await page.locator('#category-options summary').click();await page.locator('#category-enabled').uncheck();await saveCategory(page);
   await row(page,'QA Workflow Service').getByText('Group disabled',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Edit group QA Training',exact:true}).click();
   await page.locator('#category-options summary').click();await page.locator('#category-enabled').check();await saveCategory(page);
   await row(page,'QA Workflow Service').getByText('Published',{exact:true}).waitFor();
   await page.locator('#add-category').click();await page.locator('#category-label').fill('QA Earlier');
   await saveCategory(page);
   await row(page,'QA Workflow Service').getByRole('button',{name:'Edit QA Workflow Service',exact:true}).click();
   const earlier=await page.locator('#service-group option').filter({hasText:'QA Earlier'}).getAttribute('value');
   await page.locator('#service-category').selectOption(earlier);await saveService(page);
   assert.equal(await row(page,'QA Workflow Service').getAttribute('data-service-id'),originalId);
   await page.getByRole('button',{name:'Add service to QA Training',exact:true}).click();
   await fill(page,'QA Shared Class');await page.locator('#service-type').selectOption('class');
   await page.locator('#service-status').selectOption('published');await saveService(page);
   await row(page,'QA Shared Class').getByText('Not bookable yet',{exact:true}).waitFor();
   if(fixture) {
    await row(page,fixture.name).getByRole('button',{name:'Edit '+fixture.name,exact:true}).click();
    await page.locator('#service-content summary').click();
    const photo=page.locator('#service-photo-preview');await photo.waitFor();
    await photo.evaluate(img=>img.decode());assert(await photo.evaluate(img=>img.naturalWidth>0));
    await page.locator('#service-category').selectOption(earlier);
    await page.locator('#service-status').selectOption('published');await saveService(page);
    assert.equal(records.find(s=>s.id===fixture.id).photo_path,fixture.photo_path);
    assert.equal(records.find(s=>s.id===fixture.id).price_amount,fixture.price_amount);
   }
   await page.locator('#add-service').click();await fill(page,'Cancelled nested group');
   await page.locator('#create-service-category').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#service-dialog').isVisible(),true);
   assert.equal(await page.locator('#service-name').inputValue(),'Cancelled nested group');
   await check(page);
   await page.screenshot({path:'/tmp/admin-services-drawer-'+width+(qa?'-real':'')+'.png',fullPage:true});
   await page.locator('#cancel-service').click();
   await page.screenshot({path:'/tmp/admin-services-grouped-'+width+(qa?'-real':'')+'.png',fullPage:true});
   await page.goto(origin+'/admin/'+slug+'/'+key+'#categories');
   await page.locator('#services-panel').waitFor();
   assert.equal(await page.locator('#calendar-panel').isVisible(),false);
   const client=await context.newPage();
   await client.goto(origin+'/'+slug);
   await client.getByRole('button',{name:'QA Training',exact:true}).click();
   await client.getByRole('heading',{name:'QA Shared Class',exact:true}).waitFor();
   const classCard=client.locator('.client-service-card').filter({has:client.getByRole('heading',{name:'QA Shared Class',exact:true})});
   assert.equal(await classCard.getByRole('button').isDisabled(),true,'Shared class scheduling remains disabled');
   await check(client);
   assert.deepEqual(errors,[]);
   console.log('PASS '+(qa?'real browser → Supabase → public catalogue':'intercepted RPC browser')+' '+width+'px: group creation/assignment, publication, status round-trip, icons/order/enable, move preserving ID, classes disabled, modal cancel/focus, photographs, no overflow');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});