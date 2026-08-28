#!/usr/bin/env node
/**
 * Genera public/data/analytics.json — análisis avanzado calculado sobre el catálogo único,
 * más los informes de investigación (muertos, compradores).
 * Ejecutar después de scripts/integrate-ampliacion.mjs.
 * Regla de honestidad: todo número sale de contar; lo no calculable se marca como pendiente.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const muertos = existsSync(resolve(root, "db/muertos.json")) ? JSON.parse(readFileSync(resolve(root, "db/muertos.json"), "utf8")) : null;
const compradores = existsSync(resolve(root, "db/compradores-informe.json")) ? JSON.parse(readFileSync(resolve(root, "db/compradores-informe.json"), "utf8")) : null;

const text = (c) => `${c.name} ${c.model || ""} ${c.offer || ""} ${c.niche || ""} ${c.agencyType || ""}`.toLowerCase();
const fullText = (c) => `${text(c)} ${c.guarantee || ""} ${c.ticket || ""} ${c.contract || ""}`.toLowerCase();

/* ---------- 1. Clasificación por nicho (palabra clave, transparente) ---------- */
const NICHES = [
  { key: "Dental", re: /dental|dentist|odont|implante/ },
  { key: "Estética y belleza", re: /est[eé]tic|belleza|beauty|salon|peluquer|barber|spa\b/ },
  { key: "Salud y clínicas", re: /cl[ií]nic|salud|m[eé]dic|health|fisio|veterinari|farmac/ },
  { key: "Solar y energía", re: /solar|fotovolta|photovolta|energ[ií]a|placas|solc|aurinko/ },
  { key: "Reformas y construcción", re: /reforma|construc|obra|handwerk|trades|byggl|remont|travaux|renov|oficios|bygge|remodel/ },
  { key: "Inmobiliario", re: /inmobiliari|real estate|propiedad|immobili|fastighet/ },
  { key: "Legal", re: /legal|abogad|lawyer|jur[ií]dic/ },
  { key: "Seguros y finanzas", re: /seguro|insurance|financ|hipotec|pr[eé]stamo/ },
  { key: "Automoción", re: /coche|autom[oó]|car\b|veh[ií]culo|taller/ },
  { key: "Hostelería", re: /restaurant|hosteler|hotel|turis/ },
  { key: "B2B / tecnología", re: /b2b|saas|software|tech|tecnolog|empresas b2b|sdr\b/ },
  { key: "Bodas y eventos", re: /boda|wedding|evento/ },
];
function nichesOf(c) {
  const t = text(c);
  const hits = NICHES.filter((n) => n.re.test(t)).map((n) => n.key);
  return hits.length ? hits : ["Generalista / multi-nicho"];
}

/* ---------- 2. Matriz nicho × país (top países por volumen) ---------- */
const countryCounts = {};
for (const c of companies) countryCounts[c.primaryCountry] = (countryCounts[c.primaryCountry] || 0) + 1;
const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k]) => k);
const nicheKeys = [...NICHES.map((n) => n.key), "Generalista / multi-nicho"];
const matrix = nicheKeys.map((niche) => ({
  niche,
  total: 0,
  cells: topCountries.map((country) => ({ country, count: 0 })),
}));
for (const c of companies) {
  for (const niche of nichesOf(c)) {
    const row = matrix.find((r) => r.niche === niche);
    row.total += 1;
    const cell = row.cells.find((x) => x.country === c.primaryCountry);
    if (cell) cell.count += 1;
  }
}
matrix.sort((a, b) => b.total - a.total);

/* ---------- 3. Saturación España por nicho ---------- */
const spain = companies.filter((c) => c.primaryCountry === "España");
const saturation = nicheKeys
  .map((niche) => ({ niche, count: spain.filter((c) => nichesOf(c).includes(niche)).length }))
  .filter((x) => x.count > 0)
  .sort((a, b) => b.count - a.count);

/* ---------- 4. Correlación precio ↔ garantía fuerte ---------- */
const strongGuarantee = (c) =>
  /(coste cero|100 ?% a éxito|solo (se )?(cobra|factura|paga)|pago por (resultado|cita|reuni[oó]n|lead)|reemplaz\w+|repone\w*|reposici[oó]n|devoluci[oó]n del dinero|money.back)/.test(fullText(c));
const priced = companies.filter((c) => c.price && typeof c.price.eur === "number" && c.price.eur > 0);
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };
const withG = priced.filter(strongGuarantee).map((c) => c.price.eur);
const withoutG = priced.filter((c) => !strongGuarantee(c)).map((c) => c.price.eur);
const priceGuarantee = {
  withGuarantee: { n: withG.length, medianEur: med(withG) },
  withoutGuarantee: { n: withoutG.length, medianEur: med(withoutG) },
  reading: null,
};
if (priceGuarantee.withGuarantee.medianEur && priceGuarantee.withoutGuarantee.medianEur) {
  const diff = Math.round(((priceGuarantee.withGuarantee.medianEur - priceGuarantee.withoutGuarantee.medianEur) / priceGuarantee.withoutGuarantee.medianEur) * 100);
  priceGuarantee.reading = diff >= 0
    ? `Quien da garantía fuerte cobra de mediana un ${diff}% MÁS. La garantía no abarata: da permiso para cobrar.`
    : `Quien da garantía fuerte cobra de mediana un ${Math.abs(diff)}% menos: en esta muestra la garantía acompaña a ofertas de volumen barato.`;
}

/* ---------- 5. Elasticidad: percentiles de precio por país (mín. 6 precios) ---------- */
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]); };
const priceByCountry = {};
for (const c of priced) (priceByCountry[c.primaryCountry] = priceByCountry[c.primaryCountry] || []).push(c.price.eur);
const elasticity = Object.entries(priceByCountry)
  .filter(([, v]) => v.length >= 6)
  .map(([country, v]) => ({ country, n: v.length, p25: pct(v, 25), p50: pct(v, 50), p75: pct(v, 75) }))
  .sort((a, b) => b.n - a.n);

/* ---------- 6. Copy por prioridad estratégica del catálogo ---------- */
const STOP = new Set("de la el en y a los las para con que un una del al por su sus se o más como sin sobre este esta hasta desde entre pero the and for with your our of to in on is are we you leads lead clientes cliente marketing agencia empresa empresas negocio negocios servicio servicios web digital online".split(" "));
function topWords(list) {
  const freq = {};
  for (const c of list) {
    const words = (c.offer || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-zñ]{4,}/g) || [];
    for (const w of new Set(words)) { if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1; }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([word, count]) => ({ word, count }));
}
const winners = companies.filter((c) => c.score >= 80);
const laggards = companies.filter((c) => c.score > 0 && c.score <= 40);
const copyAnalysis = {
  winnersN: winners.length,
  laggardsN: laggards.length,
  winnerWords: topWords(winners),
  laggardWords: topWords(laggards),
};

/* ---------- 7. Scoring v2 (fórmula de negocio, transparente) ---------- */
function scoreV2(c) {
  let s = 0;
  if (c.threat === "Alta") s += 30; else if (c.threat === "Media") s += 15;
  if (c.relation === "Competidor directo") s += 20; else if (c.relation === "Competidor indirecto") s += 8; else if (c.relation === "Referente para adaptar") s += 10;
  if (c.decision === "Copiar") s += 15; else if (c.decision === "Probar") s += 12; else if (c.decision === "Adaptar") s += 10;
  if (c.evidence === "Confirmado") s += 10;
  if (c.price && c.price.eur) s += 5;
  if ((c.googleAds || 0) + (c.metaAds || 0) > 0) s += 10;
  if ((c.media || []).length > 0 || (c.mediaDeclared || 0) > 0) s += 5;
  if (strongGuarantee(c)) s += 5;
  return s;
}
const v2Formula = "Amenaza (Alta 30 / Media 15) + Relación (directo 20 / referente 10 / indirecto 8) + Decisión (Copiar 15 / Probar 12 / Adaptar 10) + Evidencia confirmada 10 + Precio público 5 + Publicidad activa detectada 10 + Evidencia visual 5 + Garantía fuerte 5. Máx 100.";
const v2Spain = spain.map((c) => ({ id: c.id, name: c.name, v2: scoreV2(c), v1: c.score, agencyType: c.agencyType }))
  .sort((a, b) => b.v2 - a.v2).slice(0, 25);
const v2Global = companies.filter((c) => c.primaryCountry !== "España")
  .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry, v2: scoreV2(c), v1: c.score }))
  .sort((a, b) => b.v2 - a.v2).slice(0, 20);

/* ---------- 8. Grupos y holdings detectados ---------- */
const holdings = companies
  .filter((c) => (c.model || "").startsWith("Holding:") || /grupo |holding|\(grupo/i.test(c.name))
  .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry, offer: (c.offer || "").slice(0, 180) }));

/* ---------- Salida ---------- */
const analytics = {
  generatedAt: "23/08/2026",
  universe: companies.length,
  matrix: { countries: topCountries, rows: matrix.filter((r) => r.total > 0) },
  saturation,
  priceGuarantee,
  elasticity,
  copyAnalysis,
  scoringV2: { formula: v2Formula, spain: v2Spain, global: v2Global },
  holdings,
  mortality: muertos ? { cases: muertos.cases || [], patterns: muertos.patterns || [] } : null,
  leadEconomy: compradores ? { verticals: compradores.verticals || [], notes: compradores.notes || [] } : null,
  pending: [
    "Patrones de campaña publicitaria: pendiente de la verificación de bibliotecas de anuncios (bloqueada desde servidor; se hará vía navegador).",
    "TAM por nicho: pendiente de cruzar censo de negocios (INE) por vertical; no se estima sin fuente.",
  ],
};
writeFileSync(resolve(root, "public/data/analytics.json"), JSON.stringify(analytics, null, 1));
console.log(`analytics.json: ${matrix.filter((r) => r.total > 0).length} nichos · ${elasticity.length} países con percentiles · ${v2Spain.length} top v2 España · ${holdings.length} holdings · muertos: ${muertos ? (muertos.cases || []).length : 0}`);
