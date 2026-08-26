#!/usr/bin/env node
/**
 * Vuelca a las fichas la comprobación de actividad publicitaria (Google Ads
 * Transparency, indexado por dominio → fiable; y Meta si está disponible),
 * leída de db/ads-espana.json. Patchea public/data/companies-index.json in situ.
 * Ejecutar DESPUÉS de integrate-ampliacion.mjs y ANTES de build-insights/analytics.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const indexPath = resolve(root, "public/data/companies-index.json");
const adsPath = resolve(root, "db/ads-espana.json");
if (!existsSync(adsPath)) { console.log("db/ads-espana.json no existe; nada que aplicar."); process.exit(0); }

const index = JSON.parse(readFileSync(indexPath, "utf8"));
const ads = JSON.parse(readFileSync(adsPath, "utf8"));
const byDomain = new Map(ads.map((a) => [(a.domain || "").toLowerCase(), a]));

let patched = 0;
for (const c of index) {
  const a = byDomain.get((c.domain || "").toLowerCase());
  if (!a) continue;
  if (typeof a.googleAds === "number") c.googleAds = a.googleAds < 0 ? 0 : a.googleAds;
  if (a.googleStatus) c.googleStatus = a.googleStatus;
  if (typeof a.metaAds === "number") { c.metaAds = a.metaAds; c.metaStatus = a.metaStatus || c.metaStatus; }
  patched += 1;
}
writeFileSync(indexPath, JSON.stringify(index, null, 1));
const active = ads.filter((a) => a.googleActive).length;
console.log(`apply-ads: ${patched} fichas actualizadas · ${active} con anuncios de Google activos`);
