import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
const base=new URL('../public/abogados/',import.meta.url);
test('returning browsers receive content-versioned contact and measurement dependencies',()=>{
 const versions=JSON.parse(readFileSync(new URL('asset-versions.json',base),'utf8'));
 for(const file of readdirSync(base).filter(n=>n.endsWith('.html'))){
  const $=load(readFileSync(new URL(file,base),'utf8'));
  const scripts=$('script[src]').map((_,el)=>$(el).attr('src').split('?')[0]).get();
  if(scripts.includes('contact.js'))assert.ok(scripts.indexOf('asset-versions.js')<scripts.indexOf('configuration.js'));
  $('script[src],link[rel="stylesheet"]').each((_,el)=>{
   const source=$(el).attr('src')||$(el).attr('href');if(/^(?:https?:)?\/\//.test(source))return;
   const [name,query]=source.split('?');assert.ok(versions[name],file+': '+name);
   const actual=createHash('sha256').update(readFileSync(new URL(name,base),'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,16);
   assert.equal(new URLSearchParams(query).get('v'),actual,file+': stale '+name);
  });
 }
});
