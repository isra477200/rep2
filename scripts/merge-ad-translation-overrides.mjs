#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "scripts/data/ad-translation-overrides-es.json");
const corpusPath = resolve(root, "public/data/ad-corpus.json");
const fragmentPaths = process.argv.slice(2).map((value) => resolve(root, value));

if (!fragmentPaths.length) {
  throw new Error("Indica al menos un fragmento de traducciones revisadas.");
}

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const activeByHash = new Map();
for (const item of corpus.items || []) {
  if (!item.copyAvailable || item.idioma === "es") continue;
  const previous = activeByHash.get(item.sourceCopySha256);
  if (previous && previous.idioma !== item.idioma) {
    throw new Error(`Idioma ambiguo en corpus: ${item.sourceCopySha256}`);
  }
  activeByHash.set(item.sourceCopySha256, item);
}

const existing = existsSync(outputPath)
  ? JSON.parse(readFileSync(outputPath, "utf8"))
  : { items: [] };
const mergedByHash = new Map(
  (existing.items || []).map((item) => [item.sourceCopySha256, item]),
);
const imported = [];
const skipped = [];

for (const fragmentPath of fragmentPaths) {
  const fragment = JSON.parse(readFileSync(fragmentPath, "utf8"));
  if (fragment.schema !== "redvitalia-reviewed-translation-fragment-v1") {
    throw new Error(`Esquema de fragmento no reconocido: ${fragmentPath}`);
  }
  const languages = new Set(fragment.languages || []);
  const fragmentHashes = new Set();
  for (const item of fragment.items || []) {
    if (fragmentHashes.has(item.sourceCopySha256)) {
      throw new Error(`Hash duplicado en fragmento: ${item.sourceCopySha256}`);
    }
    fragmentHashes.add(item.sourceCopySha256);
    const source = activeByHash.get(item.sourceCopySha256);
    if (!source) throw new Error(`Hash sin fuente activa: ${item.sourceCopySha256}`);
    if (source.idioma !== item.sourceLanguage) {
      throw new Error(
        `Idioma incoherente ${item.sourceCopySha256}: ${item.sourceLanguage}->${source.idioma}`,
      );
    }
    if (!languages.has(item.sourceLanguage)) {
      throw new Error(`Idioma fuera del fragmento: ${item.sourceCopySha256}`);
    }
    const copy = {
      titular: String(item.copy?.titular || "").trim(),
      texto: String(item.copy?.texto || "").trim(),
      cta: String(item.copy?.cta || "").trim(),
      precioVisible: String(
        item.copy?.precioVisible ?? source.precioVisible ?? "",
      ).trim(),
    };
    if (!copy.titular && !copy.texto && !copy.cta) {
      throw new Error(`Traducción vacía: ${item.sourceCopySha256}`);
    }
    const reviewed = {
      sourceCopySha256: item.sourceCopySha256,
      sourceLanguage: item.sourceLanguage,
      copy,
      reviewedAt: item.reviewedAt || new Date().toISOString().slice(0, 10),
      reviewedBy: item.reviewedBy || "RedVitalia · revisión editorial asistida",
      reviewNote: String(item.reviewNote || "Traducción contrastada con el original").trim(),
    };
    mergedByHash.set(reviewed.sourceCopySha256, reviewed);
    imported.push(reviewed.sourceCopySha256);
  }
  for (const item of fragment.skipped || []) {
    if (fragmentHashes.has(item.sourceCopySha256)) {
      throw new Error(`Hash presente en items y skipped: ${item.sourceCopySha256}`);
    }
    fragmentHashes.add(item.sourceCopySha256);
    skipped.push({
      sourceCopySha256: item.sourceCopySha256,
      reason: String(item.reason || "Requiere revisión adicional").trim(),
      fragment: fragmentPath,
    });
  }
}

const items = [...mergedByHash.values()].sort(
  (left, right) =>
    left.sourceLanguage.localeCompare(right.sourceLanguage, "es") ||
    left.sourceCopySha256.localeCompare(right.sourceCopySha256),
);
const data = {
  schema: "redvitalia-reviewed-translation-overrides-v1",
  generatedAt: new Date().toISOString().slice(0, 10),
  note: "Traducciones editoriales contrastadas con el copy original. El original permanece intacto.",
  total: items.length,
  items,
};
const temporary = `${outputPath}.tmp`;
writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
renameSync(temporary, outputPath);
console.log(
  `${outputPath}: ${items.length} revisadas · ${imported.length} importadas · ${skipped.length} omitidas`,
);
if (skipped.length) console.log(JSON.stringify({ skipped }, null, 2));
