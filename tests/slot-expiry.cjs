const fs=require('fs'),assert=require('assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const helper=src.slice(src.indexOf('    const bookingClock'),src.indexOf('    let activeDateString'));
for(const [instant,expected] of [['2026-10-30T11:59:59Z',true],['2026-10-30T12:00:00Z',false],['2026-10-30T12:01:00Z',false]]){
 class Clock extends Date{constructor(...a){super(...(a.length?a:[instant]))}}
 const future=new Function('Date','SUPABASE_URL',helper+'return slotIsFuture;')(Clock,'https://example.invalid');
 assert.equal(future({date:'2026-10-30',time:'14:00:00'}),expected);
}
console.log('PASS South African slot expiry before/at/after 14:00');
