import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/abogados/receipt.js',import.meta.url),'utf8');
function render(receipt,channel='whatsapp'){
 const events=[],heading={innerHTML:'Continuamos'},message={textContent:'Hablemos'};
 const node=href=>({href,removeAttribute(){},getAttribute(){return this.href;},addEventListener(_,fn){this.click=fn;}});
 const contact=node('https://wa.me/34919935237'),alternative=node('tel:+34919935237');
 vm.runInNewContext(source,{URLSearchParams,Date,location:{search:'?canal='+channel},sessionStorage:{getItem(){return receipt===undefined?null:JSON.stringify(receipt);}},document:{getElementById:id=>id==='receipt-contact'?contact:id==='receipt-alternative'?alternative:message,querySelector:()=>heading},window:{RedVitaliaMetrics:{track:(...args)=>events.push(args)}}});
 return {heading,events,contact,alternative};
}
test('direct, expired and wrong-channel visits do not claim receipt or count leads',()=>{
 for(const receipt of [undefined,{id:'a',channel:'whatsapp',at:Date.now()-1000000},{id:'a',channel:'phone',at:Date.now()}]){const r=render(receipt);assert.equal(r.heading.innerHTML,'Continuamos');assert.equal(r.events.length,0);}
});
test('a verified session receipt acknowledges delivery without generating a duplicate lead',()=>{
 const receipt={id:'test-ack',channel:'whatsapp',at:Date.now()};
 for(let i=0;i<2;i++){const r=render(receipt);assert.match(r.heading.innerHTML,/Solicitud recibida/);assert.equal(r.events.length,0);}
});
test('both receipt links track their actual channel, even when it differs from the form',()=>{
 const r=render(undefined,'phone');r.contact.click();r.alternative.click();
 assert.deepEqual(r.events.map(e=>e[0]),['contact_phone_click','contact_whatsapp_click']);
 assert.ok(r.events.every(e=>e[0]!=='generate_lead'));
});
