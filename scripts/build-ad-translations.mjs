#!/usr/bin/env node
/**
 * Traduce al español con inferencia local, caché por hash y QA estricto.
 * El original nunca se modifica. Cada lote aceptado se guarda de forma
 * atómica; una salida dudosa se conserva como rechazo y queda pendiente.
 *
 * Uso:
 *   node scripts/build-ad-translations.mjs
 *   node scripts/build-ad-translations.mjs --limit 20 --languages en,fr
 *   node scripts/build-ad-translations.mjs --hashes 2037f0d386d5,f26c584d65b1
 */
import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline } from "@huggingface/transformers";
import {
  brandTermsFor,
  escapeRegExp,
  literalCounts,
  missingBrandTerms,
  PROTECTED_PATTERN_SOURCE,
  sourceLanguageMismatch,
  sourceResidueProblem,
  sourceResidueTerms,
  targetLanguageProblem,
  unexpectedSourceScriptProblem,
} from "./lib/ad-translation-qa.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusPath = resolve(root, "public/data/ad-corpus.json");
const outputPath = resolve(root, "public/data/ad-translations-es.json");
const reviewedOverridesPath = resolve(
  root,
  "scripts/data/ad-translation-overrides-es.json",
);
const quarantinePath = resolve(
  root,
  "scripts/data/ad-translation-quarantine-v22.json",
);
const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const limit = Math.max(0, Number(valueAfter("--limit", "0")) || 0);
const requestedLanguages = new Set(
  String(valueAfter("--languages", ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const requestedHashes = String(valueAfter("--hashes", ""))
  .split(",")
  .map((value) => value.trim().toLocaleLowerCase("en"))
  .filter(Boolean);
const cacheDir = resolve(
  valueAfter("--cache-dir", resolve(root, "work/huggingface-cache")),
);
env.cacheDir = cacheDir;
env.allowRemoteModels = true;

const RECIPE_VERSION = "rv-mt-es-v22";
const MIGRATABLE_RECIPE_VERSIONS = new Set([
  "rv-mt-es-v20",
  "rv-mt-es-v21",
]);
const AUTOMATIC_REVIEW_LANGUAGES = new Set([
  "ar",
  "he",
  "id",
  "ja",
  "ko",
  "th",
  "zh",
]);
const AUTOMATIC_REVIEW_MIN_CHARS = new Map([
  ["en", 425],
  ["fr", 360],
  ["de", 290],
]);
const automaticReviewReason = (source) => {
  if (AUTOMATIC_REVIEW_LANGUAGES.has(source.idioma))
    return `revision_editorial:idioma:${source.idioma}`;
  if (source.id === "dentalead" && source.idioma === "it")
    return "revision_editorial:familia:dentalead-it";
  const minChars = AUTOMATIC_REVIEW_MIN_CHARS.get(source.idioma);
  const sourceChars = [source.titular, source.texto, source.cta]
    .filter(Boolean)
    .join("\n").length;
  if (minChars && sourceChars >= minChars)
    return `revision_editorial:extension:${source.idioma}:${minChars}`;
  return null;
};
const CHECKPOINT_ITEMS = 8;
const DIRECT_MODELS = {
  en: "Xenova/opus-mt-en-es",
  fr: "Xenova/opus-mt-fr-es",
  de: "Xenova/opus-mt-de-es",
  it: "Xenova/opus-mt-it-es",
  ru: "Xenova/opus-mt-ru-es",
};
const PIVOT_MODELS = {
  pt: "Xenova/opus-mt-ROMANCE-en",
  tr: "Xenova/opus-mt-tr-en",
  ar: "Xenova/opus-mt-ar-en",
  ja: "Xenova/opus-mt-ja-en",
  zh: "Xenova/opus-mt-zh-en",
  ko: "Xenova/opus-mt-ko-en",
  he: "Xenova/opus-mt-mul-en",
  id: "Xenova/opus-mt-id-en",
  vi: "Xenova/opus-mt-vi-en",
  th: "Xenova/opus-mt-th-en",
  pl: "Xenova/opus-mt-pl-en",
  nl: "Xenova/opus-mt-nl-en",
  da: "Xenova/opus-mt-da-en",
};
const supported = new Set([
  ...Object.keys(DIRECT_MODELS),
  ...Object.keys(PIVOT_MODELS),
]);

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const previous = existsSync(outputPath)
  ? JSON.parse(readFileSync(outputPath, "utf8"))
  : { items: [], rejections: [] };
const reviewedOverrides = existsSync(reviewedOverridesPath)
  ? JSON.parse(readFileSync(reviewedOverridesPath, "utf8"))
  : { items: [] };
const quarantine = existsSync(quarantinePath)
  ? JSON.parse(readFileSync(quarantinePath, "utf8"))
  : { items: [] };
const quarantineByHash = new Map(
  (quarantine.items || []).map((item) => [item.sourceCopySha256, item]),
);
const sourceItems = (corpus.items || []).filter(
  (item) =>
    item.copyAvailable &&
    supported.has(item.idioma) &&
    item.idioma !== "es" &&
    ["detected", "reviewed"].includes(item.idiomaOrigen) &&
    item.estadoOcr !== "completo_baja" &&
    Number(item.idiomaConfianza || 0) >= 0.68,
);
const activeItemByHash = new Map(
  sourceItems.map((item) => [item.sourceCopySha256, item]),
);

const normalizeComparable = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}%€$+.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const PROTECTED_PATTERN = new RegExp(PROTECTED_PATTERN_SOURCE, "giu");

const splitProtectedParts = (value, protectedTerms = []) => {
  const text = String(value || "");
  const terms = protectedTerms
    .map((term) => String(term || "").trim())
    .filter((term) => term.length >= 3)
    .map((term) => `["“”]?${escapeRegExp(term)}["“”]?`);
  const pattern = new RegExp(
    terms.length ? `${PROTECTED_PATTERN.source}|${terms.join("|")}` : PROTECTED_PATTERN.source,
    "giu",
  );
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor)
      parts.push({ type: "text", value: text.slice(cursor, match.index) });
    parts.push({ type: "literal", value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length)
    parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value: text }];
};

const splitLongLine = (text, max = 420, protectedTerms = []) => {
  const chunks = [];
  let remaining = text;
  while (remaining.length > max) {
    const window = remaining.slice(0, max + 1);
    const breaks = [
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("; "),
      window.lastIndexOf(" "),
    ];
    const best = Math.max(...breaks);
    let end = best >= Math.floor(max * 0.55)
      ? best + (window[best] === "\n" ? 0 : 1)
      : max;
    for (const term of protectedTerms) {
      const pattern = new RegExp(escapeRegExp(term), "giu");
      for (const match of remaining.matchAll(pattern)) {
        const start = match.index;
        const finish = start + match[0].length;
        if (start < end && finish > end) {
          end = start >= Math.floor(max * 0.35) ? start : finish;
          break;
        }
      }
    }
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};

const splitText = (value, max = 420, protectedTerms = []) => {
  const text = String(value || "").trim();
  if (!text) return [];
  const lines = text
    .replace(/\s*\\[|]\s*/g, "\n")
    .replace(/\s+[|]\s+/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const chunks = [];
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    chunks.push(...splitLongLine(buffer, max, protectedTerms));
    buffer = "";
  };
  const exactCtas = /^(?:learn more|más información|sign up|watch on youtube|get started|get quote|get rate|see details|essayez gratuitement|essayez 15 jours gratuit|open|contact us|careers)$/i;
  const normalizedTerm = (valueToNormalize) => normalizeComparable(valueToNormalize);
  const semanticChunkBoundaries = new Set([
    "money back guarantee",
    "scale pipeline not payroll",
    "get 5 free target records",
  ]);
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    const isBrandLine = protectedTerms.some(
      (term) => normalizedTerm(term) === normalizedTerm(line),
    );
    const isUrlLine = /[./@]/.test(line) && new RegExp(`^(?:${PROTECTED_PATTERN.source})$`, "iu").test(line);
    const isMetadataLine = /^—\s*variante visible\s*—$/i.test(line);
    const isBullet = /^[✅☑✓•▪◾►▶👉]/u.test(line);
    if (isBrandLine || isUrlLine || isMetadataLine || exactCtas.test(line) || isBullet) {
      flush();
      chunks.push(line);
      continue;
    }
    const separator = buffer.endsWith("-") ? "" : " ";
    const candidate = buffer ? `${buffer}${separator}${line}` : line;
    if (candidate.length > Math.min(max, 260)) {
      flush();
      buffer = line;
    } else {
      buffer = candidate;
    }
    if (semanticChunkBoundaries.has(normalizedTerm(buffer))) flush();
    if (/[.!?…]$/.test(line) && buffer.length >= 120) flush();
  }
  flush();
  return chunks;
};

const allCopy = (copy) =>
  [copy?.titular, copy?.texto, copy?.cta].filter(Boolean).join("\n");

const repetitionProblem = (value) => {
  const tokens = normalizeComparable(value).split(" ").filter(Boolean);
  if (tokens.length < 18) return false;
  const tokenCounts = new Map();
  for (const token of tokens)
    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  if (
    Math.max(...tokenCounts.values()) >=
    Math.max(9, Math.ceil(tokens.length * 0.28))
  ) return true;
  const trigrams = new Map();
  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const key = tokens.slice(index, index + 3).join(" ");
    trigrams.set(key, (trigrams.get(key) || 0) + 1);
  }
  return Math.max(0, ...trigrams.values()) >= 7;
};

const unchangedCopyProblem = (original, translated) => {
  const sourceWords = normalizeComparable(original).split(" ").filter(Boolean);
  const targetWords = normalizeComparable(translated).split(" ").filter(Boolean);
  if (sourceWords.join(" ").length < 40 || targetWords.length < 6) return false;
  const source = new Set(sourceWords);
  const target = new Set(targetWords);
  let intersection = 0;
  for (const word of source) if (target.has(word)) intersection += 1;
  return intersection / Math.max(source.size, target.size, 1) > 0.86;
};

const semanticTranslationProblems = (original, translated) => {
  const problems = [];
  if (/\bdevis\b/iu.test(original) && /\b(?:monedas?|divisas?)\b/iu.test(translated))
    problems.push("devis_como_moneda");
  if (
    /\bd[eé]j[aà]\s+plus\s+de\s+\d/iu.test(original) &&
    /\bya\s+no(?:\s+\p{L}+){0,3}\s+\d/iu.test(translated)
  ) problems.push("inversion_deja_plus");
  if (/\bsans\s+frais\b/iu.test(original) && /\bsin\s+fresco\b/iu.test(translated))
    problems.push("sans_frais_como_fresco");
  if (/\bmoins\s+de\b/iu.test(original) && /\bmenos\s+da\b/iu.test(translated))
    problems.push("moins_de_como_menos_da");
  if (/â\s*[€¬™œ]|Ã[\p{L}€]|�/u.test(translated))
    problems.push("mojibake");
  if (!/[ãõ]/iu.test(original) && /[ãõ]/iu.test(translated))
    problems.push("diacritico_inesperado");
  return problems;
};

const validateTranslation = (entry, source) => {
  const reasons = [];
  if (entry.recipeVersion !== RECIPE_VERSION) reasons.push("receta_obsoleta");
  if (!["automatica", "revisada"].includes(entry.status))
    reasons.push("estado_no_publicable");
  const automaticReview = automaticReviewReason(source);
  if (entry.status === "automatica" && automaticReview)
    reasons.push(automaticReview);
  const quarantined = quarantineByHash.get(source.sourceCopySha256);
  if (entry.status === "automatica" && quarantined)
    reasons.push(
      `revision_editorial:cuarentena:${quarantined.severity || "P1"}:${quarantined.category || "semantica"}`,
    );
  if ((entry.warnings || []).length) reasons.push("tokens_protegidos_perdidos");
  for (const field of ["titular", "texto", "cta"]) {
    if (
      String(source[field] || "").trim() &&
      !String(entry.copy?.[field] || "").trim()
    ) reasons.push(`campo_vacio:${field}`);
  }
  const original = allCopy(source);
  const translated = allCopy(entry.copy);
  const protectedTerms = brandTermsFor(source);
  const sourceMismatch = sourceLanguageMismatch(
    original,
    source.idioma,
    protectedTerms,
  );
  if (sourceMismatch)
    reasons.push(`idioma_origen_inconsistente:${source.idioma}->${sourceMismatch}`);
  const ratio = translated.length / Math.max(1, original.length);
  const wideRatio = /^(?:ar|he|ja|ko|zh|th)$/.test(source.idioma);
  if (
    ratio < (wideRatio ? 0.12 : 0.25) ||
    ratio > (wideRatio ? 6 : 3.2)
  ) reasons.push(`ratio_anomalo:${ratio.toFixed(2)}`);
  if (repetitionProblem(translated) && !repetitionProblem(original))
    reasons.push("repeticion_anomala");
  if (unexpectedSourceScriptProblem(translated, protectedTerms))
    reasons.push("escritura_inesperada");
  else if (targetLanguageProblem(translated, protectedTerms))
    reasons.push("destino_no_espanol");
  const residue = sourceResidueTerms(translated, source.idioma, protectedTerms, original);
  if (sourceResidueProblem(translated, source.idioma, protectedTerms, original))
    reasons.push(
      residue.length
        ? `residuo_idioma_origen:${residue.join(",")}`
        : "residuo_no_espanol",
    );
  for (const field of ["titular", "texto"]) {
    const originalField = String(source[field] || "").trim();
    const translatedField = String(entry.copy?.[field] || "").trim();
    if (!originalField || !translatedField) continue;
    const fieldWordCount = normalizeComparable(translatedField)
      .split(" ")
      .filter(Boolean).length;
    if (
      (field === "texto" || fieldWordCount >= 12) &&
      targetLanguageProblem(translatedField, protectedTerms)
    )
      reasons.push(`destino_no_espanol:${field}`);
    const fieldResidue = sourceResidueTerms(
      translatedField,
      source.idioma,
      protectedTerms,
      originalField,
    );
    if (
      sourceResidueProblem(
        translatedField,
        source.idioma,
        protectedTerms,
        originalField,
      )
    ) reasons.push(
      fieldResidue.length
        ? `residuo_idioma_origen:${field}:${fieldResidue.join(",")}`
        : `residuo_no_espanol:${field}`,
    );
  }
  if (unchangedCopyProblem(original, translated)) reasons.push("salida_sin_traducir");
  for (const problem of semanticTranslationProblems(original, translated))
    reasons.push(`error_semantico:${problem}`);
  for (const term of missingBrandTerms(original, translated, protectedTerms))
    reasons.push(`marca_alterada:${term}`);
  const originalLiterals = literalCounts(original);
  const translatedLiterals = literalCounts(translated);
  for (const [literal, count] of originalLiterals) {
    if ((translatedLiterals.get(literal) || 0) < count)
      reasons.push(`literal_perdido:${literal}`);
  }
  for (const [literal, count] of translatedLiterals) {
    if ((originalLiterals.get(literal) || 0) < count)
      reasons.push(`literal_inventado:${literal}`);
  }
  return [...new Set(reasons)];
};

const byHash = new Map();
for (const entry of previous.items || []) {
  const source = activeItemByHash.get(entry.sourceCopySha256);
  const candidate = MIGRATABLE_RECIPE_VERSIONS.has(entry.recipeVersion)
    ? {
        ...entry,
        recipeVersion: RECIPE_VERSION,
        sourceConfidence: source?.idiomaConfianza,
        sourceDetection: source?.idiomaOrigen,
      }
    : entry;
  if (
    source &&
    source.idioma === candidate.sourceLanguage &&
    !validateTranslation(candidate, source).length
  ) byHash.set(candidate.sourceCopySha256, candidate);
}
const rejectionByHash = new Map(
  (previous.rejections || [])
    .filter(
      (entry) =>
        entry.recipeVersion === RECIPE_VERSION ||
        MIGRATABLE_RECIPE_VERSIONS.has(entry.recipeVersion),
    )
    .map((entry) => [
      entry.sourceCopySha256,
      { ...entry, recipeVersion: RECIPE_VERSION },
    ]),
);

const previousItemByHash = new Map(
  (previous.items || []).map((item) => [item.sourceCopySha256, item]),
);
for (const source of activeItemByHash.values()) {
  const quarantineItem = quarantineByHash.get(source.sourceCopySha256);
  const automaticReview = automaticReviewReason(source);
  if (
    byHash.has(source.sourceCopySha256) ||
    (!automaticReview && !quarantineItem)
  ) continue;
  const previousRejection = rejectionByHash.get(source.sourceCopySha256);
  const previousItem = previousItemByHash.get(source.sourceCopySha256);
  const reasons = new Set(previousRejection?.reasons || []);
  if (automaticReview) reasons.add(automaticReview);
  if (quarantineItem)
    reasons.add(
      `revision_editorial:cuarentena:${quarantineItem.severity || "P1"}:${quarantineItem.category || "semantica"}`,
    );
  rejectionByHash.set(source.sourceCopySha256, {
    sourceCopySha256: source.sourceCopySha256,
    sourceLanguage: source.idioma,
    recipeVersion: RECIPE_VERSION,
    models: previousItem?.models || previousRejection?.models || [],
    rejectedAt: new Date().toISOString(),
    reasons: [...reasons],
    candidateCopy:
      previousItem?.copy || previousRejection?.candidateCopy || undefined,
  });
}

const overrideProblems = [];
for (const override of reviewedOverrides.items || []) {
  const source = activeItemByHash.get(override.sourceCopySha256);
  if (!source) {
    overrideProblems.push(`sin fuente activa: ${override.sourceCopySha256}`);
    continue;
  }
  if (source.idioma !== override.sourceLanguage) {
    overrideProblems.push(
      `idioma incoherente: ${override.sourceCopySha256} · ${override.sourceLanguage}->${source.idioma}`,
    );
    continue;
  }
  const entry = {
    sourceCopySha256: source.sourceCopySha256,
    sourceLanguage: source.idioma,
    targetLanguage: "es",
    status: "revisada",
    recipeVersion: RECIPE_VERSION,
    sourceConfidence: source.idiomaConfianza,
    sourceDetection: source.idiomaOrigen,
    provider: "Revisión editorial asistida · contraste contextual",
    models: [],
    model: "Revisión editorial asistida",
    translatedAt: override.reviewedAt || new Date().toISOString().slice(0, 10),
    reviewedBy: override.reviewedBy || "RedVitalia · revisión editorial asistida",
    reviewNote: override.reviewNote || "Traducción contrastada con el original",
    warnings: [],
    copy: {
      titular: String(override.copy?.titular || "").trim(),
      texto: String(override.copy?.texto || "").trim(),
      cta: String(override.copy?.cta || "").trim(),
      precioVisible:
        override.copy?.precioVisible ?? source.precioVisible ?? "",
    },
  };
  const reasons = validateTranslation(entry, source);
  if (reasons.length) {
    overrideProblems.push(
      `${source.sourceCopySha256}: ${reasons.join(", ")}`,
    );
    continue;
  }
  byHash.set(source.sourceCopySha256, entry);
  rejectionByHash.delete(source.sourceCopySha256);
}
if (overrideProblems.length) {
  throw new Error(
    `Overrides editoriales inválidos (${overrideProblems.length}):\n- ${overrideProblems.join("\n- ")}`,
  );
}

const snapshot = () => {
  const items = [...byHash.values()]
    .filter((entry) => {
      const source = activeItemByHash.get(entry.sourceCopySha256);
      return source && source.idioma === entry.sourceLanguage;
    })
    .sort(
      (left, right) =>
        left.sourceLanguage.localeCompare(right.sourceLanguage, "es") ||
        left.sourceCopySha256.localeCompare(right.sourceCopySha256),
    );
  const rejections = [...rejectionByHash.values()]
    .filter((entry) => activeItemByHash.has(entry.sourceCopySha256))
    .sort((left, right) =>
      left.sourceCopySha256.localeCompare(right.sourceCopySha256),
    );
  const data = {
    schema: "redvitalia-ad-translations-es-v1",
    generatedAt: new Date().toISOString().slice(0, 10),
    recipeVersion: RECIPE_VERSION,
    models: [
      ...new Set(
        items.flatMap((item) => item.models || [item.model]).filter(Boolean),
      ),
    ],
    provider: "Traducción neuronal local + revisión editorial asistida",
    note: "Traducciones para lectura y búsqueda, con estado automático o revisado por pieza. Nunca sustituyen el original. Las salidas dudosas permanecen en revisión y fuera de publicación.",
    total: items.length,
    rejectedCount: rejections.length,
    items,
    rejections,
  };
  const temporary = `${outputPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 1)}\n`);
  renameSync(temporary, outputPath);
};

snapshot();
let pending = [...activeItemByHash.values()].filter(
  (item) =>
    !byHash.has(item.sourceCopySha256) &&
    !(rejectionByHash.get(item.sourceCopySha256)?.reasons || []).some((reason) =>
      String(reason).startsWith("revision_editorial:"),
    ) &&
    (!requestedLanguages.size || requestedLanguages.has(item.idioma)) &&
    (!requestedHashes.length ||
      requestedHashes.some((prefix) =>
        item.sourceCopySha256.toLocaleLowerCase("en").startsWith(prefix),
      )),
);
if (limit > 0) pending = pending.slice(0, limit);
if (!pending.length) {
  console.log(`${outputPath}: sin traducciones nuevas · ${byHash.size} válidas`);
  process.exit(0);
}

const groupByLanguage = (items) => {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.idioma) || [];
    group.push(item);
    groups.set(item.idioma, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => allCopy(left).length - allCopy(right).length);
  }
  return groups;
};

const languageGroups = groupByLanguage(pending);
const infrastructureFailures = [];
const recordInfrastructureFailure = (language, models, error) => {
  const message = String(error?.message || error || "Error desconocido");
  infrastructureFailures.push({ language, models, message });
  console.error(
    `No se pudo procesar ${language}; se conserva pendiente. ${message}`,
  );
};
const generationOptions = (batch) => ({
  max_new_tokens: Math.min(
    220,
    Math.max(
      12,
      Math.ceil(Math.max(...batch.map((value) => value.length)) / 2) + 6,
    ),
  ),
  num_beams: 3,
  early_stopping: true,
  no_repeat_ngram_size: 3,
  repetition_penalty: 1.12,
});

const modelResultCache = new WeakMap();
const runModel = async (translator, values, extra = {}) => {
  if (!values.length) return [];
  if (values.length === 1 && !Object.keys(extra).length) {
    const cache = modelResultCache.get(translator) || new Map();
    modelResultCache.set(translator, cache);
    if (cache.has(values[0])) return [cache.get(values[0])];
    const output = await translator(values, generationOptions(values));
    const rows = Array.isArray(output) ? output : [output];
    const translated = String(rows[0]?.translation_text || "").trim();
    cache.set(values[0], translated);
    return [translated];
  }
  const output = await translator(values, {
    ...generationOptions(values),
    ...extra,
  });
  const rows = Array.isArray(output) ? output : [output];
  return rows.map((row) => String(row?.translation_text || "").trim());
};

const EXACT_MARKETING_TRANSLATIONS = new Map([
  ["learn more", "Más información"],
  ["sign up", "Regístrate"],
  ["watch on youtube", "Ver en YouTube"],
  ["get started", "Empieza ahora"],
  ["más información", "Más información"],
  ["money back guarantee", "Garantía de devolución del dinero"],
  ["scale pipeline not payroll", "Escala el embudo comercial, no la plantilla"],
  ["get 5 free target records", "Consigue 5 contactos objetivo gratis"],
  ["get quote", "Solicita presupuesto"],
  ["get rate", "Solicita presupuesto"],
  ["see details", "Ver detalles"],
  ["essayez gratuitement", "Pruébalo gratis"],
  ["essayez 15 jours gratuit", "Pruébalo gratis durante 15 días"],
  ["follow us now", "Síguenos ahora"],
  ["dein permanent make up", "Tu maquillaje permanente"],
  ["scopri il libro", "Descubre el libro"],
  ["sans frais", "Sin coste"],
  ["richiedi un preventivo personalizza", "Solicita un presupuesto personalizado"],
]);

const exactMarketingTranslation = (source) =>
  EXACT_MARKETING_TRANSLATIONS.get(normalizeComparable(source));

const applyMarketingGlossary = (source, translated, allowExact = true) => {
  let output = String(translated || "");
  const exactSource = normalizeComparable(source);
  if (allowExact && EXACT_MARKETING_TRANSLATIONS.has(exactSource))
    return EXACT_MARKETING_TRANSLATIONS.get(exactSource);
  if (/\bleads?\b/i.test(source)) {
    output = output.replace(
      /\b(?:leads?|plomos?|l[ií]der(?:es)?|pistas?|conductores?)\b/gi,
      "contactos potenciales",
    );
  }
  if (/\bquit\b/i.test(source)) {
    output = output
      .replace(/\bdejan de fumar\b/gi, "abandonan")
      .replace(/\bdeja de fumar\b/gi, "abandona");
  }
  const exactPhrases = [
    [/\blearn more\b/gi, "Más información"],
    [/\bsign up\b/gi, "Regístrate"],
    [/\bwatch on youtube\b/gi, "Ver en YouTube"],
    [/\bget started\b/gi, "Empieza ahora"],
    [/\bget (?:quote|rate)\b/gi, "Solicita presupuesto"],
    [/\bsee details\b/gi, "Ver detalles"],
    [/\bessayez gratuitement\b/gi, "Pruébalo gratis"],
    [/\bessayez 15 jours gratuit\b/gi, "Pruébalo gratis durante 15 días"],
    [/\bfollow us now\b/gi, "Síguenos ahora"],
    [/\bdein permanent make up\b/gi, "Tu maquillaje permanente"],
    [/\bsans frais\b/gi, "Sin coste"],
  ];
  for (const [pattern, replacement] of exactPhrases) {
    if (pattern.test(source)) output = output.replace(pattern, replacement);
    pattern.lastIndex = 0;
  }
  if (/\blead generation\b/i.test(source)) {
    output = output.replace(
      /\b(?:lead generation|contactos potenciales\s+generaci[oó]n|generaci[oó]n\s+de\s+(?:leads?|contactos potenciales))\b/gi,
      "captación de clientes potenciales",
    );
  }
  if (/\bcold calling\b/i.test(source)) {
    output = output.replace(/\bcold calling\b/gi, "prospección telefónica");
  }
  if (/\bpipelines?\b/i.test(source)) {
    const plural = /\bpipelines\b/i.test(source);
    output = output.replace(
      /\b(?:gasoductos?|oleoductos?|tuber[ií]as?|pipelines?)\b/gi,
      plural ? "embudos comerciales" : "embudo comercial",
    );
  }
  if (/\bappointments?\b/i.test(source))
    output = output.replace(/\bnombramientos?\b/gi, "citas");
  if (/\breal human dialers\b/i.test(source))
    output = output.replace(
      /\b(?:reales\s+)?marcadores humanos(?:\s+reales)?\b/gi,
      "teleoperadores reales",
    );
  if (/\bwalk-?throughs?\b/i.test(source))
    output = output.replace(
      /\b(?:paseos?|recorridos?|pasos? a trav[eé]s)\b/gi,
      "visitas técnicas",
    );
  if (/\bbypass\b/i.test(source))
    output = output.replace(/\bbypass\b/gi, "evita");
  if (/\bjanitorial\b/i.test(source))
    output = output.replace(/\bjanitorial\b/gi, "de limpieza profesional");
  if (/\blow-bid cleaning boards\b/i.test(source))
    output = output.replace(
      /\blow-?bid cleaning boards\b/gi,
      "plataformas de limpieza de bajo presupuesto",
    );
  if (/\bcoffee break\b/i.test(source))
    output = output.replace(
      /\bbreak caf[eé](?=\s|$|[,.;:!?])|\bcoffee break\b/gi,
      "pausa para el café",
    );
  const campaignPhrases = [
    [/\bfree credit car wash service\b/gi, "crédito gratis para el servicio de lavado de coches"],
    [/\bcar wash service\b/gi, "servicio de lavado de coches"],
    [/\b(?:i\s+)?guaranteed sales meetings\b/gi, "reuniones comerciales garantizadas"],
    [/\bexclusive market (?:leads?|contactos potenciales)\b/gi, "contactos potenciales exclusivos del mercado"],
    [/\b(?:cold calling|prospecci[oó]n telef[oó]nica) services\b/gi, "servicios de prospección telefónica"],
    [/\bB2B marketing services\b/gi, "servicios de marketing B2B"],
    [/\bcommercial cleaning (?:leads?|contactos potenciales)\b/gi, "contactos potenciales de limpieza comercial"],
    [/\bquality B2B (?:leads?|contactos potenciales)\b/gi, "contactos potenciales B2B de calidad"],
    [/\blead generation services\b/gi, "servicios de captación de clientes potenciales"],
  ];
  for (const [pattern, replacement] of campaignPhrases)
    output = output.replace(pattern, replacement);
  if (/\bappels?\s+d['’]?\s*offres\b/i.test(source))
    output = output.replace(
      /\b(?:appels?\s+(?:d|de)\s+offres?|llamadas?\s+de\s+ofertas?)\b/gi,
      "licitaciones",
    );
  if (/\bchantiers?\b/i.test(source))
    output = output.replace(
      /\b(?:chantiers?|astilleros?|candados?)\b/gi,
      "obras",
    );
  if (/\bplanning\b/i.test(source))
    output = output.replace(/\bplanning\b/gi, "planificación");
  if (/\bdevis\b/i.test(source))
    output = output.replace(
      /\b(?:devis|monedas?|divisas?)\b/gi,
      "presupuesto",
    );
  if (/\bd[eé]j[aà]\s+plus\s+de\s+\d/i.test(source))
    output = output.replace(
      /\bya\s+no(?:\s+\p{L}+){0,3}\s+(\d[\d.]*)/giu,
      "Ya son más de $1",
    );
  if (/\bsans\s+frais\b/i.test(source))
    output = output.replace(/\bsin\s+fresco\b/gi, "sin coste");
  if (/\bmoins\s+de\b/i.test(source))
    output = output.replace(/\bmenos\s+da\b/gi, "menos de");
  if (/\bmeilleur\b/i.test(source))
    output = output.replace(/\b(?:meilleur|meileur)\b/gi, "mejor");
  if (/\b[eé]lectriciens?\b/i.test(source))
    output = output.replace(
      /\b(?:[eé]lectriciens?|electriens?)\b/gi,
      "electricistas",
    );
  if (/\barchitectes?\b/i.test(source))
    output = output.replace(/\barchitectes?\b/gi, "arquitectos");
  output = output.replace(/\bmentale?\s+da\b/gi, "mental de");
  if (/\bimpresa\s+edile\b/i.test(source))
    output = output.replace(/\bempresa\s+edile\b/gi, "empresa constructora");
  if (/\bpreventivi\s+della\b/i.test(source))
    output = output.replace(
      /\bpreventivos?\s+della\b/gi,
      "presupuestos de la",
    );
  if (/\bil\s+dentista\s+cieco\b/i.test(source))
    output = output.replace(/\bel\s+den(?:tista|ista)\s+cieco\b/gi, "el dentista ciego");
  if (/\bscopri\s+il\s+libro\b/i.test(source))
    output = output.replace(
      /\b(?:descubierta?|descubre)\s+el\s+libro\b/gi,
      "Descubre el libro",
    );
  output = output.replace(/\bembudos comerciales comerciales\b/gi, "embudos comerciales");
  output = output
    .replace(
      /\bempresa contactos potenciales de generaci[oó]n\b/gi,
      "empresa de captación de clientes potenciales",
    )
    .replace(
      /\bexpert B2B captaci[oó]n de clientes potenciales\b/gi,
      "captación experta de clientes potenciales B2B",
    )
    .replace(
      /\bgen contactos potenciales\b/gi,
      "captación de clientes potenciales",
    )
    .replace(
      /\bm[aá]s cuantificado B2B contactos potenciales\b/gi,
      "más contactos potenciales B2B cualificados",
    );
  if (/\bcommercialista\b/i.test(source)) {
    output = output.replace(
      /\b(?:commercialista|comercializaci[oó]n|comercializador(?:a)?)\b/gi,
      "asesor fiscal",
    );
  }
  if (/\bfuoriclasse\b/i.test(source)) {
    output = output.replace(
      /\b(?:fuoriclasse|holgaz[aá]n|perezoso)\b/gi,
      "profesional excepcional",
    );
  }
  if (/\bun quarto d['’]ora\b/i.test(source))
    output = output.replace(/\b15\s+minutos?\b/gi, "un cuarto de hora");
  const italianResidue = new Map([
    ["ottieni", "Consigue"],
    ["preventivi", "presupuestos"],
    ["sponsorizzato", "Patrocinado"],
    ["scopri", "Descubre"],
    ["trova", "Encuentra"],
    ["confronta", "Compara"],
    ["professionisti", "profesionales"],
    ["imprese", "empresas"],
    ["aziende", "empresas"],
  ]);
  for (const [word, replacement] of italianResidue) {
    if (new RegExp(`\\b${word}\\b`, "i").test(source))
      output = output.replace(new RegExp(`\\b${word}\\b`, "gi"), replacement);
  }
  const italianWrittenNumbers = [
    ["cinque", "5", "cinco"],
    ["dieci", "10", "diez"],
    ["dodici", "12", "doce"],
    ["quindici", "15", "quince"],
    ["venti", "20", "veinte"],
    ["trenta", "30", "treinta"],
    ["quaranta", "40", "cuarenta"],
    ["cinquanta", "50", "cincuenta"],
    ["sessanta", "60", "sesenta"],
    ["settanta", "70", "setenta"],
    ["ottanta", "80", "ochenta"],
    ["novanta", "90", "noventa"],
    ["cento", "100", "cien"],
  ];
  for (const [word, digit, spanish] of italianWrittenNumbers) {
    if (!new RegExp(`\\b${word}\\b`, "i").test(source)) continue;
    if (new RegExp(`(?:^|\\D)${digit}(?:\\D|$)`).test(source)) continue;
    output = output
      .replace(new RegExp(`\\b${digit}\\s*%`, "g"), `${spanish} por ciento`)
      .replace(new RegExp(`\\b${digit}\\b`, "g"), spanish);
  }
  return output;
};

const applyWholeSegmentRepairs = (source, translated) => {
  let output = String(translated || "");
  if (/\bd[eé]j[aà]\s+plus\s+de\s+\d/i.test(source))
    output = output.replace(
      /\bya\s+no(?:\s+\p{L}+){0,3}\s+(\d[\d.]*)/giu,
      "Ya son más de $1",
    );
  return output;
};

const makeSegments = (items) => {
  const segments = [];
  for (const item of items) {
    const protectedTerms = [...brandTermsFor(item), "— Variante visible —"];
    for (const field of ["titular", "texto", "cta"]) {
      splitText(item[field], 420, protectedTerms).forEach((text, index) => {
        segments.push({
          hash: item.sourceCopySha256,
          field,
          index,
          original: text,
          protectedTerms,
        });
      });
    }
  }
  return segments.sort((left, right) => left.original.length - right.original.length);
};

const translateSegments = async (
  segments,
  firstTranslator,
  secondTranslator,
) => {
  const translated = new Map();
  const warnings = new Map();
  for (const segment of segments) {
    let output = exactMarketingTranslation(segment.original) || "";
    if (!output) {
      for (const part of splitProtectedParts(segment.original, segment.protectedTerms)) {
        if (part.type === "literal") {
          output += part.value;
          continue;
        }
        const leading = part.value.match(/^\s*/)?.[0] || "";
        const trailing = part.value.match(/\s*$/)?.[0] || "";
        const core = part.value.trim();
        if (!core || !/\p{L}/u.test(core)) {
          output += part.value;
          continue;
        }
        const first = (await runModel(firstTranslator, [core]))[0];
        const final = secondTranslator
          ? (await runModel(secondTranslator, [first]))[0]
          : first;
        if (!final) {
          const current = warnings.get(segment.hash) || [];
          current.push(`Salida vacía en ${segment.field}`);
          warnings.set(segment.hash, current);
        }
        const rendered = `${leading}${applyMarketingGlossary(core, final || core)}${trailing}`;
        if (/\p{L}$/u.test(output) && /^\p{L}/u.test(rendered))
          output += " ";
        output += rendered;
      }
      output = splitProtectedParts(output, segment.protectedTerms)
        .map((part) => part.type === "literal"
          ? part.value
          : applyMarketingGlossary(segment.original, part.value, false))
        .join("");
      output = applyWholeSegmentRepairs(segment.original, output);
    }
    const key = `${segment.hash}:${segment.field}`;
    const values = translated.get(key) || [];
    values[segment.index] = output
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
    translated.set(key, values);
  }
  return { translated, warnings };
};

const commitChunk = (items, result, language, models, provider) => {
  for (const item of items) {
    const joinField = (field) =>
      (result.translated.get(`${item.sourceCopySha256}:${field}`) || [])
        .filter(Boolean)
        .join("\n");
    const entry = {
      sourceCopySha256: item.sourceCopySha256,
      sourceLanguage: language,
      targetLanguage: "es",
      status: "automatica",
      recipeVersion: RECIPE_VERSION,
      sourceConfidence: item.idiomaConfianza,
      sourceDetection: item.idiomaOrigen,
      provider,
      models,
      model: models.join(" → "),
      translatedAt: new Date().toISOString().slice(0, 10),
      copy: {
        titular: joinField("titular"),
        texto: joinField("texto"),
        cta: joinField("cta"),
        precioVisible: item.precioVisible || "",
      },
      warnings: result.warnings.get(item.sourceCopySha256) || [],
    };
    const reasons = validateTranslation(entry, item);
    if (reasons.length) {
      rejectionByHash.set(item.sourceCopySha256, {
        sourceCopySha256: item.sourceCopySha256,
        sourceLanguage: language,
        recipeVersion: RECIPE_VERSION,
        models,
        rejectedAt: new Date().toISOString(),
        reasons,
        candidateCopy: entry.copy,
      });
      byHash.delete(item.sourceCopySha256);
    } else {
      byHash.set(item.sourceCopySha256, entry);
      rejectionByHash.delete(item.sourceCopySha256);
    }
  }
  snapshot();
};

const processLanguage = async (
  language,
  items,
  firstTranslator,
  secondTranslator,
  models,
  provider,
) => {
  console.error(`${language}: ${items.length} textos únicos`);
  for (let start = 0; start < items.length; start += CHECKPOINT_ITEMS) {
    const chunk = items.slice(start, start + CHECKPOINT_ITEMS);
    const result = await translateSegments(
      makeSegments(chunk),
      firstTranslator,
      secondTranslator,
    );
    commitChunk(chunk, result, language, models, provider);
    console.error(`  ${Math.min(start + chunk.length, items.length)}/${items.length}`);
  }
};

// Primero, modelos directos: calidad y velocidad superiores.
for (const language of ["it", "fr", "de", "ru"]) {
  const items = languageGroups.get(language) || [];
  if (!items.length) continue;
  const model = DIRECT_MODELS[language];
  console.error(`Cargando ${model}`);
  let translator;
  try {
    translator = await pipeline("translation", model, { dtype: "q8" });
    await processLanguage(
      language,
      items,
      translator,
      null,
      [model],
      "MarianMT · inferencia local directa",
    );
  } catch (error) {
    recordInfrastructureFailure(language, [model], error);
  } finally {
    await translator?.dispose?.();
  }
}

// Inglés directo y todos los pivotes comparten el mismo segundo paso EN→ES.
const englishItems = languageGroups.get("en") || [];
const pivotLanguages = [...languageGroups.keys()].filter(
  (language) => PIVOT_MODELS[language],
);
if (englishItems.length || pivotLanguages.length) {
  const targetModel = DIRECT_MODELS.en;
  console.error(`Cargando ${targetModel}`);
  let targetTranslator;
  try {
    targetTranslator = await pipeline("translation", targetModel, {
      dtype: "q8",
    });
    if (englishItems.length) {
      try {
        await processLanguage(
          "en",
          englishItems,
          targetTranslator,
          null,
          [targetModel],
          "MarianMT · inferencia local directa",
        );
      } catch (error) {
        recordInfrastructureFailure("en", [targetModel], error);
      }
    }
    for (const language of pivotLanguages) {
      const sourceModel = PIVOT_MODELS[language];
      console.error(`Cargando ${sourceModel}`);
      let sourceTranslator;
      try {
        sourceTranslator = await pipeline("translation", sourceModel, {
          dtype: "q8",
        });
        await processLanguage(
          language,
          languageGroups.get(language),
          sourceTranslator,
          targetTranslator,
          [sourceModel, targetModel],
          "MarianMT · inferencia local con pivote inglés",
        );
      } catch (error) {
        recordInfrastructureFailure(
          language,
          [sourceModel, targetModel],
          error,
        );
      } finally {
        await sourceTranslator?.dispose?.();
      }
    }
  } catch (error) {
    recordInfrastructureFailure(
      englishItems.length ? "en y pivotes" : "pivotes",
      [targetModel],
      error,
    );
  } finally {
    await targetTranslator?.dispose?.();
  }
}

snapshot();
console.log(
  `${outputPath}: ${byHash.size} traducciones válidas · ${rejectionByHash.size} pendientes de revisión`,
);
if (infrastructureFailures.length) {
  console.error(
    `${infrastructureFailures.length} idioma(s) quedaron pendientes por fallos de infraestructura.`,
  );
  process.exitCode = 1;
}
