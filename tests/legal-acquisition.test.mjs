import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { chapters, scripts, profiles, evidence } from '../app/legal-acquisition-content.ts';
import { defaultContext, fillText, pendingFields, readSavedContext, readSavedProgress, clientEconomics, buildDossier, matchingScripts } from '../app/legal-acquisition-model.ts';

test('personalization changes specialty and keeps missing facts visible', () => {
 const context = {...defaultContext,profile:'herencias',zona:'Valencia',despacho:'Ejemplo & Asociados'};
 const result = fillText('{{despacho}} · {{especialidad}} · {{zona}} · {{nombre}}',context);
 assert.equal(result,'Ejemplo & Asociados · Herencias · Valencia · [Nombre de quien decide]');
 assert.equal(pendingFields(result).length,1);
 assert.match(fillText('{{tituloCliente}}',context),/herencia/);
 assert.doesNotMatch(fillText('{{tituloCliente}}',context),/Segunda Oportunidad/);
});
test('malformed saved data does not introduce invalid profiles or progress', () => {
 assert.deepEqual(readSavedContext(null),defaultContext);
 assert.deepEqual(readSavedContext({profile:'bogus',zona:123}),defaultContext);
 assert.equal(readSavedContext({observacion:'x'.repeat(2000)}).observacion.length,1500);
 assert.deepEqual(readSavedProgress(['llamadas','fake','llamadas',{},'control']),['llamadas','control']);
});
test('complete manual includes all scripts and substitutes every profile', () => {
 assert.equal(new Set(scripts.map(s=>s.id)).size,scripts.length);
 for(const chapter of chapters)assert.ok(scripts.some(s=>s.chapter===chapter.id)||chapter.id==='prospectos');
 for(const profile of profiles){
  const text=buildDossier({...defaultContext,profile:profile.id});
  assert.doesNotMatch(text,/\{\{/);
  for(const script of scripts)assert.ok(text.includes(script.title));
  assert.ok(text.includes(profile.consumerTitle));
 }
});
test('client economics includes management and setup, and rounds cases up', () => {
 const input={ticket:2500,margin:40,close:20,media:1200,setup:300,tools:100,share:50};
 const result=clientEconomics(input);
 assert.equal(result.cost,2000);assert.equal(result.contribution,1000);assert.equal(result.breakEvenCases,2);
 assert.equal(result.maxCac,500);assert.equal(result.maxValidQuery,100);assert.equal(result.feeGross,484);
 assert.equal(clientEconomics({...input,media:1201}).breakEvenCases,3);
 for(const change of [{close:0},{ticket:NaN},{margin:101},{setup:-1},{share:0}])assert.equal(clientEconomics({...input,...change}),null);
});
test('search supports accents and narrowing by stage', () => {
 assert.ok(matchingScripts('garantia').some(s=>s.id==='objecion-garantia'));
 assert.ok(matchingScripts('correo','seguimiento').every(s=>s.chapter==='seguimiento'));
 assert.equal(matchingScripts('a phrase absent from corpus').length,0);
});
test('competitor references and images are backed by shipped resources', () => {
 const companies=JSON.parse(readFileSync(new URL('../public/data/companies-index.json',import.meta.url),'utf8'));
 for(const item of evidence)assert.ok(companies.some(c=>c.id===item.company),item.company);
 for(const file of ['creativo-seguimiento.png','creativo-recorrido.png'])assert.ok(existsSync(new URL(`../public/abogados/${file}`,import.meta.url)));
});
test('base management price matches the panel instead of bundling infrastructure', () => {
 const data=JSON.parse(readFileSync(new URL('../public/data/nichos/legal.json',import.meta.url),'utf8'));
 assert.match(JSON.stringify(data),/400/);
 const proposal=scripts.find(s=>s.id==='propuesta-completa').text;
 assert.match(proposal,/No está incluido por defecto/);
 assert.match(proposal,/Sistema RedVitalia: desde 400 € netos\/mes/);
});
