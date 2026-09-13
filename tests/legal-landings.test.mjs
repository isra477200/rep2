import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
const base=new URL('../public/abogados/',import.meta.url);
const pages=['index','redvitalia','segunda-oportunidad','herencias','divorcios','privacidad','manual','anuncios','medicion'];
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
