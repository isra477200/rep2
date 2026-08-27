#!/usr/bin/env node
/* eslint-disable no-control-regex */
/**
 * Consolida OCR legado y el barrido exhaustivo de creatividades exactas.
 * Publica texto útil y, por separado, una auditoría que conserva también
 * estados sin texto, fallo, pendiente y OCR no necesario.
 *
 * Uso: node scripts/prepare-ad-ocr-source.mjs C:/carpeta/con/ocr
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const positionalSource = args.find((value, index) =>
  !value.startsWith("--") && args[index - 1] !== "--baseline-ref",
);
const sourceDir = resolve(positionalSource || resolve(root, "work"));
const baselineRef = valueAfter("--baseline-ref");
const transcriptPath = resolve(root, "public/data/ad-ocr-transcripts.json");
const auditPath = resolve(root, "public/data/ad-ocr-audit.json");
if (!existsSync(sourceDir)) throw new Error(`No existe la carpeta OCR: ${sourceDir}`);

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
const companies = readJson("public/data/companies-index.json");
const identities = readJson("public/data/ad-media-identity.json").items || [];
const currentCorpus = readJson("public/data/ad-corpus.json").items || [];
const companyById = new Map(companies.map((company) => [company.id, company]));

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const comparisonText = (value) =>
  normalizeText(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokenCount = (value) =>
  comparisonText(value).split(" ").filter((token) => token.length > 2).length;
const isUseful = (value) =>
  comparisonText(value).length >= 18 && tokenCount(value) >= 3;

const boilerplate = [
  /^google(?: ads)? (?:centro|center)/i,
  /centro de transparencia publicitaria/i,
  /ads transparency (?:center|centre)/i,
  /(?:denunciar este anuncio|report this ad)/i,
  /(?:ver m[eéáa]s anuncios(?: de este anunciante)?|see more ads(?: from this advertiser)?)/i,
  /^(?:primera|[uú]ltima) (?:aparici[oó]n|impresi[oó]n)/i,
  /^(?:first|last) (?:shown|impression)/i,
  /^(?:formato|format)\s*:/i,
  /^(?:mostrado por|shown by|paid for by)\b/i,
  /anuncio financiado por/i,
  /^cr\d{8,}$/i,
  /^ar\d{8,}$/i,
  /(?:vincular a anuncio|este anuncio proviene de un enlace)/i,
  /^(?:[©O@\s]*activo\b|identificador de la biblioteca|en circulaci[oóe]n desde|plataformas?\b|este anuncio tiene varias versiones|ver detalles del anuncio|transparencia de la ue|cerrar\b)/i,
  /no podemos mostrarte esta variante/i,
  /^(?:patrocinado|sponsored|sponsorise|sponsoris[eé]|gesponsert|sponsorlu)$/i,
];

const cleanOcr = (value) => {
  const seen = new Set();
  return normalizeText(
    normalizeText(value)
      .split("\n")
      .map((line) => line.replace(/[|¦]{2,}/g, " ").replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 1)
      .filter((line) => !boilerplate.some((pattern) => pattern.test(line)))
      .filter((line) => {
        const key = comparisonText(line);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join("\n"),
  );
};

const titleFrom = (text) => {
  const candidates = normalizeText(text)
    .split("\n")
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .filter((line) => line.length >= 4 && !/^https?:|^www\./i.test(line));
  const score = (line) => {
    const words = line.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || [];
    const symbols = (line.match(/[^\p{L}\p{N}\s.,:;!?€$%+'’/()-]/gu) || []).length;
    let value = Math.min(9, words.length) * 4 + Math.min(18, line.length / 5) - symbols * 2;
    if (line.length < 12 || line.length > 140) value -= 14;
    if (/^https?:|^www\.|\.(?:com|es|fr|de|pt|it|net)\b/i.test(line)) value -= 16;
    return value;
  };
  return ([...candidates].sort((a, b) => score(b) - score(a))[0] || "Texto visible sin titular separado").slice(0, 180);
};

const ctaFrom = (text) => {
  const pattern = /(m[aá]s informaci[oó]n|learn more|book|agenda|solicita|descubre|contacta|cont[aá]ctanos|empieza|comienza|quiero|reg[ií]strate|haz clic|click|visita|llama|escr[ií]benos|get started|apply|sign up|free quote|download|shop now)/i;
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

const sha256OfFile = (publicFile) => {
  const diskPath = resolve(root, "public", String(publicFile || "").replace(/^\/+/, ""));
  if (!publicFile || !existsSync(diskPath)) return null;
  return createHash("sha256").update(readFileSync(diskPath)).digest("hex");
};

const identityKey = (item) => `${item.companyId}:${item.platform}:${item.externalId}`;
const identityByFile = new Map(identities.map((item) => [item.file, item]));
const identityHashes = new Map();
for (const identity of identities) {
  const hash = sha256OfFile(identity.file);
  if (!hash) continue;
  const key = `${identity.companyId}:${hash}`;
  const bucket = identityHashes.get(key) || [];
  bucket.push(identity);
  identityHashes.set(key, bucket);
}

const sourceFiles = readdirSync(sourceDir)
  .filter((file) => /^(?:ocr-ads-[a-z-]+|ad-ocr-final)\.json$/i.test(file))
  .sort((a, b) => a.localeCompare(b, "es"));
if (!sourceFiles.length) throw new Error(`No hay resultados OCR en ${sourceDir}`);

const rawCandidates = [];
for (const sourceFile of sourceFiles) {
  const source = JSON.parse(readFileSync(resolve(sourceDir, sourceFile), "utf8"));
  const isFinalRun = source.schema === "redvitalia-ad-ocr-run-v2";
  for (const item of source.items || []) {
    const companyId = item.companyId || item.id;
    const text = cleanOcr(item.text ?? item.texto);
    const file = item.file || "";
    const archivoSha256 = item.archivoSha256 || sha256OfFile(file);
    let identity = isFinalRun
      ? identities.find(
          (candidate) =>
            candidate.companyId === companyId &&
            candidate.platform === item.platform &&
            candidate.externalId === item.externalId,
        )
      : identityByFile.get(file);
    let joinMethod = identity ? (isFinalRun ? "external_id" : "exact_file") : null;
    if (!identity && archivoSha256) {
      const matches = identityHashes.get(`${companyId}:${archivoSha256}`) || [];
      if (matches.length === 1) {
        [identity] = matches;
        joinMethod = "sha256_company";
      } else if (matches.length > 1) {
        joinMethod = "sha256_company_ambiguous";
      }
    }
    const usable = item.usable !== false && isUseful(text);
    rawCandidates.push({
      companyId,
      name: item.name || companyById.get(companyId)?.name || companyId,
      country: item.country || companyById.get(companyId)?.primaryCountry || "Sin país",
      file,
      platform: identity?.platform || item.platform || "other",
      externalId: identity?.externalId || item.externalId || null,
      variantCount: identity?.variantCount || item.variantCount || 1,
      text,
      confidence: Math.max(0, Math.min(100, Number(item.confidence ?? item.confianza ?? 0) || 0)),
      attempts: Math.max(0, Number(item.attempts || 1)),
      engine: item.engine || (isFinalRun ? source.engine : "tesseract.js@legacy"),
      ocrLanguages: item.ocrLanguages || source.languages || null,
      archivoSha256,
      usable,
      status: usable ? "completo" : (item.status === "fallido" ? "fallido" : "sin_texto"),
      reason: item.reason || (usable ? null : "texto_insuficiente_o_ruidoso"),
      joinMethod,
      sourceFile,
    });
  }
}

const quality = (item) =>
  (item.usable ? 1000 : 0) + item.confidence * 4 + Math.min(300, comparisonText(item.text).length);
const candidateByIdentity = new Map();
const candidateByFile = new Map();
for (const candidate of rawCandidates) {
  if (candidate.file) {
    const previous = candidateByFile.get(candidate.file);
    if (!previous || quality(candidate) > quality(previous)) candidateByFile.set(candidate.file, candidate);
  }
  if (candidate.externalId) {
    const key = `${candidate.companyId}:${candidate.platform}:${candidate.externalId}`;
    const previous = candidateByIdentity.get(key);
    if (!previous || quality(candidate) > quality(previous)) candidateByIdentity.set(key, candidate);
  }
}

const nonOcrCorpus = currentCorpus.filter((item) => item.origen !== "ocr_captura");
const strongByIdentity = new Map();
const strongByFile = new Map();
for (const item of nonOcrCorpus) {
  if (!isUseful(`${item.titular || ""}\n${item.texto || ""}`)) continue;
  if (item.file) strongByFile.set(item.file, item);
  if (item.externalId) {
    const platform = /^CR/i.test(item.externalId) ? "google" : "meta";
    strongByIdentity.set(`${item.id}:${platform}:${item.externalId}`, item);
  }
}

let auditItems = identities.map((identity) => {
  const key = identityKey(identity);
  const strong = strongByIdentity.get(key) || strongByFile.get(identity.file);
  const candidate = candidateByIdentity.get(key) || candidateByFile.get(identity.file);
  const fileSha256 = sha256OfFile(identity.file);
  const common = {
    ...identity,
    country: companyById.get(identity.companyId)?.primaryCountry || "Sin país",
    mediaType: [".jpg", ".jpeg", ".png", ".webp", ".svg"].includes(extname(identity.file).toLowerCase()) ? "image" : "other",
    archivoSha256: fileSha256,
  };
  if (strong) {
    return {
      ...common,
      estadoOcr: "no_necesario",
      confianzaOcr: null,
      intentosOcr: 0,
      motorOcr: null,
      idiomasOcr: null,
      motivoOcr: "texto_manual_o_biblioteca_disponible",
      textoUtil: true,
    };
  }
  if (!candidate) {
    return {
      ...common,
      estadoOcr: "pendiente",
      confianzaOcr: null,
      intentosOcr: 0,
      motorOcr: null,
      idiomasOcr: null,
      motivoOcr: "sin_resultado_ocr_en_el_checkpoint",
      textoUtil: false,
    };
  }
  const estadoOcr = candidate.usable
    ? candidate.confidence >= 90
      ? "completo_alta"
      : candidate.confidence >= 75
        ? "completo_media"
        : "completo_baja"
    : candidate.status === "fallido"
      ? "fallido"
      : "sin_texto";
  return {
    ...common,
    estadoOcr,
    confianzaOcr: candidate.confidence,
    intentosOcr: candidate.attempts,
    motorOcr: candidate.engine,
    idiomasOcr: candidate.ocrLanguages,
    motivoOcr: candidate.reason,
    textoUtil: candidate.usable,
    archivoSha256: candidate.archivoSha256 || fileSha256,
    joinMethod: candidate.joinMethod,
  };
});

const transcriptCandidates = [
  ...candidateByIdentity.values(),
  ...[...candidateByFile.values()].filter((candidate) => !candidate.externalId),
]
  .filter((candidate) => candidate.usable)
  .sort(
    (left, right) =>
      left.companyId.localeCompare(right.companyId, "es") ||
      left.file.localeCompare(right.file, "es"),
  );
let transcriptItems = transcriptCandidates.map((candidate) => {
  const audit = candidate.externalId
    ? auditItems.find(
        (item) =>
          item.companyId === candidate.companyId &&
          item.platform === candidate.platform &&
          item.externalId === candidate.externalId,
      )
    : null;
  const text = candidate.text;
  return {
    file: candidate.file,
    id: candidate.companyId,
    name: candidate.name,
    country: candidate.country,
    plataforma: candidate.externalId
      ? candidate.platform === "meta"
        ? "Meta Ads Library"
        : "Google Ads Transparency"
      : "Plataforma no determinada · archivo local",
    platformFamily: candidate.externalId ? candidate.platform : "unknown",
    externalId: candidate.externalId,
    titular: titleFrom(text),
    texto: text,
    cta: ctaFrom(text),
    precioVisible: priceFrom(text),
    angulo: angleFrom(text),
    capturaEnVivo: false,
    fecha: companyById.get(candidate.companyId)?.reviewedAt || "",
    origen: "ocr_captura",
    transcripcion: "OCR automático sobre creatividad local; original no verificado",
    confianza: candidate.confidence,
    estadoEvidencia: "OCR automático · pendiente de revisión literal",
    estadoOcr: audit?.estadoOcr || (candidate.confidence >= 90 ? "completo_alta" : candidate.confidence >= 75 ? "completo_media" : "completo_baja"),
    intentosOcr: candidate.attempts,
    motorOcr: candidate.engine,
    idiomasOcr: candidate.ocrLanguages,
    motivoOcr: candidate.reason,
    archivoSha256: candidate.archivoSha256,
    atribucion: "asociada_a_ficha",
    aptaPatrones: false,
  };
});

if (baselineRef) {
  const fromGit = (relativePath) => JSON.parse(execFileSync(
    "git",
    ["show", `${baselineRef}:${relativePath}`],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  ));
  const baselineAudit = fromGit("public/data/ad-ocr-audit.json");
  const baselineTranscripts = fromGit("public/data/ad-ocr-transcripts.json");
  const baselineAuditByIdentity = new Map(
    (baselineAudit.items || []).map((item) => [identityKey(item), item]),
  );
  auditItems = auditItems.map((item) => {
    const baseline = baselineAuditByIdentity.get(identityKey(item));
    if (
      !baseline ||
      baseline.estadoOcr === "pendiente" ||
      baseline.file !== item.file ||
      baseline.archivoSha256 !== item.archivoSha256
    ) return item;
    const baselineIsBetter =
      ["pendiente", "fallido", "sin_texto"].includes(item.estadoOcr) &&
      !["pendiente", "fallido", "sin_texto"].includes(baseline.estadoOcr);
    if (!baselineIsBetter) return item;
    return {
      ...baseline,
      companyId: item.companyId,
      platform: item.platform,
      externalId: item.externalId,
      file: item.file,
      variantCount: item.variantCount,
      country: item.country,
      mediaType: item.mediaType,
      archivoSha256: item.archivoSha256,
    };
  });

  const identityByKey = new Map(identities.map((item) => [identityKey(item), item]));
  const transcriptKey = (item) => item.externalId
    ? `${item.id}:${item.platformFamily}:${item.externalId}`
    : `file:${item.file}`;
  const merged = new Map();
  for (const item of baselineTranscripts.items || []) {
    if (!item.externalId) {
      const diskPath = resolve(root, "public", String(item.file || "").replace(/^\/+/, ""));
      if (companyById.has(item.id) && item.file && existsSync(diskPath)) {
        merged.set(transcriptKey(item), item);
      }
      continue;
    }
    const identity = item.externalId
      ? identityByKey.get(`${item.id}:${item.platformFamily}:${item.externalId}`)
      : null;
    if (!identity) continue;
    merged.set(transcriptKey(item), item);
  }
  for (const item of transcriptItems) merged.set(transcriptKey(item), item);
  transcriptItems = [...merged.values()].sort(
    (left, right) =>
      left.id.localeCompare(right.id, "es") ||
      left.file.localeCompare(right.file, "es"),
  );
  sourceFiles.push(`git:${baselineRef}`);
}

const statusCounts = auditItems.reduce((counts, item) => {
  counts[item.estadoOcr] = (counts[item.estadoOcr] || 0) + 1;
  return counts;
}, {});
const audit = {
  schema: "redvitalia-ad-ocr-audit-v2",
  generatedAt: new Date().toISOString().slice(0, 10),
  note: "Una fila por identidad creativa exacta con archivo versionado. Un estado sin texto o fallido no se interpreta como ausencia de anuncio.",
  totalAssets: auditItems.length,
  sourceFiles,
  statusCounts,
  attemptedAssets: auditItems.filter((item) => item.intentosOcr > 0).length,
  assetsWithUsableText: auditItems.filter((item) => item.textoUtil).length,
  assetsPending: auditItems.filter((item) => item.estadoOcr === "pendiente").length,
  items: auditItems,
};
const transcripts = {
  schema: "redvitalia-ad-ocr-transcripts-v2",
  generatedAt: new Date().toISOString().slice(0, 10),
  nota: "OCR trazable al archivo, hash, motor e intentos. Es buscable, pero nunca sustituye al original verificado ni entra en patrones sin revisión humana.",
  sourceFiles,
  total: transcriptItems.length,
  companies: new Set(transcriptItems.map((item) => item.id)).size,
  items: transcriptItems,
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 1)}\n`);
writeFileSync(transcriptPath, `${JSON.stringify(transcripts, null, 1)}\n`);
console.log(`${transcriptPath}: ${transcripts.total} OCR útiles · ${transcripts.companies} empresas`);
console.log(`${auditPath}: ${audit.totalAssets} identidades · ${audit.attemptedAssets} intentadas · ${audit.assetsPending} pendientes`);
