const API='https://jtonmfevmcmnkmdjmubn.supabase.co/functions/v1/sales-checkout';
document.getElementById('sale-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=document.getElementById('submit'),msg=document.getElementById('msg');
 button.disabled=true;msg.textContent='Preparing secure checkout…';
 const payload={business_name:document.getElementById('business').value.trim(),contact_name:document.getElementById('name').value.trim(),
 email:document.getElementById('email').value.trim(),phone:document.getElementById('phone').value.trim(),
 accepted:document.getElementById('agree').checked,terms_version:'service-2026-11-v1'};
 try{
 const r=await fetch(API+'/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Checkout unavailable');
 const url=new URL(data.authorization_url);if(url.hostname!=='checkout.paystack.com'||url.protocol!=='https:')throw Error('Unexpected payment destination');
 sessionStorage.setItem('logtraq-sales-'+data.id,data.token);
 location.assign(url.href);
 }catch(err){msg.textContent=err.message;button.disabled=false;}
});