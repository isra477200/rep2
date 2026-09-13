import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const base=new URL('../public/abogados/',import.meta.url),code=name=>readFileSync(new URL(name,base),'utf8');
const key='redvitalia.contact-receipt.v1',now=1789400000000,id='00000000-0000-4000-8000-000000000001';
class Clock extends Date{static now(){return now;}}
const plain=value=>JSON.parse(JSON.stringify(value));
const fresh=changes=>({id,channel:'whatsapp',at:now,analyticsEligible:true,...changes});

function storage(receipt,{readFails=false,writeFails=false}={}){
 const values=new Map(),writes=[];
 if(receipt!==undefined)values.set(key,typeof receipt==='string'?receipt:JSON.stringify(receipt));
 return {values,writes,getItem(k){if(readFails)throw Error('Storage read unavailable');return values.get(k)??null;},
  setItem(k,v){if(writeFails)throw Error('Storage write unavailable');writes.push([k,v]);values.set(k,v);},removeItem(k){values.delete(k);}};
}
function dom(){
 const heading={innerHTML:'Continuamos'},message={textContent:'Hablemos'},handlers=new Map(),scripts=[];
 const element=(href='')=>({href,hidden:true,dataset:{},innerHTML:'',textContent:'',nodes:new Map(),listeners:new Map(),
  removeAttribute(name){delete this[name];},setAttribute(name,value){this[name]=value;},getAttribute(name){return this[name]??null;},focus(){},
  addEventListener(name,fn){this.listeners.set(name,fn);},click(){this.listeners.get('click')?.();},
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,element());return this.nodes.get(selector);}});
 const contact=element('https://wa.me/34919935237'),alternative=element('tel:+34919935237'),panel=element();
 const document={cookie:'',createElement:tag=>tag==='section'?panel:element(),body:{appendChild(){}},head:{appendChild:s=>scripts.push(s)},
  getElementById:name=>name==='receipt-contact'?contact:name==='receipt-alternative'?alternative:message,
  querySelector:selector=>selector==='h1'?heading:null,
  addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},
  dispatchEvent(event){for(const fn of handlers.get(event.type)||[])fn(event);}};
 return {heading,message,contact,alternative,panel,document,scripts,handlers};
}
function render(saved,{channel='whatsapp',consent=true,metricsPresent=true,integrated=false,ga4First=false,extraSearch=''}={}){
 const d=dom(),events=[],markedWhenTracked=[],window={REDVITALIA_CONFIG:{gtmId:'',ga4Id:'G-QRQEMYM8NH'}};
 if(metricsPresent)window.RedVitaliaMetrics={consent,track:(...args)=>{events.push(args);markedWhenTracked.push(JSON.parse(saved.getItem(key)||'null')?.metricsSent===true);}};
 const location={search:'?canal='+channel+extraSearch,pathname:'/abogados/gracias.html',origin:'https://redvitalia.srv1480016.hstgr.cloud',hostname:'redvitalia.srv1480016.hstgr.cloud',protocol:'https:'};
 const localValues=new Map([['redvitalia.analytics-consent.v2',JSON.stringify({value:consent,at:now})]]);
 const localStorage={getItem:k=>localValues.get(k)||null,setItem:(k,v)=>localValues.set(k,v)};
 const context=vm.createContext({window,document:d.document,location,sessionStorage:saved,localStorage,URLSearchParams,Date:Clock,Event});
 if(integrated){vm.runInContext(code('measurement.js'),context);if(ga4First)vm.runInContext(code('ga4.js'),context);}
 vm.runInContext(code('receipt.js'),context);
 return {...d,window,context,events,markedWhenTracked,loadGA4(){vm.runInContext(code('ga4.js'),context);},
  queuedLeads:()=>window.dataLayer?.filter(x=>x.event==='rv_generate_lead')||[],
  ga4Leads:()=>window.dataLayer?.filter(x=>x[0]==='event'&&x[1]==='generate_lead')||[]};
}
function acknowledgment(saved,consent=true){
 let onAck;const events=[],stop=new Error('Stop after capturing the native bridge callback');
 const node={setAttribute(){},querySelector(){return {};}};
 const window={REDVITALIA_CONFIG:{ghlForms:{}},RedVitaliaMetrics:{consent,track:(...args)=>events.push(args)},
  RedVitaliaNativeBridge:{create(options){onAck=options.onAck;throw stop;}}};
 try{vm.runInNewContext(code('contact.js'),{window,document:{getElementById:()=>null,createElement:()=>node,body:{appendChild(){}}},
  location:{protocol:'https:',href:'https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html',search:''},
  sessionStorage:saved,crypto:{randomUUID:()=>id},Date:Clock,URLSearchParams});}catch(error){if(error!==stop)throw error;}
 assert.equal(typeof onAck,'function');
 onAck({channel:'whatsapp',fingerprint:'PRIVATE',name:'PRIVATE',phone:'PRIVATE'});
 return events;
}

test('native acknowledgment persists a non-personal receipt and defers conversion until thank-you',()=>{
 const saved=storage(),events=acknowledgment(saved);
 assert.equal(events.length,0);assert.deepEqual(JSON.parse(saved.getItem(key)),fresh());
 assert.ok(!JSON.stringify(saved.writes).includes('PRIVATE'));
});
test('native acknowledgment snapshots analytics eligibility instead of obtaining it later',()=>{
 const saved=storage();acknowledgment(saved,false);
 assert.equal(JSON.parse(saved.getItem(key)).analyticsEligible,false);
 const thankYou=render(saved,{consent:true});assert.match(thankYou.heading.innerHTML,/Solicitud recibida/);assert.equal(thankYou.events.length,0);
});
test('acknowledgment retains a single fallback attempt when receipt storage fails',()=>{
 const events=acknowledgment(storage(undefined,{writeFails:true}));
 assert.deepEqual(plain(events),[['generate_lead',{contact_channel:'whatsapp'}]]);
});
test('verified eligible receipt is marked consumed BEFORE its one conversion',()=>{
 const saved=storage(fresh()),r=render(saved);
 assert.match(r.heading.innerHTML,/Solicitud recibida/);
 assert.deepEqual(plain(r.events),[['generate_lead',{contact_channel:'whatsapp'}]]);
 assert.deepEqual(r.markedWhenTracked,[true]);assert.equal(JSON.parse(saved.getItem(key)).metricsSent,true);
});
test('reloads and a second script execution do not send the same receipt again',()=>{
 const saved=storage(fresh()),first=render(saved);vm.runInContext(code('receipt.js'),first.context);
 const reload=render(saved);assert.equal(first.events.filter(e=>e[0]==='generate_lead').length,1);
 assert.equal(reload.events.filter(e=>e[0]==='generate_lead').length,0);assert.match(reload.heading.innerHTML,/Solicitud recibida/);
});
test('a later independently acknowledged submission may generate its own conversion',()=>{
 const saved=storage(fresh());render(saved);saved.setItem(key,JSON.stringify(fresh({id:'00000000-0000-4000-8000-000000000002'})));
 const next=render(saved),reload=render(saved);assert.equal(next.events.filter(e=>e[0]==='generate_lead').length,1);
 assert.equal(reload.events.filter(e=>e[0]==='generate_lead').length,0);
});
test('direct, malformed, expired, future and wrong-channel visits neither claim receipt nor count leads',()=>{
 const invalid=[undefined,'{broken',[],fresh({at:now-900000}),fresh({at:now+1}),fresh({at:String(now)}),fresh({at:null}),fresh({id:''}),fresh({channel:'phone'})];
 for(const receipt of invalid){const r=render(storage(receipt));assert.equal(r.heading.innerHTML,'Continuamos',JSON.stringify(receipt));assert.equal(r.events.length,0);}
 for(const channel of ['email','',null]){const r=render(storage(fresh({channel})),{channel});assert.equal(r.heading.innerHTML,'Continuamos');assert.equal(r.events.length,0);}
});
test('a receipt immediately inside the fifteen-minute boundary remains valid',()=>{
 const r=render(storage(fresh({at:now-899999})));assert.match(r.heading.innerHTML,/Solicitud recibida/);
 assert.equal(r.events.filter(e=>e[0]==='generate_lead').length,1);
});
test('both original and current analytics consent must explicitly permit measurement',()=>{
 for(const eligibility of [false,undefined,'true']){const r=render(storage(fresh({analyticsEligible:eligibility})),{consent:true});
  assert.match(r.heading.innerHTML,/Solicitud recibida/);assert.equal(r.events.length,0);}
 const saved=storage(fresh()),r=render(saved,{consent:false});assert.match(r.heading.innerHTML,/Solicitud recibida/);
 assert.equal(r.events.length,0);assert.notEqual(JSON.parse(saved.getItem(key)).metricsSent,true);
});
test('missing measurement API never consumes an otherwise valid receipt',()=>{
 const saved=storage(fresh()),r=render(saved,{metricsPresent:false});assert.match(r.heading.innerHTML,/Solicitud recibida/);
 assert.notEqual(JSON.parse(saved.getItem(key)).metricsSent,true);assert.equal(render(saved).events.filter(e=>e[0]==='generate_lead').length,1);
});
test('failed reads or failed consumption writes cannot produce repeatable conversions',()=>{
 const unreadable=render(storage(fresh(),{readFails:true}));assert.equal(unreadable.events.length,0);
 const saved=storage(fresh(),{writeFails:true});assert.equal(render(saved).events.length,0);assert.equal(render(saved).events.length,0);
});
test('both receipt links measure their actual channel without becoming another lead',()=>{
 const r=render(storage(),{channel:'phone'});r.contact.click();r.alternative.click();
 assert.deepEqual(r.events.map(e=>e[0]),['contact_phone_click','contact_whatsapp_click']);
 assert.equal(r.contact.href,'tel:+34919935237');assert.equal(r.alternative.href,'https://wa.me/34919935237');
});
for(const ga4First of [false,true])test('thank-you lead survives '+(ga4First?'an already loaded GA4 sender':'asynchronous GA4 loading')+' once and without personal data',()=>{
 const saved=storage(fresh()),r=render(saved,{integrated:true,ga4First,
  extraSearch:'&utm_source=meta&utm_medium=paid_social&utm_campaign=sistema_redvitalia_abogados&utm_content=e1_meta_feed&phone=PRIVATE&email=PRIVATE&gclid=PRIVATE'});
 assert.equal(r.queuedLeads().length,1);if(!ga4First){assert.equal(r.ga4Leads().length,0);r.loadGA4();}assert.equal(r.ga4Leads().length,1);
 const sent=r.ga4Leads()[0][2];assert.equal(sent.page_id,'gracias');assert.equal(sent.contact_channel,'whatsapp');
 assert.equal(sent.campaign,'e1_meta_feed');assert.equal(sent.page_referrer,'');
 assert.ok(!JSON.stringify(r.window.dataLayer).includes('PRIVATE'));assert.ok(!JSON.stringify(r.window.dataLayer).includes(id),'receipt nonce stays out of Analytics');
 const reload=render(saved,{integrated:true});reload.loadGA4();assert.equal(reload.ga4Leads().length,0);
});
test('withdrawal before asynchronous GA4 arrives suppresses the queued conversion',()=>{
 const saved=storage(fresh()),r=render(saved,{integrated:true});assert.equal(r.queuedLeads().length,1);
 r.panel.querySelector('[data-consent="no"]').click();r.loadGA4();assert.equal(r.ga4Leads().length,0);assert.equal(r.window.RedVitaliaMetrics.consent,false);
});
