import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import sharp from 'sharp';
import {load} from 'cheerio';
import {approaches,pmax,platforms} from '../scripts/legal-system-campaigns.mjs';
const base=new URL('../public/abogados/',import.meta.url);
test('lawyer campaign copy meets platform limits and all 30 exports have exact dimensions',async()=>{
 assert.equal(approaches.length,5);
 for(const a of approaches){
  for(const key of ['primary_texts','headlines','descriptions'])assert.equal(a[key].length,5);
  for(const text of a.headlines)assert.ok(text.length<=40,`${a.id}: ${text}`);
  for(const text of a.descriptions)assert.ok(text.length<=30,`${a.id}: ${text}`);
  for(const text of a.primary_texts){assert.match(text,/abogados/i);assert.match(text,/Sistema RedVitalia desde 400/);assert.match(text,/publicitaria aparte/);}
 }
 for(const [values,max] of [[pmax.headlines,30],[pmax.longHeadlines,90],[pmax.descriptions,90]])for(const t of values){assert.ok(t.length<=max,t);assert.match(t,/abogados/i);}
 assert.ok(pmax.headlines.some(t=>t.length<=15));
 for(const t of pmax.descriptions){assert.match(t,/Sistema RedVitalia desde 400/);assert.match(t,/(Publicidad|Medios) aparte/);}
 for(const s of pmax.sitelinks){assert.ok(s.text.length<=25);assert.ok(s.line1.length<=35);assert.ok(s.line2.length<=35);}
 const assets=JSON.parse(readFileSync(new URL('ads/assets.json',base),'utf8'));
 assert.equal(assets.length,30);assert.equal(new Set(assets.map(a=>a.file)).size,30);
 for(const a of assets){const file=new URL('ads/'+a.file,base),meta=await sharp(readFileSync(file)).metadata(),[w,h]=platforms[a.platform].formats[a.format];assert.equal(meta.width,w);assert.equal(meta.height,h);assert.ok(statSync(file).size<5*1024*1024);assert.ok(existsSync(new URL('ads/'+a.preview,base)));const url=new URL(a.destination);assert.equal(url.pathname,'/abogados/redvitalia.html');assert.equal(url.searchParams.get('utm_campaign'),'sistema_redvitalia_abogados');assert.equal(url.searchParams.get('utm_content'),`${a.id.toLowerCase()}_${a.platform}_${a.format}`);}
});
test('every local download and page link exists, and embedded copy works offline',()=>{
 for(const page of ['index','redvitalia','segunda-oportunidad','herencias','divorcios','manual','anuncios','medicion','privacidad']){
  const $=load(readFileSync(new URL(page+'.html',base),'utf8'));
  $('a[href]').each((_,a)=>{const href=$(a).attr('href');if(!href||/^(?:[a-z]+:|\/|#)/i.test(href))return;assert.ok(existsSync(new URL(href.split('#')[0],base)),`${page}: ${href}`);});
 }
 const $=load(readFileSync(new URL('anuncios.html',base),'utf8'));assert.equal(JSON.parse($('#rv-ad-copy-data').text()).length,5);
});
