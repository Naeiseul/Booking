const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../photo-tools.js'),'utf8');
function harness({width=4032,height=3024,bytes=180000,decodeError=false,png=false}={}) {
 const draws=[],revoked=[],created=[];
 const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage(...args){draws.push(args.slice(1));}}),
 toBlob(callback,type,quality){created.push({width:canvas.width,height:canvas.height,type,quality});callback(new Blob([new Uint8Array(bytes)],{type:png?'image/png':type}));}};
 const context={window:{},location:{origin:'https://booking.logtraq.co.za'},SUPABASE_URL:'https://jtonmfevmcmnkmdjmubn.supabase.co',
 URL:class extends URL {static createObjectURL(){return 'blob:fixture';} static revokeObjectURL(value){revoked.push(value);}},
 Image:class {constructor(){this.naturalWidth=width;this.naturalHeight=height;}async decode(){if(decodeError)throw Error('decode');}},
 document:{createElement:()=>canvas},File,Blob};
 vm.runInNewContext(source,context);
 return {tools:context.window.PhotoTools,draws,revoked,created};
}
const file=(name='phone.jpg',size=8*1024*1024,type='image/jpeg')=>({name,size,type});
(async()=>{
 for(const [width,height] of [[4032,3024],[3024,4032],[2400,2400],[8000,2000]]) {
  const h=harness({width,height}),result=await h.tools.prepare(file());
  const output=h.created.at(-1);
  assert(Math.max(output.width,output.height)<=1920);
  assert(Math.abs(output.width/output.height-width/height)<0.002,'Proportions retained');
  assert.equal(result.type,'image/webp');assert(result.size<1024*1024);
  assert.deepEqual(h.draws[0],[0,0,output.width,output.height],'Draw complete photo without a crop');
  assert.equal(h.revoked.length,1);
 }
 let h=harness({width:4000,height:3000});await h.tools.prepare(file(),{logo:true});assert.equal(h.created.at(-1).width,768);
 h=harness({width:120,height:80});await h.tools.prepare(file('small.png',3000,'image/png'));assert.equal(h.created[0].width,120,'Never enlarge small images');
 h=harness({bytes:1400000});await h.tools.prepare(file());assert.equal(h.created.length,4,'Retry smaller dimensions when output is large');
 h=harness({png:true});assert.equal((await h.tools.prepare(file())).type,'image/png','Handle browsers without WebP canvas encoding');
 h=harness();await assert.rejects(()=>h.tools.prepare(file('too-big.jpg',26*1024*1024)),/25 MB/);
 await assert.rejects(()=>h.tools.prepare(file('bad.svg',3000,'image\/svg+xml')),/Choose/);
 h=harness({decodeError:true});await assert.rejects(()=>h.tools.prepare(file()),/cannot read/);assert.equal(h.revoked.length,1);
 h=harness({width:10000,height:10000});await assert.rejects(()=>h.tools.prepare(file()),/60 megapixels/);
 const p='https://jtonmfevmcmnkmdjmubn.supabase.co/storage/v1/object/public/service-photos/a/b.png';
 h=harness();assert.match(h.tools.optimized(p,192),/^\/_vercel\/image\?/);
 assert.equal(h.tools.optimized('https://other.example/photo.png'), 'https://other.example/photo.png','Do not proxy arbitrary hosts');
 assert.equal(h.tools.optimized('javascript:alert(1)'),'');
 const img={dataset:{},style:{},attrs:{},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this[k];},async decode(){}};
 h.tools.set(img,p,{width:192});assert.equal(img.style.visibility,'hidden');
 await img.onload();assert.equal(img.style.visibility,'');
 img.onerror();assert.equal(img.src,p,'Optimization failure falls back to saved original');
 img.onerror();assert.equal(img.hidden,true,'Broken original terminates fallback');
 console.log('PASS photo preparation: large phone inputs, portrait/landscape/square/panorama proportions, no enlargement, compression, PNG fallback, validation, cleanup; delivery URL, decode reveal and original fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
