// LogTraq platform sales, deliberately separate from merchant finance-api.
// No Paystack transaction can be initiated until SALES_CHECKOUT_ENABLED=true.
const SITE = 'https://booking.logtraq.co.za';
const encoder = new TextEncoder();
const json = (status, data) => new Response(JSON.stringify(data), {status, headers:{
 'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':SITE,
 'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey,authorization',
 'Referrer-Policy':'no-referrer'
}});
const fail = (status, message) => {throw {status,message}};
const allowed = s => typeof s === 'string' && s.trim().length > 1;
const sha = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
const hmac = async (key, raw) => {
 const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-512'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,raw)),x=>x.toString(16).padStart(2,'0')).join('');
};
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&Array.from(a).reduce((d,c,i)=>d|(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
Deno.serve(async req => {
 try {
  if(req.method==='OPTIONS')return json(204,{});
  if(req.method!=='POST')fail(405,'POST required');
  const url=new URL(req.url), action=url.pathname.split('/').filter(Boolean).at(-1);
  const isWebhook=action==='webhook';
  if(!isWebhook && req.headers.get('origin')!==SITE)fail(403,'Origin denied');
  const raw=new Uint8Array(await req.arrayBuffer());
  if(raw.length>16384)fail(413,'Request too large');
  let body;try{body=JSON.parse(new TextDecoder().decode(raw))}catch{fail(400,'Invalid JSON')}
  const supabase=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabase||!service)fail(503,'Sales database not configured');
  const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'};
  async function db(path,method='GET',payload){
   const r=await fetch(supabase+'/rest/v1/'+path,{method,headers,body:payload?JSON.stringify(payload):undefined});
   const data=await r.json();if(!r.ok)fail(409,'Sales record operation failed');return data;
  }
  async function getOrder(id){
   if(!/^[0-9a-f-]{36}$/.test(id||''))fail(400,'Invalid order');
   const rows=await db('logtraq_sales_orders?id=eq.'+id+'&select=*&limit=1');if(!rows[0])fail(404,'Order not found');return rows[0];
  }
  async function privateOrder(){
   const o=await getOrder(body.id);
   if(!eq(o.access_token_hash,await sha(String(body.token||''))))fail(403,'Invalid access token');
   return o;
  }
  const key=Deno.env.get('PAYSTACK_SECRET_KEY_LOGTRAQ')||'';
  const enabled=Deno.env.get('SALES_CHECKOUT_ENABLED')==='true';
  async function paystack(path,payload){
   if(!key.startsWith('sk_'))fail(503,'Paystack not configured');
   const r=await fetch('https://api.paystack.co/'+path,{method:payload?'POST':'GET',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
   const j=await r.json();if(!r.ok||j.status!==true)fail(502,'Payment provider unavailable');return j.data;
  }
  async function verify(o){
   if(!o.payment_reference)fail(409,'No payment initiated');
   const p=await paystack('transaction/verify/'+encodeURIComponent(o.payment_reference));
   if(p.status!=='success')return {paid:false,status:p.status||'pending'};
   if(p.reference!==o.payment_reference||p.amount!==25000||p.currency!=='ZAR'||p.domain!=='live'||
     String(p.metadata?.logtraq_sales_order||'')!==o.id || !p.paid_at)fail(409,'Payment details mismatch');
   const expectedIntegration=Deno.env.get('PAYSTACK_INTEGRATION_ID_LOGTRAQ');
   const actual=typeof p.integration==='object'?p.integration?.id:p.integration;
   if(expectedIntegration&&String(actual)!==expectedIntegration)fail(409,'Paystack account mismatch');
   const pslug=(o.business_name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,23)||'business')+'-'+o.id.slice(0,8);
   const result=await db('rpc/logtraq_sales_finalize_verified','POST',{p_order:o.id,p_reference:o.payment_reference,p_slug:pslug});
   const businessId=Array.isArray(result)?result[0]:result;
   return {paid:true,status:'paid',business_id:businessId,business_url:SITE+'/'+pslug};
  }
  if(isWebhook){
   if(!key.startsWith('sk_'))fail(503,'Paystack not configured');
   const signature=req.headers.get('x-paystack-signature');
   if(!eq(signature,await hmac(key,raw)))fail(401,'Invalid Paystack signature');
   if(body.event==='charge.success'&&body.data?.reference){
    const orders=await db('logtraq_sales_orders?payment_reference=eq.'+encodeURIComponent(body.data.reference)+'&limit=1');
    if(orders[0])await verify(orders[0]);
   }
   return json(200,{received:true});
  }
  if(action==='create'){
   if(!enabled)fail(503,'Checkout not activated yet');
   if(!key.startsWith('sk_live_'))fail(503,'Live Paystack credentials missing');
   const n=String(body.business_name||'').trim(),name=String(body.contact_name||'').trim(),
    email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim();
   if(!allowed(n)||n.length>150||!allowed(name)||name.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200
    ||!body.accepted||body.terms_version!=='service-2026-11-v1')fail(400,'Complete the details and accept the terms');
   const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),ref='lt_sale_'+id.replaceAll('-','');
   await db('logtraq_sales_orders','POST',{id,business_name:n,contact_name:name,contact_email:email,
    contact_phone:phone||null,terms_accepted_at:new Date().toISOString(),access_token_hash:await sha(token),
    payment_reference:ref,payment_status:'pending'});
   const payment=await paystack('transaction/initialize',{email,amount:25000,currency:'ZAR',reference:ref,
     callback_url:SITE+'/sales-confirmation.html?order='+id,
     metadata:{logtraq_sales_order:id,offer_version:'founding-2026-11-v1'}});
   const checkout=new URL(payment.authorization_url||'');
   if(checkout.protocol!=='https:'||checkout.hostname!=='checkout.paystack.com')fail(502,'Invalid checkout URL');
   await db('logtraq_sales_orders?id=eq.'+id,'PATCH',{checkout_url:checkout.href});
   return json(200,{id,token,authorization_url:checkout.href});
  }
  if(action==='status'||action==='verify'){
   const o=await privateOrder();
   if(action==='verify'&&o.payment_status!=='paid')await verify(o);
   const refreshed=await getOrder(o.id);
   return json(200,{id:refreshed.id,payment_status:refreshed.payment_status,project_status:refreshed.project_status,
    amount_paid:refreshed.payment_status==='paid'?25000:0,total:100000,balance:refreshed.payment_status==='paid'?75000:100000,
    business_url:refreshed.business_slug?SITE+'/'+refreshed.business_slug:null,
    paid_at:refreshed.payment_verified_at,contact_email:refreshed.contact_email,
    agreement_version:refreshed.terms_version});
  }
  fail(404,'Unknown action');
 }catch(e){return json(e.status||500,{error:e.message||'Unexpected error'});}
});
