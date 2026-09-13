import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Exercises the real contact.js callbacks. The native bridge is a controlled seam;
// no network, provider fields, storage of personal data or full browser DOM is used.
const path=new URL('../public/abogados/contact.js',import.meta.url);
function harness(){
 const elements=[],timers=[],events=[];let callbacks;
 function element(tag='div'){
  const e={tag,id:'',hidden:false,dataset:{},style:{},innerHTML:'',textContent:'',children:[],nodes:new Map(),listeners:new Map(),attrs:new Map(),
   setAttribute(k,v){this.attrs.set(k,String(v));if(k==='hidden')this.hidden=true;},removeAttribute(k){this.attrs.delete(k);if(k==='hidden')this.hidden=false;},getAttribute(k){return this.attrs.get(k)??null;},
   hasAttribute(k){return this.attrs.has(k);},focus(){},contains(){return false;},appendChild(n){this.children.push(n);return n;},
   addEventListener(k,fn){this.listeners.set(k,fn);},click(){this.listeners.get('click')?.({target:this,preventDefault(){}});},
   querySelectorAll(s){if(s==='[data-channel]')return ['whatsapp','phone'].map(c=>this.querySelector('[data-channel="'+c+'"]'));return [];},
   querySelector(s){if(!this.nodes.has(s)){const n=element();const channel=s.match(/^\[data-channel="(phone|whatsapp)"\]$/);if(channel)n.dataset.channel=channel[1];this.nodes.set(s,n);}return this.nodes.get(s);}
  };elements.push(e);return e;
 }
 const inline=element(),document={
  getElementById:id=>elements.find(e=>e.id===id)||null,
  createElement:element,body:{appendChild(){}},
  querySelectorAll:s=>s==='[data-rv-inline]'?[inline]:[],addEventListener(){},dispatchEvent(){}
 };
 const window={REDVITALIA_CONFIG:{phone:'34919935237',displayPhone:'919 935 237',contactName:'Nidia Guerrero',ghlForms:{phone:'cxXcdVJAXp9MBbRpm29d',whatsapp:'XMLHrXNBUMUlHOsFUvJH'}},
  RedVitaliaMetrics:{consent:false,hasResponded:true,track:(...args)=>events.push(args)},
  RedVitaliaNativeBridge:{create(options){callbacks=options;return {refreshConsent(){},register(frame,{channel}){frame.id='rv-test-'+elements.indexOf(frame);frame.src='https://api.leadconnectorhq.com/widget/form/'+channel;}};}}
 };
 // Expose only the contact entry list to select channels through the real handlers.
 const source=readFileSync(path,'utf8').replace(/\}\)\(\);\s*$/, 'window.__contactTest={instances};})();');
 vm.runInNewContext(source,{window,document,URLSearchParams,Date,Event,CustomEvent:Event,
  location:{search:'',protocol:'https:',href:'https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html'},
  setTimeout:fn=>timers.push(fn),sessionStorage:{setItem(){throw Error('not used by ready/timeout');}},crypto:{randomUUID:()=> 'test'}});
 const entry=window.__contactTest.instances.find(e=>e.slot===inline);assert.ok(entry);
 const choose=channel=>inline.querySelector('[data-channel="'+channel+'"]').click();
 return {entry,choose,ready:frame=>callbacks.onReady({frameId:frame.id}),timers,events,loading:inline.querySelector('[data-native-loading]')};
}

test('no provider form loads before an explicit channel choice, and the first choice is measured once',()=>{
 const h=harness();assert.equal(h.entry.channel,null);assert.equal(Object.keys(h.entry.frames).length,0);assert.equal(h.events.length,0);
 h.choose('phone');assert.equal(Object.keys(h.entry.frames).length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(h.events)),[['contact_channel_select',{contact_channel:'phone'}]]);
});

test('switching back reuses the same native form and preserves its ready state',()=>{
 const h=harness();h.choose('whatsapp');const original=h.entry.frames.whatsapp;h.ready(original);
 h.choose('phone');h.choose('whatsapp');
 assert.equal(h.entry.current,original);assert.equal(original.hidden,false);assert.equal(h.loading.hidden,true);
 assert.equal(Object.keys(h.entry.frames).length,2);
});

test('timeout from an inactive channel cannot replace a successfully loaded current form',()=>{
 const h=harness();h.choose('whatsapp');const previous=h.entry.frames.whatsapp;
 h.choose('phone');const current=h.entry.frames.phone;assert.ok(previous&&current);
 h.ready(current);assert.equal(h.loading.hidden,true);
 for(const callback of h.timers)callback();
 assert.equal(current.hidden,false,'current ready form remains visible');
 assert.equal(h.loading.hidden,true,'inactive timer must not show a loading/failure notice');
 assert.equal(h.events.some(([name])=>name==='generate_lead'),false);
});

test('ready from an inactive channel cannot hide the loading notice of the current form',()=>{
 const h=harness();h.choose('whatsapp');const previous=h.entry.frames.whatsapp;
 h.choose('phone');const current=h.entry.frames.phone;
 // The active provider request is still pending at this point.
 h.loading.hidden=false;h.ready(previous);
 assert.equal(previous.hidden,true,'ready response does not reveal an inactive form');
 assert.equal(h.loading.hidden,false,'current request remains visibly pending');
 h.ready(current);assert.equal(current.hidden,false);assert.equal(h.loading.hidden,true);
 assert.equal(h.events.some(([name])=>name==='generate_lead'),false);
});
