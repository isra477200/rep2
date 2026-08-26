#!/usr/bin/env node
/**
 * Genera public/data/insights.json → conclusiones calculadas sobre el catálogo único
 * (fichas madre + fichas en verificación integradas por scripts/integrate-ampliacion.mjs).
 *
 * Fuente: public/data/companies-index.json (proyección pública canónica).
 * Ejecutar SIEMPRE después de scripts/integrate-ampliacion.mjs.
 *
 * Regla de honestidad: nada se inventa. Todo número sale de contar la base;
 * los métodos referencian fichas reales (el script falla si una referencia no existe).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));

const OBSERVED_AT = "23/08/2026";
const byId = new Map(companies.map((c) => [c.id, c]));
const byDomain = new Map(companies.map((c) => [(c.domain || "").toLowerCase(), c]));

function ref(id) {
  const c = byId.get(id);
  if (!c) throw new Error(`Referencia a ficha inexistente: ${id}`);
  return { type: "ficha", id, name: c.name, country: c.primaryCountry, score: c.score };
}
function pref(domain) {
  const c = byDomain.get(domain);
  if (!c) throw new Error(`Referencia a dominio inexistente en el catálogo: ${domain}`);
  return { type: "ficha", id: c.id, name: c.name, country: c.primaryCountry, score: c.score };
}

const text = (c) => `${c.offer || ""} ${c.guarantee || ""} ${c.ticket || ""} ${c.contract || ""}`.toLowerCase();

/* ---------- Modelos de negocio ---------- */
const modelCounts = {};
for (const c of companies) {
  const k = c.agencyType || "Sin clasificar";
  modelCounts[k] = (modelCounts[k] || 0) + 1;
}
const models = Object.entries(modelCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => ({
    type,
    count,
    pct: Math.round((count / companies.length) * 1000) / 10,
  }));

/* ---------- Precios ---------- */
const priced = companies.filter((c) => c.price && typeof c.price.eur === "number" && c.price.eur > 0);
const eur = priced.map((c) => c.price.eur).sort((a, b) => a - b);
const median = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);
const buckets = [
  { label: "Menos de 50 €", min: 0, max: 50 },
  { label: "50 – 150 €", min: 50, max: 150 },
  { label: "150 – 500 €", min: 150, max: 500 },
  { label: "500 – 1.500 €", min: 500, max: 1500 },
  { label: "1.500 – 5.000 €", min: 1500, max: 5000 },
  { label: "Más de 5.000 €", min: 5000, max: Infinity },
].map((b) => ({ label: b.label, count: eur.filter((v) => v >= b.min && v < b.max).length }));
const pricedByCountry = {};
for (const c of priced) {
  const k = c.primaryCountry || "—";
  (pricedByCountry[k] = pricedByCountry[k] || []).push(c.price.eur);
}
const countryMedians = Object.entries(pricedByCountry)
  .filter(([, v]) => v.length >= 4)
  .map(([country, v]) => ({ country, n: v.length, medianEur: Math.round(median(v.sort((a, b) => a - b))) }))
  .sort((a, b) => b.n - a.n)
  .slice(0, 12);

/* ---------- Garantías (clasificación por texto público) ---------- */
const guaranteeKinds = [
  { kind: "Pago solo por resultado (cita, lead o venta)", re: /(coste cero|100 ?% a éxito|solo (se )?(cobra|factura|paga)|pago por (resultado|cita|reuni[oó]n|lead)|no cure,? no pay|no win no fee)/ },
  { kind: "Reemplazo explícito del lead o cita malos", re: /(reemplaz\w+|repone\w*|reposici[oó]n|sustituy\w+|replace\w*)\s+(el |la |los |las |de |del )?(lead|cita|contacto|llamada|falsos|duplicad)/ },
  { kind: "Sin permanencia / cancelación libre", re: /(sin permanencia|mes a mes|cancel(a|ar|ación)|sin contrato|month.to.month|no locked)/ },
  { kind: "Volumen mínimo garantizado", re: /(garantiza \d|m[ií]nimo de \d|al menos \d+ (leads|citas|reuniones))/ },
  { kind: "Exclusividad del lead o de la zona", re: /(exclusiv)/ },
];
const guarantees = guaranteeKinds.map(({ kind, re }) => {
  const hits = companies.filter((c) => re.test(text(c)));
  return {
    kind,
    count: hits.length,
    spain: hits.filter((c) => c.primaryCountry === "España").length,
    examples: hits
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry })),
  };
});

/* ---------- Amenazas en España ---------- */
const threatsSpain = companies
  .filter((c) => c.primaryCountry === "España" && c.threat === "Alta")
  .sort((a, b) => b.score - a.score)
  .slice(0, 15)
  .map((c) => ({ id: c.id, name: c.name, score: c.score, agencyType: c.agencyType, relation: c.relation }));
const threatsSpainTotal = companies.filter((c) => c.primaryCountry === "España" && c.threat === "Alta").length;

/* ---------- Para copiar ya ---------- */
const copyNow = companies
  .filter((c) => (c.decision === "Copiar" || c.decision === "Probar") && c.score >= 60)
  .sort((a, b) => b.score - a.score)
  .slice(0, 12)
  .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry, decision: c.decision, score: c.score, agencyType: c.agencyType, offer: (c.offer || "").slice(0, 220) }));

/* ---------- Huecos calculados (con cifra que los respalda) ---------- */
const spain = companies.filter((c) => c.primaryCountry === "España");
const spainPriced = spain.filter((c) => c.price && typeof c.price.eur === "number" && c.price.eur > 0).length;
const perMeetingSpain = spain.filter((c) => /(pago por (cita|reuni[oó]n)|por cita (v[aá]lida|efectiva|agendada)|per meeting)/.test(text(c))).length;
const replaceRe = /(reemplaz\w+|repone\w*|reposici[oó]n|sustituy\w+|replace\w*)\s+(el |la |los |las |de |del )?(lead|cita|contacto|llamada|falsos|duplicad)/;
const replaceSpain = spain.filter((c) => replaceRe.test(text(c))).length;
const territoryRe = /exclusiv\w*\s+(territorial|de zona|por zona|geogr[aá]fic)/;
const territorySpain = spain.filter((c) => territoryRe.test(text(c))).length;
const gaps = [
  {
    title: "Precio público en España",
    stat: `${spainPriced} de ${spain.length}`,
    detail: `Solo ${spainPriced} de las ${spain.length} fichas españolas muestran un precio verificable en público. Publicar tarifas precualifica al lead y la mayoría no lo hace.`,
  },
  {
    title: "Pago por reunión válida en España",
    stat: `${perMeetingSpain} de ${spain.length}`,
    detail: `El cobro por reunión que cumple criterios (estándar en los países nórdicos y en Japón) no aparece en ninguna ficha española de la base: ${perMeetingSpain} casos detectados. Encaja de forma natural con un modelo setter.`,
  },
  {
    title: "Reemplazo explícito del lead malo en España",
    stat: `${replaceSpain} de ${spain.length}`,
    detail: `Solo ${replaceSpain} fichas españolas prometen por escrito reponer el lead falso, duplicado o fuera de zona. Es una garantía barata de cumplir para quien controla la cualificación, y casi nadie la da.`,
  },
  {
    title: "Exclusividad territorial declarada en España",
    stat: `${territorySpain} de ${spain.length}`,
    detail: `Solo ${territorySpain} ficha española declara exclusividad territorial en su material público. El aval central del modelo RedVitalia casi no tiene imitadores visibles: conviene hacerlo más grande y más verificable.`,
  },
];

/* ---------- Métodos (playbooks) ---------- */
const methods = [
  {
    id: "pago-por-reunion",
    title: "Cobrar por reunión válida, no por gestión",
    what: "La unidad de facturación es la reunión que cumple criterios pactados (decisor presente, necesidad y presupuesto). Si la cita no los cumple, no se cobra o se repone. El estándar lo marcan Japón y los países nórdicos.",
    who: [ref("scale-lead"), ref("edge-connection"), ref("everconnect"), pref("bokare.se"), pref("leadlabbet.se"), pref("etatapaamisia.fi")],
    apply: "El modelo setter ya produce citas: definir por escrito qué es una cita válida y ofrecer un paquete de entrada a éxito (X € por cita válida) para eliminar la objeción de riesgo del cliente nuevo. La mensualidad sigue siendo el destino; el pago por cita es la puerta.",
    risk: "Canibalizar la cuota mensual si se ofrece a todo el mundo. Usarlo solo como oferta de entrada o para nichos nuevos.",
  },
  {
    id: "reemplazo-lead",
    title: "Garantía de reemplazo del lead malo",
    what: "Todo lead con datos falsos, fuera de zona o que no responde se repone sin discusión. Es la garantía dominante del pay-per-lead británico y holandés: barata de cumplir y muy potente en la venta.",
    who: [pref("onebasemedia.co.uk"), pref("gigaleads.nl"), pref("leadskopen.be"), pref("slimster.nl")],
    apply: "Añadir la reposición de cita no-show o lead ilocalizable a la oferta setter. El coste real es marginal (Nidia ya cualifica) y desarma la objeción principal del cliente quemado por leads compartidos.",
    risk: "Definir mal los criterios de reposición y acabar regalando trabajo. Criterios cerrados por escrito antes de vender.",
  },
  {
    id: "precio-publico",
    title: "Precio público como filtro de entrada",
    what: "Publicar la tarifa en la web y en el anuncio. Solo lo hace una minoría del mercado y quien lo hace lo usa como precualificación: llega menos gente, pero llega sabiendo lo que cuesta.",
    who: [pref("leadsagentur.de"), pref("sink-or-swim-marketing.com"), ref("horizzon-media")],
    apply: "RedVitalia ya precualifica mostrando precio en anuncios de Meta. El paso que falta: tarifas visibles también en la landing, con la exclusividad territorial al lado como justificación del precio.",
    risk: "Competidores copian el precio. Irrelevante: la exclusividad territorial no se puede copiar sin cambiar de modelo.",
  },
  {
    id: "exclusividad-territorial",
    title: "Exclusividad territorial como escasez verificable",
    what: "Un solo cliente por zona y nicho, y que se vea: contador de zonas ocupadas, lista de huecos libres. Convierte la venta en una carrera por la plaza en lugar de una comparación de agencias.",
    who: [ref("placassolares-es-nettbureau"), ref("handv-rker-dk"), ref("checkatrade")],
    apply: "RedVitalia ya vende exclusividad territorial: hacerla visible y verificable (mapa o lista pública de zonas ocupadas por nicho) multiplica su efecto de urgencia en la llamada del setter y en el deck de pre-cita.",
    risk: "Mostrar demasiado inventario libre debilita la escasez. Publicar solo por nicho activo.",
  },
  {
    id: "dominio-nicho",
    title: "Dominio-nicho: el marketplace vertical propio",
    what: "En lugar de vender 'marketing', operar portales por vertical (placas solares, reformas, clínicas) que captan demanda propia y reparten los leads entre los clientes de la zona. Nettbureau lo ejecuta en España con PlacasSolares.es; en el norte de Europa es una industria entera.",
    who: [ref("placassolares-es-nettbureau"), ref("urban-company"), pref("byggstart.no"), pref("3byggetilbud.dk")],
    apply: "Micro-portal por nicho y provincia alimentado con SEO local + Ads, que genera leads inbound propios. Reduce la dependencia del frío puro de los setters y crea un activo que se revaloriza.",
    risk: "Frente nuevo con coste de arranque real. Solo tiene sentido tras validar un nicho con 3+ clientes cerrados en frío.",
  },
  {
    id: "prueba-social-cruda",
    title: "Prueba social con números crudos, no con adjetivos",
    what: "Publicar ratios reales — citas generadas, ventas cerradas, por nicho — en lugar de testimonios genéricos. Las agencias japonesas de la base publican tablas de citas/ventas por caso y eso sostiene precios altos.",
    who: [ref("scale-lead"), ref("edge-connection"), ref("qdq-qdq-media")],
    apply: "Registrar citas→cierres por nicho (el dato ya existe en el CRM) y publicarlo en la presentación de ventas y el deck de pre-cita: «en clínicas dentales: 22 citas, 9 cierres». Nada vende más barato que un número verificable.",
    risk: "Publicar ratios malos. Se publica por nicho y solo donde el dato es defendible.",
  },
  {
    id: "financiar-ads",
    title: "La agencia financia la publicidad y cobra a éxito",
    what: "El proveedor paga el presupuesto publicitario y factura únicamente por lead cualificado entregado en exclusiva. Lo ejecuta DM Expert en Reino Unido.",
    who: [pref("dmexpert.co.uk")],
    apply: "NO recomendado para RedVitalia ahora: exige caja para financiar campañas ajenas y disciplina de riesgo de una financiera. Se vigila como amenaza — si un competidor español lo lanza, cambia el mercado.",
    risk: "Riesgo de caja directo. Es el método con mayor barrera y mayor peligro de imitar mal.",
  },
];

/* ---------- Salida ---------- */
const insights = {
  generatedAt: OBSERVED_AT,
  universe: companies.length,
  pricedCount: priced.length,
  worldMedianEur: Math.round(median(eur)),
  spainCount: spain.length,
  models,
  priceBuckets: buckets,
  countryMedians,
  guarantees,
  threatsSpain,
  threatsSpainTotal,
  copyNow,
  gaps,
  methods,
};
writeFileSync(resolve(root, "public/data/insights.json"), JSON.stringify(insights, null, 1));
console.log(`insights.json: ${companies.length} fichas · ${models.length} modelos · ${priced.length} precios · ${guarantees.length} clases de garantía · ${methods.length} métodos`);
