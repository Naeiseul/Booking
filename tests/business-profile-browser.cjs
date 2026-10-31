// Candidate assets with isolated RPC fixtures by default. QA_CONTEXT_JSON must identify a disposable QA business.
// Real QA records and uploaded objects are cleaned by the caller, never by this runner.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),origin=process.env.BROWSER_BASE_URL||'https://booking.logtraq.co.za';
const qa=process.env.QA_CONTEXT_JSON?JSON.parse(process.env.QA_CONTEXT_JSON):null;
const skipImages=Boolean(qa&&process.env.QA_SKIP_UPLOADS==='1');
const slug=qa?qa.slug:'profile-fixture',key=qa?qa.admin_key:'isolated-test-key';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFKkAAAAASUVORK5CYII=','base64');
const defaultProfile=()=>({slug,name:'Original business',tagline:'',description:'',email:'',phone_number:'+27820000001',whatsapp_number:'+27820000001',instagram_url:'',facebook_url:'',tiktok_url:'',website_url:'',logo_url:'',hero_photo_path:'',gallery_photo_paths:[],delivery_methods:[],service_area:'',show_social_icons:true,profile_version:0});
async function checkSize(page) {
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow at '+await page.evaluate(()=>innerWidth));
 for(const input of await page.locator('#profile-panel input:visible, #profile-panel textarea:visible').all()) {
  assert(await input.evaluate(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.right<=innerWidth+1&&b.left>=0;}),'Field outside viewport');
 }
}
async function saved(page){await page.locator('#profile-save').click();await page.getByText('Business profile saved.',{exact:true}).waitFor();}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const width of qa?[390]:[320,390,820,1440]) {
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let profile=defaultProfile(),failSave=false,loseResponse=false,uploads=0,slotWrites=0,saveCalls=0;
   if(!qa) {
    await context.addInitScript(()=>{const RealDate=Date;window.Date=class extends RealDate {constructor(...a){super(...(a.length?a:['2026-10-31T10:00:00Z']));}static now(){return new RealDate('2026-10-31T10:00:00Z').valueOf();}};});
    await context.route('**/rest/v1/rpc/**',async route=>{
     const name=new URL(route.request().url()).pathname.split('/').at(-1),p=route.request().postDataJSON();let data;
     if(name==='get_admin_page')data={name:profile.name,slots:[]};
     else if(name==='get_admin_business_profile')data=profile;
     else if(['get_admin_services','get_admin_categories','get_admin_service_photos'].includes(name))data=[];
     else if(name==='get_public_page')data={...profile,instagram_url:profile.show_social_icons?profile.instagram_url:null,slots:[],services:[],categories:[]};
     else if(name==='set_slot'){slotWrites++;data=null;}
     else if(name==='save_admin_business_profile'){
      saveCalls++;
      if(failSave){await route.fulfill({status:503,json:{message:'Temporary save failure'}});return;}
      if(p.p_expected_version!==profile.profile_version&&JSON.stringify(p.p_profile)!==JSON.stringify(Object.fromEntries(Object.entries(profile).filter(([k])=>!['slug','profile_version'].includes(k))))){await route.fulfill({status:409,json:{message:'This profile changed in another tab. Reload the saved profile.'}});return;}
      profile={...p.p_profile,slug,profile_version:profile.profile_version+1};data=profile;
      if(loseResponse){loseResponse=false;await route.abort();return;}
     } else throw Error('Unexpected RPC '+name);
     await route.fulfill({json:data});
    });
    await context.route('**/functions/v1/service-photo-upload',async route=>{
     uploads++;const photo_path='11111111-1111-4111-8111-111111111111/'+String(uploads).padStart(8,'0')+'-1111-4111-8111-111111111111.png';
     await route.fulfill({json:{photo_path,url:'https://jtonmfevmcmnkmdjmubn.supabase.co/storage/v1/object/public/service-photos/'+photo_path}});
    });
    await context.route('**/storage/v1/object/public/**',route=>route.fulfill({contentType:'image/png',body:png}));
   }
   if(!process.env.CHECK_LIVE_ASSETS)await context.route(origin+'/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const asset=pathname.startsWith('/admin/')?'admin.html':pathname==='/'+slug?'index.html':pathname.slice(1);
    const file=path.join(root,asset);
    if(!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}
    const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
    await route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
   });
   await page.goto(origin+'/admin/'+slug+'/'+key+'#profile');
   await page.locator('#profile-fields:not([disabled])').waitFor();
   assert.equal(await page.locator('#profile-panel').isVisible(),true);
   assert.equal(await page.locator('#calendar-panel').isVisible(),false);
   assert.equal(await page.locator('.admin-navigation a').count(),2);
   assert.equal(await page.locator('#admin-view-business').textContent().then(x=>x.trim()),'View client page');
   assert.equal(await page.locator('#admin-view-business').getAttribute('target'),'_blank');
   assert((await page.locator('#profile-public-link').inputValue()).endsWith('/'+slug));
   await checkSize(page);
   await page.locator('#profile-name').fill('FitCore QA');
   await page.locator('#profile-tagline').fill('Stronger. Healthier. You.');
   await page.locator('#profile-description').fill('QA business description');
   await page.locator('#profile-email').fill('qa@example.com');
   await page.locator('#profile-phone_number').fill('+27 82 000 0002');
   await page.locator('#profile-whatsapp_number').fill('0820000003');
   await page.locator('#profile-instagram_url').fill('https://instagram.com/example');
   await page.locator('#profile-facebook_url').fill('https://facebook.com/example');
   await page.locator('#profile-tiktok_url').fill('tiktok.com/@example');
   await page.locator('#profile-website_url').fill('https://example.com');
   await page.locator('#profile-service_area').fill('Cape Town');
   await page.locator('#profile-delivery-online').check();
   await page.locator('#profile-delivery-in_person').check();
   if(!skipImages)for(const id of ['logo-file','hero-file','gallery-files']){
    await page.locator('#profile-'+id).setInputFiles({name:'qa.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>!document.getElementById('profile-fields').disabled);
   }
   assert.equal(await page.locator('#profile-logo-preview img').count(),skipImages?0:1);
   assert.equal(await page.locator('#profile-gallery img').count(),skipImages?0:1);
   if(!qa){
    failSave=true;await page.locator('#profile-save').click();
    await page.getByText(/Temporary save failure/).waitFor();
    assert.equal(await page.locator('#profile-name').inputValue(),'FitCore QA');assert.equal(uploads,3);
    failSave=false;
   }
   await saved(page);
   if(!qa)assert.equal(uploads,3,'Retry reuses uploaded photos');
   assert.equal(await page.locator('#profile-sidebar-name').textContent(),'FitCore QA');
   assert.equal(await page.locator('#admin-business-name').textContent(),'FitCore QA');
   await page.reload();await page.locator('#profile-fields:not([disabled])').waitFor();
   assert.equal(await page.locator('#profile-name').inputValue(),'FitCore QA');
   assert.equal(await page.locator('#profile-logo-preview img').count(),skipImages?0:1);
   assert.equal(await page.locator('#profile-gallery img').count(),skipImages?0:1);
   await checkSize(page);
   await page.screenshot({path:'/vercel/profile-'+width+'.png',fullPage:true});
   const publicPage=await context.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
   await publicPage.goto(origin+'/'+slug);
   await publicPage.getByText('QA business description',{exact:true}).waitFor();
   assert.equal(await publicPage.locator('#biz-title-text').textContent(),'FitCore QA');
   assert.equal(await publicPage.locator('#business-tagline').textContent(),'Stronger. Healthier. You.');
   assert.equal(await publicPage.getByRole('link',{name:'WhatsApp',exact:true}).getAttribute('href'),'https://wa.me/27820000003');
   assert.equal(await publicPage.locator('#business-phone-link').getAttribute('href'),'tel:+27820000002');
   assert.equal(await publicPage.locator('.public-branding-gallery img').count(),skipImages?0:1);
   assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#profile-show_social_icons').uncheck();await saved(page);
   await publicPage.reload();await publicPage.getByText('QA business description',{exact:true}).waitFor();
   assert.equal(await publicPage.locator('#ig-link').isVisible(),false);
   assert.equal(await publicPage.getByRole('link',{name:'WhatsApp',exact:true}).isVisible(),true);
   await page.locator('#profile-name').fill('Discard this');await page.locator('#profile-cancel').click();
   assert.equal(await page.locator('#profile-name').inputValue(),'FitCore QA');
   if(!qa){
    await page.locator('#profile-email').fill('bad-email');const before=saveCalls;await page.locator('#profile-save').click();assert.equal(saveCalls,before);
    await page.locator('#profile-email').fill('qa@example.com');
    await page.locator('#profile-website_url').fill('javascript:alert(1)');await page.locator('#profile-save').click();assert.equal(saveCalls,before);
    await page.locator('#profile-website_url').fill('https://example.com/');
    profile.profile_version++;await page.locator('#profile-tagline').fill('Stale edit');await page.locator('#profile-save').click();
    await page.getByText(/changed in another tab/).waitFor();assert.equal(await page.locator('#profile-tagline').inputValue(),'Stale edit');
    await page.locator('#profile-reload').click();await page.waitForFunction(()=>!document.getElementById('profile-fields').disabled);
    await page.locator('#nav-calendar').click();
    const past=page.locator('#time-grid .time-chip').filter({hasText:'09:00'});await past.click();
    await page.getByText('09:00 has passed. Clients can only book future times.',{exact:true}).waitFor();
    assert((await past.getAttribute('class')).includes('taken'));assert.equal(slotWrites,0,'Past time never saved');
    assert(await page.locator('#admin-calendar-toast').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
    await page.locator('#day-tabs .day-tab').nth(1).click();await page.locator('#time-grid .time-chip').first().click();assert.equal(slotWrites,1,'Future time still saves');
    await page.locator('#nav-services').click();await page.locator('#services-panel').waitFor({state:'visible'});
    await page.locator('#nav-profile').click();await page.locator('#profile-panel').waitFor({state:'visible'});assert.equal(await page.locator('#profile-name').inputValue(),'FitCore QA');
   }
   if(!skipImages){await page.locator('#profile-logo-remove').click();await page.locator('#profile-hero-remove').click();
   await page.getByRole('button',{name:'Remove gallery photo 1',exact:true}).click();await saved(page);}
   await publicPage.reload();await publicPage.getByText('QA business description',{exact:true}).waitFor();
   assert.equal(await publicPage.locator('#biz-avatar-img').isVisible(),false);
   assert.equal(await publicPage.locator('#biz-avatar-svg').isVisible(),true);
   assert.equal(await publicPage.locator('.public-branding-gallery img').count(),0);
   assert.deepEqual(errors,[]);
   console.log('PASS '+(qa?'REAL QA':'fixture')+' profile '+width+'px: identity, save/reload, '+(skipImages?'image uploads skipped':'images')+', public profile, independent contacts, visibility, cancel, navigation, overflow'+(qa?'':', save failure/retry, validation, stale edits, past-time no-write guard'));
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
