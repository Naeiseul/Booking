window.initializeAdminPayments = async function ({bizSlug,adminKey}) {
 const get=id=>document.getElementById(id), endpoint=SUPABASE_URL+'/functions/v1/finance-api';
 const login=get('finance-login'), area=get('finance-workspace'), dialog=get('invoice-dialog'), form=get('invoice-form'), fields=get('invoice-fields');
 let session=null,busy=false,requestId=null,page=1,syncPage=1,state=null;
 try{const saved=JSON.parse(sessionStorage.getItem('finance-session:'+bizSlug)||'null');sessionStorage.removeItem('finance-session:'+bizSlug);if(saved?.expires_at>Date.now()/1000)session=saved;}catch(_){}
 const money=value=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value)/100);
 const date=value=>value?new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium'}).format(new Date(value)):'—';
 function message(text,error=false){const el=get('finance-message');el.textContent=text;el.setAttribute('role',error?'alert':'status');}
 function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
 function button(text,action){const node=el('button',text,'finance-button finance-secondary');node.type='button';node.addEventListener('click',action);return node;}
 async function api(action,extra={},binary=false){
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY,...(session?{Authorization:'Bearer '+session.access_token}:{})},
   body:JSON.stringify({slug:bizSlug,action,...extra}),signal:AbortSignal.timeout(action==='sync'?90000:30000)});
  if(!response.ok){const data=await response.json();if(response.status===401){session=null;reset();}throw Error(data.error||'The request failed. Try again.');}
  return binary?response.blob():response.json();
 }
 function lock(value){busy=value;get('finance-refresh').disabled=value;get('finance-create').disabled=value||state?.account_mode!=='live';get('finance-sync').disabled=value||!state?.sync_ready;get('finance-logout').disabled=value;}
 function reset(){area.hidden=true;login.hidden=false;state=null;get('finance-payments-body').replaceChildren();get('finance-invoices-body').replaceChildren();get('finance-emails-body').replaceChildren();get('finance-summary').replaceChildren();if(dialog.open)dialog.close();form.reset();get('invoice-lines').replaceChildren();get('finance-detail').replaceChildren();}
 async function download(id){
  try{const blob=await api('pdf',{id},true),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(state.invoices.find(i=>i.id===id)?.number||'invoice')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(error){message(error.message,true);}
 }
 function details(invoice){
  const panel=get('finance-detail');panel.replaceChildren();
  panel.append(el('h3',invoice.number),el('p',invoice.status.toUpperCase()+' · '+invoice.mode.toUpperCase()),el('p',invoice.customer.name+' · '+invoice.customer.email));
  if(invoice.customer.address)panel.append(el('p',invoice.customer.address));
  invoice.items.forEach(item=>panel.append(el('p',item.description+' · '+item.quantity+' × '+money(item.unit_amount)+' = '+money(item.quantity*item.unit_amount))));
  panel.append(el('strong','Total '+money(invoice.total_amount)));
  if(invoice.notes)panel.append(el('p',invoice.notes));
  const actions=el('div',undefined,'finance-actions');
  actions.append(button('Download PDF',()=>download(invoice.id)));
  const copy=button('Copy customer link',async()=>{try{const result=await api('invoice_link',{id:invoice.id});await navigator.clipboard.writeText(result.url);message('Customer invoice link copied.');}catch(error){message(error.message,true);}});
  copy.disabled=!state.links_ready||invoice.status==='void';actions.append(copy);
  const email=button('Email invoice',async()=>{if(busy)return;email.disabled=true;try{const result=await api('queue_invoice',{id:invoice.id});message(result.status==='sent'?'This invoice has already been emailed.':'Invoice email queued.');}catch(error){message(error.message,true);}finally{email.disabled=!state?.email_ready;}});email.disabled=!state.email_ready;actions.append(email);
  if(invoice.status==='issued')actions.append(button('Void unpaid invoice',async()=>{
   if(!window.confirm('Void '+invoice.number+'? Its payment link will stop working.'))return;
   try{await api('void',{id:invoice.id});panel.replaceChildren();await load();message('Invoice voided.');}catch(error){message(error.message,true);}
  }));
  panel.append(actions,el('p',!state.links_ready?'Customer links are awaiting secure setup. You can download the PDF.':'Only share this private link with the intended customer.','finance-hint'),
   el('p',state.email_ready?'Invoice and receipt emails are sent from your business email address.':'Email delivery is awaiting a free sending service connection.','finance-hint'));
  panel.hidden=false;panel.focus();
 }
 function render(){
  area.hidden=false;login.hidden=true;
  get('finance-environment-label').textContent='Verified Paystack payments';
  get('finance-create').disabled=busy||state.account_mode!=='live';get('finance-create').textContent='Create invoice';get('finance-sync').disabled=busy||!state.sync_ready;
  const received=state.payments.filter(p=>p.status==='success').reduce((sum,p)=>sum+Number(p.amount),0);
  const reversed=state.payments.filter(p=>p.status==='reversed').reduce((sum,p)=>sum+Number(p.amount),0);
  const cards=get('finance-summary');cards.replaceChildren();
  for(const [label,value] of [['Received in displayed records',money(received)],['Reversed in displayed records',money(reversed)],['Displayed payments',String(state.payments.length)]]){
   const card=el('div',undefined,'finance-stat');card.append(el('span',label),el('strong',value));cards.append(card);
  }
  get('finance-payments-body').replaceChildren();
  state.payments.forEach(payment=>{
   const tr=el('tr');for(const text of [date(payment.paid_at),payment.customer_name||payment.customer_email,money(payment.amount),payment.status,payment.reference])tr.append(el('td',text));
   get('finance-payments-body').append(tr);
  });
  get('finance-payments-empty').hidden=state.payments.length>0;
  get('finance-page').textContent='Page '+page;get('finance-previous').disabled=page===1||busy;get('finance-next').disabled=!state.has_more||busy;
  get('finance-invoices-body').replaceChildren();
  state.invoices.forEach(invoice=>{
   const tr=el('tr');for(const text of [invoice.number,invoice.customer.name,money(invoice.total_amount),invoice.status,invoice.due_date||'—'])tr.append(el('td',text));
   const td=el('td');td.append(button('View',()=>details(invoice)));tr.append(td);get('finance-invoices-body').append(tr);
  });
  get('finance-invoices-empty').hidden=state.invoices.length>0;
  get('finance-emails-body').replaceChildren();
  state.emails.forEach(job=>{const tr=el('tr');for(const text of [job.kind,job.status,job.sent_at?date(job.sent_at):'Not sent'])tr.append(el('td',text));
   const td=el('td');if(job.status==='sent'&&job.kind!=='login'){const resend=button('Resend',async()=>{if(busy)return;resend.disabled=true;try{await api('resend_email',{id:job.id,request_id:crypto.randomUUID()});message('Email resend queued.');}catch(error){message(error.message,true);}finally{resend.disabled=!state?.email_ready;}});resend.disabled=!state.email_ready;td.append(resend);}else if(job.last_error)td.textContent=job.last_error;tr.append(td);get('finance-emails-body').append(tr);});
  get('finance-emails-empty').hidden=state.emails.length>0;
  get('finance-connection').textContent=state.payments_ready?'Paystack is connected. Invoice payments do not reserve a time or class place.':'Paystack connection is awaiting setup. Existing payment links remain unchanged.';
 }
 async function load(){
  if(busy||!session)return;lock(true);message('Loading payments…');
  try{
   state=await api('dashboard',{page,mode:'live',search:get('finance-search').value,from:get('finance-from').value,to:get('finance-to').value});
   render();message('');
  }catch(error){message(error.message,true);}
  finally{lock(false);}
 }
 login.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;get('finance-login-submit').disabled=true;message('Signing in…');
  try{
   const response=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:get('finance-email').value.trim(),password:get('finance-password').value}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();get('finance-password').value='';
   if(!response.ok||!result.access_token)throw Error('Could not sign in. Check your finance account details.');
   session=result;busy=false;await load();
  }catch(error){session=null;message(error.message,true);}
  finally{busy=false;get('finance-login-submit').disabled=false;}
 });
 get('finance-login-link').addEventListener('click',async()=>{
  const email=get('finance-email').value.trim();if(!email||!get('finance-email').checkValidity()){get('finance-email').reportValidity();return;}
  const button=get('finance-login-link');button.disabled=true;message('Requesting your private sign-in link…');
  try{try{sessionStorage.setItem('finance-return:'+bizSlug,location.pathname+location.search+'#payments');}catch(_){}
   await api('request_login',{email,admin_key:adminKey});message('Your sign-in email is queued. Check your inbox shortly.');
  }catch(error){message(error.message,true);}finally{button.disabled=false;}
 });
 get('finance-logout').addEventListener('click',async()=>{
  if(busy)return;const token=session?.access_token;session=null;reset();message('Signed out of Payments.');
  if(token)fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token}}).catch(()=>{});
 });
 get('finance-refresh').addEventListener('click',load);
 get('finance-filter').addEventListener('submit',event=>{event.preventDefault();page=1;load();});
 get('finance-previous').addEventListener('click',()=>{if(page>1){page--;load();}});
 get('finance-next').addEventListener('click',()=>{if(state?.has_more){page++;load();}});
 get('finance-sync').addEventListener('click',async()=>{
  if(busy)return;lock(true);message('Checking Paystack payment history…');
  try{const result=await api('sync',{page:syncPage});syncPage=result.next_page||1;message(result.imported+' verified payments checked.'+(result.next_page?' Select Import next page to continue.':' History import finished.'));
   get('finance-sync').textContent=result.next_page?'Import next page':'Import Paystack history';lock(false);await load();}
  catch(error){message(error.message,true);}finally{lock(false);}
 });
 function addLine(){
  if(get('invoice-lines').children.length>=20)return;
  const row=el('div',undefined,'invoice-line');
  const input=(label,cls,type,value)=>{const wrapper=el('label');wrapper.append(el('span',label));const field=el('input');field.className=cls;field.type=type;field.value=value;field.required=true;wrapper.append(field);row.append(wrapper);return field;};
  const description=input('Description','invoice-description','text','');description.maxLength=200;
  const quantity=input('Quantity','invoice-quantity','number','1');quantity.min='1';quantity.max='10000';quantity.step='1';
  const amount=input('Unit price (ZAR)','invoice-price','text','');amount.inputMode='decimal';amount.pattern='[0-9]+([.][0-9]{1,2})?';
  const remove=button('Remove item',()=>{if(get('invoice-lines').children.length>1)row.remove();});row.append(remove);get('invoice-lines').append(row);
 }
 get('finance-create').addEventListener('click',()=>{
  if(busy||!session)return;form.reset();get('invoice-lines').replaceChildren();addLine();requestId=crypto.randomUUID();get('invoice-error').textContent='';dialog.showModal();get('invoice-customer-name').focus();
 });
 get('invoice-add-line').addEventListener('click',addLine);
 const close=()=>{if(!busy)dialog.close();};
 get('invoice-cancel').addEventListener('click',close);get('invoice-close').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!session||!form.reportValidity())return;
  const items=[];try{
   for(const row of get('invoice-lines').children){
    const raw=row.querySelector('.invoice-price').value.trim();if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error('Enter a price with up to two decimal places.');
    const [rands,cents='']=raw.split('.'),amount=Number(rands)*100+Number(cents.padEnd(2,'0'));
    if(!Number.isSafeInteger(amount)||amount>2147483647)throw Error('The price is too large.');
    items.push({description:row.querySelector('.invoice-description').value.trim(),quantity:Number(row.querySelector('.invoice-quantity').value),unit_amount:amount});
   }
   const total=items.reduce((sum,item)=>sum+item.quantity*item.unit_amount,0);if(total<1||total>2147483647)throw Error('Check the invoice total.');
  }catch(error){get('invoice-error').textContent=error.message;return;}
  lock(true);fields.disabled=true;get('invoice-save').disabled=true;get('invoice-close').disabled=true;get('invoice-cancel').disabled=true;get('invoice-save').textContent='Creating invoice…';
  try{
   const result=await api('issue',{request_id:requestId,mode:'live',customer:{name:get('invoice-customer-name').value.trim(),email:get('invoice-customer-email').value.trim(),address:get('invoice-customer-address').value.trim()},
    items,due_date:get('invoice-due').value||null,notes:get('invoice-notes').value.trim()});
   dialog.close();lock(false);await load();details(result.invoice);message('Invoice '+result.invoice.number+' created. No email has been sent.');
  }catch(error){get('invoice-error').textContent=error.message+' Your invoice details are retained. Retry to confirm the same invoice.';}
  finally{fields.disabled=false;get('invoice-save').disabled=false;get('invoice-close').disabled=false;get('invoice-cancel').disabled=false;get('invoice-save').textContent='Create invoice';lock(false);}
 });
 try{
  const setup=await api('setup');get('finance-setup').textContent=setup.access_ready?'Sign in with your authorised finance account.':'Your finance login is awaiting activation. Payment records are protected until setup is complete.';
  get('finance-login-submit').disabled=!setup.access_ready;
  get('finance-login-link').disabled=!setup.email_ready;
  if(session&&setup.access_ready)await load();
 }catch(error){get('finance-setup').textContent='Payments could not load. Reopen the page to try again.';get('finance-login-submit').disabled=true;}
};
