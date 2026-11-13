const API='https://jtonmfevmcmnkmdjmubn.supabase.co/functions/v1/sales-checkout';
const params=new URLSearchParams(location.search),id=params.get('order'),hash=new URLSearchParams(location.hash.slice(1));
const token=hash.get('token')||sessionStorage.getItem('logtraq-sales-'+id);
const msg=document.getElementById('status');
if(!id||!token){msg.textContent='Your private confirmation link is unavailable. Contact LogTraq with your payment reference.';}
else{
 const privateUrl=location.origin+'/sales-confirmation.html?order='+encodeURIComponent(id)+'#token='+encodeURIComponent(token);
 history.replaceState(null,'',privateUrl);
 (async()=>{
  try{
   let r=await fetch(API+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token})});
   let data=await r.json();if(!r.ok)throw Error(data.error||'Unable to verify');
   document.getElementById('content').hidden=false;
   msg.textContent=data.payment_status==='paid'?'Payment verified. Your project has been registered.':'Payment is not yet verified. Please do not pay twice.';
   const money=n=>'R'+(n/100).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
   document.getElementById('amount').textContent=money(data.amount_paid);
   document.getElementById('balance').textContent=money(data.balance);
   document.getElementById('stage').textContent=data.project_status.replaceAll('_',' ');
   document.getElementById('agreement').textContent=data.agreement_version;
   const el=document.getElementById('link');
   if(data.business_url){const a=document.createElement('a');a.href=data.business_url;a.textContent=data.business_url;el.append(a);}else el.textContent='Generated after verified deposit';
   document.getElementById('copy').onclick=async()=>{await navigator.clipboard.writeText(privateUrl);msg.textContent='Private tracking link copied.'};
  }catch(e){msg.textContent=e.message;}
 })();
}