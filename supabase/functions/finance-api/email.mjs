// Direct Resend delivery. No marketplace subscription is required.
const address=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value)/100);
const encoded=bytes=>{let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);};
export function emailReady(account,env){
 return !!(account?.email_enabled&&address.test(account.email_from||'')&&account.email_key_env&&env.get(account.email_key_env)?.startsWith('re_'));
}
export function renderEmail({kind,business,account,invoice,payment,url}){
 const seller=invoice?.seller?.name||business.name;
 const recipient=kind==='receipt'?payment?.customer_email:invoice?.customer?.email;
 if(!address.test(recipient||''))throw Error('The customer email address is invalid.');
 const name=kind==='receipt'?(payment.customer_name||invoice?.customer?.name||'there'):invoice.customer.name;
 const amount=kind==='receipt'?payment.amount:invoice.total_amount;
 const number=invoice?.number||payment.reference;
 const title=kind==='receipt'?'Payment received':'Your invoice';
 const detail=kind==='receipt'?'We have verified your payment of '+money(amount)+'.':'Your invoice total is '+money(amount)+'.';
 const reference=kind==='receipt'?'Payment reference: '+payment.reference:'Invoice: '+number;
 const caution=kind==='receipt'?'This receipt confirms money received. Appointment or class confirmation is separate.':'This invoice does not reserve an appointment or class place.';
 const text=[seller,title+' · '+number,'Hello '+name+',',detail,reference,invoice?.due_date&&kind==='invoice'?'Due date: '+invoice.due_date:null,url?'View and download your invoice: '+url:null,caution].filter(Boolean).join('\n\n');
 const html='<div style="font:16px/1.6 Arial,sans-serif;color:#171717;max-width:600px;margin:auto;padding:28px"><p style="font-weight:700">'+escape(seller)+'</p><h1 style="font-size:26px">'+escape(title)+'</h1><p>Hello '+escape(name)+',</p><p>'+escape(detail)+'</p><p>'+escape(reference)+'</p>'+(invoice?.due_date&&kind==='invoice'?'<p>Due date: '+escape(invoice.due_date)+'</p>':'')+(url?'<p><a href="'+escape(url)+'" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">View invoice</a></p>':'')+'<p style="font-size:13px;color:#666">'+escape(caution)+'</p></div>';
 const friendly=String(seller).replace(/[<>\r\n]/g,'').slice(0,100);
 return {from:friendly+' <'+account.email_from+'>',to:[recipient],subject:title+' · '+number,text,html};
}
export function renderLoginEmail({business,account,url}){
 if(!address.test(account.owner_email||''))throw Error('Owner email is not configured.');
 return {from:String(business.name).replace(/[<>\r\n]/g,'')+' <'+account.email_from+'>',to:[account.owner_email],subject:'Sign in to '+business.name+' Payments',
 text:'Use this private link to sign in to Payments:\n\n'+url+'\n\nIt can be used once. If you did not request it, ignore this email.',
 html:'<div style="font:16px/1.6 Arial,sans-serif;max-width:600px;padding:28px"><h1 style="font-size:24px">Sign in to Payments</h1><p><a href="'+escape(url)+'">Sign in securely</a></p><p>This link can be used once. If you did not request it, ignore this email.</p></div>'};
}
export async function dispatchEmails({db,env,fetcher,account,business,makeLink,pdf,limit=3}){
 if(!emailReady(account,env))return {sent:0,failed:0,ready:false};
 const key=env.get(account.email_key_env);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
 let sent=0,failed=0;
 for(let n=0;n<Math.min(limit,5);n++){
  const job=await db('rpc/finance_claim_email',{p_business:business.id,p_provider_hash:hash});
  if(!job?.id)break;
  let completed=false;
  const finish=async(status,providerId,error,delay=60)=>db('rpc/finance_finish_email',{p_id:job.id,p_lease:job.lease_token,p_status:status,p_provider_id:providerId||null,p_error:error||null,p_delay:delay});
  try{
   let invoice=null,payment=null;
   if(job.payment_id){
    const rows=await db('finance_payments?business_id=eq.'+business.id+'&id=eq.'+job.payment_id+'&limit=1');payment=rows[0];
    if(!payment||payment.status!=='success'||payment.mode!=='live'){await finish('manual_review',null,'Receipt requires a verified live payment.');failed++;continue;}
   }
   if(job.invoice_id){
    const rows=await db('finance_invoices?business_id=eq.'+business.id+'&id=eq.'+job.invoice_id+'&limit=1');invoice=rows[0];
    if(!invoice||invoice.mode!=='live'||invoice.status==='void'){await finish('manual_review',null,'Invoice is no longer eligible for email.');failed++;continue;}
   }
   let payload=job.payload;
   if(job.kind==='login'){
    if(!payload||payload.to?.length!==1||payload.to[0]!==account.owner_email){await finish('manual_review',null,'Owner email changed. Request a fresh sign-in link.');failed++;continue;}
   }else if(!payload){
    if(job.kind==='receipt'&&!payment||job.kind==='invoice'&&!invoice){await finish('manual_review',null,'Financial record is unavailable.');failed++;continue;}
    payload=renderEmail({kind:job.kind,business,account,invoice,payment,url:invoice?await makeLink(invoice):null});
    if(invoice&&pdf){
     const bytes=await pdf(invoice);
     payload.attachments=[{filename:invoice.number+'.pdf',content:encoded(bytes)}];
    }
    payload=await db('rpc/finance_store_mail_payload',{p_id:job.id,p_lease:job.lease_token,p_payload:payload});
   }
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'logtraq-email/'+job.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   const result=await response.json().catch(()=>null);
   if(response.ok&&typeof result?.id==='string'){
    const confirmed=await finish('sent',result.id,null);completed=true;if(confirmed)sent++;
   }else{
    const permanent=[400,401,403,404,409,422].includes(response.status);
    await finish(permanent?'manual_review':'failed',null,permanent?'Email service configuration or message needs review.':'Email service is temporarily unavailable.',Math.min(7200,300*2**job.attempts));
    completed=true;failed++;
   }
  }catch(_){
   if(!completed)await finish('failed',null,'Delivery could not be confirmed. The same email will be retried safely.',Math.min(7200,300*2**job.attempts)).catch(()=>{});
   failed++;
  }
 }
 return {sent,failed,ready:true};
}
