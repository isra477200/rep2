import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { load } from 'cheerio';
const base=new URL('../public/abogados/',import.meta.url);
const pages=['index','redvitalia','segunda-oportunidad','herencias','divorcios','privacidad','manual'];
test('every landing ships local resources, unique sections and accessible fields',()=>{
 for(const page of pages){
  const $=load(readFileSync(new URL(page+'.html',base),'utf8'));
  assert.equal($('html').attr('lang'),'es');assert.equal($('h1').length,1);assert.ok($('meta[name="viewport"]').length);
  const ids=$('[id]').map((_,el)=>$(el).attr('id')).get();assert.equal(new Set(ids).size,ids.length);
  $('img,script[src],link[rel="stylesheet"]').each((_,el)=>{const src=$(el).attr('src')||$(el).attr('href');assert.ok(existsSync(new URL(src,base)),`${page}: ${src}`);});
  $('img').each((_,el)=>assert.ok($(el).attr('alt')));
  $('input,select,textarea').each((_,el)=>assert.ok($(el).closest('label').length||$(el).attr('aria-label')));
  $('a[href^="#"]').each((_,el)=>assert.ok(ids.includes($(el).attr('href').slice(1)),`${page}: missing anchor`));
 }
});
test('unassigned law firm models cannot collect personal information',()=>{
 for(const page of pages.slice(2,5)){
  const $=load(readFileSync(new URL(page+'.html',base),'utf8'));
  assert.ok($('.demo-bar').text().includes('No recoge solicitudes'));
  assert.equal($('.demo-form input,.demo-form textarea').length,0);
  assert.equal($('.demo-form select').length,2);
  assert.equal($('meta[name="robots"]').attr('content'),'noindex,nofollow');
 }
});
test('WhatsApp message is encoded and requires a separate visitor action',()=>{
 let submit;let scroll=false;const data={name:'Prueba & Ana',firm:'Firma + Ejemplo',specialty:'Herencias',zone:'A Coruña',need:'Filtrar las consultas'};
 const form={reportValidity:()=>true,addEventListener:(event,fn)=>{if(event==='submit')submit=fn;}};
 const preview={value:''};const link={href:'https://wa.me/34637371993'};const result={hidden:true,scrollIntoView:()=>{scroll=true;}};
 const dom={'#agency-form':form,'#message-preview':preview,'#whatsapp-link':link,'#agency-result':result};
 const context={document:{querySelector:s=>dom[s],querySelectorAll:()=>[]},FormData:class{get(name){return data[name];}},window:{matchMedia:()=>({matches:true})},encodeURIComponent};
 vm.runInNewContext(readFileSync(new URL('landing.js',base),'utf8'),context);
 assert.ok(submit);assert.equal(result.hidden,true);assert.equal(preview.value,'');
 let prevented=false;submit({preventDefault:()=>{prevented=true;}});
 assert.ok(prevented&&scroll);assert.equal(result.hidden,false);
 const url=new URL(link.href);assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/34637371993');
 assert.equal(url.searchParams.get('text'),preview.value);assert.ok(preview.value.includes('Prueba & Ana'));assert.ok(preview.value.includes('Firma + Ejemplo'));
});
