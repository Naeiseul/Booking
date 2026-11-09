import assert from 'node:assert/strict';
import {handle,hmac} from '../supabase/functions/finance-api/core.mjs';
const business='11111111-1111-4111-8111-111111111111';
const account={business_id:business,owner_email:'owner@example.invalid',email_from:'owner@example.invalid',email_enabled:true,email_key_env:'RESEND_API_KEY_UNIT',invoice_link_secret:'private-unit-link-secret-with-32-characters'};
const env={get:key=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'private-unit-service',SUPABASE_ANON_KEY:'public-unit',RESEND_API_KEY_UNIT:'re_private-unit-only'}[key])};
let generated=0,queued=[],claims=0;
const fetcher=async(url,options)=>{
 let data;
 if(url.includes('/businesses?'))data=[{id:business,slug:'unit',name:'Unit business',active:true}];
 else if(url.includes('/finance_accounts?'))data=[account];
 else if(url.endsWith('/rpc/get_admin_photo_context'))data=JSON.parse(options.body).p_key==='private-key'?business:null;
 else if(url.endsWith('/rpc/finance_login_request'))data=account.owner_email;
 else if(url.includes('/auth/v1/admin/generate_link')){generated++;assert.equal(JSON.parse(options.body).email,account.owner_email);data={hashed_token:'private-one-time-unit-token'};}
 else if(url.endsWith('/rest/v1/finance_email_jobs')){const job=JSON.parse(options.body);queued.push(job);data=[{id:'queued-unit'}];}
 else if(url.includes('/finance_worker_config?'))data=[{signing_secret:'private-worker-unit'}];
 else if(url.endsWith('/rpc/finance_claim_email')){claims++;data=null;}
 else data=[];
 return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
};
const request=(body,headers={})=>new Request('https://db.invalid/functions/v1/finance-api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({slug:'unit',...body})});
let response=await handle(request({action:'request_login',email:'wrong@example.invalid',admin_key:'private-key'}),{env,fetcher});
assert.equal(response.status,403);assert.equal(generated,0);
response=await handle(request({action:'request_login',email:account.owner_email,admin_key:'private-key'}),{env,fetcher});
assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body,{queued:true});
assert.equal(queued[0].kind,'login');assert.deepEqual(queued[0].payload.to,[account.owner_email]);assert(queued[0].payload.text.includes('/finance-login.html#'));
assert(!JSON.stringify(body).includes('private-one-time-unit-token'),'Auth token must never be returned to the requesting browser');
response=await handle(request({action:'dispatch_emails'}),{env,fetcher});assert.equal(response.status,401);assert.equal(claims,0);
const payload=JSON.stringify({slug:'unit',action:'dispatch_emails'}),timestamp=String(Math.floor(Date.now()/1000));
const signature=await hmac('private-worker-unit',timestamp+'.'+payload);
response=await handle(new Request('https://db.invalid/functions/v1/finance-api',{method:'POST',headers:{'Content-Type':'application/json','X-Finance-Worker-Time':timestamp,'X-Finance-Worker-Signature':signature},body:payload}),{env,fetcher});
assert.equal(response.status,200);assert.equal(claims,1);
console.log('PASS approved-owner magic-link privacy, correct recipient, no token response and authenticated scheduled delivery.');
