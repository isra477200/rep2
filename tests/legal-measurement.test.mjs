import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const base=new URL('../public/abogados/',import.meta.url);
function harness(id='',search='?utm_content=e2_feed&name=PRIVATE&phone=919935237',ga4Id=''){
 const scripts=[],handlers={},nodes={};
 function node(){return {hidden:true,dataset:{},setAttribute(){},addEventListener:(e,fn)=>{},focus(){},querySelector(selector){return nodes[selector]??=( {focus(){},addEventListener:(event,fn)=>{handlers[selector+event]=fn;}});}};}
 const panel=node();const document={cookie:'',createElement:tag=>tag==='section'?panel:{},body:{appendChild(){}},head:{appendChild:s=>scripts.push(s)},addEventListener:(e,fn)=>handlers[e]=fn,dispatchEvent(){},querySelector:()=>null};
 const values=new Map();const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const window={REDVITALIA_CONFIG:{gtmId:id,ga4Id}};const location={pathname:'/abogados/redvitalia.html',search,origin:'https://redvitalia.srv1480016.hstgr.cloud',hostname:'redvitalia.srv1480016.hstgr.cloud'};
 const context={window,document,location,localStorage,URLSearchParams,Date,Event};
 vm.runInNewContext(readFileSync(new URL('measurement.js',base),'utf8'),context);
 return {window,scripts,handlers,panel,context};
}

test('direct GA4 queues the first event, sends it once, and respects withdrawal',()=>{
 const h=harness('','?phone=PRIVATE','G-QRQEMYM8NH');
 assert.equal(h.scripts.length,0);h.handlers['[data-consent="yes"]click']();
 assert.equal(h.scripts.length,1);assert.equal(h.scripts[0].src,'/abogados/ga4.js?v=native-20260913');
 vm.runInNewContext(readFileSync(new URL('ga4.js',base),'utf8'),h.context);
 assert.equal(h.window.dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);
 h.window.RedVitaliaMetrics.track('generate_lead',{contact_channel:'whatsapp',phone:'PRIVATE'});
 assert.equal(h.window.dataLayer.filter(x=>x[0]==='event'&&x[1]==='generate_lead').length,1);
 assert.ok(!JSON.stringify(h.window.dataLayer).includes('PRIVATE'));
 h.handlers['[data-consent="no"]click']();h.window.RedVitaliaMetrics.track('generate_lead');
 assert.equal(h.window.dataLayer.filter(x=>x[0]==='event'&&x[1]==='generate_lead').length,1);
 h.handlers['[data-consent="yes"]click']();assert.equal(h.window.dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);
});
test('tracking loads nothing before acceptance and never passes personal fields',()=>{
 const h=harness('GTM-TEST123');assert.equal(h.scripts.length,0);assert.equal(h.panel.hidden,false);
 h.window.RedVitaliaMetrics.track('generate_lead',{phone:'SECRET'});assert.equal(h.window.dataLayer.length,0);
 h.handlers['[data-consent="yes"]click']();assert.equal(h.scripts.length,1);assert.match(h.scripts[0].src,/GTM-TEST123$/);
 h.window.RedVitaliaMetrics.track('generate_lead',{phone:'SECRET',name:'SECRET',company:'SECRET',contact_channel:'phone',asset_id:'SECRET'});
 const events=h.window.dataLayer.filter(x=>x.event==='rv_generate_lead');assert.equal(events.length,1);assert.equal(events[0].event_data.contact_channel,'phone');assert.equal(events[0].event_data.campaign,'e2_feed');assert.ok(!JSON.stringify(h.window.dataLayer).includes('SECRET'));assert.ok(!JSON.stringify(h.window.dataLayer).includes('919935237'));
 const before=h.window.dataLayer.length;h.handlers['[data-consent="no"]click']();h.window.RedVitaliaMetrics.track('contact_phone_click');assert.equal(h.window.dataLayer.length,before);
});
test('unconfigured IDs never request GTM even after accepting',()=>{const h=harness();h.handlers['[data-consent="yes"]click']();assert.equal(h.scripts.length,0);});
test('the shared PMax destination is attributed to the campaign without inventing an image',()=>{const h=harness('','?utm_source=google&utm_medium=cpc&utm_campaign=sistema_redvitalia_abogados');assert.equal(h.window.RedVitaliaMetrics.campaign,'pmax_campaign');const invalid=harness('','?utm_source=google&utm_medium=unknown&utm_campaign=sistema_redvitalia_abogados');assert.equal(invalid.window.RedVitaliaMetrics.campaign,'direct');});
test('configured GA4 sends one explicit event with cleaned URLs and consent controls',()=>{
 const c=JSON.parse(readFileSync(new URL('measurement/RedVitalia-GTM.json',base),'utf8')).containerVersion;
 const init=c.tag[0].parameter.find(x=>x.key==='html').value.replace(/<\/?script>/g,'').replace('{{RV · GA4 ID}}','G-TEST1234');
 const scripts=[];const window={RedVitaliaMetrics:{consent:true,pageId:'redvitalia'}};
 const location={origin:'https://redvitalia.srv1480016.hstgr.cloud',hostname:'redvitalia.srv1480016.hstgr.cloud',search:'?name=PRIVATE'};
 vm.runInNewContext(init,{window,location,Date,URLSearchParams,document:{createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}}});
 assert.equal(scripts.length,1);const config=Array.from(window.dataLayer.find(args=>args[0]==='config'));assert.equal(config[2].send_page_view,false);
 window.rvSendGA4('generate_lead',{name:'PRIVATE',phone:'PRIVATE',contact_channel:'phone'});
 const events=window.dataLayer.filter(args=>args[0]==='event');assert.equal(events.length,1);assert.equal(events[0][2].contact_channel,'phone');assert.ok(!JSON.stringify(window.dataLayer).includes('PRIVATE'));
 window.RedVitaliaMetrics.consent=false;window.rvGA4Consent(false);window.rvSendGA4('generate_lead',{});assert.equal(window.dataLayer.filter(args=>args[0]==='event').length,1);assert.equal(window['ga-disable-G-TEST1234'],true);
});
test('container imports a closed event set, all references resolve and empty GA4 fails closed',()=>{
 const json=JSON.parse(readFileSync(new URL('measurement/RedVitalia-GTM.json',base),'utf8'));assert.equal(json.exportFormatVersion,2);
 const c=json.containerVersion;assert.equal(c.tag.length,11);assert.equal(c.trigger.length,11);const triggerIds=new Set(c.trigger.map(x=>x.triggerId));
 for(const tag of c.tag){assert.ok(tag.firingTriggerId.every(x=>triggerIds.has(x)));assert.equal(tag.type,'html');}
 const init=c.tag[0].parameter.find(x=>x.key==='html').value.replace(/<\/?script>/g,'').replace('{{RV · GA4 ID}}','G-REPLACE_ME');
 const window={RedVitaliaMetrics:{consent:true}};vm.runInNewContext(init,{window});assert.equal(window.rvSendGA4,undefined);
});
test('paid campaign attribution keeps only known non-personal URL values',()=>{
 const c=JSON.parse(readFileSync(new URL('measurement/RedVitalia-GTM.json',base),'utf8')).containerVersion;
 const init=c.tag[0].parameter.find(x=>x.key==='html').value.replace(/<\/?script>/g,'').replace('{{RV · GA4 ID}}','G-TEST1234');
 for(const source of ['meta','google']){
  const medium=source==='meta'?'paid_social':'cpc',content=source==='meta'?'e3_meta_story':'e3_pmax_wide';
  const window={RedVitaliaMetrics:{consent:true,pageId:'redvitalia'}};
  const location={origin:'https://example.com',hostname:'example.com',search:`?utm_source=${source}&utm_medium=${medium}&utm_campaign=sistema_redvitalia_abogados&utm_content=${content}&phone=SECRET&gclid=SECRET`};
  vm.runInNewContext(init,{window,location,Date,URLSearchParams,document:{createElement:()=>({}),head:{appendChild(){}}}});
  window.rvSendGA4('generate_lead',{});
  const event=window.dataLayer.find(args=>args[0]==='event');assert.match(event[2].page_location,new RegExp(`utm_content=${content}`));assert.ok(!JSON.stringify(window.dataLayer).includes('SECRET'));
 }
});
