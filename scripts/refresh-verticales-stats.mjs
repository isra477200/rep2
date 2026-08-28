#!/usr/bin/env node
/**
 * Recalcula la estadística de verticales.json sobre la base actual SIN tocar
 * la síntesis editorial (tacticas, clienteIdeal, estacionalidad, guionApertura).
 * Restituye además el mapa id→vertical que consume build-cruces.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const data = JSON.parse(readFileSync(resolve(root, "public/data/verticales.json"), "utf8"));

const BUCKETS = [
  ["clinicas-salud", /(cl[ií]nic|dental|dentista|salud|m[eé]dic|paciente|est[eé]tic|fisio|health|doctor|veterinar)/i],
  ["reformas-hogar", /(reforma|construcc|obra|hogar|handwerk|contractor|fontaner|plumb|hvac|tejado|roof|electric|carpinter|pintor|renov|artisan|oficios|builder|home service)/i],
  ["solar-energia", /(solar|placas|fotovolta|energ[ií]a|photovolta|izi by edf)/i],
  ["inmobiliario", /(inmobiliar|real estate|propiedad|properties|vivienda|off.?plan|agentes? inmob)/i],
  ["legal", /(legal|abogad|law firm|jur[ií]dic|despacho)/i],
  ["coches-motor", /(coche|veh[ií]culo|automoci[oó]n|concesionario|car dealer|taller)/i],
  ["b2b-sdr", /(sdr|cold call|appointment|outbound|telemarketing|prospecc|b2b|reuniones (b2b|comerciales)|setter|closer)/i],
  ["directorios-marketplaces", /(directorio|marketplace|yellow ?pages|p[aá]ginas amarillas|listado|portal de|presupuestos|compara)/i],
  ["belleza-bienestar", /(belleza|peluquer|barber|sal[oó]n|spa|masaje|u[ñn]as)/i],
  ["hosteleria-turismo", /(restaurante|hostel|hotel|gastro|turis|reservas de mesa)/i],
];
const classify = (c) => {
  const hay = `${c.niche || ""} ${c.offer || ""} ${c.name} ${c.agencyType || ""}`;
  for (const [id, re] of BUCKETS) if (re.test(hay)) return id;
  return "generalista";
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const map = {};
const byBucket = new Map([...BUCKETS.map(([id]) => [id, []]), ["generalista", []]]);
for (const c of companies) { const b = classify(c); map[c.id] = b; byBucket.get(b).push(c); }

for (const v of data.verticales) {
  const list = byBucket.get(v.id) || [];
  const priced = list.filter((c) => (c.price?.eur || 0) > 0);
  const spain = list.filter((c) => c.primaryCountry === "España");
  v.n = list.length;
  v.spainN = spain.length;
  v.pricedN = priced.length;
  v.medianEur = priced.length >= 3 ? Math.round(median(priced.map((c) => c.price.eur))) : null;
  v.adsActivePct = list.length ? Math.round((list.filter((c) => (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0).length / list.length) * 100) : 0;
  v.referentes = [...list].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name, country: c.primaryCountry || "", score: c.score || 0 }));
}
data.map = map;
data.generatedAt = new Date().toLocaleDateString("es-ES");
writeFileSync(resolve(root, "public/data/verticales.json"), JSON.stringify(data, null, 1) + "\n");
console.log("verticales.json:", data.verticales.map((v) => `${v.id}:${v.n}`).join(" · "), "· map:", Object.keys(map).length);
