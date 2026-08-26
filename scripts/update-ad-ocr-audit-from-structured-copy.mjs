#!/usr/bin/env node
/**
 * Extiende la auditoría OCR cuando una creatividad nueva ya trae copy literal
 * de la API. En ese caso OCR sería redundante y se registra no_necesario.
 * Conserva intactos todos los resultados OCR históricos.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = resolve(".");
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const identities = read("public/data/ad-media-identity.json").items || [];
const corpus = read("public/data/ad-corpus.json").items || [];
const companies = read("public/data/companies-index.json");
const audit = read("public/data/ad-ocr-audit.json");
const transcriptPath = resolve(root, "public/data/ad-ocr-transcripts.json");
const transcripts = read("public/data/ad-ocr-transcripts.json");
const ocrRunPath = resolve(root, "work/ad-ocr-final.json");
const ocrRun = existsSync(ocrRunPath)
  ? JSON.parse(readFileSync(ocrRunPath, "utf8"))
  : { items: [] };
const companyById = new Map(companies.map((company) => [company.id, company]));
const previous = new Map(
  (audit.items || []).map((item) => [
    `${item.companyId}:${item.platform}:${item.externalId}`,
    item,
  ]),
);
const ocrByIdentity = new Map(
  (ocrRun.items || []).map((item) => [
    `${item.companyId}:${item.platform}:${item.externalId}`,
    item,
  ]),
);
const structured = new Map();
for (const item of corpus) {
  if (item.origen !== "api_scrapecreators" || !item.externalId || !item.copyAvailable) continue;
  structured.set(`${item.id}:meta:${item.externalId}`, item);
}

const hashFile = (publicFile) => {
  const path = resolve(root, "public", String(publicFile || "").replace(/^\/+/, ""));
  return existsSync(path)
    ? createHash("sha256").update(readFileSync(path)).digest("hex")
    : null;
};
const mediaType = (file) => {
  const extension = extname(String(file || "")).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) return "image";
  if ([".mp4", ".webm", ".mov"].includes(extension)) return "video";
  return "other";
};

const items = identities.map((identity) => {
  const key = `${identity.companyId}:${identity.platform}:${identity.externalId}`;
  const old = previous.get(key);
  if (old && old.estadoOcr !== "pendiente") {
    return {
      ...old,
      file: identity.file,
      variantCount: identity.variantCount,
      archivoSha256: hashFile(identity.file) || old.archivoSha256 || null,
    };
  }
  const ocr = ocrByIdentity.get(key);
  if (ocr) {
    const usable = ocr.usable === true;
    const confidence = Math.max(0, Math.min(100, Number(ocr.confidence || 0)));
    return {
      ...identity,
      country: companyById.get(identity.companyId)?.primaryCountry || "Sin país",
      mediaType: mediaType(identity.file),
      archivoSha256: ocr.archivoSha256 || hashFile(identity.file),
      estadoOcr: usable
        ? confidence >= 90
          ? "completo_alta"
          : confidence >= 75
            ? "completo_media"
            : "completo_baja"
        : ocr.status === "fallido"
          ? "fallido"
          : "sin_texto",
      confianzaOcr: confidence,
      intentosOcr: Number(ocr.attempts || 0),
      motorOcr: ocr.engine || "tesseract.js@7",
      idiomasOcr: ocr.ocrLanguages || null,
      motivoOcr: ocr.reason || null,
      textoUtil: usable,
      joinMethod: "external_id",
    };
  }
  const copy = structured.get(key);
  const common = {
    ...identity,
    country: companyById.get(identity.companyId)?.primaryCountry || "Sin país",
    mediaType: mediaType(identity.file),
    archivoSha256: hashFile(identity.file),
  };
  if (copy) {
    return {
      ...common,
      estadoOcr: "no_necesario",
      confianzaOcr: null,
      intentosOcr: 0,
      motorOcr: null,
      idiomasOcr: null,
      motivoOcr: "copy_literal_api_scrapecreators_disponible",
      textoUtil: true,
      joinMethod: "external_id",
    };
  }
  return {
    ...common,
    estadoOcr: "pendiente",
    confianzaOcr: null,
    intentosOcr: 0,
    motorOcr: null,
    idiomasOcr: null,
    motivoOcr: "sin_copy_estructurado_ni_resultado_ocr",
    textoUtil: false,
    joinMethod: "external_id",
  };
});
const statusCounts = items.reduce((counts, item) => {
  counts[item.estadoOcr] = (counts[item.estadoOcr] || 0) + 1;
  return counts;
}, {});
const output = {
  ...audit,
  generatedAt: "2026-08-26",
  note: "Auditoría exhaustiva por identidad creativa. Conserva OCR histórico y marca no_necesario cuando ScrapeCreators entrega copy literal estructurado; no confunde copy de biblioteca con lectura visual.",
  totalAssets: items.length,
  statusCounts,
  attemptedAssets: items.filter((item) => item.intentosOcr > 0).length,
  assetsWithUsableText: items.filter((item) => item.textoUtil).length,
  assetsPending: items.filter((item) => item.estadoOcr === "pendiente").length,
  items,
};
writeFileSync(
  resolve(root, "public/data/ad-ocr-audit.json"),
  `${JSON.stringify(output, null, 1)}\n`,
  "utf8",
);

// Publica el texto de las identidades que estaban pendientes y ahora sí tienen
// OCR útil, sin reescribir ni degradar las transcripciones históricas.
const transcriptItems = [...(transcripts.items || [])];
const transcriptKeys = new Set(
  transcriptItems.map((item) => `${item.id}:${item.platformFamily || "unknown"}:${item.externalId || item.file}`),
);
const titleFrom = (value) =>
  String(value || "").split("\n").map((line) => line.trim()).find((line) => line.length >= 4)?.slice(0, 180) ||
  "Texto visible sin titular separado";
const priceFrom = (value) =>
  [...new Set(String(value || "").match(/(?:€|EUR|USD|US\$|\$)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|EUR|USD|US\$|\$)/gi) || [])]
    .slice(0, 4)
    .join(" · ");
let recovered = 0;
for (const [key, old] of previous) {
  if (old.estadoOcr !== "pendiente") continue;
  const ocr = ocrByIdentity.get(key);
  if (!ocr?.usable || !String(ocr.text || "").trim()) continue;
  const identity = identities.find(
    (item) => `${item.companyId}:${item.platform}:${item.externalId}` === key,
  );
  if (!identity) continue;
  const transcriptKey = `${identity.companyId}:${identity.platform}:${identity.externalId}`;
  if (transcriptKeys.has(transcriptKey)) continue;
  const confidence = Math.max(0, Math.min(100, Number(ocr.confidence || 0)));
  transcriptItems.push({
    file: identity.file,
    id: identity.companyId,
    name: companyById.get(identity.companyId)?.name || identity.companyId,
    country: companyById.get(identity.companyId)?.primaryCountry || "Sin país",
    plataforma: "Meta Ads Library · archivo local",
    platformFamily: "meta",
    externalId: identity.externalId,
    titular: titleFrom(ocr.text),
    texto: String(ocr.text).trim(),
    cta: "",
    precioVisible: priceFrom(ocr.text),
    angulo: "texto visual recuperado por OCR",
    capturaEnVivo: false,
    fecha: "2026-08-26",
    origen: "ocr_captura",
    transcripcion: "OCR automático sobre creatividad local con identidad Meta exacta",
    confianza: confidence,
    estadoEvidencia: "OCR automático · pendiente de revisión literal",
    estadoOcr: confidence >= 90 ? "completo_alta" : confidence >= 75 ? "completo_media" : "completo_baja",
    intentosOcr: Number(ocr.attempts || 0),
    motorOcr: ocr.engine || "tesseract.js@7",
    idiomasOcr: ocr.ocrLanguages || null,
    motivoOcr: ocr.reason || null,
    archivoSha256: ocr.archivoSha256 || hashFile(identity.file),
    atribucion: "asociada_a_ficha",
    aptaPatrones: false,
  });
  transcriptKeys.add(transcriptKey);
  recovered += 1;
}
transcriptItems.sort(
  (left, right) =>
    String(left.id).localeCompare(String(right.id), "es") ||
    String(left.externalId || left.file).localeCompare(String(right.externalId || right.file), "es"),
);
writeFileSync(
  transcriptPath,
  `${JSON.stringify({
    ...transcripts,
    generatedAt: "2026-08-26",
    nota: "OCR trazable a archivo e identidad externa. Incluye recuperación puntual de creatividades API sin copy estructurado; nunca sustituye al original.",
    total: transcriptItems.length,
    companies: new Set(transcriptItems.map((item) => item.id)).size,
    items: transcriptItems,
  }, null, 1)}\n`,
  "utf8",
);
console.log(`OCR audit: ${items.length} activos · ${statusCounts.no_necesario || 0} no necesitan OCR · ${statusCounts.pendiente || 0} pendientes · ${recovered} textos nuevos recuperados.`);
