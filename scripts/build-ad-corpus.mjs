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
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalAdCompanyId,
} from "./ad-aliases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const detailsDir = resolve(root, "public/data/company-details");
const outputPath = resolve(root, "public/data/ad-corpus.json");
const ocrPath = resolve(root, "public/data/ad-ocr-transcripts.json");
const coveragePath = resolve(root, "public/data/ad-coverage.json");

const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const companyById = new Map(companies.map((company) => [company.id, company]));
const manualData = JSON.parse(readFileSync(resolve(root, "public/data/anuncios-reales.json"), "utf8"));
const ocrData = existsSync(ocrPath)
  ? JSON.parse(readFileSync(ocrPath, "utf8"))
  : { items: [], total: 0, companies: 0 };
const coverageData = existsSync(coveragePath)
  ? JSON.parse(readFileSync(coveragePath, "utf8"))
  : null;

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
      similar(
        `${manualItem.titular}\n${manualItem.texto}`,
        `${item.titular}\n${item.texto}`,
      ),
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

const ocr = (ocrData.items || []).map((item, index) => {
  const id = companyById.has(item.id) ? item.id : canonicalAdCompanyId(item.id);
  const company = companyById.get(id);
  const ownProbable = company ? confirmsBrand(company, "", `${item.titular}\n${item.texto}`) : false;
  return {
    ...item,
    observedId: item.id !== id ? item.id : (item.observedId || null),
    observedName: item.id !== id ? item.name : (item.observedName || null),
    id,
    name: company?.name || item.name,
    atribucion: ownProbable ? "propia_probable_por_marca_visible" : (item.atribucion || "asociada_a_ficha"),
    aptaPatrones: false,
    corpusKey: `ocr:${id}:${item.archivoSha256 || String(index + 1).padStart(4, "0")}`,
  };
});

const items = [...manual, ...structuredDeduped, ...ocr];
const patternReady = items.filter((item) => item.aptaPatrones !== false);
const countsByOrigin = Object.entries(items.reduce((acc, item) => {
  acc[item.origen] = (acc[item.origen] || 0) + 1;
  return acc;
}, {})).map(([label, n]) => ({ label, n }));
const companyCounts = new Map();
for (const item of items) companyCounts.set(item.id, (companyCounts.get(item.id) || 0) + 1);

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  nota: "Corpus trazable en tres capas. El texto curado y el confirmado por ID público alimentan patrones; el OCR queda buscable y visible sobre su captura, pero fuera de patrones hasta validación. Frecuencia no equivale a rendimiento: los ganadores solo existen tras un test con métricas.",
  total: items.length,
  companies: companyCounts.size,
  patternReady: patternReady.length,
  patternCompanies: new Set(patternReady.map((item) => item.id)).size,
  withFive: [...companyCounts.values()].filter((count) => count >= 5).length,
  withTen: [...companyCounts.values()].filter((count) => count >= 10).length,
  byOrigin: countsByOrigin,
  items,
};

writeFileSync(outputPath, `${JSON.stringify(data, null, 1)}\n`);
console.log(
  `${outputPath}: ${data.total} piezas · ${data.companies} empresas · ${data.patternReady} aptas para patrones · ${data.withFive} con 5+ · ${data.withTen} con 10+`,
);
