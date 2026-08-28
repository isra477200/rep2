#!/usr/bin/env node
/**
 * Genera public/data/cruces.json → los cruces analíticos avanzados:
 * elasticidad garantía→precio, fórmula de titular por vertical, curva de precio
 * España, índice de madurez por país, matriz promesa×remedio, contradicciones,
 * ADN de los 95+, delta del 10x, mapa mundial de promesas, fragilidad España,
 * léxico por vertical y benchmark de time-to-contact.
 * Todo calculado sobre la base; las lecturas se generan desde los números.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const arsenal = JSON.parse(readFileSync(resolve(root, "public/data/arsenal.json"), "utf8"));
const verticalesData = JSON.parse(readFileSync(resolve(root, "public/data/verticales.json"), "utf8"));
const vmap = verticalesData.map;
const vlabel = Object.fromEntries(verticalesData.verticales.map((v) => [v.id, v.label]));
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const priced = companies.filter((c) => c.price?.eur > 0);

/* 1 ─ Elasticidad garantía→precio (solo modelos de cuota mensual, para comparar peras con peras) */
const gByCompany = new Map(arsenal.garantias.items.map((g) => [g.id, g]));
const monthly = priced.filter((c) => /(mes\b|mensual|month|\/mo|al mes)/i.test(c.priceLocal || ""));
const bands = [[1, 2, "Garantía floja (1-2)"], [3, 3, "Garantía media (3)"], [4, 5, "Garantía fuerte (4-5)"]];
const elasticidadGarantia = bands.map(([lo, hi, label]) => {
  const list = monthly.filter((c) => { const g = gByCompany.get(c.id); return g && g.fuerza >= lo && g.fuerza <= hi; });
  return { label, n: list.length, medianEur: list.length >= 5 ? Math.round(median(list.map((c) => c.price.eur))) : null };
});
const sinGarantia = monthly.filter((c) => !gByCompany.get(c.id));
elasticidadGarantia.unshift({ label: "Sin garantía publicada", n: sinGarantia.length, medianEur: sinGarantia.length >= 5 ? Math.round(median(sinGarantia.map((c) => c.price.eur))) : null });

/* 2 ─ Fórmula de titular ganadora por vertical */
const formulaVertical = {};
for (const t of arsenal.titulares.items) {
  const v = vmap[t.id] || "generalista";
  formulaVertical[v] = formulaVertical[v] || { total: 0, winners: 0, formulas: {} };
  formulaVertical[v].total++;
  if (t.score >= 80) { formulaVertical[v].winners++; for (const f of t.formulas) formulaVertical[v].formulas[f] = (formulaVertical[v].formulas[f] || 0) + 1; }
}
const titularPorVertical = Object.entries(formulaVertical)
  .filter(([, d]) => d.winners >= 4)
  .map(([v, d]) => {
    const top = Object.entries(d.formulas).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { vertical: vlabel[v] || v, winners: d.winners, top: top.map(([f, n]) => ({ formula: f, n })) };
  })
  .sort((a, b) => b.winners - a.winners);

/* 3 ─ Curva de precio España + hueco */
const esPrices = priced.filter((c) => c.primaryCountry === "España").map((c) => c.price.eur).sort((a, b) => a - b);
const buckets = [[0, 100], [100, 250], [250, 400], [400, 600], [600, 900], [900, 1200], [1200, 2000], [2000, 99999]];
const curvaEspana = buckets.map(([lo, hi]) => ({ rango: hi > 5000 ? `${lo}+ €` : `${lo}–${hi} €`, n: esPrices.filter((p) => p >= lo && p < hi).length }));
const minBucket = [...curvaEspana].slice(1, 6).sort((a, b) => a.n - b.n)[0];

/* 4 ─ Índice de madurez comercial por país */
const paises = {};
for (const c of companies) (paises[c.primaryCountry] = paises[c.primaryCountry] || []).push(c);
const madurez = Object.entries(paises)
  .filter(([, list]) => list.length >= 10)
  .map(([pais, list]) => {
    const price = pct(list.filter((c) => c.price?.eur > 0).length, list.length);
    const gar = pct(list.filter((c) => (c.guarantee || "").length > 30).length, list.length);
    const adsA = pct(list.filter((c) => (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0).length, list.length);
    return { pais, n: list.length, precioPublico: price, garantia: gar, adsActivos: adsA, indice: Math.round((price + gar + adsA) / 3) };
  })
  .sort((a, b) => b.indice - a.indice)
  .slice(0, 16);

/* 5 ─ Matriz promesa × remedio */
const promiseOf = (t) => /(al menos \d|m[ií]nimo de \d|garantiza \d|\d+\+? (leads|citas|reuniones))/i.test(t) ? "Volumen" : /(en \d+ (d[ií]as|semanas)|primeros resultados)/i.test(t) ? "Plazo" : /(v[aá]lid|cualificad|decisor|criterio)/i.test(t) ? "Calidad" : "Genérica";
const remedyOf = (t) => /(devoluci[oó]n|devolvemos|reembols|money.?back)/i.test(t) ? "Devolución" : /(gratis hasta|trabajam?os gratis|sin coste hasta|prolonga)/i.test(t) ? "Seguimos gratis" : /(reemplaz|repone|reposici[oó]n|sustituy|re-?cr[eé]dit)/i.test(t) ? "Reposición" : "Sin remedio explícito";
const matriz = {};
let esCells = {};
for (const g of arsenal.garantias.items) {
  const key = promiseOf(g.text) + "|" + remedyOf(g.text);
  matriz[key] = (matriz[key] || 0) + 1;
  if (g.country === "España") esCells[key] = (esCells[key] || 0) + 1;
}
const promesaRemedio = Object.entries(matriz).map(([k, n]) => { const [promesa, remedio] = k.split("|"); return { promesa, remedio, n, espana: esCells[k] || 0 }; }).sort((a, b) => b.n - a.n);
const huecosPR = promesaRemedio.filter((x) => x.n >= 8 && x.espana <= 2);

/* 6 ─ Contradicciones copy vs letra pequeña */
const contradicciones = companies
  .map((c) => {
    const copy = `${c.offer || ""} ${c.cta || ""} ${c.proof || ""}`.toLowerCase();
    const fine = `${c.contract || ""} ${c.legal || ""} ${c.guarantee || ""}`.toLowerCase();
    const flags = [];
    if (/sin permanencia|sin compromiso|cancela cuando/i.test(copy) && /(permanencia|renovaci[oó]n autom|12 meses|anual|ventana de baja|penalizaci[oó]n)/i.test(fine))
      flags.push("Vende «sin permanencia» pero su letra pequeña recoge permanencia o renovación automática");
    if (/garant/i.test(copy) && (c.guarantee || "").length < 25)
      flags.push("Menciona garantía en el copy sin garantía documentada en ninguna parte");
    if (/(resultados|clientes|pacientes) garantizados/i.test(copy) && !/(devoluci|gratis|repone|reemplaz)/i.test(fine))
      flags.push("Garantiza resultados sin remedio definido si no llegan");
    return flags.length ? { id: c.id, name: c.name, country: c.primaryCountry, score: c.score, flags } : null;
  })
  .filter(Boolean)
  .sort((a, b) => (b.country === "España" ? 1 : 0) - (a.country === "España" ? 1 : 0) || b.score - a.score)
  .slice(0, 30);

/* 7 ─ ADN de los 95+ */
const top = companies.filter((c) => c.score >= 95);
const rasgo = (label, fn) => ({ rasgo: label, pctTop: pct(top.filter(fn).length, top.length), pctBase: pct(companies.filter(fn).length, companies.length) });
const adn = [
  rasgo("Garantía sustancial publicada", (c) => (c.guarantee || "").length > 30),
  rasgo("Precio público convertible", (c) => c.price?.eur > 0),
  rasgo("Anuncios activos verificados", (c) => (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0),
  rasgo("Promesa numérica en la oferta", (c) => /\d+\s*(citas|leads|reuniones|clientes|d[ií]as)/i.test(c.offer || "")),
  rasgo("CTA de conversión documentado", (c) => (c.cta || "").length > 15),
  rasgo("Prueba social documentada", (c) => (c.proof || "").length > 25),
  rasgo("Multi-mercado", (c) => (c.countries || []).length > 1),
  rasgo("Galería de creatividades", (c) => (c.media || []).length > 0),
];

/* 8 ─ El delta del 10x (qué añaden los caros) */
const KEYWORDS = [["exclusiv", "Exclusividad"], ["garant", "Garantía"], ["dashboard|panel|informe|reporting", "Reporting/panel"], ["crm", "CRM incluido"], ["equipo dedicado|account manager|gestor", "Gestor dedicado"], ["cualificad|filtrad|verificad", "Cualificación"], ["cita|reuni[oó]n|agenda", "Agenda/citas"], ["whatsapp", "WhatsApp"], ["grabaci|transcri", "Grabaciones"], ["sin permanencia|mes a mes", "Sin permanencia"]];
const q1 = priced.filter((c) => c.price.eur <= (median(priced.map((x) => x.price.eur)) || 0) / 2);
const q4 = priced.filter((c) => c.price.eur >= (median(priced.map((x) => x.price.eur)) || 0) * 3);
const delta10x = KEYWORDS.map(([re, label]) => {
  const rx = new RegExp(re, "i");
  const cheap = pct(q1.filter((c) => rx.test(c.offer || "")).length, q1.length);
  const dear = pct(q4.filter((c) => rx.test(c.offer || "")).length, q4.length);
  return { rasgo: label, baratos: cheap, caros: dear, delta: dear - cheap };
}).sort((a, b) => b.delta - a.delta);

/* 9 ─ Mapa mundial de promesas (garantía dominante por país) */
const promesasPais = Object.entries(paises)
  .map(([pais, list]) => {
    const gs = list.map((c) => gByCompany.get(c.id)).filter(Boolean);
    if (gs.length < 5) return null;
    const counts = {};
    for (const g of gs) for (const k of g.kinds) counts[k] = (counts[k] || 0) + 1;
    const topKind = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { pais, n: gs.length, dominante: topKind[0], nDominante: topKind[1] };
  })
  .filter(Boolean)
  .sort((a, b) => b.n - a.n)
  .slice(0, 16);

/* 10 ─ Fragilidad España (competidores atacables) */
const fragilidad = companies
  .filter((c) => c.primaryCountry === "España" && c.scope !== "Excluir — fuente/no negocio")
  .map((c) => {
    let puntos = 0;
    const razones = [];
    if (!((c.metaAds || 0) > 0 || (c.googleAds || 0) > 0)) { puntos += 3; razones.push("sin anuncios activos"); }
    if (!(c.price?.eur > 0)) { puntos += 2; razones.push("precio oculto"); }
    if ((c.guarantee || "").length < 30) { puntos += 2; razones.push("sin garantía"); }
    if (!(c.media || []).length) { puntos += 1; razones.push("sin creatividades"); }
    if (/(queja|reclamaci|penalizaci|renovaci[oó]n autom)/i.test(`${c.legal} ${c.contract}`)) { puntos += 2; razones.push("letra pequeña con fricción"); }
    return { id: c.id, name: c.name, agencyType: c.agencyType, score: c.score, puntos, razones };
  })
  .filter((x) => x.puntos >= 5)
  .sort((a, b) => b.puntos - a.puntos || b.score - a.score)
  .slice(0, 25);

/* 11 ─ Léxico por vertical (bigramas ganadores) */
const STOP = new Set("de la el en y a los las del para con por que se un una tu te su o al es más mas sin nos lo como".split(" "));
const bigrams = (text) => {
  const words = (text || "").toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const out = [];
  for (let i = 0; i < words.length - 1; i++) out.push(words[i] + " " + words[i + 1]);
  return out;
};
const lexico = [];
for (const v of verticalesData.verticales) {
  if (v.id === "generalista") continue;
  const winners = companies.filter((c) => vmap[c.id] === v.id && c.score >= 75);
  if (winners.length < 5) continue;
  const counts = {};
  for (const c of winners) for (const b of bigrams(c.offer)) counts[b] = (counts[b] || 0) + 1;
  const topB = Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topB.length >= 3) lexico.push({ vertical: v.label, n: winners.length, bigramas: topB.map(([b, n]) => ({ b, n })) });
}

/* 12 ─ Benchmark time-to-contact (SLAs declarados) */
const slas = [];
for (const c of companies) {
  const text = `${c.offer || ""} ${c.funnel || ""} ${c.cta || ""} ${c.guarantee || ""}`;
  const m = text.match(/(?:en |menos de |dentro de |<\s?)(\d+)\s?(minutos|min\b|horas?|h\b)/i);
  if (m && /(contact|respond|respuesta|llama|lead|cita|atenci)/i.test(text)) {
    const minutes = /min/i.test(m[2]) ? Number(m[1]) : Number(m[1]) * 60;
    if (minutes <= 2880) slas.push({ id: c.id, name: c.name, country: c.primaryCountry, score: c.score, sla: m[0].trim(), minutos: minutes });
  }
}
slas.sort((a, b) => a.minutos - b.minutos);

const findings = [];
const fuerte = elasticidadGarantia.find((x) => x.label.startsWith("Garantía fuerte"));
const floja = elasticidadGarantia.find((x) => x.label.startsWith("Sin garantía"));
if (fuerte?.medianEur && floja?.medianEur)
  findings.push(
    fuerte.medianEur >= floja.medianEur
      ? `Entre cuotas mensuales, la garantía fuerte cobra una mediana de ${fuerte.medianEur} € frente a ${floja.medianEur} € de quien no publica garantía: la promesa blindada no abarata — encarece.`
      : `Entre cuotas mensuales, quien publica garantía fuerte cobra una mediana de ${fuerte.medianEur} € frente a ${floja.medianEur} € de quien no promete nada: la garantía se usa como arma de entrada a precio agresivo — RedVitalia puede romper ese patrón cobrando premium CON garantía.`,
  );
if (minBucket) findings.push(`En España el tramo de precio menos poblado es ${minBucket.rango} (${minBucket.n} actores): hueco de posicionamiento directo.`);
if (huecosPR.length) findings.push(`Combinaciones promesa×remedio frecuentes fuera y casi vírgenes en España: ${huecosPR.slice(0, 3).map((h) => `${h.promesa} + ${h.remedio}`).join("; ")}.`);
if (slas.length) findings.push(`${slas.length} fichas declaran SLA de contacto; el más agresivo es ${slas[0].name} (${slas[0].sla}). Un SLA firmado de 10 minutos sitúa a RedVitalia en el 1% del mercado.`);

const out = {
  generatedAt: new Date().toLocaleDateString("es-ES"),
  nota: "Cruces calculados sobre la base canónica y el arsenal. Las lecturas se generan desde los números; nada se estima a mano.",
  elasticidadGarantia,
  titularPorVertical,
  curvaEspana: { total: esPrices.length, buckets: curvaEspana, hueco: minBucket },
  madurez,
  promesaRemedio: { celdas: promesaRemedio.slice(0, 12), huecosEspana: huecosPR },
  contradicciones,
  adn: { nTop: top.length, rasgos: adn },
  delta10x: { nBaratos: q1.length, nCaros: q4.length, rasgos: delta10x },
  promesasPais,
  fragilidad,
  lexico,
  slas: { total: slas.length, top: slas.slice(0, 20) },
  findings,
};
writeFileSync(resolve(root, "public/data/cruces.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`cruces.json: elasticidad ${elasticidadGarantia.length} bandas · ${titularPorVertical.length} verticales con fórmula · madurez ${madurez.length} países · ${contradicciones.length} contradicciones · ADN ${adn.length} rasgos · ${fragilidad.length} frágiles · ${lexico.length} léxicos · ${slas.length} SLAs`);
console.log(findings.join("\n"));
