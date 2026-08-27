#!/usr/bin/env node
/* eslint-disable no-control-regex */
/**
 * Construye el corpus buscable del Laboratorio de anuncios.
 *
 * Capas, siempre separadas:
 *  1. curado_literal: las 179 transcripciones manuales existentes;
 *  2. biblioteca_estructurada: copy exacto ligado a un ID público de Meta/Google;
 *  3. ocr_captura: OCR trazable a archivo/hash, excluido de patrones por defecto.
 *
 * Nunca convierte frecuencia en rendimiento ni llama "ganador" a una pieza.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { francAll } from "franc-min";
import {
  canonicalAdCompanyId,
} from "./ad-aliases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const detailsDir = resolve(root, "public/data/company-details");
const outputPath = resolve(root, "public/data/ad-corpus.json");
const ocrPath = resolve(root, "public/data/ad-ocr-transcripts.json");
const ocrAuditPath = resolve(root, "public/data/ad-ocr-audit.json");
const translationsPath = resolve(root, "public/data/ad-translations-es.json");
const coveragePath = resolve(root, "public/data/ad-coverage.json");
const scrapeCreatorsPath = resolve(root, "db/scrapecreators-spain-leadgen.json");
const scrapeCreatorsMapPath = resolve(root, "scripts/data/scrapecreators-company-map.json");
const scrapeCreatorsMediaPath = resolve(root, "public/data/scrapecreators-media-index.json");
const leadMarketPath = resolve(root, "db/leads-market-spain-2026-08-26.json");
const leadMarketReviewPath = resolve(root, "scripts/data/leads-market-company-review.json");
const TRANSLATION_RECIPE_VERSION = "rv-mt-es-v22";
const TRANSLATABLE_LANGUAGES = new Set([
  "en", "fr", "de", "it", "ru", "pt", "tr", "ar", "ja", "zh", "ko", "he",
  "id", "vi", "th", "pl", "nl", "da",
]);
const LANGUAGE_HASH_OVERRIDES = new Map([
  ["16ae6a2486b75df57b1b5e39b202817b99445d9afe9a90388b26a37e593b0753", { code: "ja", confidence: 0.99, source: "reviewed" }],
  ["95fc78e46ceb804d956249bea96e8551ec05b96b67221d4f9ca3182d4837363f", { code: "ja", confidence: 0.99, source: "reviewed" }],
  ["cc5f35cd44feb56646e069a96126bf5ec4d9956711123452674989b36d9c5f09", { code: "ja", confidence: 0.99, source: "reviewed" }],
  ["6319d695cfbc8f35d094ec1303220f30a281525bc293ba4671010c8262662c2d", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["d481b8d949fec5ce5caba859be2ee5172ec5c3a590cd217c2cbed9f8dd1d48ff", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["12271941c4e249b3407c060ae23071ec201b7d8a6d53817a4575ea7d9a233008", { code: "it", confidence: 0.99, source: "reviewed" }],
  ["20f09eccdb9691f3d415845419ed932f0bfc05fd5d7d8613a700e7a70d6d73ef", { code: "it", confidence: 0.99, source: "reviewed" }],
  ["acd15f465966b3d7e6e38d94e68303ca2b88b3d7485933b52f47912790a0b754", { code: "it", confidence: 0.99, source: "reviewed" }],
  // Copies españoles con CTA de plataforma en inglés. La revisión del cuerpo
  // evita que un CTA corto fuerce una traducción innecesaria y degradada.
  ["dc38d7216fb7691c81ddef5b76f0c5a249903a6336305cebe5346848679ce31f", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["b9b5a320234fcaa24b3b40c15b83fcb44e30058306bb2b3668f063938590f72e", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["cc1febc4c2667b2f25c51470801830bb56b741f36fdf4795ec8d26d380d45dcb", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["cd6978fbf6cc3cf8b7fdd38571cd177f08a85c5e23c7ac4f7183df2cfc79bf95", { code: "es", confidence: 0.99, source: "reviewed" }],
  ["62ef33ef967277744f6154e9fc65cc4eb9d22d868085016c8c0e7ea9f17c976b", { code: "es", confidence: 0.99, source: "reviewed" }],
]);

const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const companyById = new Map(companies.map((company) => [company.id, company]));
const manualData = JSON.parse(readFileSync(resolve(root, "public/data/anuncios-reales.json"), "utf8"));
const ocrData = existsSync(ocrPath)
  ? JSON.parse(readFileSync(ocrPath, "utf8"))
  : { items: [], total: 0, companies: 0 };
const ocrAuditData = existsSync(ocrAuditPath)
  ? JSON.parse(readFileSync(ocrAuditPath, "utf8"))
  : { items: [], totalAssets: 0 };
const translationsData = existsSync(translationsPath)
  ? JSON.parse(readFileSync(translationsPath, "utf8"))
  : { items: [] };
const coverageData = existsSync(coveragePath)
  ? JSON.parse(readFileSync(coveragePath, "utf8"))
  : null;
const scrapeCreatorsData = existsSync(scrapeCreatorsPath)
  ? JSON.parse(readFileSync(scrapeCreatorsPath, "utf8"))
  : { items: [] };
const scrapeCreatorsMap = existsSync(scrapeCreatorsMapPath)
  ? JSON.parse(readFileSync(scrapeCreatorsMapPath, "utf8"))
  : { pageIds: {} };
const scrapeCreatorsMedia = existsSync(scrapeCreatorsMediaPath)
  ? JSON.parse(readFileSync(scrapeCreatorsMediaPath, "utf8"))
  : { items: {} };
const leadMarketData = existsSync(leadMarketPath)
  ? JSON.parse(readFileSync(leadMarketPath, "utf8"))
  : { items: [] };
const leadMarketReview = existsSync(leadMarketReviewPath)
  ? JSON.parse(readFileSync(leadMarketReviewPath, "utf8"))
  : { pageIds: {} };

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u2066-\u2069]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const plainMarkdown = (value) =>
  normalizeText(value)
    .replace(/\[([^\]]+)]\((?:https?:\/\/|mailto:)[^)]+\)/g, "$1")
    .replaceAll("\\[", "[")
    .replaceAll("\\]", "]")
    .replace(/[*_`]/g, "")
    .trim();

const comparisonText = (value) =>
  plainMarkdown(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value) =>
  new Set(comparisonText(value).split(" ").filter((token) => token.length > 2));

const isUseful = (value) =>
  comparisonText(value).length >= 18 && tokens(value).size >= 3;

const similar = (left, right) => {
  const aText = comparisonText(left);
  const bText = comparisonText(right);
  if (!aText || !bText) return false;
  if (aText === bText) return true;
  const shorter = aText.length < bText.length ? aText : bText;
  const longer = aText.length < bText.length ? bText : aText;
  if (shorter.length >= 45 && longer.includes(shorter)) return true;
  const a = tokens(aText);
  const b = tokens(bText);
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union > 0 && intersection / union >= 0.82;
};

const uniqueLines = (value) => {
  const seen = new Set();
  return normalizeText(value)
    .split("\n")
    .map((line) => plainMarkdown(line.replace(/^>\s?/, "")))
    .filter(Boolean)
    .filter((line) => {
      const key = comparisonText(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
};

const titleFrom = (text) => {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .filter((line) => line.length >= 4 && !/^https?:|^www\./i.test(line));
  return (lines.find((line) => line.length <= 140) || lines[0] || "Creatividad sin titular separado").slice(0, 180);
};

const ctaFrom = (text) => {
  const pattern = /(m[aá]s informaci[oó]n|learn more|book now|agenda|solicita|descubre|contacta|empieza|comienza|reg[ií]strate|haz clic|click|visita|llama|escr[ií]benos|get started|apply|sign up|free quote|download|shop now)/i;
  return normalizeText(text)
    .split("\n")
    .reverse()
    .find((line) => pattern.test(line) && line.length <= 180) || "";
};

const priceFrom = (text) => {
  const matches = normalizeText(text).match(/(?:€|EUR|USD|US\$|\$)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|EUR|USD|US\$|\$)/gi);
  return matches ? [...new Set(matches)].slice(0, 4).join(" · ") : "";
};

const angleFrom = (text) => {
  const value = comparisonText(text);
  const rules = [
    [/(exclusiv|una sola empresa|one company|only one|tu zona|your area|territor)/, "exclusividad territorial"],
    [/(garant|devolu|refund|money back|gratis si|free until|no cobr)/, "garantía o riesgo invertido"],
    [/(\b\d+\s*(clientes|leads|citas|visitas|ventas|customers|appointments|calls|days|dias|horas|hours|%))/, "resultado o cifra concreta"],
    [/(24 ?h|48 ?h|minut|rapido|rapid|instant|same day|today)/, "velocidad o SLA"],
    [/(€|eur|usd|\$|precio|price|desde|from only|per lead|por lead)/, "precio visible"],
    [/(caso de exito|testimoni|review|trusted by|years|anos|clientes satisfechos)/, "prueba social o autoridad"],
    [/(sin suficientes|no tienes|problema|pierdes|perdiendo|struggl|tired of|stop wasting|competencia)/, "dolor y agitación del problema"],
    [/(gratis|free|auditoria|audit|demo|diagnostico|consulta)/, "entrada gratuita o lead magnet"],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || "propuesta de valor";
};

const scrapeCreatorsMediaItems = Array.isArray(scrapeCreatorsMedia.items)
  ? scrapeCreatorsMedia.items.map((item) => [String(item.externalId || ""), item])
  : Object.entries(scrapeCreatorsMedia.items || {});
const scrapeCreatorsMediaById = new Map(
  scrapeCreatorsMediaItems.filter(([externalId]) => /^\d{10,}$/.test(externalId)),
);

const publicMediaFile = (value) => {
  const file = String(value || "").trim();
  if (!/^\/media\/[a-z0-9_./-]+$/i.test(file)) return "";
  return existsSync(resolve(root, "public", file.replace(/^\/+/, ""))) ? file : "";
};

const localMediaAssets = (value) => (Array.isArray(value) ? value : [])
  .map((asset) => {
    if (typeof asset === "string") return publicMediaFile(asset);
    if (!asset || typeof asset !== "object") return null;
    const file = publicMediaFile(asset.file || asset.localFile);
    const posterFile = publicMediaFile(asset.posterFile);
    if (!file && !posterFile) return null;
    return {
      ...asset,
      ...(file ? { file, localFile: file } : {}),
      ...(posterFile ? { posterFile } : {}),
      // El índice público solo aporta medios locales; nunca propagamos URLs
      // efímeras de Meta a otro JSON público.
      url: undefined,
      sourceUrl: undefined,
      posterUrl: undefined,
    };
  })
  .filter(Boolean);

const isHighConfidenceMatch = (value) =>
  String(value || "").trim().toLocaleLowerCase("en") === "high";

// El informe secundario marcaba cualquier cifra en euros como “precio”. Solo
// estas menciones tienen contexto de precio pagable revisado; el resto se
// conserva en el copy, pero no alimenta el filtro de precio del laboratorio.
const LEAD_MARKET_REVIEWED_PRICES = new Map([
  ["2076944506550929", "10 €/lead"],
  ["1403656351829330", "10 €/lead"],
  ["1377645054476359", "10 €/lead"],
  ["1072452485525268", "10 €/lead"],
  ["1551160893052106", "79,99 €/mes"],
  ["1748414716364402", "129 €/mes"],
  ["1967587027234094", "19 €/mes"],
]);

const metaIdentity = (externalId) => {
  const id = String(externalId || "").trim();
  return /^\d{10,}$/.test(id) ? `meta:${id}` : "";
};

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return plainMarkdown(match[1]);
  }
  return "";
};

const allMatches = (value, pattern) =>
  [...value.matchAll(pattern)].map((match) => plainMarkdown(match[1])).filter(Boolean);

const STOP_TOKENS = new Set([
  "agencia", "agency", "marketing", "digital", "leads", "lead", "group", "grupo",
  "service", "services", "solutions", "company", "consulting", "media", "online",
  "inc", "ltd", "llc", "gmbh", "srl", "slu", "sas", "com", "net", "the",
]);

const brandTokens = (company) => {
  const domain = String(company.domain || company.website || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[./]/)[0];
  return [...tokens(`${company.name} ${domain}`)]
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
};

const confirmsBrand = (company, advertiser, text) => {
  const evidence = comparisonText(`${advertiser} ${text}`);
  return brandTokens(company).some((token) => evidence.includes(token));
};

const isAbsenceRecord = (item) =>
  /(?:^|\b)(?:0 anuncios|sin anuncios activos|sin resultados atribuibles)(?:\b|$)/i.test(
    `${item.titular || ""} ${item.texto || ""}`,
  );

const coverageRows = coverageData?.companies || coverageData?.rows || coverageData?.items || [];
const coverageEvidence = new Map();
for (const evidence of coverageData?.creativeFiles || []) {
  const externalId = String(evidence.externalId || evidence.id || "").toUpperCase();
  const companyId = evidence.companyId || evidence.id;
  if (companyId && externalId) coverageEvidence.set(`${companyId}:${externalId}`, evidence);
}
for (const row of Array.isArray(coverageRows) ? coverageRows : []) {
  for (const evidence of row.evidence || row.creatives || []) {
    const externalId = String(evidence.externalId || evidence.id || "").toUpperCase();
    if (!externalId) continue;
    const companyId = row.companyId || row.id;
    if (companyId) coverageEvidence.set(`${companyId}:${externalId}`, evidence);
  }
}

const findCoverageEvidence = (companyId, externalId) =>
  coverageEvidence.get(`${companyId}:${String(externalId).toUpperCase()}`) || null;

const manual = manualData.items.map((item, index) => {
  const id = companyById.has(item.id) ? item.id : canonicalAdCompanyId(item.id);
  const company = companyById.get(id);
  return {
    ...item,
    observedId: item.id !== id ? item.id : (item.observedId || null),
    observedName: item.id !== id ? item.name : (item.observedName || null),
    id,
    name: company?.name || item.name,
    origen: item.origen || "curado_literal",
    transcripcion: item.transcripcion || "Manual sobre captura o biblioteca pública",
    estadoEvidencia: item.estadoEvidencia || "Texto curado · literal o ilegible marcado",
    atribucion: item.atribucion || "propia_confirmada",
    aptaPatrones: isAbsenceRecord(item) ? false : (item.aptaPatrones ?? true),
    corpusKey: `manual:${id}:${String(index + 1).padStart(3, "0")}`,
  };
});

const structured = [];
const externalSeen = new Set();
for (const file of readdirSync(detailsDir).filter((name) => name.endsWith(".json")).sort()) {
  const detail = JSON.parse(readFileSync(resolve(detailsDir, file), "utf8"));
  const canonicalId = companyById.has(detail.id)
    ? detail.id
    : canonicalAdCompanyId(detail.id);
  const company = canonicalId ? companyById.get(canonicalId) : null;
  if (!company) continue;
  const headings = [...String(detail.body || "").matchAll(/^## Anuncio consolidado · (.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const externalId = headings[index][1].trim();
    if (!/^(?:CR\d{10,}|\d{10,})$/i.test(externalId)) continue;
    const start = headings[index].index;
    const end = headings[index + 1]?.index ?? detail.body.length;
    const section = detail.body.slice(start, end);
    // El tipo de ID es determinista. El copy puede mencionar "Google Ads"
    // dentro de una creatividad Meta y nunca debe cambiar su plataforma.
    const platform = /^CR/i.test(externalId)
      ? "Google Ads Transparency"
      : "Meta Ads Library";
    const globalKey = `${platform}:${externalId.toUpperCase()}`;
    if (externalSeen.has(globalKey)) continue;

    const visibleParts = [...section.matchAll(/\*\*Texto visible\*\*\s*\n((?:>[^\n]*(?:\n|$))+)/gi)]
      .map((match) => uniqueLines(match[1]))
      .filter(Boolean);
    const primary = firstMatch(section, [/- \*\*Texto principal:\*\*\s*([^\n]+)/i]);
    const archivedTitle = firstMatch(section, [/- \*\*Titular:\*\*\s*([^\n]+)/i]);
    const archivedCta = firstMatch(section, [/- \*\*Descripci[oó]n\/CTA:\*\*\s*([^\n]+)/i]);
    const reading = firstMatch(section, [/\*\*Lectura:\*\*\s*([^\n]+)/i]);
    const textParts = [...new Set([primary, ...visibleParts].filter(Boolean))];
    if (!textParts.length && !reading) continue;
    const text = textParts.length ? textParts.join("\n\n— Variante visible —\n\n") : reading;
    if (comparisonText(text).length < 12) continue;

    const sourceUrl = firstMatch(section, [
      /\]\((https:\/\/www\.facebook\.com\/ads\/library\/\?id=\d+)[^)]*\)/i,
      /\]\((https:\/\/adstransparency\.google\.com\/advertiser\/[^)]+)\)/i,
      /(https:\/\/www\.facebook\.com\/ads\/library\/\?id=\d+)/i,
      /(https:\/\/adstransparency\.google\.com\/advertiser\/\S+)/i,
    ]).replace(/[)>.,]+$/, "");
    const advertisers = allMatches(section, /-?\s*\*\*Anunciante:\*\*\s*([^\n]+)/gi)
      .filter((value) => !/^AR\d+$/i.test(value));
    const advertiser = advertisers.at(-1) || "";
    const format = firstMatch(section, [
      /\*\*Formato real:\*\*\s*([^\n]+)/i,
      /\*\*Formato:\*\*\s*\\?\[?\\?["']?([^\]"'\n]+)/i,
    ]);
    const ownConfirmed = confirmsBrand(company, advertiser, text);
    const mapped = findCoverageEvidence(canonicalId, externalId);
    const filePath = mapped?.file || mapped?.publicFile || "";
    const title = archivedTitle || titleFrom(text);
    externalSeen.add(globalKey);
    structured.push({
      file: filePath,
      id: canonicalId,
      name: company.name,
      plataforma: format ? `${platform} · ${format}` : platform,
      titular: title,
      texto: text,
      cta: archivedCta || ctaFrom(text),
      precioVisible: priceFrom(`${title}\n${text}\n${archivedCta}`),
      angulo: angleFrom(`${title}\n${text}`),
      capturaEnVivo: /\*\*Estado:\*\*\s*Activo|activo desde/i.test(section),
      fecha: company.reviewedAt || "",
      origen: "biblioteca_estructurada",
      transcripcion: visibleParts.length || primary ? "Texto visible estructurado desde biblioteca pública" : "Lectura estratégica archivada",
      estadoEvidencia: visibleParts.length || primary ? "Texto confirmado · ID público exacto" : "Síntesis de creatividad · ID público exacto",
      atribucion: ownConfirmed ? "propia_confirmada" : "campana_asociada_a_ficha",
      aptaPatrones: Boolean(ownConfirmed && (visibleParts.length || primary)),
      externalId,
      fuenteUrl: sourceUrl,
      anunciante: advertiser,
      corpusKey: `library:${platform.startsWith("Meta") ? "meta" : "google"}:${externalId}`,
    });
  }
}

// Cuando el mismo copy existe en curado manual y biblioteca estructurada, se
// fusiona el linaje en vez de descartar el ID/URL exactos de la biblioteca.
const structuredDeduped = [];
for (const item of structured) {
  const candidate = manual.find(
    (manualItem) =>
      manualItem.id === item.id &&
      ((item.file && manualItem.file === item.file) ||
        (item.externalId && manualItem.externalId === item.externalId) ||
        similar(
          `${manualItem.titular}\n${manualItem.texto}`,
          `${item.titular}\n${item.texto}`,
        )),
  );
  if (!candidate) {
    structuredDeduped.push(item);
    continue;
  }
  candidate.externalId ||= item.externalId;
  candidate.fuenteUrl ||= item.fuenteUrl;
  candidate.file ||= item.file;
  candidate.anunciante ||= item.anunciante;
  candidate.estadoEvidencia = item.estadoEvidencia || candidate.estadoEvidencia;
  candidate.atribucion =
    candidate.atribucion === "propia_confirmada"
      ? candidate.atribucion
      : item.atribucion;
  candidate.aptaPatrones =
    candidate.aptaPatrones !== false && item.aptaPatrones !== false;
  candidate.evidenceLayers = uniqueLines(
    `${candidate.origen || "curado_literal"}\n${item.origen || "biblioteca_estructurada"}`,
  ).split("\n");
}

// Las fuentes estructuradas aportan copy y metadatos exactos de Meta. Cada
// pageId se resuelve únicamente mediante un mapa editorial explícito: ni el
// nombre del anunciante ni el dominio bastan para atribuir una creatividad.
const scrapeCreatorsAds = [];
const scrapeCreatorsSeen = new Set();
const structuredSources = [
  { items: scrapeCreatorsData.items || [], origin: "api_scrapecreators", review: scrapeCreatorsMap },
  { items: leadMarketData.items || [], origin: "informe_mercado_leads", review: leadMarketReview },
];
for (const source of structuredSources) for (const ad of source.items) {
  const externalId = String(ad.externalId || "").trim();
  const identity = metaIdentity(externalId);
  const pageId = String(ad.pageId || "").trim();
  const mapping = source.review.pageIds?.[pageId] || (
    source.origin === "informe_mercado_leads"
      ? scrapeCreatorsMap.pageIds?.[pageId]
      : null
  );
  if (identity && scrapeCreatorsSeen.has(identity)) {
    if (
      source.origin === "informe_mercado_leads" &&
      mapping?.status === "matched" &&
      companyById.has(mapping.companyId)
    ) {
      const existing = scrapeCreatorsAds.find((item) => item.corpusKey === identity);
      if (existing) {
        existing.researchSnapshotId = ad.marketIntelligence?.sourceSnapshotId || null;
        existing.marketCategory = ad.marketIntelligence?.category || null;
        existing.marketVerticals = Array.isArray(ad.marketIntelligence?.verticals)
          ? [...ad.marketIntelligence.verticals]
          : [];
        existing.marketGuarantees = Array.isArray(ad.marketIntelligence?.guarantees)
          ? [...ad.marketIntelligence.guarantees]
          : [];
        existing.precioVisible = LEAD_MARKET_REVIEWED_PRICES.get(externalId) || "";
        existing.priceEvidenceRole = LEAD_MARKET_REVIEWED_PRICES.has(externalId)
          ? "offer_price_reviewed"
          : "currency_mentions_not_treated_as_price";
        existing.evidenceLayers = [...new Set([
          ...(existing.evidenceLayers || [existing.origen]),
          source.origin,
        ].filter(Boolean))];
      }
    }
    continue;
  }
  if (
    !identity ||
    mapping?.status !== "matched" ||
    !companyById.has(mapping.companyId)
  ) continue;

  const company = companyById.get(mapping.companyId);
  const indexedMedia = scrapeCreatorsMediaById.get(externalId);
  const mediaMatches = indexedMedia &&
    (!indexedMedia.companyId || indexedMedia.companyId === mapping.companyId) &&
    (!indexedMedia.pageId || String(indexedMedia.pageId) === pageId);
  const media = mediaMatches ? indexedMedia : {};
  const sourceLocalFile = publicMediaFile(ad.media?.localFile);
  const file = publicMediaFile(media.file) || sourceLocalFile;
  const videoFile = publicMediaFile(media.videoFile);
  const posterFile = publicMediaFile(media.posterFile) || (
    ad.media?.role === "video_poster" ? sourceLocalFile : ""
  );
  const mediaAssets = localMediaAssets(media.mediaAssets).length
    ? localMediaAssets(media.mediaAssets)
    : (sourceLocalFile ? [{
        file: sourceLocalFile,
        localFile: sourceLocalFile,
        kind: ad.media?.role === "video_poster" ? "poster" : "image",
        type: ad.media?.type || "image/jpeg",
        bytes: Number(ad.media?.bytes || 0),
        width: Number(ad.media?.width || 0) || null,
        height: Number(ad.media?.height || 0) || null,
        sha256: String(ad.media?.sha256 || ""),
      }] : []);
  const title = String(ad.copy?.title || "");
  const text = String(ad.copy?.text || "");
  const description = String(ad.copy?.description || "");
  const cta = String(ad.cta?.text || "");
  const transcript = String(ad.transcription?.text || "") || null;
  const copyForAnalysis = `${title}\n${text}\n${description}\n${cta}`;
  const copyForPatterns = `${title}\n${text}\n${cta}`;
  const structuredCopyAvailable = Boolean(
    `${title}\n${text}\n${description}`.trim(),
  );
  const displayFormats = Array.isArray(ad.displayFormats) ? [...ad.displayFormats] : [];
  const publisherPlatforms = Array.isArray(ad.publisherPlatforms) ? [...ad.publisherPlatforms] : [];
  const collationIds = Array.isArray(ad.collationIds) ? [...ad.collationIds] : [];

  scrapeCreatorsSeen.add(identity);
  scrapeCreatorsAds.push({
    file,
    videoFile: videoFile || null,
    posterFile: posterFile || null,
    mediaAssets,
    id: mapping.companyId,
    name: company.name,
    plataforma: displayFormats.length
      ? `Meta Ads Library · ${displayFormats.join(" / ")}`
      : "Meta Ads Library",
    platformFamily: "meta",
    titular: title,
    texto: text,
    descripcion: description,
    cta,
    sourceCopy: { title, text, description, cta },
    extraTexts: Array.isArray(ad.copy?.extraTexts) ? [...ad.copy.extraTexts] : [],
    structuredCopyAvailable,
    ctaType: String(ad.cta?.type || ""),
    precioVisible: source.origin === "informe_mercado_leads"
      ? (LEAD_MARKET_REVIEWED_PRICES.get(externalId) || "")
      : priceFrom(copyForAnalysis),
    priceEvidenceRole: source.origin === "informe_mercado_leads"
      ? (LEAD_MARKET_REVIEWED_PRICES.has(externalId) ? "offer_price_reviewed" : "currency_mentions_not_treated_as_price")
      : null,
    angulo: angleFrom(copyForAnalysis),
    capturaEnVivo: typeof ad.isActive === "boolean" ? ad.isActive : false,
    fecha: String(ad.startedAt || "").slice(0, 10),
    origen: source.origin,
    transcripcion: transcript,
    transcript,
    estadoEvidencia: "Copy estructurado · ID público exacto · Page ID resuelto editorialmente",
    atribucion: "propia_confirmada",
    aptaPatrones: Boolean(
      isHighConfidenceMatch(mapping.confidence) && isUseful(copyForPatterns),
    ),
    estadoOcr: "no_necesario",
    externalId,
    fuenteUrl: String(ad.sourceUrl || ""),
    sourceUrl: String(ad.sourceUrl || ""),
    anunciante: String(ad.pageName || ""),
    pageId,
    pageName: String(ad.pageName || ""),
    landingUrl: String(ad.landing?.url || "") || null,
    isActive: typeof ad.isActive === "boolean" ? ad.isActive : null,
    startedAt: ad.startedAt || null,
    endedAt: ad.endedAt || null,
    // Alias conservados para la interfaz actual; los campos `startedAt` y
    // `endedAt` mantienen además los nombres originales del dataset fuente.
    startDate: ad.startedAt || null,
    endDate: ad.endedAt || null,
    collationIds,
    displayFormats,
    publisherPlatforms,
    mappingConfidence: String(mapping.confidence || ""),
    mappingNote: String(mapping.note || ""),
    researchSnapshotId: ad.marketIntelligence?.sourceSnapshotId || null,
    marketCategory: ad.marketIntelligence?.category || null,
    marketVerticals: Array.isArray(ad.marketIntelligence?.verticals)
      ? [...ad.marketIntelligence.verticals]
      : [],
    marketGuarantees: Array.isArray(ad.marketIntelligence?.guarantees)
      ? [...ad.marketIntelligence.guarantees]
      : [],
    evidenceLayers: [source.origin],
    corpusKey: identity,
  });
}

const iso3ToIso2 = {
  spa: "es", eng: "en", por: "pt", ita: "it", deu: "de", nld: "nl",
  fra: "fr", tur: "tr", pol: "pl", dan: "da", vie: "vi", ind: "id",
  uzb: "uz", rus: "ru", ara: "ar", heb: "he", jpn: "ja", kor: "ko",
  cmn: "zh", tha: "th", cat: "ca", eus: "eu", glg: "gl",
};
const languageLabels = {
  es: "Español", en: "Inglés", pt: "Portugués", it: "Italiano",
  de: "Alemán", nl: "Neerlandés", fr: "Francés", tr: "Turco",
  pl: "Polaco", da: "Danés", vi: "Vietnamita", id: "Indonesio",
  uz: "Uzbeko", ru: "Ruso", ar: "Árabe", he: "Hebreo",
  ja: "Japonés", ko: "Coreano", zh: "Chino", th: "Tailandés",
  ca: "Catalán", eu: "Euskera", gl: "Gallego", mul: "Multilingüe",
  und: "Sin determinar",
};
const countryLanguage = {
  España: "es", México: "es", "Estados Unidos": "en", "Reino Unido": "en",
  "Emiratos Árabes Unidos": "en", Singapur: "en", Sudáfrica: "en",
  "Nueva Zelanda": "en", Mauricio: "en", Tanzania: "en", India: "en",
  Malasia: "en", Nepal: "en", Francia: "fr", Luxemburgo: "fr",
  Alemania: "de", Portugal: "pt", Brasil: "pt", Italia: "it",
  "Países Bajos": "nl", Dinamarca: "da", Polonia: "pl", Turquía: "tr",
  "Arabia Saudita": "ar", Egipto: "ar", Israel: "he", Japón: "ja",
  "Corea del Sur": "ko", "Hong Kong": "zh", Taiwán: "zh",
  Indonesia: "id", Vietnam: "vi", Tailandia: "th", Uzbekistán: "uz",
};
// Vocabulario de alta señal. Se puntúan tokens completos, no subcadenas: así
// "para" o "clientes" no bastan por sí solos para confundir español/portugués.
const latinLexicons = {
  es: [
    "agenda", "ahora", "analisis", "anuncios", "atraer", "busca", "centros", "ciudad",
    "clientes", "clinica", "clinicas", "comience", "conseguido", "consigue", "consultas",
    "costarte", "creatividad", "cualificados", "cuesta", "del", "dental", "elegir",
    "encuentra", "euros", "extrae", "fisioterapia", "garantia", "generar", "gratis",
    "hasta", "hemos", "implantes", "informacion", "llame", "llena", "medible", "medico",
    "miles", "minutos", "necesitas", "negocio", "negocios", "nuevos", "obten",
    "alicante", "bano", "buscamos", "contacto", "empresas", "entra", "hablamos", "operario",
    "ortodoncia", "paciente", "pacientes", "pagas", "para", "presupuestos", "primer", "puede",
    "real", "reforma", "reformas", "salud", "sanitario", "sector", "sin", "solicita", "sobreimpreso",
    "texto", "titular", "todo", "trabajando", "tus", "una", "unico", "vertical", "video",
  ],
  en: [
    "after", "and", "attempts", "book", "business", "customers", "find", "for",
    "free", "from", "get", "grow", "help", "home", "jobs", "just", "know",
    "deck", "leads", "less", "local", "looking", "more", "most", "need", "now",
    "quote", "ready", "replacement", "sales", "service", "services", "start", "the",
    "today", "watch", "with", "work", "you", "your", "youtube",
  ],
  pt: [
    "agencia", "ajude", "chame", "clientes", "com", "compromisso", "custos", "empresa",
    "encontre", "entenda", "faca", "grafico", "gratuito", "hoje", "mais", "nao",
    "negocio", "novos", "obtenha", "orcamento", "pedido", "pouco", "procuras",
    "profissionais", "propostas", "receba", "resultados", "saude", "sem", "seus", "sua",
    "tempo", "tua", "uma", "voce",
  ],
  it: [
    "adatto", "attivita", "automatico", "aziende", "cerchi", "che", "clienti", "completa",
    "confronta", "consumatori", "della", "dicci", "distributore", "evidente", "fai",
    "gestione", "gratuita", "hanno", "idonee", "inclusa", "installando", "installazione",
    "autonomi", "carburante", "carta", "centesimi", "costi", "fare", "fino", "ideale", "imprese",
    "italiane", "lavoratori", "liberi", "litro", "molte", "necessita", "nostra", "nuovi", "oggi",
    "ottimizzare", "piu", "pochi", "preventivo", "professionale", "professionista", "professionisti",
    "rifornimento", "riservata", "risparmiare", "richiesta", "semplificare", "senza", "servizio",
    "sola", "soluzione", "solo", "spese", "sponsorizzato", "stanno", "tua", "tutti", "tuoi",
    "utilizzate", "vantaggi", "veicoli", "verifica", "vostri",
  ],
  de: [
    "angebot", "das", "der", "die", "eine", "fur", "handwerker", "ihre", "jetzt",
    "kostenlos", "kunden", "mehr", "mit", "ohne", "unternehmen", "und",
  ],
  nl: [
    "aanvragen", "bedrijf", "consumenten", "controle", "correct", "dienst", "een", "eenvoudig",
    "ervaring", "fouten", "gebruik", "gesponsord", "horecazaak", "jaar", "jouw", "kassasysteem",
    "klaar", "klanten", "meer", "minder", "naar", "offerte", "onder", "overzicht", "rekening",
    "stroom", "tijdens", "vandaag", "volledig", "voor", "werkt", "wij", "wilt", "zonder",
    "zorgen", "zoals",
  ],
  fr: [
    "accroitre", "aujourd", "avec", "besoin", "clients", "considerablement", "des",
    "devis", "entreprise", "etes", "gratuit", "les", "notre", "nouveaux", "obtenez",
    "plus", "pour", "pret", "sans", "une", "vos", "votre", "vous",
  ],
  tr: [
    "bir", "cihaz", "cihazlari", "daha", "destegi", "distributor", "ertesi", "esnafim",
    "firsatiyla", "fiyatlari", "garanti", "gune", "guvencesi", "hemen", "icin", "ile",
    "komisyon", "musteri", "resmi", "servis", "simdi", "sizin", "teknik", "teklif",
    "ucretsiz", "yil",
  ],
  da: [
    "arbejde", "din", "dit", "flere", "gratis", "handvaerker", "hjaelp", "ikke",
    "kan", "kunder", "med", "og", "skal", "tilbud", "virksomhed", "vores",
  ],
  pl: ["bez", "dzisiaj", "firma", "jest", "klientow", "nie", "oferta", "oraz", "twoj"],
  id: ["anda", "bisnis", "dengan", "dapatkan", "dan", "gratis", "lebih", "pelanggan", "sekarang", "tanpa", "untuk", "yang"],
  vi: ["ban", "doanh", "hang", "khach", "mien", "ngay", "nghiep", "nhieu", "phi", "voi"],
};

const stripDetectionBoilerplate = (value) =>
  normalizeText(value)
    .replace(/\b(?:collapsed|expanded)\s+ad\s+on\s+(?:desktop|mobile)(?:\s*\/\s*(?:desktop|mobile))?/gi, " ")
    .replace(/\bno soy un robot\b/gi, " ")
    .replace(/\bprimera:\s*no expuesta\s*-?\s*última:\s*no expuesta\s*-?\s*formato:\s*no expuesto\s*-?\s*variantes:\s*\d+/gi, " ")
    .replace(/https?:\/\/\S+|\bwww\.\S+|[\w.+-]+@[\w.-]+\.\w+/gi, " ")
    .replace(/\b(?:en circulaci[oó]n desde|anuncios mostrados en|informaci[oó]n sobre este anuncio|marketing publicidad|watch on youtube)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectLanguage = (value, country, origin, ocrLanguages = "") => {
  if (
    origin === "ocr_captura" &&
    /\bprimera:\s*no expuesta\b[\s\S]*(?:ultima|última):\s*no expuesta\b[\s\S]*\bformato:\s*no expuesto\b[\s\S]*\bvariantes:\s*\d+/i.test(
      normalizeText(value),
    )
  ) {
    return { code: "es", confidence: 0.98, source: "library_ui_literal" };
  }
  const text = origin === "ocr_captura"
    ? stripDetectionBoilerplate(value)
    : normalizeText(value);
  if (comparisonText(text).length < 12) {
    return { code: "und", confidence: null, source: "insufficient_text" };
  }
  const counts = {
    arabic: (text.match(/[\u0600-\u06ff]/g) || []).length,
    hebrew: (text.match(/[\u0590-\u05ff]/g) || []).length,
    kana: (text.match(/[\u3040-\u30ff]/g) || []).length,
    hangul: (text.match(/[\uac00-\ud7af]/g) || []).length,
    han: (text.match(/[\u3400-\u9fff]/g) || []).length,
    thai: (text.match(/[\u0e00-\u0e7f]/g) || []).length,
    cyrillic: (text.match(/[\u0400-\u04ff]/g) || []).length,
    latin: (text.match(/[A-Za-zÀ-ž]/g) || []).length,
  };
  const scripted = [
    ["ja", counts.kana], ["ko", counts.hangul], ["ar", counts.arabic],
    ["he", counts.hebrew], ["th", counts.thai], ["zh", counts.han],
    ["ru", counts.cyrillic],
  ].sort((left, right) => right[1] - left[1]);
  if (scripted[0][1] >= 12 && counts.latin >= 20) {
    return { code: "mul", confidence: 0.72, source: "detected" };
  }
  if (scripted[0][1] >= 4 && scripted[0][1] >= counts.latin * 0.22) {
    const mixed = counts.latin >= 12 && scripted[0][1] >= 12 && scripted[0][1] / counts.latin < 2.5;
    return { code: mixed ? "mul" : scripted[0][0], confidence: mixed ? 0.65 : 0.94, source: "detected" };
  }
  const normalized = comparisonText(text);
  const lexicalTokens = normalized
    .split(" ")
    .filter((token) => /^\p{L}{2,}$/u.test(token));
  const meaningfulTokens = lexicalTokens.filter((token) => token.length >= 3);
  if (
    origin === "ocr_captura" &&
    (meaningfulTokens.length < 3 || meaningfulTokens.length / Math.max(1, lexicalTokens.length) < 0.36)
  ) {
    return { code: "und", confidence: 0.2, source: "ambiguous_ocr" };
  }
  const lexicalTokenSet = new Set(lexicalTokens);
  const lexical = Object.entries(latinLexicons)
    .map(([code, words]) => [
      code,
      words.reduce((score, word) => score + (lexicalTokenSet.has(word) ? 1 : 0), 0),
    ])
    .sort((left, right) => right[1] - left[1]);
  if (
    lexical[0][1] >= 2 &&
    (lexical[0][1] >= lexical[1][1] + 2 || lexical[0][1] >= 4)
  ) {
    return {
      code: lexical[0][0],
      confidence: Math.min(0.96, 0.72 + lexical[0][1] * 0.04),
      source: "detected",
    };
  }
  const ranked = francAll(meaningfulTokens.join(" "), { minLength: 18 })
    .map(([code, score]) => [iso3ToIso2[code], score])
    .filter(([code]) => Boolean(code));
  const [detected, detectedScore = 0] = ranked[0] || [];
  const secondScore = ranked[1]?.[1] || 0;
  const market = countryLanguage[country] || "und";
  const ocrHint = String(ocrLanguages)
    .split("+")
    .map((code) => iso3ToIso2[code.trim()] || code.trim())
    .find((code) => code && code !== "en") || "";
  const prior = origin === "ocr_captura" && ocrHint ? ocrHint : market;
  const priorScore = ranked.find(([code]) => code === prior)?.[1] || 0;
  if (
    prior !== "und" &&
    priorScore >= 0.84 &&
    detectedScore - priorScore <= (origin === "ocr_captura" ? 0.14 : 0.09)
  ) {
    return {
      code: prior,
      confidence: Math.min(0.9, 0.68 + priorScore * 0.2),
      source: "detected",
    };
  }
  if (
    detected &&
    origin === "ocr_captura" &&
    (detectedScore < 0.94 || detectedScore - secondScore < 0.1)
  ) {
    return { code: "und", confidence: 0.35, source: "ambiguous_ocr" };
  }
  if (detected) {
    const margin = Math.max(0, detectedScore - secondScore);
    return {
      code: detected,
      confidence: Math.min(0.78, 0.55 + margin * 1.5),
      source: "detected",
    };
  }
  const fallback = countryLanguage[country] || "und";
  return { code: fallback, confidence: fallback === "und" ? null : 0.3, source: fallback === "und" ? "unknown" : "market_inferred" };
};

const platformFamilyOf = (item) => {
  if (/^CR/i.test(item.externalId || "")) return "google";
  if (/^\d{10,}$/.test(item.externalId || "")) return "meta";
  const value = comparisonText(item.plataforma);
  if (value.includes("instagram")) return "instagram";
  if (value.includes("meta")) return "meta";
  if (value.includes("google")) return "google";
  if (value.includes("display")) return "display";
  return "unknown";
};

const mediaTypeOf = (file) => {
  if (!file) return "none";
  if (/\.(?:jpe?g|png|webp|svg)$/i.test(file)) return "image";
  if (/\.(?:mp4|webm|mov)$/i.test(file)) return "video";
  if (/\.pdf$/i.test(file)) return "document";
  return "other";
};

const canonicalAngles = (value) => {
  const labels = new Map();
  for (const raw of String(value || "").split(",")) {
    const clean = raw.trim();
    const key = comparisonText(clean);
    if (key && !labels.has(key)) labels.set(key, clean.charAt(0).toLocaleLowerCase("es") + clean.slice(1));
  }
  return [...labels.values()].join(", ") || "sin ángulo etiquetado";
};

const ocr = (ocrData.items || []).map((item, index) => {
  const id = companyById.has(item.id) ? item.id : canonicalAdCompanyId(item.id);
  const company = companyById.get(id);
  const ownProbable = company ? confirmsBrand(company, "", `${item.titular}\n${item.texto}`) : false;
  const family = item.platformFamily || (/^CR/i.test(item.externalId || "") ? "google" : /^\d+$/.test(item.externalId || "") ? "meta" : "unknown");
  return {
    ...item,
    observedId: item.id !== id ? item.id : (item.observedId || null),
    observedName: item.id !== id ? item.name : (item.observedName || null),
    id,
    name: company?.name || item.name,
    country: company?.primaryCountry || item.country || "Sin país",
    platformFamily: family,
    atribucion: ownProbable ? "propia_probable_por_marca_visible" : (item.atribucion || "asociada_a_ficha"),
    aptaPatrones: false,
    corpusKey: item.externalId
      ? `ocr:${family}:${item.externalId}`
      : `ocr:${id}:${item.archivoSha256 || String(index + 1).padStart(4, "0")}`,
  };
});

const items = [...manual, ...structuredDeduped];
for (const candidate of scrapeCreatorsAds) {
  const identity = metaIdentity(candidate.externalId);
  const existingIndex = items.findIndex(
    (item) => metaIdentity(item.externalId) === identity,
  );
  if (existingIndex < 0) {
    items.push(candidate);
    continue;
  }

  // El registro estructurado sustituye el copy derivado de una captura, pero conserva
  // el archivo canónico ya auditado si esa creatividad estaba en el corpus.
  const existing = items[existingIndex];
  const keepExistingVisibleCopy =
    !candidate.structuredCopyAvailable &&
    Boolean(`${existing.titular || ""}\n${existing.texto || ""}`.trim());
  const canonicalFile = existing.file || candidate.file || "";
  const variantFiles = [...new Set([
    ...(existing.variantFiles || []),
    existing.file,
    candidate.file,
  ].filter(Boolean))];
  items[existingIndex] = {
    ...existing,
    ...candidate,
    titular: keepExistingVisibleCopy ? existing.titular : candidate.titular,
    texto: keepExistingVisibleCopy ? existing.texto : candidate.texto,
    cta: keepExistingVisibleCopy ? existing.cta : candidate.cta,
    precioVisible: keepExistingVisibleCopy
      ? existing.precioVisible
      : candidate.precioVisible,
    angulo: keepExistingVisibleCopy ? existing.angulo : candidate.angulo,
    estadoOcr: keepExistingVisibleCopy
      ? existing.estadoOcr
      : candidate.estadoOcr,
    file: canonicalFile,
    videoFile: candidate.videoFile || existing.videoFile || null,
    posterFile: candidate.posterFile || existing.posterFile || null,
    mediaAssets: candidate.mediaAssets?.length
      ? candidate.mediaAssets
      : (existing.mediaAssets || []),
    archivoSha256:
      canonicalFile && canonicalFile === existing.file
        ? existing.archivoSha256
        : undefined,
    variantFiles: variantFiles.length > 1 ? variantFiles : existing.variantFiles,
    evidenceLayers: [...new Set([
      ...(existing.evidenceLayers || [existing.origen]),
      ...(candidate.evidenceLayers || []),
      candidate.origen,
    ].filter(Boolean))],
  };
}
const findExisting = (candidate) => {
  const identity = metaIdentity(candidate.externalId);
  if (identity) {
    const exactMeta = items.find(
      (item) => metaIdentity(item.externalId) === identity,
    );
    if (exactMeta) return exactMeta;
  }
  return items.find((item) =>
    item.id === candidate.id &&
    ((candidate.externalId && item.externalId === candidate.externalId) ||
      (candidate.file && item.file === candidate.file)),
  );
};
for (const candidate of ocr) {
  const existing = findExisting(candidate);
  if (!existing) {
    items.push(candidate);
    continue;
  }
  if (
    ["api_scrapecreators", "informe_mercado_leads"].includes(existing.origen) &&
    !existing.structuredCopyAvailable &&
    isUseful(`${candidate.titular || ""}\n${candidate.texto || ""}\n${candidate.cta || ""}`)
  ) {
    existing.titular = candidate.titular;
    existing.texto = candidate.texto;
    existing.cta = candidate.cta;
    existing.precioVisible = candidate.precioVisible;
    existing.angulo = candidate.angulo;
    existing.estadoOcr = candidate.estadoOcr;
    existing.transcripcion ||= candidate.transcripcion;
  }
  existing.file ||= candidate.file;
  existing.externalId ||= candidate.externalId;
  existing.archivoSha256 ||= candidate.archivoSha256;
  existing.estadoOcr ||= candidate.estadoOcr;
  existing.intentosOcr ||= candidate.intentosOcr;
  existing.motorOcr ||= candidate.motorOcr;
  existing.idiomasOcr ||= candidate.idiomasOcr;
  existing.motivoOcr ||= candidate.motivoOcr;
  existing.evidenceLayers = [...new Set([
    ...(existing.evidenceLayers || [existing.origen]),
    "ocr_captura",
  ].filter(Boolean))];
}

const auditByIdentity = new Map();
const auditByFile = new Map();
for (const audit of ocrAuditData.items || []) {
  auditByIdentity.set(`${audit.companyId}:${audit.platform}:${audit.externalId}`, audit);
  auditByFile.set(audit.file, audit);
}
for (const audit of ocrAuditData.items || []) {
  const identity = metaIdentity(audit.externalId);
  const existing = (identity
    ? items.find((item) => metaIdentity(item.externalId) === identity)
    : null) || items.find((item) =>
    item.id === audit.companyId &&
    ((item.externalId && item.externalId === audit.externalId) || item.file === audit.file),
  );
  const common = {
    country: audit.country || companyById.get(audit.companyId)?.primaryCountry || "Sin país",
    platformFamily: audit.platform,
    mediaType: audit.mediaType || mediaTypeOf(audit.file),
    estadoOcr: audit.estadoOcr,
    confianzaOcr: audit.confianzaOcr,
    intentosOcr: audit.intentosOcr,
    motorOcr: audit.motorOcr,
    idiomasOcr: audit.idiomasOcr,
    motivoOcr: audit.motivoOcr,
    variantCount: Math.max(1, Number(audit.variantCount || 1)),
  };
  if (existing) {
    Object.assign(existing, common);
    if (["api_scrapecreators", "informe_mercado_leads"].includes(existing.origen) && existing.structuredCopyAvailable) {
      existing.estadoOcr = "no_necesario";
    }
    if (existing.file && existing.file !== audit.file) {
      existing.variantFiles = [...new Set([
        ...(existing.variantFiles || []),
        existing.file,
        audit.file,
      ])];
    }
    existing.file = audit.file;
    existing.externalId ||= audit.externalId;
    existing.archivoSha256 = audit.archivoSha256;
    continue;
  }
  items.push({
    file: audit.file,
    id: audit.companyId,
    name: companyById.get(audit.companyId)?.name || audit.companyId,
    plataforma: audit.platform === "meta" ? "Meta Ads Library" : "Google Ads Transparency",
    titular: "",
    texto: "",
    cta: "",
    precioVisible: "",
    angulo: "sin ángulo etiquetado",
    externalId: audit.externalId,
    origen: "ocr_captura",
    transcripcion: "Doble pasada OCR sin texto suficiente; creatividad conservada para revisión visual",
    estadoEvidencia: "Archivo verificado · sin texto legible",
    atribucion: "asociada_a_ficha",
    aptaPatrones: false,
    archivoSha256: audit.archivoSha256,
    corpusKey: `ocr:${audit.platform}:${audit.externalId}`,
    ...common,
  });
}

const translationByHash = new Map(
  (translationsData.items || []).map((item) => [item.sourceCopySha256, item]),
);
const rejectedTranslationHashes = new Set(
  (translationsData.rejections || [])
    .filter((item) => item.recipeVersion === TRANSLATION_RECIPE_VERSION)
    .map((item) => item.sourceCopySha256),
);
for (const item of items) {
  const company = companyById.get(item.id);
  item.country ||= company?.primaryCountry || "Sin país";
  item.platformFamily = item.platformFamily || platformFamilyOf(item);
  item.mediaType = item.mediaType || mediaTypeOf(item.file);
  item.angulo = canonicalAngles(item.angulo);
  const audit = item.externalId
    ? auditByIdentity.get(`${item.id}:${item.platformFamily}:${item.externalId}`)
    : auditByFile.get(item.file);
  if (audit && !item.estadoOcr) item.estadoOcr = audit.estadoOcr;
  if (!item.estadoOcr)
    item.estadoOcr = item.origen === "ocr_captura"
      ? "pendiente"
      : "no_necesario";
  const original = {
    titular: normalizeText(item.titular),
    texto: normalizeText(item.texto),
    cta: normalizeText(item.cta),
    precioVisible: normalizeText(item.precioVisible),
  };
  item.copyAvailable = isUseful(`${original.titular}\n${original.texto}\n${original.cta}`);
  item.sourceCopySha256 = createHash("sha256").update(JSON.stringify(original)).digest("hex");
  const language = item.copyAvailable
    ? LANGUAGE_HASH_OVERRIDES.get(item.sourceCopySha256) || detectLanguage(
        `${original.titular}\n${original.texto}\n${original.cta}`,
        item.country,
        item.origen,
        item.idiomasOcr,
      )
    : { code: "und", confidence: null, source: "no_text" };
  item.idioma = language.code;
  item.idiomaNombre = languageLabels[language.code] || language.code.toUpperCase();
  item.idiomaConfianza = language.confidence;
  item.idiomaOrigen = language.source;
  const translation = translationByHash.get(item.sourceCopySha256);
  if (!item.copyAvailable) {
    item.estadoTraduccion = "no_aplica";
  } else if (item.idioma === "es") {
    item.estadoTraduccion = "no_necesaria";
  } else if (
    item.origen === "ocr_captura" &&
    item.estadoOcr === "completo_baja"
  ) {
    item.estadoTraduccion = "requiere_revision";
  } else if (
    translation &&
    translation.sourceCopySha256 === item.sourceCopySha256 &&
    translation.sourceLanguage === item.idioma &&
    translation.recipeVersion === TRANSLATION_RECIPE_VERSION &&
    ["automatica", "revisada"].includes(translation.status) &&
    !(translation.warnings || []).length
  ) {
    item.estadoTraduccion = translation.status || "automatica";
    item.traduccionEs = translation.copy;
    item.proveedorTraduccion = translation.provider;
    item.traducidoEn = translation.translatedAt;
    if (translation.status === "revisada") {
      item.revisadoPorTraduccion = translation.reviewedBy;
      item.notaRevisionTraduccion = translation.reviewNote;
    }
  } else if (
    item.idioma === "mul" ||
    item.idioma === "und" ||
    item.idiomaOrigen !== "detected" ||
    Number(item.idiomaConfianza || 0) < 0.68 ||
    rejectedTranslationHashes.has(item.sourceCopySha256)
  ) {
    item.estadoTraduccion = "requiere_revision";
  } else if (!TRANSLATABLE_LANGUAGES.has(item.idioma)) {
    item.estadoTraduccion = "no_disponible";
  } else {
    item.estadoTraduccion = "pendiente";
  }
}

const uniqueKeys = new Set();
for (const item of items) {
  let key = item.corpusKey;
  let suffix = 2;
  while (uniqueKeys.has(key)) key = `${item.corpusKey}:${suffix++}`;
  item.corpusKey = key;
  uniqueKeys.add(key);
}

const patternReady = items.filter((item) => item.aptaPatrones !== false);
const countsByOrigin = Object.entries(items.reduce((acc, item) => {
  acc[item.origen] = (acc[item.origen] || 0) + 1;
  return acc;
}, {})).map(([label, n]) => ({ label, n }));
const companyCounts = new Map();
for (const item of items) companyCounts.set(item.id, (companyCounts.get(item.id) || 0) + 1);
const countBy = (key) => Object.entries(items.reduce((acc, item) => {
  const value = item[key] || "unknown";
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {})).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "es"));

const data = {
  schema: "redvitalia-ad-corpus-v2",
  generatedAt: new Date().toISOString().slice(0, 10),
  nota: "Corpus bilingüe y trazable. El original nunca se sustituye; las traducciones automáticas se muestran como ayuda de lectura y no convierten una frecuencia en rendimiento. El OCR permanece fuera de patrones hasta revisión humana.",
  total: items.length,
  companies: companyCounts.size,
  patternReady: patternReady.length,
  patternCompanies: new Set(patternReady.map((item) => item.id)).size,
  withFive: [...companyCounts.values()].filter((count) => count >= 5).length,
  withTen: [...companyCounts.values()].filter((count) => count >= 10).length,
  byOrigin: countsByOrigin,
  byLanguage: countBy("idioma"),
  byOcrStatus: countBy("estadoOcr"),
  byTranslationStatus: countBy("estadoTraduccion"),
  items,
};

writeFileSync(outputPath, `${JSON.stringify(data, null, 1)}\n`);
console.log(
  `${outputPath}: ${data.total} piezas · ${data.companies} empresas · ${data.patternReady} aptas · ${data.withFive} con 5+ · ${data.withTen} con 10+`,
);
