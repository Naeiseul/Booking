import assert from 'node:assert/strict';
import {dispatchEmails,renderEmail,emailReady} from '../supabase/functions/finance-api/email.mjs';
const account={email_enabled:true,email_from:'owner@example.invalid',owner_email:'owner@example.invalid',email_key_env:'RESEND_API_KEY_UNIT'};
const env={get:key=>key==='RESEND_API_KEY_UNIT'?'re_private_unit_key':null};
const business={id:'business-unit',name:'Owner business'};
const invoice={id:'invoice-unit',mode:'live',status:'paid',number:'INV-000001',seller:{name:'Owner business'},customer:{name:'<script>Customer</script>',email:'customer@example.invalid'},total_amount:50000,items:[]};
let payment={id:'payment-unit',mode:'live',status:'success',customer_email:'customer@example.invalid',customer_name:'Actual payer',reference:'verified-reference',amount:50000};
const draft=renderEmail({kind:'invoice',business,account,invoice,url:'https://booking.logtraq.co.za/invoice.html#token=unit'});
assert(draft.html.includes('&lt;script&gt;'));assert(!draft.html.includes('<script>'));
assert(!emailReady({...account,email_enabled:false},env));
let job={id:'job-unit',lease_token:'lease-unit',business_id:business.id,invoice_id:invoice.id,payment_id:payment.id,kind:'receipt',attempts:1,payload:null};
let active=true,finished=[],payloads=[],networkCalls=0;
const db=async(path,body)=>{
 if(path==='rpc/finance_claim_email'){if(!active)return null;active=false;return {...job};}
 if(path.startsWith('finance_payments?'))return [payment];
 if(path.startsWith('finance_invoices?'))return [invoice];
 if(path==='rpc/finance_store_mail_payload'){job.payload=body.p_payload;return job.payload;}
 if(path==='rpc/finance_finish_email'){finished.push(body);return true;}
 throw Error('Unexpected database call');
};
const fetcher=async(url,options)=>{networkCalls++;payloads.push({headers:options.headers,body:options.body});if(networkCalls===1)throw Error('Private uncertain network failure');return new Response(JSON.stringify({id:'provider-unit-id'}),{status:200});};
let result=await dispatchEmails({db,env,fetcher,account,business,makeLink:async()=> 'https://booking.logtraq.co.za/invoice.html#token=unit'});
assert.equal(result.sent,0);assert.equal(finished.at(-1).p_status,'failed');
active=true;job.attempts=2;job.lease_token='lease-retry';
result=await dispatchEmails({db,env,fetcher,account,business,makeLink:async()=>{throw Error('Frozen payload must not change');}});
assert.equal(result.sent,1);assert.equal(finished.at(-1).p_status,'sent');
assert.equal(payloads[0].body,payloads[1].body);assert.equal(payloads[0].headers['Idempotency-Key'],payloads[1].headers['Idempotency-Key']);
assert.match(JSON.parse(payloads[1].body).text,/500/);assert(!JSON.parse(payloads[1].body).text.includes('booking confirmed'));
active=true;payment={...payment,status:'reversed'};await dispatchEmails({db,env,fetcher,account,business,makeLink:async()=>''});
assert.equal(networkCalls,2);assert.equal(finished.at(-1).p_status,'manual_review');
result=await dispatchEmails({db:()=>{throw Error('Disabled sender must not claim');},env,fetcher,account:{...account,email_enabled:false},business});
assert.equal(result.ready,false);
console.log('PASS email delivery: real-value templates/escaping, verified-payment-only receipts, frozen message/idempotency across uncertain retries, reversal guard and disabled-sender no-op.');
