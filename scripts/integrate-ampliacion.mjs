#!/usr/bin/env node
/**
 * Integra la ampliación europea (db/panorama-europa-fuente.json) dentro del
 * catálogo único público (public/data/companies-index.json), sin silo aparte.
 *
 * - Cada empresa nueva se convierte en una ficha del catálogo con id "amp-<slug>".
 * - Nivel de verificación honesto: evidence "Probable", review "No aplica",
 *   decisión "Vigilar", sin puntuación (score 0) hasta completar la ficha madre.
 * - Ubicación: centroide del país (misma convención "centro_pais_mercado" que
 *   usa la base para puntos de mercado), con su limitación documentada.
 * - Idempotente: elimina las fichas "amp-" previas antes de volver a añadirlas.
 *
 * Ejecutar SIEMPRE antes de scripts/build-insights.mjs.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const indexPath = resolve(root, "public/data/companies-index.json");
import { readdirSync as _rd } from "node:fs";
const fuentesDir = resolve(root, "db/fuentes");
const source = _rd(fuentesDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(resolve(fuentesDir, f), "utf8")));
const geo = JSON.parse(readFileSync(resolve(root, "public/data/country-geo.json"), "utf8"));
const base = JSON.parse(readFileSync(indexPath, "utf8")).filter((c) => !c.id.startsWith("amp-"));

const OBSERVED_AT = "2026-08-23";
const geoByName = new Map(geo.map((g) => [g.name, g]));
// Alias de países cuyo nombre difiere entre la fuente y country-geo.json
geoByName.set("Chequia", geoByName.get("República Checa"));
geoByName.set("EE.UU.", geoByName.get("Estados Unidos"));

/** Normaliza países con coletillas ("España (multinacional)" → "España"). */
function normCountry(raw) {
  if (!raw) return "";
  let c = raw.split(" (")[0].split("/")[0].trim();
  if (c === "EE.UU.") c = "Estados Unidos";
  return c;
}
const existingDomains = new Set(base.map((c) => (c.domain || "").toLowerCase()));

const slug = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function classify(model) {
  const m = (model || "").toLowerCase();
  if (/(marketplace|broker|portal|directorio|venta de leads|leads? (a|para) (varios|terceros))/.test(m)) {
    return { scope: "Vertical — broker/marketplace", agencyType: "Lead broker / venta de leads" };
  }
  if (/(telemarketing|appointment|citas|reuni[oó]n|setter|m[oö]tesbok|booking)/.test(m)) {
    return { scope: "Núcleo — agencia/leadgen", agencyType: "Multi-nicho especializada" };
  }
  if (/(vertical|inmobiliari|dental|cl[ií]nic|solar|handwerk|trades|oficios)/.test(m)) {
    return { scope: "Núcleo — agencia/leadgen", agencyType: "Vertical de un solo nicho" };
  }
  return { scope: "Núcleo — agencia/leadgen", agencyType: "Generalista pymes" };
}

const added = [];
const seenNew = new Set();
for (const p of source) {
  const domain = (p.domain || "").toLowerCase();
  if (!domain || existingDomains.has(domain) || seenNew.has(domain)) continue;
  seenNew.add(domain);
  p.country = normCountry(p.country);
  const g = geoByName.get(p.country);
  const { scope, agencyType } = classify(p.model);
  const id = `amp-${slug(domain)}`;
  const bodyParts = [
    `## Estado de la ficha`,
    `Observación inicial de web pública (${OBSERVED_AT}). Ficha en verificación: los campos analíticos profundos (funnel, evidencias visuales, puntuación) se completarán al pasar el proceso de ficha madre. Nada de lo mostrado está inventado; lo no observado se marca como no comprobado.`,
    `## Modelo`,
    p.model || "No observable",
    `## Oferta observada`,
    p.offer || "No observable",
  ];
  if (p.public_price) bodyParts.push(`## Precio público`, `${p.public_price} (moneda local tal y como se publica; conversión pendiente de auditoría de tipo de cambio)`);
  if (p.guarantee) bodyParts.push(`## Garantía observada`, p.guarantee);
  if (p.relevance) bodyParts.push(`## Por qué está en el catálogo`, p.relevance);
  if (Array.isArray(p.sources) && p.sources.length) bodyParts.push(`## Fuentes consultadas`, p.sources.map((s) => `- ${s}`).join("\n"));

  added.push({
    id,
    name: p.name,
    title: p.name,
    domain,
    website: `https://${domain}`,
    country: p.country,
    primaryCountry: p.country,
    countries: [p.country],
    market: p.country,
    markets: [p.country],
    scope,
    agencyType,
    offer: p.offer || "",
    priceLocal: p.public_price || "",
    priceStatus: p.public_price ? "Observado" : "No observable",
    price: {
      currency: null,
      amount: null,
      eur: null,
      label: p.public_price
        ? `${p.public_price} (moneda local; conversión pendiente de auditoría)`
        : "Sin precio público observable",
    },
    ticket: "",
    contract: "",
    guarantee: p.guarantee || "",
    channels: [],
    metaStatus: "No comprobado",
    metaAds: 0,
    googleStatus: "No comprobado",
    googleAds: 0,
    creativeArchive: 0,
    score: 0,
    threat: "No aplica",
    relation: "Competidor indirecto",
    decision: "Vigilar",
    evidence: "Probable",
    proof: "",
    team: "",
    cta: "",
    funnel: "",
    niche: "",
    legal: "",
    review: "No aplica",
    reviewedAt: OBSERVED_AT,
    sources: Array.isArray(p.sources) ? p.sources : [],
    body: bodyParts.join("\n\n"),
    media: [],
    mediaDeclared: 0,
    location: g
      ? {
          companyId: id,
          latitude: g.latitude,
          longitude: g.longitude,
          precision: "centro_pais_mercado",
          locationLabel: `${p.country}: centro de país o mercado; no es sede.`,
          locality: null,
          canonicalMarket: p.country,
          commercialMarket: p.country,
          locationCountry: p.country,
          pointRepresents: "mercado o país canónico",
          headquartersVerified: false,
          sourceUrl: `https://${domain}`,
          coordinateSourceUrl: null,
          limitation: "El punto representa el país o mercado asociado a la ficha, no la ubicación de la empresa.",
          zoom: 4.2,
          reviewedAt: OBSERVED_AT,
        }
      : null,
  });
}

// Contrato de carga del portal: el índice viaja ligero (body y sources vacíos)
// y el dossier completo vive en company-details/<id>.json, que la ficha carga bajo demanda.
const detailsDir = resolve(root, "public/data/company-details");
for (const file of readdirSync(detailsDir)) {
  if (file.startsWith("amp-")) unlinkSync(resolve(detailsDir, file));
}
const lightweight = added.map((c) => ({ ...c, body: "", sources: [] }));
for (const c of added) {
  writeFileSync(resolve(detailsDir, `${c.id}.json`), JSON.stringify({ id: c.id, body: c.body, sources: c.sources }, null, 1));
}
writeFileSync(indexPath, JSON.stringify([...base, ...lightweight], null, 1));
console.log(`Catálogo único: ${base.length} fichas madre + ${added.length} en verificación = ${base.length + added.length} (dossiers amp-*: ${added.length})`);
