document.addEventListener('DOMContentLoaded',async()=>{
 const get=id=>document.getElementById(id),fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 const id=fragment.get('id')||query.get('id'),slug=fragment.get('slug')||query.get('slug');
 let token=fragment.get('token'),reference=query.get('reference')||query.get('trxref'),invoice=null,busy=false,paymentsReady=false;
 const message=(text,error=false)=>{get('invoice-message').textContent=text;get('invoice-message').setAttribute('role',error?'alert':'status');};
 try{if(token)sessionStorage.setItem('invoice-link:'+id,JSON.stringify({token,slug}));else{const saved=JSON.parse(sessionStorage.getItem('invoice-link:'+id)||'null');if(saved&&saved.slug===slug)token=saved.token;}
  if(!reference)reference=sessionStorage.getItem('invoice-reference:'+id);
 }catch(_){}
 // Fragments are never sent in page requests or Referrer headers. Do not add them to query strings.
 if(!id||!slug||!token){message('This private invoice link is incomplete. Reopen the original link sent by the business.',true);return;}
 const endpoint=SUPABASE_URL+'/functions/v1/finance-api';
 const money=value=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value)/100);
 const date=value=>new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium'}).format(new Date(value));
 async function api(action,extra={},binary=false){
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({action,slug,id,token,...extra}),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const data=await response.json();throw Error(data.error||'Could not load the invoice. Please try again.');}
  return binary?response.blob():response.json();
 }
 function render(){
  get('customer-invoice').hidden=false;
  get('seller-name').textContent=invoice.seller.name;get('seller-contact').textContent=[invoice.seller.email,invoice.seller.phone].filter(Boolean).join(' · ');
  get('customer-invoice-status').textContent=invoice.status==='paid'?'PAID':invoice.status.toUpperCase();
  get('customer-invoice-number').textContent=invoice.number;
  get('customer-invoice-dates').textContent='Issued '+date(invoice.created_at)+(invoice.due_date?' · Due '+invoice.due_date:'');
  get('customer-invoice-customer').textContent=invoice.customer.name+' · '+invoice.customer.email;
  get('customer-invoice-address').textContent=invoice.customer.address||'';get('customer-invoice-address').hidden=!invoice.customer.address;
  get('customer-invoice-lines').replaceChildren();
  invoice.items.forEach(item=>{const row=document.createElement('tr');for(const text of [item.description,String(item.quantity),money(item.unit_amount),money(item.quantity*item.unit_amount)]){const td=document.createElement('td');td.textContent=text;row.appendChild(td);}get('customer-invoice-lines').appendChild(row);});
  get('customer-invoice-total').textContent='Total '+money(invoice.total_amount);get('customer-invoice-notes').textContent=invoice.notes||'';
  get('customer-invoice-pay').disabled=busy||!paymentsReady||invoice.status!=='issued';
  get('customer-invoice-pay').hidden=['paid','reversed','void'].includes(invoice.status);
  get('customer-invoice-check').hidden=!reference||invoice.status!=='issued';
  get('customer-invoice-payment-note').textContent=invoice.status==='paid'?'Payment verified. Thank you.':invoice.status==='reversed'?'This payment was reversed. Contact the business for assistance.':invoice.status==='void'?'This invoice is void.':!paymentsReady?'Online payment is not activated for this invoice. Contact the business.':'The amount above will be charged securely through Paystack.';
 }
 async function load(){
  const result=await api('public_invoice');invoice=result.invoice;paymentsReady=result.payments_ready;reference=reference||result.pending_reference;render();message('');
 }
 async function check(){
  if(!reference||busy)return;busy=true;get('customer-invoice-check').disabled=true;message('Verifying payment with Paystack…');
  try{const result=await api('check_payment',{reference});invoice=result.invoice;render();message(result.status==='success'?'Your payment has been verified.':result.status==='reversed'?'The payment was reversed.':'Payment is not confirmed yet. You can check again shortly.');}
  catch(error){message(error.message,true);}
  finally{busy=false;get('customer-invoice-check').disabled=false;render();}
 }
 get('customer-invoice-pay').addEventListener('click',async()=>{
  if(busy||!paymentsReady||invoice?.status!=='issued')return;busy=true;render();message('Opening secure checkout…');
  try{const result=await api('pay');const url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com')throw Error('The checkout link could not be verified.');
   reference=result.reference;try{sessionStorage.setItem('invoice-reference:'+id,reference);}catch(_){}
   location.assign(url.href);
  }catch(error){message(error.message,true);await load().catch(()=>{});}
  finally{busy=false;render();}
 });
 get('customer-invoice-check').addEventListener('click',check);
 get('customer-invoice-pdf').addEventListener('click',async()=>{
  const button=get('customer-invoice-pdf');button.disabled=true;
  try{const blob=await api('public_pdf',{},true),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=invoice.number+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(error){message(error.message,true);}finally{button.disabled=false;}
 });
 try{await load();if(reference)await check();}catch(error){message(error.message,true);}
});
