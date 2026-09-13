import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
import {load} from 'cheerio';
import {approaches} from '../scripts/legal-ads-content.mjs';
const base=new URL('../public/abogados/',import.meta.url);
test('all 75 ad texts meet copy limits and all 15 assets have exact dimensions',async()=>{
 assert.equal(approaches.length,5);
 for(const a of approaches){
  for(const key of ['primary_texts','headlines','descriptions'])assert.equal(a[key].length,5);
  for(const text of a.headlines)assert.ok(text.length<=40,`${a.id}: ${text}`);
  for(const text of a.descriptions)assert.ok(text.length<=30,`${a.id}: ${text}`);
 }
 const assets=JSON.parse(readFileSync(new URL('ads/assets.json',base),'utf8'));
 assert.equal(assets.length,15);assert.equal(new Set(assets.map(a=>a.file)).size,15);
 for(const a of assets){const meta=await sharp(readFileSync(new URL('ads/'+a.file,base))).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,{feed:1350,square:1080,story:1920}[a.format]);assert.ok(existsSync(new URL('ads/'+a.preview,base)));}
});
test('every local download and page link exists, and embedded copy works offline',()=>{
 for(const page of ['index','redvitalia','segunda-oportunidad','herencias','divorcios','manual','anuncios','medicion','privacidad']){
  const $=load(readFileSync(new URL(page+'.html',base),'utf8'));
  $('a[href]').each((_,a)=>{const href=$(a).attr('href');if(!href||/^(?:[a-z]+:|\/|#)/i.test(href))return;assert.ok(existsSync(new URL(href.split('#')[0],base)),`${page}: ${href}`);});
 }
 const $=load(readFileSync(new URL('anuncios.html',base),'utf8'));assert.equal(JSON.parse($('#rv-ad-copy-data').text()).length,5);
});
