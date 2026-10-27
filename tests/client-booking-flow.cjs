
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const files = Object.fromEntries(['app.js', 'index.html', 'details.js', 'details.html', 'vercel.json']
    .map(path => [path, readFileSync(join(__dirname, '..', path), 'utf8')]));
function element() {
 const el = {textContent:'',value:'',hidden:true,disabled:false,children:[],listeners:{},style:{},className:'',
 addEventListener(type,fn){this.listeners[type]=fn;},
 setAttribute(name,value){this[name]=value;},
 getAttribute(name){return this[name] ?? null;},
 removeAttribute(name){delete this[name];},
 appendChild(child){this.children.push(child);},
 focus(){this.focused=true;}};
 let html='';
 Object.defineProperty(el,'innerHTML',{get(){return html;},set(value){html=value;this.children=[];}});
 el.classList={
  remove(name){el.className=el.className.split(' ').filter(item=>item!==name).join(' ');},
  add(name){if(!el.className.split(' ').includes(name))el.className+=' '+name;}
 };
 return el;
}
async function details(options={}) {
 const els={}; const get=id=>els[id]||(els[id]=element());
 const inputs={}; for(const name of ['first_name','last_name','phone','email','notes']) inputs[name]=element();
 const form=get('booking-form');form.elements={namedItem:name=>inputs[name]};
 form.reportValidity=()=>['first_name','last_name','phone','email'].every(name=>inputs[name].value.length>0)&&inputs.email.value.includes('@');
 const saved={}; let count=0;let loaded;
 const win={location:{pathname:'/logtraq/details',search:options.query||'?date=2026-11-01&time=10%3A00'},addEventListener(){}};
 // Match get_public_page: available slots omit status entirely.
 const slot={date:'2026-11-01',time:'10:00:00'};
 const context={window:win,document:{getElementById:get,addEventListener(type,fn){loaded=fn;}},
 URL,URLSearchParams,Date,console,SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'test',
 sessionStorage:{getItem(){return null;},setItem(k,v){if(options.storageError)throw Error('storage');saved[k]=v;}},
 fetch:async()=>{count++; if(options.networkError)throw Error('offline');return {ok:true,json:async()=>({name:'Demo',services:options.services||[],slots:options.missingSlot?[]:[{...slot,...(options.unavailable||options.race&&count>1?{status:'taken'}:options.explicitStatus?{status:options.explicitStatus}:{})}]})};}};
 vm.runInNewContext(files['details.js'],context);
 await loaded();
 return {els,get,inputs,form,win,saved,calls:()=>count,submit:()=>form.listeners.submit({preventDefault(){}})};
}
(async()=>{
 let p=await details();
 assert.equal(p.form.hidden,false);
 assert.equal(p.get('selected-time').textContent,'10:00');
 assert.equal(p.get('back-to-calendar').href,'/logtraq');
 await p.submit();assert.equal(p.win.location.href,undefined);
 Object.assign(p.inputs.first_name,{value:' Ada '});p.inputs.last_name.value="O'Brien";p.inputs.phone.value='+27 79 123 4567';p.inputs.email.value='ada+demo@example.com';p.inputs.notes.value='<script>notes</script>';
 await p.submit();
 let url=new URL(p.win.location.href);assert.equal(url.origin,'https://paystack.shop');assert.equal(url.pathname,'/pay/o495iejvn3');
 assert.equal(url.searchParams.get('first_name'),'Ada');assert.equal(url.searchParams.get('last_name'),"O'Brien");
 assert.equal(url.searchParams.get('email'),'ada+demo@example.com');
 let draft=JSON.parse(Object.values(p.saved)[0]);assert.equal(draft.date,'2026-11-01');assert.equal(draft.time,'10:00');assert.equal(draft.phone,'+27 79 123 4567');assert.equal(draft.notes,'<script>notes</script>');
 for(const opts of [{unavailable:true},{explicitStatus:'pending'},{missingSlot:true},{networkError:true},{query:'?date=2026-02-31&time=10:00'},{query:'?date=2026-11-01&time=25:00'},{query:'?date=2026-11-01'}]) {
  p=await details(opts);assert.equal(p.form.hidden,true);assert.equal(p.get('booking-error').hidden,false);assert.equal(p.win.location.href,undefined);
 }
 for(const opts of [{race:true},{storageError:true}]) {
  p=await details(opts);for(const [name,value] of Object.entries({first_name:'Ada',last_name:'Demo',phone:'0791234567',email:'ada@example.com'}))p.inputs[name].value=value;
  await p.submit();assert.equal(p.win.location.href,undefined);assert.equal(p.get('booking-error').hidden,false);assert.equal(p.get('continue-payment').disabled,false);
 }
 p=await details();for(const [name,value] of Object.entries({first_name:'Ada',last_name:'Demo',phone:'12',email:'ada@example.com'}))p.inputs[name].value=value;
 await p.submit();assert.equal(p.win.location.href,undefined);assert.equal(p.inputs.phone.focused,true);
 p=await details({explicitStatus:'open'});assert.equal(p.form.hidden,false);
 let loaded,poll;const els={};const get=id=>els[id]||(els[id]=element());
 const win={location:{pathname:'/logtraq',search:''}};
 const doc={getElementById:get,createElement:()=>element(),querySelector:()=>null,querySelectorAll:()=>get('day-tabs').children,addEventListener(type,fn){loaded=fn;}};
 let slots=[{date:'2026-11-01',time:'10:00:00'},{date:'2026-11-01',time:'11:00:00',status:'taken'},{date:'2026-11-01',time:'12:00:00',status:'pending'},{date:'2026-11-01',time:'13:00:00',status:'open'},{date:'2026-11-02',time:'09:00:00'}];
 let fail=false,missingBusiness=false;
 vm.runInNewContext(files['app.js'],{document:doc,window:win,URL,URLSearchParams,Date,console:{error(){}},SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'test',setInterval(fn){poll=fn;},
 fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>missingBusiness?null:({name:'Demo',slots})};}});
 await loaded();
 let chips=get('time-grid').children;
 const book=get('book-selected-slot');
 assert.equal(chips.length,4);assert.equal(chips[3].disabled,false);assert.equal(chips[0].disabled,false);assert.equal(chips[1].disabled,true);assert.equal(chips[2].disabled,true);
 assert.equal(book.disabled,true);book.listeners.click();assert.equal(win.location.href,undefined);
 chips[0].listeners.click();
 assert.equal(win.location.href,undefined);assert.equal(book.disabled,false);
 assert.match(book.textContent,/^Book .*1.*November.*10:00$/);
 assert.equal(get('time-grid').children[0]['aria-pressed'],'true');
 assert(get('time-grid').children[0].className.includes('selected'));
 await poll();
 assert.equal(book.disabled,false);assert.equal(get('time-grid').children[0]['aria-pressed'],'true');
 get('time-grid').children[3].listeners.click();
 assert.equal(win.location.href,undefined);assert.match(book.textContent,/13:00$/);
 assert.equal(get('time-grid').children[0]['aria-pressed'],'false');
 assert.equal(get('time-grid').children[3]['aria-pressed'],'true');
 book.listeners.click();assert.equal(win.location.href,'/logtraq/details?date=2026-11-01&time=13%3A00');
 delete win.location.href;
 get('day-tabs').children[1].listeners.click();assert.equal(book.disabled,true);
 get('time-grid').children[0].listeners.click();assert.match(book.textContent,/2.*November.*09:00$/);
 slots=slots.filter(slot=>slot.date!=='2026-11-02');await poll();
 assert.equal(book.disabled,true);book.listeners.click();assert.equal(win.location.href,undefined);
 get('time-grid').children[0].listeners.click();fail=true;await poll();
 assert.equal(book.disabled,true);book.listeners.click();assert.equal(win.location.href,undefined);
 fail=false;await poll();assert.equal(book.disabled,false);
 slots[0].status='taken';await poll();assert.equal(book.disabled,true);
 get('time-grid').children[3].listeners.click();missingBusiness=true;await poll();
 assert.equal(book.disabled,true);book.listeners.click();assert.equal(win.location.href,undefined);
 missingBusiness=false;slots=[];await poll();
 assert.equal(book.disabled,true);assert.equal(get('day-tabs').children.length,0);
 assert(files['index.html'].includes('id="book-selected-slot"'));
 const rewrites=JSON.parse(files['vercel.json']).rewrites;
 assert.equal(rewrites.find(r=>r.source==='/:biz/details').destination,'/details.html');
 assert(!files['index.html'].includes('paystack.shop'));
 for(const match of files['details.html'].matchAll(/for="([^"]+)"/g)) assert(files['details.html'].includes('id="'+match[1]+'"'));

 const privateService={id:'11111111-1111-4111-8111-111111111111',name:'Partner coaching',description:'Bring a friend',service_type:'private',duration_minutes:90,price_amount:12050,currency:'ZAR',price_basis:'per_person',participant_count:2};
 const groupService={...privateService,id:'22222222-2222-4222-8222-222222222222',name:'Shared class',service_type:'class',participant_count:null};
 async function catalogue(initialServices, search='') {
  let ready,refresh;const nodes={};const find=id=>nodes[id]||(nodes[id]=element());
  const location={pathname:'/logtraq',search};
  const state={services:initialServices,slots:[{date:'2026-11-01',time:'10:00:00'}],fail:false};
  vm.runInNewContext(files['app.js'],{
   document:{getElementById:find,createElement:()=>element(),querySelector:()=>null,querySelectorAll:()=>find('day-tabs').children,addEventListener(type,fn){ready=fn;}},
   window:{location},URL,URLSearchParams,Date,console:{error(){}},SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'test',
   setInterval(fn){refresh=fn;},
   fetch:async()=>{if(state.fail)throw Error('offline');return {ok:true,json:async()=>({name:'Demo',slots:state.slots,services:state.services})};}
  });
  await ready();
  return {get:find,location,state,poll:()=>refresh(),choose:index=>find('client-services').children[index].children.at(-1).listeners.click()};
 }
 let cat=await catalogue([privateService,groupService]);
 assert.equal(cat.get('client-calendar').hidden,true);
 assert.equal(cat.get('client-services').children.length,2);
 assert.equal(cat.get('client-services').children[1].children.at(-1).disabled,true);
 assert.equal(cat.get('client-services').children[0].children[2].textContent,'1 hr 30 min · 2 people per booking');
 assert.match(cat.get('client-services').children[0].children[4].textContent,/241[,.]00 total for 2 people/);
 cat.choose(0);
 assert.equal(cat.get('client-calendar').hidden,false);
 assert.equal(cat.get('calendar-service-name').textContent,'Partner coaching');
 cat.get('time-grid').children[0].listeners.click();
 const firstCard=cat.get('client-services').children[0];
 await cat.poll();
 assert.equal(cat.get('client-services').children[0],firstCard,'Polling must not replace focused catalogue buttons');
 assert.equal(cat.get('book-selected-slot').disabled,false);
 cat.get('book-selected-slot').listeners.click();
 let chosenUrl=new URL(cat.location.href,'https://booking.example');
 assert.equal(chosenUrl.searchParams.get('service'),privateService.id);
 assert.equal(chosenUrl.searchParams.get('date'),'2026-11-01');
 cat.state.services=[{...privateService,price_amount:15000},groupService];await cat.poll();
 assert.equal(cat.get('book-selected-slot').disabled,true,'A price edit requires choosing the time again');
 assert.match(cat.get('calendar-service-details').textContent,/300[,.]00/);
 cat.state.services=[groupService];await cat.poll();
 assert.equal(cat.get('client-calendar').hidden,true,'A hidden/removed service clears selection');
 assert.equal(cat.get('book-selected-slot').disabled,true);
 cat=await catalogue([privateService], '?service='+privateService.id);
 assert.equal(cat.get('client-calendar').hidden,false,'Back link restores service selection');
 cat=await catalogue([privateService], '?service='+groupService.id);
 assert.equal(cat.get('client-calendar').hidden,true);
 assert.match(cat.get('catalogue-message').textContent,/no longer listed/);
 cat=await catalogue([{...privateService,name:'<img src=x onerror=alert(1)>'}]);
 assert.equal(cat.get('client-services').children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
 p=await details({query:'?date=2026-11-01&time=10:00&service='+privateService.id,services:[privateService]});
 assert.equal(p.form.hidden,false);
 assert.equal(p.get('details-service-name').textContent,privateService.name);
 assert.match(p.get('details-service-info').textContent,/1 hr 30 min/);
 assert.match(p.get('details-service-price').textContent,/241[,.]00/);
 assert.equal(p.get('back-to-calendar').href,'/logtraq?service='+privateService.id);
 assert.equal(p.get('continue-payment').disabled,true,'Service prices must not go to an unrelated checkout amount');
 assert.equal(p.get('service-payment-note').hidden,false);
 for(const [name,value] of Object.entries({first_name:'Ada',last_name:'Demo',phone:'0791234567',email:'ada@example.com'}))p.inputs[name].value=value;
 await p.submit();assert.equal(p.win.location.href,undefined);
 for(const opts of [
  {query:'?date=2026-11-01&time=10:00&service='+privateService.id,services:[]},
  {query:'?date=2026-11-01&time=10:00&service='+groupService.id,services:[groupService]},
  {query:'?date=2026-11-01&time=10:00&service=invalid',services:[privateService]},
  {services:[privateService]}
 ]) {p=await details(opts);assert.equal(p.form.hidden,true);assert.equal(p.get('booking-error').hidden,false);}
 console.log('PASS: published catalogue rendering; private/class distinction; 90-minute duration and per-person total; service selection carried into details; fresh prices; polling focus; removal; back links; safe text; invalid IDs; service payment guard.');

 console.log('PASS: public API slots without status and explicit open slots; selection without navigation; confirmation button; changing time/day; polling persistence; removed/taken slots; failed refresh; missing business; empty calendar; taken/unknown slots disabled; appointment summary; required fields; phone validation; exact Paystack destination and encoded prefills; draft contents; unavailable slot; availability race; network/storage errors; malformed dates/times; details route; labels; no calendar payment bypass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
