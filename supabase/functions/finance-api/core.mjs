import {emailReady,dispatchEmails,renderLoginEmail} from './email.mjs';
export class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reference=/^[A-Za-z0-9._=-]{1,150}$/;
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function hmac(key,value,algorithm='SHA-256'){
 const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:algorithm},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',k,typeof value==='string'?encoder.encode(value):value));
}
export async function webhookValid(raw,headers,secret,legacyKey,now=Math.floor(Date.now()/1000)){
 const modern=headers.get('paystack-signature');
 if(modern){
  if(!secret)return false;
  let timestamp=null;const signatures=[];
  for(const part of modern.split(',')){const i=part.indexOf('=');if(i<0)continue;const key=part.slice(0,i).trim(),value=part.slice(i+1).trim();
   if(key==='t'){if(timestamp!==null||!/^\d+$/.test(value))return false;timestamp=Number(value);}
   if(key==='v1'){const n=value.indexOf(':');if(n>0&&/^whk_/.test(value))signatures.push(value.slice(n+1));}
  }
  if(timestamp===null||Math.abs(now-timestamp)>300)return false;
  const prefix=encoder.encode(timestamp+'.'),bytes=new Uint8Array(prefix.length+raw.length);bytes.set(prefix);bytes.set(raw,prefix.length);
  const expected=await hmac(secret,bytes,'SHA-512');
  return signatures.some(s=>/^[0-9a-f]{128}$/.test(s)&&equal(s,expected));
 }
 const signature=headers.get('x-paystack-signature')||'';
 return !!legacyKey&&/^[0-9a-f]{128}$/.test(signature)&&equal(signature,await hmac(legacyKey,raw,'SHA-512'));
}
export function normalizePayment(data,account,ref){
 const integration=typeof data.integration==='object'?data.integration?.id:data.integration;
 if((integration!=null&&String(integration)!==String(account.integration_id))||data.domain!==account.mode||data.reference!==ref||data.currency!=='ZAR'||
 !Number.isSafeInteger(data.amount)||data.amount<1||data.amount>2147483647||!['success','reversed'].includes(data.status)||
 !data.id||!data.paid_at||!Number.isFinite(Date.parse(data.paid_at))||typeof data.customer?.email!=='string')throw new ApiError(409,'The payment does not match this business or invoice.');
 return {integration_id:account.integration_id,provider_id:String(data.id),reference:ref,mode:data.domain,amount:data.amount,currency:data.currency,
 customer_email:data.customer.email.trim().toLowerCase(),customer_name:[data.customer.first_name,data.customer.last_name].filter(Boolean).join(' '),
 status:data.status,channel:data.channel||'',paid_at:data.paid_at};
}
function visibleInvoice(i){return {id:i.id,number:i.number,seller:i.seller,customer:i.customer,items:i.items,total_amount:i.total_amount,currency:i.currency,status:i.status,mode:i.mode,due_date:i.due_date,notes:i.notes,created_at:i.created_at,paid_at:i.paid_at};}
export async function handle(request,deps={}){
 const env=deps.env||Deno.env,fetcher=deps.fetcher||fetch;
 const site=env.get('FINANCE_SITE_URL')||'https://booking.logtraq.co.za';
 const origin=request.headers.get('origin');
 const cors={'Cache-Control':'no-store','Content-Type':'application/json','Referrer-Policy':'no-referrer',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 if(origin===site)cors['Access-Control-Allow-Origin']=origin;
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
 try{
  if(origin&&origin!==site)throw new ApiError(403,'This origin is not allowed.');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')throw new ApiError(405,'Use POST.');
  const base=env.get('SUPABASE_URL'),service=env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=env.get('SUPABASE_ANON_KEY');
  if(!base||!service)throw new ApiError(503,'Payments setup is incomplete.');
  const dbHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  async function db(path,body,method){
   const response=await fetcher(base+'/rest/v1/'+path,{method:method||(body?'POST':'GET'),headers:{...dbHeaders,Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok){const message=['22023','40001','42501'].includes(result.code)?result.message:'Could not save or load the financial record.';throw new ApiError(result.code==='42501'?403:409,message);}
   return path.startsWith('rpc/')&&Array.isArray(result)&&result.length===1?result[0]:result;
  }
  const raw=new Uint8Array(await request.arrayBuffer());
  if(raw.length>32768)throw new ApiError(413,'This request is too large.');
  let body;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{throw new ApiError(400,'Invalid request.');}
  const hook=new URL(request.url).pathname.match(/\/webhook\/([a-z0-9-]+)$/);
  const slug=hook?.[1]||body.slug;
  if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))throw new ApiError(400,'Choose a valid business.');
  const businesses=await db('businesses?select=id,slug,name,active&slug=eq.'+encodeURIComponent(slug)+'&active=eq.true&limit=1');
  const business=businesses[0];if(!business)throw new ApiError(404,'Business not found.');
  const accounts=await db('finance_accounts?business_id=eq.'+business.id+'&limit=1');const account=accounts[0];
  function providerKey(){
   if(!account?.paystack_key_env||!account.integration_id)throw new ApiError(503,'Paystack is not connected yet.');
   const key=env.get(account.paystack_key_env);
   if(!key||!key.startsWith('sk_'+account.mode+'_'))throw new ApiError(503,'Paystack credentials need configuration.');
   return key;
  }
  const canPay=()=>!!(account?.paystack_key_env&&account.integration_id&&env.get(account.paystack_key_env)?.startsWith('sk_'+account.mode+'_')&&(account.invoice_link_secret||env.get('FINANCE_LINK_SECRET'))&&(account.mode==='test'||account.live_enabled));
  async function paystack(path,data){
   const response=await fetcher('https://api.paystack.co/'+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+providerKey(),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok||result.status!==true)throw new ApiError(502,'Paystack could not confirm this request. Your records are retained; try checking again.');
   return result;
  }
  async function invoice(id){if(!uuid.test(id||''))throw new ApiError(400,'Invalid invoice.');const rows=await db('finance_invoices?business_id=eq.'+business.id+'&id=eq.'+id+'&limit=1');if(!rows[0])throw new ApiError(404,'Invoice not found.');return rows[0];}
  async function tokenFor(i){const secret=account?.invoice_link_secret||env.get('FINANCE_LINK_SECRET');if(!secret||secret.length<32)throw new ApiError(503,'Private invoice links are not configured yet.');return hmac(secret,i.id+':'+i.business_id+':'+i.link_version);}
  async function link(i){const token=await tokenFor(i);return site+'/invoice.html#'+new URLSearchParams({slug,id:i.id,token});}
  async function checkToken(i){if(!equal(body.token,await tokenFor(i)))throw new ApiError(404,'This invoice link is not valid.');}
  function dispatch(){return dispatchEmails({db,env,fetcher,account,business,makeLink:link,pdf:deps.pdf});}
  function queueDispatch(){if(deps.defer&&emailReady(account,env))deps.defer(dispatch().catch(()=>{}));}
  async function verify(ref,sendReceipt=true){
   if(!reference.test(ref||''))throw new ApiError(400,'Check the transaction reference.');
   const result=await paystack('transaction/verify/'+encodeURIComponent(ref));const data=result.data;
   if(!['success','reversed'].includes(data?.status)){
    const next=['failed','abandoned'].includes(data?.status)?'failed':'pending';
    await db('finance_attempts?business_id=eq.'+business.id+'&reference=eq.'+encodeURIComponent(ref)+'&status=in.(initializing,pending)',{status:next,updated_at:new Date().toISOString()},'PATCH');
    return {status:data?.status||'pending'};
   }
   const normalized=normalizePayment(data,account,ref);normalized.send_receipt=sendReceipt;
   const payment=await db('rpc/finance_record_payment',{p_business:business.id,p_payment:normalized});
   if(sendReceipt&&payment.status==='success')queueDispatch();
   return {status:payment.status,payment};
  }
  if(hook){
   const key=providerKey(),secret=account.webhook_secret_env?env.get(account.webhook_secret_env):null;
   if(!await webhookValid(raw,request.headers,secret,key))throw new ApiError(401,'Invalid webhook signature.');
   if(body.event==='charge.success'){await verify(body.data?.reference);}
   // Unknown events are acknowledged without mutating money records.
   return reply(200,{received:true});
  }
  if(body.action==='setup'){
   const members=await db('finance_members?select=user_id&business_id=eq.'+business.id+'&limit=1');
   return reply(200,{business_name:business.name,access_ready:members.length>0||!!account?.owner_email,payments_ready:canPay(),email_ready:emailReady(account,env)});
  }
  if(body.action==='dispatch_emails'){
   const timestamp=request.headers.get('x-finance-worker-time')||'',signature=request.headers.get('x-finance-worker-signature')||'';
   if(!/^\d+$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)throw new ApiError(401,'Invalid delivery request.');
   const config=(await db('finance_worker_config?id=eq.true&limit=1'))[0];
   const prefix=encoder.encode(timestamp+'.'),signed=new Uint8Array(prefix.length+raw.length);signed.set(prefix);signed.set(raw,prefix.length);
   if(!config||!equal(signature,await hmac(config.signing_secret,signed)))throw new ApiError(401,'Invalid delivery signature.');
   return reply(200,await dispatch());
  }
  if(body.action==='request_login'){
   if(!account?.owner_email||!emailReady(account,env))throw new ApiError(503,'Sign-in email is awaiting email service setup.');
   if(String(body.email||'').trim().toLowerCase()!==account.owner_email.toLowerCase())throw new ApiError(403,'Use the approved finance email address.');
   // Existing dashboard ownership plus a rate limit prevent arbitrary sign-in-email triggers.
   const owner=await db('rpc/get_admin_photo_context',{p_slug:slug,p_key:body.admin_key||''});
   if(owner!==business.id)throw new ApiError(403,'Reopen your admin link.');
   const allowed=await db('rpc/finance_login_request',{p_business:business.id});
   if(typeof allowed!=='string'||allowed.toLowerCase()!==account.owner_email.toLowerCase())throw new ApiError(429,'Please wait one minute before requesting another sign-in email.');
   const generated=await fetcher(base+'/auth/v1/admin/generate_link',{method:'POST',headers:dbHeaders,body:JSON.stringify({type:'magiclink',email:account.owner_email}),signal:AbortSignal.timeout(15000)});
   const generatedData=await generated.json();
   if(!generated.ok||!generatedData.hashed_token)throw new ApiError(502,'The sign-in link could not be created. Try again shortly.');
   const url=site+'/finance-login.html#'+new URLSearchParams({slug,token_hash:generatedData.hashed_token,type:'magiclink'});
   await db('finance_email_jobs',{business_id:business.id,kind:'login',dedupe_key:'login:'+crypto.randomUUID(),payload:renderLoginEmail({business,account,url})});
   queueDispatch();
   return reply(200,{queued:true});
  }
  if(['public_invoice','pay','check_payment','public_pdf'].includes(body.action)){
   const i=await invoice(body.id);await checkToken(i);
   if(i.mode!=='live')throw new ApiError(404,'Invoice not found.');
   if(body.action==='public_invoice'){
    const attempts=await db('finance_attempts?invoice_id=eq.'+i.id+'&business_id=eq.'+business.id+'&status=in.(initializing,pending)&order=created_at.desc&limit=1');
    return reply(200,{invoice:visibleInvoice(i),payments_ready:canPay()&&i.mode===account.mode,mode:i.mode,pending_reference:attempts[0]?.reference||null});
   }
   if(body.action==='public_pdf'){
    if(!deps.pdf)throw new ApiError(503,'PDF generation is unavailable.');
    return new Response(await deps.pdf(visibleInvoice(i)),{headers:{...cors,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+i.number+'.pdf"'}});
   }
   if(body.action==='check_payment'){
    const attempts=await db('finance_attempts?business_id=eq.'+business.id+'&invoice_id=eq.'+i.id+'&reference=eq.'+encodeURIComponent(body.reference||'')+'&limit=1');
    if(!attempts[0])throw new ApiError(404,'This payment does not belong to the invoice.');
    const result=await verify(attempts[0].reference);return reply(200,{status:result.status,invoice:visibleInvoice(await invoice(i.id))});
   }
   if(!canPay())throw new ApiError(503,'Online invoice payments are not activated yet.');
   if(i.mode!==account.mode)throw new ApiError(409,'This invoice belongs to another payment environment.');
   const desired='lt_'+crypto.randomUUID().replaceAll('-','');
   const attempt=await db('rpc/finance_prepare_payment',{p_invoice:i.id,p_reference:desired});
   if(attempt.authorization_url&&attempt.status==='pending')return reply(200,{authorization_url:attempt.authorization_url,reference:attempt.reference});
   if(attempt.reference!==desired)throw new ApiError(409,'A payment is already being checked. Reopen the invoice after a moment; do not pay twice.');
   let result;
   try{result=await paystack('transaction/initialize',{email:i.customer.email,amount:i.total_amount,currency:i.currency,reference:attempt.reference,
    callback_url:site+'/invoice.html?'+new URLSearchParams({slug,id:i.id}),metadata:{logtraq_invoice_id:i.id,logtraq_business_id:business.id}});}
   catch(error){throw new ApiError(error.status||502,'Could not confirm checkout creation. This attempt is retained to prevent a duplicate charge. Check payment before trying again.');}
   const url=new URL(result.data?.authorization_url||'');
   if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com')throw new ApiError(502,'Paystack returned an invalid checkout link.');
   await db('finance_attempts?id=eq.'+attempt.id+'&business_id=eq.'+business.id,{authorization_url:url.href,status:'pending',updated_at:new Date().toISOString()},'PATCH');
   return reply(200,{authorization_url:url.href,reference:attempt.reference});
  }
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer \S+$/.test(auth))throw new ApiError(401,'Sign in to view Payments.');
  const response=await fetcher(base+'/auth/v1/user',{headers:{apikey:anon||service,Authorization:auth},signal:AbortSignal.timeout(10000)});
  const user=await response.json();
  if(!response.ok||!uuid.test(user.id||'')||!user.email_confirmed_at)throw new ApiError(401,'Sign in again to view Payments.');
  const member=await db('finance_members?business_id=eq.'+business.id+'&user_id=eq.'+user.id+'&limit=1');
  if(!member.length){
   const activated=await db('rpc/finance_activate_owner',{p_business:business.id,p_user:user.id,p_email:user.email||''});
   if(activated!==true)throw new ApiError(403,'This account does not have access to these payment records.');
  }
  if(body.action==='dashboard'){
   const page=Number(body.page||1);if(!Number.isInteger(page)||page<1||page>10000)throw new ApiError(400,'Invalid page.');
   const q=String(body.search||'').replace(/[^a-zA-Z0-9 @.+_-]/g,'').slice(0,80);
   const dateFilter=(column)=>{
    let filter='';for(const [key,op] of [['from','gte'],['to','lte']])if(body[key]){if(!/^\d{4}-\d{2}-\d{2}$/.test(body[key]))throw new ApiError(400,'Check the date filter.');filter+='&'+column+'='+op+'.'+encodeURIComponent(body[key]+(key==='to'?'T23:59:59.999+02:00':'T00:00:00+02:00'));}return filter;
   };
   const mode=body.mode||account?.mode||'live';if(!['test','live'].includes(mode))throw new ApiError(400,'Invalid payment environment.');
   const scope='business_id=eq.'+business.id+'&mode=eq.'+mode;
   const search=q?'&or='+encodeURIComponent('(reference.ilike.*'+q+'*,customer_email.ilike.*'+q+'*,customer_name.ilike.*'+q+'*)'):'';
   const [payments,invoices,jobs]=await Promise.all([
    db('finance_payments?'+scope+'&order=paid_at.desc&limit=100&offset='+(page-1)*100+dateFilter('paid_at')+search),
    db('finance_invoices?'+scope+'&order=created_at.desc&limit=100'),
    db('finance_email_jobs?select=id,invoice_id,payment_id,kind,status,attempts,last_error,sent_at&business_id=eq.'+business.id+'&order=created_at.desc&limit=100')]);
   return reply(200,{payments,invoices:invoices.map(visibleInvoice),emails:jobs,page,has_more:payments.length===100,payments_ready:canPay(),email_ready:emailReady(account,env),sync_ready:!!(account?.paystack_key_env&&account.integration_id&&env.get(account.paystack_key_env)),links_ready:(account?.invoice_link_secret||env.get('FINANCE_LINK_SECRET')||'').length>=32,mode,account_mode:account?.mode||'live'});
  }
  if(body.action==='issue'){
   if(body.mode!==(account?.mode||'live'))throw new ApiError(409,'Switch to the configured payment environment before creating an invoice.');
   if(!uuid.test(body.request_id||''))throw new ApiError(400,'Invalid invoice request.');
   const i=await db('rpc/finance_issue_invoice',{p_business:business.id,p_actor:user.id,p_request:body.request_id,p_customer:body.customer,p_items:body.items,p_due:body.due_date||null,p_notes:body.notes||''});
   let url=null;try{url=await link(i);}catch(error){if(error.status!==503)throw error;}
   return reply(200,{invoice:visibleInvoice(i),url});
  }
  if(['invoice','pdf','invoice_link','queue_invoice','void'].includes(body.action)){
   const i=await invoice(body.id);
   if(body.action==='invoice')return reply(200,{invoice:visibleInvoice(i)});
   if(body.action==='invoice_link')return reply(200,{url:await link(i)});
   if(body.action==='pdf'){
    if(!deps.pdf)throw new ApiError(503,'PDF generation is unavailable.');
    return new Response(await deps.pdf(visibleInvoice(i)),{headers:{...cors,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+i.number+'.pdf"'}});
   }
   if(body.action==='queue_invoice'){
    if(!emailReady(account,env))throw new ApiError(503,'Email delivery is not connected yet. You can download the invoice PDF.');
    if(i.status==='void')throw new ApiError(409,'A void invoice cannot be emailed.');
    const existing=(await db('finance_email_jobs?business_id=eq.'+business.id+'&dedupe_key=eq.'+encodeURIComponent('invoice:'+i.id)+'&limit=1'))[0];
    if(!existing)await db('finance_email_jobs',{business_id:business.id,invoice_id:i.id,kind:'invoice',dedupe_key:'invoice:'+i.id});
    queueDispatch();return reply(200,{status:existing?.status||'pending'});
   }
   if(i.status!=='issued')throw new ApiError(409,'Only unpaid invoices can be voided.');
   // The atomic RPC rejects voids while a checkout is open or a payment is already recorded.
   return reply(200,{invoice:visibleInvoice(await db('rpc/finance_void_invoice',{p_business:business.id,p_invoice:i.id,p_actor:user.id}))});
  }
  if(body.action==='resend_email'){
   if(!emailReady(account,env))throw new ApiError(503,'Email sending is not connected.');
   if(!uuid.test(body.id||'')||!uuid.test(body.request_id||''))throw new ApiError(400,'Invalid resend request.');
   const original=(await db('finance_email_jobs?business_id=eq.'+business.id+'&id=eq.'+body.id+'&limit=1'))[0];
   if(!original||original.kind==='login')throw new ApiError(404,'Email not found.');
   if(original.status!=='sent')throw new ApiError(409,'This email has not been confirmed sent. Review its delivery status before resending.');
   const dedupe='resend:'+original.id+':'+body.request_id;
   const prior=(await db('finance_email_jobs?business_id=eq.'+business.id+'&dedupe_key=eq.'+encodeURIComponent(dedupe)+'&limit=1'))[0];
   if(!prior)await db('finance_email_jobs',{business_id:business.id,invoice_id:original.invoice_id,payment_id:original.payment_id,kind:original.kind,dedupe_key:dedupe});
   queueDispatch();return reply(200,{queued:true});
  }
  if(body.action==='verify')return reply(200,await verify(body.reference,false));
  if(body.action==='sync'){
   const page=Number(body.page||1);if(!Number.isInteger(page)||page<1||page>10000)throw new ApiError(400,'Invalid page.');
   const result=await paystack('transaction?perPage=20&page='+page);let imported=0;
   const candidates=(result.data||[]).filter(data=>['success','reversed'].includes(data.status));
   for(let n=0;n<candidates.length;n+=4){await Promise.all(candidates.slice(n,n+4).map(data=>verify(data.reference,false)));imported+=candidates.slice(n,n+4).length;}
   return reply(200,{imported,next_page:(result.data||[]).length===20?page+1:null});
  }
  throw new ApiError(400,'Unknown action.');
 }catch(error){
  if(error instanceof ApiError)return reply(error.status,{error:error.message});
  return reply(500,{error:'The request could not be completed. Your saved records are safe. Please try again.'});
 }
}
