
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const files = Object.fromEntries(['app.js', 'index.html', 'details.js', 'details.html', 'vercel.json']
    .map(path => [path, readFileSync(join(__dirname, '..', path), 'utf8')]));
function element() {
 return {textContent:'',value:'',hidden:true,disabled:false,innerHTML:'',children:[],listeners:{},style:{},
 addEventListener(type,fn){this.listeners[type]=fn;},
 setAttribute(name,value){this[name]=value;},
 appendChild(el){this.children.push(el);},
 classList:{remove(){},add(){}},focus(){this.focused=true;}};
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
 fetch:async()=>{count++; if(options.networkError)throw Error('offline');return {ok:true,json:async()=>({name:'Demo',slots:options.missingSlot?[]:[{...slot,...(options.unavailable||options.race&&count>1?{status:'taken'}:options.explicitStatus?{status:options.explicitStatus}:{})}]})};}};
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
 let loaded;const els={};const get=id=>els[id]||(els[id]=element());
 const win={location:{pathname:'/logtraq',search:''}};
 const doc={getElementById:get,createElement:()=>element(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){loaded=fn;}};
 vm.runInNewContext(files['app.js'],{document:doc,window:win,URLSearchParams,Date,console,SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'test',setInterval(){},
 fetch:async()=>({ok:true,json:async()=>({name:'Demo',slots:[{date:'2026-11-01',time:'10:00:00'},{date:'2026-11-01',time:'11:00:00',status:'taken'},{date:'2026-11-01',time:'12:00:00',status:'pending'},{date:'2026-11-01',time:'13:00:00',status:'open'}]})})});
 await loaded();
 const chips=get('time-grid').children;
 assert.equal(chips.length,4);assert.equal(chips[3].disabled,false);assert.equal(chips[0].disabled,false);assert.equal(chips[1].disabled,true);assert.equal(chips[2].disabled,true);
 chips[0].listeners.click();assert.equal(win.location.href,'/logtraq/details?date=2026-11-01&time=10%3A00');
 const rewrites=JSON.parse(files['vercel.json']).rewrites;
 assert.equal(rewrites.find(r=>r.source==='/:biz/details').destination,'/details.html');
 assert(!files['index.html'].includes('paystack.shop'));
 for(const match of files['details.html'].matchAll(/for="([^"]+)"/g)) assert(files['details.html'].includes('id="'+match[1]+'"'));
 console.log('PASS: public API slots without status and explicit open slots; navigation; taken/unknown slots disabled; appointment summary; required fields; phone validation; exact Paystack destination and encoded prefills; draft contents; unavailable slot; availability race; network/storage errors; malformed dates/times; details route; labels; no calendar payment bypass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
