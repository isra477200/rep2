#!/usr/bin/env node
/**
 * Conserva hasta diez vistas previas representativas por anunciante de Google
 * Ads Transparency. Solo descarga imágenes públicas de googlesyndication y
 * publica rutas locales estables; nunca necesita ni persiste la clave SerpAPI.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  assertCompleteEditorialCoverage,
  resolveSerpApiMediaDestination,
  reusableDownloadedMedia,
  selectTransparencyMedia,
} from "./lib/serpapi-contracts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(ROOT, "db/serpapi-google-ads-spain-2026-08-27.json");
const MAP_PATH = resolve(ROOT, "scripts/data/serpapi-company-map.json");
const OUTPUT_PATH = resolve(ROOT, "public/data/serpapi-media-index.json");
const MEDIA_ROOT = resolve(ROOT, "public/media/serpapi-google");
const PER_COMPANY = 10;
const MAX_BYTES = 8 * 1024 * 1024;

for (const path of [SOURCE_PATH, MAP_PATH]) {
  if (!existsSync(path)) throw new Error(`Falta la entrada requerida: ${path}`);
}

const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
const review = JSON.parse(readFileSync(MAP_PATH, "utf8"));
assertCompleteEditorialCoverage(source, review.domains);
const previousIndex = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, "utf8"))
  : { items: {} };
const previousItems = previousIndex?.schema === "redvitalia-serpapi-media-index-v1"
  ? (previousIndex.items || {})
  : {};

const safePreview = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "tpc.googlesyndication.com") return null;
    if (!url.pathname.startsWith("/archive/simgad/")) return null;
    return url;
  } catch {
    return null;
  }
};

const selected = selectTransparencyMedia({
  creatives: source.transparencyCreatives,
  domainMappings: review.domains,
  safePreview,
  perCompany: PER_COMPANY,
});

const readLimited = async (response) => {
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > MAX_BYTES) throw new Error("imagen demasiado grande");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("imagen demasiado grande");
  return buffer;
};

const download = async (row) => {
  const destination = resolveSerpApiMediaDestination(MEDIA_ROOT, row.companyId, row.creativeId);
  const response = await fetch(row.previewUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const input = await readLimited(response);
  const image = sharp(input, { animated: false, failOn: "warning", limitInputPixels: 50_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < 40 || metadata.height < 24) {
    throw new Error("vista previa sin dimensiones útiles");
  }
  const output = await image
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 92, effort: 4 })
    .toBuffer();
  const final = await sharp(output).metadata();
  mkdirSync(destination.directory, { recursive: true });
  writeFileSync(destination.absolute, output);
  const file = destination.file;
  return {
    creativeId: row.creativeId,
    advertiserId: row.advertiserId,
    companyId: row.companyId,
    domain: row.domain,
    format: row.format,
    selectionRank: row.selectionRank,
    file,
    posterFile: file,
    videoFile: null,
    mediaAssets: [{
      file,
      localFile: file,
      type: "image/webp",
      role: "google_ads_transparency_preview",
      width: final.width || null,
      height: final.height || null,
      bytes: output.length,
      sha256: createHash("sha256").update(output).digest("hex"),
    }],
    previewUrl: row.previewUrl,
    sourceUrl: row.detailsUrl,
    width: final.width || null,
    height: final.height || null,
    bytes: output.length,
    sha256: createHash("sha256").update(output).digest("hex"),
    status: "downloaded",
  };
};

const items = {};
let cursor = 0;
const workers = Array.from({ length: Math.min(5, selected.length || 1) }, async () => {
  while (cursor < selected.length) {
    const row = selected[cursor++];
    const reusable = reusableDownloadedMedia({
      item: previousItems[row.creativeId],
      row,
      mediaRoot: MEDIA_ROOT,
    });
    if (reusable) {
      items[row.creativeId] = reusable;
      continue;
    }
    try {
      items[row.creativeId] = await download(row);
    } catch (error) {
      items[row.creativeId] = {
        creativeId: row.creativeId,
        advertiserId: row.advertiserId,
        companyId: row.companyId,
        domain: row.domain,
        format: row.format,
        selectionRank: row.selectionRank,
        file: null,
        previewUrl: row.previewUrl,
        sourceUrl: row.detailsUrl,
        status: "failed",
        reason: String(error?.message || error).slice(0, 240),
      };
    }
  }
});
await Promise.all(workers);

const orderedItems = Object.fromEntries(Object.values(items)
  .sort((left, right) => left.companyId.localeCompare(right.companyId, "es")
    || left.selectionRank - right.selectionRank
    || left.creativeId.localeCompare(right.creativeId))
  .map((item) => [item.creativeId, item]));
const output = {
  schema: "redvitalia-serpapi-media-index-v1",
  generatedAt: new Date().toISOString(),
  source: "db/serpapi-google-ads-spain-2026-08-27.json",
  policy: `Hasta ${PER_COMPANY} previews estáticas por anunciante con asociación editorial; vídeos dinámicos conservan URL de evidencia pero no se incrustan.`,
  summary: {
    selected: selected.length,
    downloaded: Object.values(orderedItems).filter((item) => item.status === "downloaded").length,
    failed: Object.values(orderedItems).filter((item) => item.status === "failed").length,
    companies: new Set(Object.values(orderedItems).map((item) => item.companyId)).size,
  },
  items: orderedItems,
};
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
const temporary = `${OUTPUT_PATH}.tmp`;
writeFileSync(temporary, `${JSON.stringify(output, null, 1)}\n`, "utf8");
renameSync(temporary, OUTPUT_PATH);
console.log(`SerpAPI media: ${output.summary.downloaded}/${output.summary.selected} previews en ${output.summary.companies} empresas.`);
