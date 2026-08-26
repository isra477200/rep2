#!/usr/bin/env node
/** Completa la lectura comercial de las landings capturadas sin inventar datos. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = JSON.parse(
  readFileSync(resolve(root, "scripts/data/scrapecreators-landing-targets.json"), "utf8"),
).items;
const source = JSON.parse(
  readFileSync(resolve(root, "db/scrapecreators-companies.json"), "utf8"),
);
const sourceById = new Map(source.map((row) => [row.id, row]));
const outputPath = resolve(root, "public/data/scrapecreators-landing-analysis.json");

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const absent = (value) =>
  !clean(value) || /^(?:no (?:observad[oa]|localizad[oa]|publicad[oa])|sin (?:garant[ií]a|url)|n\/?a)[.\s]*$/i.test(clean(value));
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const proofPattern = /(?:casos? de [eé]xito|resultados?|testimonios?|opiniones?|reseñas?|clientes?|empresas que|confían|confian|historias? reales?)/i;

const items = [];
let updated = 0;
for (const target of targets) {
  const path = resolve(root, `public/data/site-captures/${target.id}.json`);
  if (!existsSync(path)) continue;
  const record = JSON.parse(readFileSync(path, "utf8"));
  const company = sourceById.get(target.id);
  const pages = (record.pages || []).filter((page) => page.status === "captured" && page.text);
  const headings = unique(pages.flatMap((page) => page.text?.headings || []));
  const ctas = unique(pages.flatMap((page) => page.text?.ctas || []));
  const headline = clean(record.commercialRead?.headline || pages.find((page) => page.text?.h1)?.text?.h1);
  const proofHeadings = headings.filter((heading) => proofPattern.test(heading)).slice(0, 5);
  record.commercialRead ||= {};
  if (!record.commercialRead.promise && headline) record.commercialRead.promise = headline;
  if (!record.commercialRead.audience && company?.model) {
    record.commercialRead.audience = `Público inferido de la especialización declarada: ${company.model}`;
  }
  if (!record.commercialRead.offer && company?.offer) {
    record.commercialRead.offer = company.offer;
  }
  if (!record.commercialRead.price && company && !absent(company.priceLocal)) {
    record.commercialRead.price = company.priceLocal;
  }
  if (!record.commercialRead.guarantee && company && !absent(company.guarantee)) {
    record.commercialRead.guarantee = company.guarantee;
  }
  if (!record.commercialRead.proof && proofHeadings.length) {
    record.commercialRead.proof = `Secciones de prueba observadas en la página: ${proofHeadings.join(" · ")}. Su presencia no valida las cifras que contengan.`;
  }
  record.commercialReadAttribution = {
    status: "observed_not_performance_validated",
    note: "Titulares, CTA y secciones proceden de la captura pública. Oferta, precio y garantía se atribuyen al anunciante; no son resultados verificados por RedVitalia.",
    observedAt: "2026-08-26",
  };
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  updated += 1;
  items.push({
    id: target.id,
    name: record.name || target.name,
    url: target.url,
    status: record.status,
    capturedPages: pages.length,
    headline: headline || null,
    primaryCta: record.commercialRead.primaryCta || null,
    promise: record.commercialRead.promise || null,
    audience: record.commercialRead.audience || null,
    offer: record.commercialRead.offer || null,
    mechanism: record.commercialRead.mechanism || [],
    price: record.commercialRead.price || null,
    guarantee: record.commercialRead.guarantee || null,
    proof: record.commercialRead.proof || null,
    headings: headings.slice(0, 24),
    ctas: ctas.slice(0, 24),
    limitation: "Lectura de superficie pública; no demuestra inversión, conversiones, ventas ni cumplimiento de promesas.",
  });
}

writeFileSync(
  outputPath,
  `${JSON.stringify({
    schema: "redvitalia-scrapecreators-landing-analysis-v1",
    generatedAt: "2026-08-26",
    note: "Lectura estructurada de landings capturadas sin enviar formularios. Claims siempre atribuidos al anunciante.",
    total: items.length,
    complete: items.filter((item) => item.status === "complete").length,
    partial: items.filter((item) => item.status === "partial").length,
    items,
  }, null, 1)}\n`,
  "utf8",
);
console.log(`Landings ScrapeCreators sintetizadas: ${updated}; completas ${items.filter((item) => item.status === "complete").length}.`);
