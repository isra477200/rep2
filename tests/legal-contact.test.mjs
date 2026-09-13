import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLegalContact,legalContactWebhook,receiveLegalContact} from '../app/legal-contact-server.ts';
import {readSavedContext} from '../app/legal-acquisition-model.ts';
const sample={name:'Prueba local',company:'Firma de prueba',phone:'+34919935237',channel:'phone',consent:true,source_page:'redvitalia',campaign:'e1_feed',request_id:'00000000-0000-4000-8000-000000000001',website:''};
const request=(body=sample,headers={})=>new Request('https://redvitalia.srv1480016.hstgr.cloud/api/legal-contact',{method:'POST',headers:{origin:'https://redvitalia.srv1480016.hstgr.cloud','content-type':'application/json','x-real-ip':crypto.randomUUID(),...headers},body:JSON.stringify(body)});
const url='https://services.leadconnectorhq.com/hooks/test-only';
test('contact validation requires consent, a real phone shape, company and supported channel',()=>{
 assert.equal(parseLegalContact(sample).phone,'+34919935237');
 for(const fields of [{consent:false},{phone:'123'},{name:' '},{company:''},{channel:'email'},{website:'bot'}])assert.equal(parseLegalContact({...sample,...fields}),null);
 assert.equal(parseLegalContact({...sample,source_page:'https://x/?name=private',campaign:'phone_919935237'}).campaign,'direct');
 for(const campaign of ['e1_meta_feed','e2_meta_story','e3_pmax_wide','e5_pmax_portrait','pmax_campaign','meta_campaign'])assert.equal(parseLegalContact({...sample,campaign}).campaign,campaign);
 assert.equal(legalContactWebhook('http://services.leadconnectorhq.com/hooks/x'),null);
 assert.equal(legalContactWebhook('https://services.leadconnectorhq.com.evil.test/hooks/x'),null);
 assert.equal(legalContactWebhook('https://services.leadconnectorhq.com/contacts/'),null);
});
test('missing configuration and failed delivery never report a received lead',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Response('',{status:500});};
 assert.equal((await receiveLegalContact(request(),{webhook:'',fetcher})).status,503);
 assert.equal(calls,0);
 const failed=await receiveLegalContact(request(),{webhook:url,fetcher});assert.equal(failed.status,502);assert.equal((await failed.json()).accepted,false);
});
test('accepted requests map to GHL correctly and repeat IDs do not cause another delivery',async()=>{
 let count=0,payload;
 const fetcher=async(_url,options)=>{count++;payload=JSON.parse(options.body);return new Response('{}',{status:200});};
 const first=await receiveLegalContact(request(),{webhook:url,fetcher});assert.equal((await first.json()).accepted,true);
 assert.equal(payload.companyName,sample.company);assert.equal(payload.phone,sample.phone);assert.deepEqual(payload.tags,['redvitalia-abogados','canal-phone']);assert.equal(payload.source_page,'redvitalia');
 const again=await receiveLegalContact(request(),{webhook:url,fetcher});assert.equal((await again.json()).accepted,true);assert.equal(count,1);
 const conflict=await receiveLegalContact(request({...sample,company:'Otra empresa'}),{webhook:url,fetcher});assert.equal(conflict.status,409);assert.equal(count,1);
});
test('foreign origins and oversized requests are rejected without forwarding',async()=>{
 const fetcher=()=>{throw Error('must not forward');};
 assert.equal((await receiveLegalContact(request(sample,{origin:'https://other.example'}),{webhook:url,fetcher})).status,403);
 assert.equal((await receiveLegalContact(request({...sample,name:'x'.repeat(6000)}),{webhook:url,fetcher})).status,413);
});
test('legacy local customization migrates only the retired RedVitalia phone',()=>{
 assert.equal(readSavedContext({contacto:'WhatsApp: +34 637 371 993'}).contacto,'WhatsApp: +34 919 935 237');
 assert.equal(readSavedContext({contacto:'Otra persona: +34 600 000 000'}).contacto,'Otra persona: +34 600 000 000');
 assert.equal(readSavedContext({nombre:'Ana',zona:'Madrid'}).nombre,'Ana');
});
