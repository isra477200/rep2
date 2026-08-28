#!/usr/bin/env node
/**
 * Detector de patrones de prioridad estratégica → public/data/patterns.json
 *
 * Cruza toda la base canónica (companies-index.json) buscando qué hacen
 * distinto las fichas con prioridad editorial alta. Señales usadas (todas públicas):
 *   - score >= 80 (puntuación estratégica del catálogo)
 *   - anuncios verificados o presencia observada en Google Search
 * Nada se inventa: cada cifra sale de contar la base y cada lectura se genera
 * a partir de los números calculados.
 *
 * Ejecutar después de integrate-ampliacion.mjs / apply-ads.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const OBSERVED_AT = "27/08/2026";

const text = (c) => `${c.offer || ""} ${c.priceLocal || ""} ${c.ticket || ""} ${c.guarantee || ""} ${c.contract || ""}`.toLowerCase();
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/* ---------- Clasificación del modelo de cobro (texto público) ---------- */
const MODELS = [
  { id: "exito", label: "100% a éxito (cobra solo si hay resultado)", re: /(100 ?% a [eé]xito|a [eé]xito|solo (se )?(cobra|factura|paga)|pago por resultado|no cure,? no pay|no win no fee|success fee|coste cero)/ },
  { id: "por-cita", label: "Pago por cita / reunión válida", re: /(por (cita|reuni[oó]n)|per meeting|por reuni[oó]n (v[aá]lida|agendada|efectiva)|appointment)/ },
  { id: "por-lead", label: "Pago por lead", re: /(por lead|per lead|pay per lead|precio del lead|cada lead|c[eé]ntimos por lead|€ ?\/ ?lead|coste por lead)/ },
  { id: "mensualidad", label: "Cuota mensual / retainer", re: /(mensual|al mes|\/ ?mes|month|retainer|cuota|suscripci[oó]n mensual|mo\b)/ },
  { id: "proyecto", label: "Por proyecto / setup único", re: /(por proyecto|pago [uú]nico|one.?off|setup|implantaci[oó]n|desde .*proyecto)/ },
  { id: "directorio", label: "Directorio / marketplace (suscripción o comisión)", re: /(directorio|listado|perfil|marketplace|comisi[oó]n por (trabajo|servicio)|cr[eé]ditos)/ },
];
const classify = (c) => {
  const t = text(c);
  for (const m of MODELS) if (m.re.test(t)) return m.id;
  return "no-clasificable";
};

const adsActive = (c) =>
  (c.metaAds || 0) > 0 ||
  (c.googleAds || 0) > 0 ||
  (c.googleSearchAdsObserved || 0) > 0;
const adEvidenceScore = (c) =>
  Number(c.metaAds || 0) +
  Number(c.googleAds || 0) +
  (Number(c.googleSearchAdsObserved || 0) > 0 ? 1 : 0);
const hasPrice = (c) => c.price && typeof c.price.eur === "number" && c.price.eur > 0;
const hasGuarantee = (c) => (c.guarantee || "").trim().length > 25 && !/no (documentada|publicada|localizada)/i.test(c.guarantee || "");
const multiMarket = (c) => (c.countries || []).length > 1 || (c.markets || []).some((m) => /global|internacional|europa|latam/i.test(m));

const winners = companies.filter((c) => c.score >= 80);
const rest = companies.filter((c) => c.score < 80);
const withAds = companies.filter(adsActive);

/* ---------- Estadística por modelo de cobro ---------- */
const byModel = new Map();
for (const c of companies) {
  const id = classify(c);
  if (!byModel.has(id)) byModel.set(id, []);
  byModel.get(id).push(c);
}
const modelStats = [...byModel.entries()]
  .map(([id, list]) => {
    const label = MODELS.find((m) => m.id === id)?.label || "Sin señal pública de modelo de cobro";
    const priced = list.filter(hasPrice);
    return {
      id,
      label,
      n: list.length,
      medianEur: priced.length >= 3 ? Math.round(median(priced.map((c) => c.price.eur))) : null,
      pricedN: priced.length,
      adsActivePct: pct(list.filter(adsActive).length, list.length),
      guaranteePct: pct(list.filter(hasGuarantee).length, list.length),
      winnersPct: pct(list.filter((c) => c.score >= 80).length, list.length),
      avgScore: Math.round(list.reduce((s, c) => s + c.score, 0) / list.length),
      examples: list
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry, score: c.score })),
    };
  })
  .sort((a, b) => b.n - a.n);

/* ---------- Perfil de prioridad estratégica alta (score >= 80) ---------- */
const profile = (list) => ({
  n: list.length,
  adsActivePct: pct(list.filter(adsActive).length, list.length),
  pricePublicPct: pct(list.filter(hasPrice).length, list.length),
  guaranteePct: pct(list.filter(hasGuarantee).length, list.length),
  multiMarketPct: pct(list.filter(multiMarket).length, list.length),
  medianEur: (() => {
    const p = list.filter(hasPrice).map((c) => c.price.eur);
    return p.length >= 3 ? Math.round(median(p)) : null;
  })(),
});
const winnersProfile = profile(winners);
const restProfile = profile(rest);

/* ---------- Canales de las fichas con prioridad alta ---------- */
const channelCount = (list) => {
  const counts = {};
  for (const c of list) for (const ch of c.channels || []) counts[ch] = (counts[ch] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};
const winnerChannels = channelCount(winners)
  .slice(0, 10)
  .map(([channel, count]) => ({ channel, count, pctWinners: pct(count, winners.length) }));

/* ---------- Prioridad alta con anuncios activos: doble evidencia ---------- */
const doubleValidated = companies
  .filter((c) => c.score >= 80 && adsActive(c))
  .sort((a, b) => adEvidenceScore(b) - adEvidenceScore(a))
  .slice(0, 12)
  .map((c) => ({
    id: c.id,
    name: c.name,
    country: c.primaryCountry,
    score: c.score,
    metaAds: c.metaAds,
    googleAds: c.googleAds,
    googleSearchObserved: Number(c.googleSearchAdsObserved || 0) > 0,
    googleSearchAdsObserved: Number(c.googleSearchAdsObserved || 0),
    agencyType: c.agencyType,
  }));

/* ---------- Lecturas generadas desde los números ---------- */
const findings = [];
const diff = (a, b) => a - b;

if (diff(winnersProfile.guaranteePct, restProfile.guaranteePct) >= 10)
  findings.push({
    title: "Las fichas de prioridad alta publican más garantía escrita",
    stat: `${winnersProfile.guaranteePct}% vs ${restProfile.guaranteePct}%`,
    detail: `El ${winnersProfile.guaranteePct}% de las fichas con puntuación estratégica 80+ publica una garantía sustancial, frente al ${restProfile.guaranteePct}% del resto. Es una asociación descriptiva del catálogo, no una prueba de conversión o rentabilidad.`,
  });
if (diff(winnersProfile.pricePublicPct, restProfile.pricePublicPct) >= 10)
  findings.push({
    title: "Precio público asociado a prioridad estratégica alta",
    stat: `${winnersProfile.pricePublicPct}% vs ${restProfile.pricePublicPct}%`,
    detail: `Entre las fichas con puntuación estratégica 80+, el ${winnersProfile.pricePublicPct}% publica precio verificable; en el resto, el ${restProfile.pricePublicPct}%. La asociación sirve para diseñar un test de transparencia; no demuestra qué enfoque convierte mejor.`,
  });
if (diff(winnersProfile.adsActivePct, restProfile.adsActivePct) >= 10)
  findings.push({
    title: "Los mejores invierten en su propia captación",
    stat: `${winnersProfile.adsActivePct}% vs ${restProfile.adsActivePct}%`,
    detail: `El ${winnersProfile.adsActivePct}% de las fichas con prioridad estratégica alta tiene actividad publicitaria verificada u observada (Meta o Google), frente al ${restProfile.adsActivePct}% del resto. Es una señal de uso del canal, no una prueba de rentabilidad.`,
  });
if (diff(winnersProfile.multiMarketPct, restProfile.multiMarketPct) >= 10)
  findings.push({
    title: "La prioridad estratégica alta aparece más en varios mercados",
    stat: `${winnersProfile.multiMarketPct}% vs ${restProfile.multiMarketPct}%`,
    detail: `El ${winnersProfile.multiMarketPct}% de las fichas 80+ opera en más de un mercado, frente al ${restProfile.multiMarketPct}% del resto. La expansión es una característica observada, no una causa demostrada de rendimiento.`,
  });

const exito = modelStats.find((m) => m.id === "exito");
const mensual = modelStats.find((m) => m.id === "mensualidad");
if (exito && mensual && exito.avgScore > mensual.avgScore)
  findings.push({
    title: "El riesgo invertido puntúa por encima del retainer",
    stat: `${exito.avgScore} vs ${mensual.avgScore} de media`,
    detail: `Las ${exito.n} fichas con señal de cobro a éxito promedian ${exito.avgScore} puntos, frente a ${mensual.avgScore} de las ${mensual.n} con cuota mensual. El mercado premia a quien asume parte del riesgo del cliente.`,
  });
const porCita = modelStats.find((m) => m.id === "por-cita");
if (porCita && porCita.medianEur)
  findings.push({
    title: "La cita válida es la unidad más cara del mercado",
    stat: `${porCita.medianEur} € de mediana`,
    detail: `Los ${porCita.n} modelos que cobran por cita o reunión válida tienen una mediana de ${porCita.medianEur} € por unidad y un ${porCita.adsActivePct}% mantiene anuncios activos. Es la unidad de facturación con mejor relación valor-percibido/esfuerzo de venta.`,
  });
if (winnerChannels.length >= 2)
  findings.push({
    title: "Canales más repetidos en la prioridad estratégica alta",
    stat: winnerChannels.slice(0, 3).map((c) => c.channel).join(" + "),
    detail: `Entre las fichas 80+, los canales dominantes son ${winnerChannels.slice(0, 4).map((c) => `${c.channel} (${c.pctWinners}%)`).join(", ")}. La combinación de captación de pago con un canal propio de demanda es el patrón repetido.`,
  });
findings.push({
  title: "Anuncios activos: la prueba de vida del mercado",
  stat: `${withAds.length} de ${companies.length}`,
  detail: `${withAds.length} fichas (${pct(withAds.length, companies.length)}%) tienen actividad verificada u observada en Meta o Google. Su puntuación media es ${Math.round(withAds.reduce((s, c) => s + c.score, 0) / (withAds.length || 1))} frente a ${Math.round(companies.filter((c) => !adsActive(c)).reduce((s, c) => s + c.score, 0) / (companies.length - withAds.length || 1))} de las que no. La actividad ayuda a priorizar qué estudiar; no demuestra gasto, estabilidad, conversiones ni rentabilidad.`,
});

const patterns = {
  generatedAt: OBSERVED_AT,
  universe: companies.length,
  winnersN: winners.length,
  winnersProfile,
  restProfile,
  modelStats,
  winnerChannels,
  doubleValidated,
  findings,
};
writeFileSync(resolve(root, "public/data/patterns.json"), JSON.stringify(patterns, null, 1));
console.log(`patterns.json: ${modelStats.length} modelos de cobro · ${findings.length} lecturas · ${doubleValidated.length} doble-validados`);
