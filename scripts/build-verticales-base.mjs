#!/usr/bin/env node
/**
 * Fase 1 de los playbooks por nicho: clasifica las 938 fichas en verticales
 * y calcula la estadística de cada uno. Escribe:
 *  - public/data/verticales.json (estadística; la síntesis editorial se añade en fase 2)
 *  - /tmp/verticales-input/*.json (material por vertical para los agentes de síntesis)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const takeaways = JSON.parse(readFileSync(resolve(root, "public/data/takeaways.json"), "utf8")).items;

const BUCKETS = [
  { id: "clinicas-salud", label: "Clínicas y salud", re: /(cl[ií]nic|dental|dentista|salud|m[eé]dic|paciente|est[eé]tic|fisio|health|doctor|veterinar)/i },
  { id: "reformas-hogar", label: "Reformas, obra y hogar", re: /(reforma|construcc|obra|hogar|handwerk|contractor|fontaner|plumb|hvac|tejado|roof|electric|carpinter|pintor|renov|artisan|oficios|builder|home service)/i },
  { id: "solar-energia", label: "Solar y energía", re: /(solar|placas|fotovolta|energ[ií]a|photovolta|izi by edf)/i },
  { id: "inmobiliario", label: "Inmobiliario", re: /(inmobiliar|real estate|propiedad|properties|vivienda|off.?plan|agentes? inmob)/i },
  { id: "legal", label: "Legal y despachos", re: /(legal|abogad|law firm|jur[ií]dic|despacho)/i },
  { id: "coches-motor", label: "Coches y motor", re: /(coche|veh[ií]culo|automoci[oó]n|concesionario|car dealer|taller)/i },
  { id: "b2b-sdr", label: "B2B, SDR y citas", re: /(sdr|cold call|appointment|outbound|telemarketing|prospecc|b2b|reuniones (b2b|comerciales)|setter|closer)/i },
  { id: "directorios-marketplaces", label: "Directorios y marketplaces", re: /(directorio|marketplace|yellow ?pages|p[aá]ginas amarillas|listado|portal de|presupuestos|compara)/i },
  { id: "belleza-bienestar", label: "Belleza y bienestar", re: /(belleza|peluquer|barber|sal[oó]n|spa|masaje|u[ñn]as)/i },
  { id: "hosteleria-turismo", label: "Hostelería y turismo", re: /(restaurante|hostel|hotel|gastro|turis|reservas de mesa)/i },
];
const classify = (c) => {
  const hay = `${c.niche || ""} ${c.offer || ""} ${c.name} ${c.agencyType || ""}`;
  for (const b of BUCKETS) if (b.re.test(hay)) return b.id;
  return "generalista";
};
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

const byBucket = new Map(BUCKETS.map((b) => [b.id, []]).concat([["generalista", []]]));
for (const c of companies) byBucket.get(classify(c)).push(c);

mkdirSync("/tmp/verticales-input", { recursive: true });
const verticales = [];
for (const bucket of [...BUCKETS, { id: "generalista", label: "Generalistas y multi-nicho" }]) {
  const list = byBucket.get(bucket.id);
  const priced = list.filter((c) => c.price?.eur > 0);
  const spain = list.filter((c) => c.primaryCountry === "España");
  const referentes = [...list].sort((a, b) => b.score - a.score).slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry, score: c.score }));
  verticales.push({
    id: bucket.id,
    label: bucket.label,
    n: list.length,
    spainN: spain.length,
    medianEur: priced.length >= 3 ? Math.round(median(priced.map((c) => c.price.eur))) : null,
    pricedN: priced.length,
    adsActivePct: list.length ? Math.round((list.filter((c) => (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0).length / list.length) * 100) : 0,
    referentes,
    // fase 2 (síntesis editorial de los agentes):
    tacticas: [], clienteIdeal: "", estacionalidad: "", guionApertura: "",
  });
  // material para el agente de síntesis
  const material = [...list].sort((a, b) => b.score - a.score).slice(0, 25).map((c) => ({
    id: c.id, name: c.name, country: c.primaryCountry, score: c.score,
    offer: c.offer, price: c.priceLocal, guarantee: c.guarantee, cta: c.cta,
    takeaway: takeaways[c.id]?.t || "",
  }));
  writeFileSync(`/tmp/verticales-input/${bucket.id}.json`, JSON.stringify({ id: bucket.id, label: bucket.label, stats: verticales[verticales.length - 1], material }));
}

writeFileSync(resolve(root, "public/data/verticales.json"), JSON.stringify({ generatedAt: "23/08/2026", nota: "Estadística calculada sobre la base; tácticas, cliente ideal y estacionalidad son síntesis editorial sobre las fichas citadas.", verticales }, null, 1) + "\n");
console.log(verticales.map((v) => `${v.id}: ${v.n} fichas (${v.spainN} ES) · mediana ${v.medianEur ?? "—"} €`).join("\n"));
