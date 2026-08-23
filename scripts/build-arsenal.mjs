#!/usr/bin/env node
/**
 * Genera public/data/arsenal.json → munición comercial extraída de la base:
 *  - garantias: banco de garantías reales clasificadas por tipo, con fuerza (1-5)
 *    y coste de cumplir (1-5) estimados por reglas explícitas.
 *  - titulares: heros reales del funnel V3 clasificados por fórmula persuasiva.
 *  - formularios: estadística de campos/fricción por país y la recomendación calculada.
 * Nada inventado: cada entrada referencia su ficha.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const v3 = JSON.parse(readFileSync(resolve(root, "public/data/funnel-v3/index.json"), "utf8"));
const byId = new Map(companies.map((c) => [c.id, c]));

/* ---------------- Banco de garantías ---------------- */
const KINDS = [
  { kind: "Solo pagas por resultado", re: /(100 ?% a [eé]xito|a [eé]xito|solo (se )?(cobra|factura|paga)|pago por (resultado|cita|reuni[oó]n|lead)|no cure,? no pay|no win no fee|success fee|coste cero)/i },
  { kind: "Reposición del lead/cita malos", re: /(reemplaz|repone|reposici[oó]n|sustituy|replace|re-?cr[eé]dit)/i },
  { kind: "Volumen mínimo garantizado", re: /(garantiza \d|m[ií]nimo de \d|al menos \d+ (leads|citas|reuniones|contactos)|\d+\+? (leads|citas|reuniones) (al|por) mes)/i },
  { kind: "Devolución del dinero", re: /(devoluci[oó]n|devolvemos|reembols|money.?back|te devuelve)/i },
  { kind: "Seguimos gratis hasta cumplir", re: /(gratis hasta|sin coste hasta|trabajam?os gratis|prolonga\w* (la )?(campaña|servicio)|free until)/i },
  { kind: "Sin permanencia", re: /(sin permanencia|mes a mes|cancel|sin contrato|month.to.month)/i },
  { kind: "Exclusividad de zona/lead", re: /(exclusiv)/i },
  { kind: "Plazo de resultados", re: /(en \d+ d[ií]as|primeros resultados|en \d+ semanas|days? guarantee)/i },
];
const strength = (t) => {
  let s = 1;
  if (/\d/.test(t)) s++; // promesa numérica
  if (/(contrato|por escrito|cl[aá]usula|garant[ií]a formal)/i.test(t)) s++;
  if (/(devoluci[oó]n|devolvemos|reembols|gratis hasta|no pagas|coste cero)/i.test(t)) s++;
  if (/(sin (condiciones|letra)|autom[aá]tic)/i.test(t)) s++;
  return Math.min(5, s);
};
const costToKeep = (t) => {
  if (/(devoluci[oó]n|devolvemos|reembols|money.?back)/i.test(t)) return 5;
  if (/(gratis hasta|trabajam?os gratis)/i.test(t)) return 4;
  if (/(m[ií]nimo de \d|garantiza \d|al menos \d)/i.test(t)) return 3;
  if (/(reemplaz|repone|reposici[oó]n|sustituy)/i.test(t)) return 2;
  return 1; // exclusividad, sin permanencia, plazo: baratas de cumplir
};
const garantias = companies
  .filter((c) => (c.guarantee || "").trim().length > 30 && !/no (documentada|publicada|localizada|se especifica)/i.test(c.guarantee))
  .map((c) => {
    const text = c.guarantee.trim();
    const kinds = KINDS.filter((k) => k.re.test(text)).map((k) => k.kind);
    return {
      id: c.id,
      name: c.name,
      country: c.primaryCountry,
      score: c.score,
      text: text.slice(0, 420),
      kinds: kinds.length ? kinds : ["Otra promesa"],
      fuerza: strength(text),
      coste: costToKeep(text),
    };
  })
  .sort((a, b) => b.fuerza - a.fuerza || a.coste - b.coste || b.score - a.score);

/* ---------------- Titulares por fórmula ---------------- */
const FORMULAS = [
  { f: "Número concreto", re: /\d/ },
  { f: "Pregunta", re: /\?/ },
  { f: "Cómo / método", re: /\b(c[oó]mo|how to|wie )/i },
  { f: "Riesgo invertido", re: /(no pagas|sin riesgo|garant|solo pagas|a [eé]xito|no cure|money.?back|gratis)/i },
  { f: "Velocidad / plazo", re: /(en \d+ (d[ií]as|horas|semanas|minutos)|r[aá]pid|inmediat|ya\b|hoy\b|24 ?h)/i },
  { f: "Prueba social", re: /(\+ ?\d|clientes|empresas conf|casos|desde \d{4}|miles|referencias)/i },
  { f: "Exclusividad / escasez", re: /(exclusiv|un solo|[uú]nico|plaza|zona)/i },
  { f: "Enemigo común", re: /(sin (agencias|comisiones|intermediarios)|olv[ií]date|deja de|stop |harto)/i },
  { f: "Resultado directo", re: /(m[aá]s (clientes|ventas|pacientes|leads|reservas)|llena|consigue|aumenta|duplica|crece)/i },
];
const titulares = (v3.records || [])
  .filter((r) => r.headline && r.headline.length > 8 && !/no observable/i.test(r.headline))
  .map((r) => {
    const c = byId.get(r.id);
    return {
      id: r.id,
      name: r.name,
      country: c?.primaryCountry || "—",
      score: c?.score ?? 0,
      headline: r.headline.slice(0, 220),
      formulas: FORMULAS.filter((x) => x.re.test(r.headline)).map((x) => x.f),
    };
  })
  .sort((a, b) => b.score - a.score);
const formulaCounts = {};
for (const t of titulares) for (const f of t.formulas) formulaCounts[f] = (formulaCounts[f] || 0) + 1;

/* ---------------- Formularios: campos y fricción ---------------- */
const withForms = (v3.records || []).filter((r) => r.forms > 0 && r.fields > 0);
const perForm = withForms.map((r) => ({ id: r.id, fields: r.fields / r.forms, required: r.requiredFields / Math.max(1, r.forms), country: byId.get(r.id)?.primaryCountry || "—", score: byId.get(r.id)?.score ?? 0 }));
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const byCountry = {};
for (const f of perForm) (byCountry[f.country] = byCountry[f.country] || []).push(f);
const formStats = Object.entries(byCountry)
  .filter(([, list]) => list.length >= 8)
  .map(([country, list]) => ({ country, n: list.length, medianFields: Math.round(median(list.map((x) => x.fields)) * 10) / 10, medianRequired: Math.round(median(list.map((x) => x.required)) * 10) / 10 }))
  .sort((a, b) => b.n - a.n)
  .slice(0, 14);
const winnersForms = perForm.filter((f) => f.score >= 80);
const formRecommendation = {
  medianFieldsWinners: winnersForms.length ? Math.round(median(winnersForms.map((x) => x.fields)) * 10) / 10 : null,
  medianFieldsAll: Math.round(median(perForm.map((x) => x.fields)) * 10) / 10,
  reading: `Los formularios de las fichas 80+ tienen una mediana de ${winnersForms.length ? Math.round(median(winnersForms.map((x) => x.fields)) * 10) / 10 : "—"} campos visibles frente a ${Math.round(median(perForm.map((x) => x.fields)) * 10) / 10} del mercado. La pauta ganadora: pocos campos en el primer paso (nombre, teléfono, zona) y la cualificación fina por teléfono — que es exactamente el papel del setter.`,
};

const out = {
  generatedAt: "23/08/2026",
  garantias: { total: garantias.length, items: garantias.slice(0, 150) },
  titulares: { total: titulares.length, formulaCounts, items: titulares },
  formularios: { n: perForm.length, byCountry: formStats, recommendation: formRecommendation },
};
writeFileSync(resolve(root, "public/data/arsenal.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`arsenal.json: ${garantias.length} garantías · ${titulares.length} titulares · ${perForm.length} fichas con formularios`);
