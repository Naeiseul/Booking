const {chromium}=require('/vercel/test-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8080';
const id='33333333-3333-4333-8333-333333333333';
const makeInvoice=()=>({id,number:'INV-000001',seller:{name:'Private browser fixture',email:'owner@example.invalid'},customer:{name:'Fixture customer',email:'customer@example.invalid',address:''},items:[{description:'Private check',quantity:2,unit_amount:25000}],total_amount:50000,currency:'ZAR',mode:'live',status:'issued',created_at:'2026-11-09T10:00:00Z',due_date:null,notes:''});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390,820,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   const page=await context.newPage();let invoices=[],issueCalls=[],failOnce=true,loginRequests=0,invoiceEmails=0;
   await page.route('https://jtonmfevmcmnkmdjmubn.supabase.co/**',async route=>{
    const request=route.request(),url=request.url();let result;
    if(url.includes('/auth/v1/token'))result={access_token:'private-test-token'};
    else if(url.includes('/rest/v1/rpc/')){
     const name=url.split('/').at(-1);
     if(name==='get_admin_page')result={name:'Private browser fixture',slots:[]};
     else if(name==='get_admin_business_profile')result={name:'Private browser fixture',profile_version:0,gallery_photo_paths:[]};
     else result=[];
    }else if(url.includes('/functions/v1/finance-api')){
     const body=request.postDataJSON();
     if(body.action==='setup')result={access_ready:true,email_ready:true,business_name:'Private browser fixture'};
     else if(body.action==='dashboard')result={payments:[],invoices,emails:[],page:1,has_more:false,mode:'live',account_mode:'live',links_ready:false,sync_ready:false,payments_ready:false,email_ready:true};
     else if(body.action==='request_login'){loginRequests++;assert.equal(body.admin_key,'private-key');result={queued:true};}
     else if(body.action==='queue_invoice'){invoiceEmails++;result={status:'pending'};}
     else if(body.action==='issue'){
      issueCalls.push(body);invoices=[{...makeInvoice(),customer:body.customer,items:body.items,total_amount:body.items.reduce((s,i)=>s+i.quantity*i.unit_amount,0)}];
      if(failOnce){failOnce=false;return route.fulfill({status:503,json:{error:'Private injected lost response'}});}
      result={invoice:invoices[0],url:null};
     }else if(body.action==='pdf')return route.fulfill({contentType:'application/pdf',body:'%PDF-1.7\n%isolated browser fixture'});
     else result={};
    }else return route.fulfill({status:404,body:'not used'});
    return route.fulfill({json:result});
   });
   await page.goto(origin+'/admin.html?biz=fixture&key=private-key#payments');
   await page.getByRole('heading',{name:'Payments',exact:true}).waitFor();
   await page.locator('#finance-login-submit').waitFor({state:'visible'});
   await page.locator('#finance-email').fill('owner@example.invalid');await page.locator('#finance-login-link').click();await page.locator('#finance-message').filter({hasText:'queued'}).waitFor();assert.equal(loginRequests,1);await page.locator('#finance-password').fill('private-browser-only');
   await page.locator('#finance-login-submit').click();
   await page.getByRole('button',{name:'Create invoice',exact:true}).click();
   await page.locator('#invoice-customer-name').fill('Actual entered value <script>');
   await page.locator('#invoice-customer-email').fill('customer@example.invalid');
   await page.locator('.invoice-description').fill('Owner entered offering');
   await page.locator('.invoice-quantity').fill('2');await page.locator('.invoice-price').fill('250.00');
   await page.locator('#invoice-save').click();await page.locator('#invoice-error').filter({hasText:'retained'}).waitFor();
   assert.equal(await page.locator('#invoice-customer-name').inputValue(),'Actual entered value <script>');
   await page.locator('#invoice-save').click();await page.locator('#invoice-dialog').waitFor({state:'hidden'});
   assert.equal(issueCalls.length,2);assert.equal(issueCalls[0].request_id,issueCalls[1].request_id);
   assert.deepEqual(issueCalls[1].items,[{description:'Owner entered offering',quantity:2,unit_amount:25000}]);
   await page.locator('#finance-detail').waitFor({state:'visible'});
   assert.equal(await page.locator('#finance-mode').count(),0,'No test/environment selector');
   assert(!(await page.locator('#payments-panel').innerText()).includes('Create test invoice'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Admin page overflow '+width);
   await page.getByRole('button',{name:'Email invoice',exact:true}).click();await page.locator('#finance-message').filter({hasText:'Invoice email queued'}).waitFor();assert.equal(invoiceEmails,1);
   const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await dl;
   await page.getByRole('button',{name:'Sign out of Payments',exact:true}).click();
   assert.equal(await page.locator('#finance-invoices-body tr').count(),0,'Sign out clears financial records');
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage();let current=makeInvoice();
  await page.route('https://jtonmfevmcmnkmdjmubn.supabase.co/functions/v1/finance-api',async route=>{
   const body=route.request().postDataJSON();
   if(body.action==='public_invoice')return route.fulfill({json:{invoice:current,payments_ready:false,mode:'live',pending_reference:null}});
   return route.fulfill({status:503,json:{error:'Connection pending'}});
  });
  await page.goto(origin+'/invoice.html#slug=fixture&id='+id+'&token=private-browser-token');
  await page.locator('#customer-invoice').waitFor({state:'visible'});
  assert.equal(await page.locator('#customer-invoice-pay').isDisabled(),true);
  assert(!(await page.locator('body').innerText()).includes('Test invoice'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Customer page overflow');
  current={...current,status:'paid',paid_at:'2026-11-09T10:01:00Z'};
  await page.reload();await page.locator('#customer-invoice-status').filter({hasText:'PAID'}).waitFor();
  assert.equal(await page.locator('#customer-invoice-pay').isVisible(),false);
  await context.close();
  console.log('PASS Chromium 320/390/820/1440: Payments navigation/sign-in, owner-entered invoice amounts, lost-response retry ID, PDF download, no test screen, safe text, sign-out cleanup and no overflow; customer invoice and paid/unconfigured states.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
