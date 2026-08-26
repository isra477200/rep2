#!/usr/bin/env node
/* eslint-disable no-control-regex */
/**
 * Ejecuta OCR sobre todas las creatividades exactas que todavía no tienen
 * texto útil en el corpus. La salida es un checkpoint privado dentro de
 * `work/`; `prepare-ad-ocr-source.mjs` publica después solo los campos seguros.
 *
 * Uso:
 *   node scripts/run-ad-ocr.mjs
 *   node scripts/run-ad-ocr.mjs --all --cache-dir C:/ruta/tess-cache
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createScheduler, createWorker } from "tesseract.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const processAll = args.includes("--all");
const outputPath = resolve(
  valueAfter("--output", resolve(root, "work/ad-ocr-final.json")),
);
const cacheDir = resolve(
  valueAfter("--cache-dir", resolve(root, "work/tess-cache")),
);
const workersRequested = Math.max(
  1,
  Math.min(4, Number(valueAfter("--workers", "3")) || 3),
);

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
const companies = readJson("public/data/companies-index.json");
const identities = readJson("public/data/ad-media-identity.json").items || [];
const corpus = readJson("public/data/ad-corpus.json").items || [];
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

const comparable = (value) =>
  normalizeText(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenCount = (value) =>
  comparable(value).split(" ").filter((token) => token.length > 2).length;

const usefulText = (value) =>
  comparable(value).length >= 18 && tokenCount(value) >= 3;

const existingFilesWithText = new Set(
  corpus
    .filter(
      (item) =>
        item.file &&
        usefulText(`${item.titular || ""}\n${item.texto || ""}`) &&
        item.estadoOcr !== "sin_texto" &&
        item.estadoOcr !== "fallido",
    )
    .map((item) => item.file),
);

const GROUPS = [
  { id: "spanish", languages: "spa+eng", countries: ["España", "México"] },
  {
    id: "english",
    languages: "eng",
    countries: [
      "Estados Unidos",
      "Reino Unido",
      "Emiratos Árabes Unidos",
      "Singapur",
      "Sudáfrica",
      "Nueva Zelanda",
      "Mauricio",
      "Tanzania",
      "India",
      "Malasia",
      "Nepal",
    ],
  },
  { id: "french", languages: "fra+eng", countries: ["Francia", "Luxemburgo"] },
  { id: "german", languages: "deu+eng", countries: ["Alemania"] },
  { id: "portuguese", languages: "por+eng", countries: ["Portugal", "Brasil"] },
  { id: "italian", languages: "ita+eng", countries: ["Italia"] },
  { id: "dutch", languages: "nld+eng", countries: ["Países Bajos"] },
  { id: "danish", languages: "dan+eng", countries: ["Dinamarca"] },
  { id: "polish", languages: "pol+eng", countries: ["Polonia"] },
  { id: "turkish", languages: "tur+eng", countries: ["Turquía"] },
  { id: "arabic", languages: "ara+eng", countries: ["Arabia Saudita", "Egipto"] },
  { id: "hebrew", languages: "heb+eng", countries: ["Israel"] },
  { id: "japanese", languages: "jpn+eng", countries: ["Japón"] },
  { id: "korean", languages: "kor+eng", countries: ["Corea del Sur"] },
  { id: "chinese", languages: "chi_sim+chi_tra+eng", countries: ["Hong Kong", "Taiwán"] },
  { id: "southeast", languages: "ind+vie+tha+eng", countries: ["Indonesia", "Vietnam", "Tailandia"] },
  { id: "uzbek", languages: "uzb+rus+eng", countries: ["Uzbekistán"] },
];
const groupByCountry = new Map(
  GROUPS.flatMap((group) => group.countries.map((country) => [country, group])),
);
const fallbackGroup = { id: "fallback", languages: "eng+spa", countries: [] };

const tasks = identities
  .filter((identity) => processAll || !existingFilesWithText.has(identity.file))
  .map((identity) => {
    const company = companyById.get(identity.companyId);
    const diskPath = resolve(root, "public", identity.file.replace(/^\/+/, ""));
    const country = company?.primaryCountry || "Sin país";
    const group = groupByCountry.get(country) || fallbackGroup;
    return { identity, company, country, group, diskPath };
  });

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const previous = existsSync(outputPath)
  ? JSON.parse(readFileSync(outputPath, "utf8"))
  : { items: [] };
const plannedKeys = new Set(
  tasks.map(
    (task) =>
      `${task.identity.companyId}:${task.identity.platform}:${task.identity.externalId}`,
  ),
);
const resultByKey = new Map(
  (previous.items || [])
    .filter((item) =>
      plannedKeys.has(`${item.companyId}:${item.platform}:${item.externalId}`),
    )
    .map((item) => [
      `${item.companyId}:${item.platform}:${item.externalId}`,
      item,
    ]),
);
const keyOf = (task) =>
  `${task.identity.companyId}:${task.identity.platform}:${task.identity.externalId}`;

const preprocess = async (diskPath, mode) => {
  let image = sharp(diskPath, {
    density: extname(diskPath).toLowerCase() === ".svg" ? 260 : 144,
    limitInputPixels: false,
  })
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: false })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalize()
    .sharpen();
  if (mode === "threshold") image = image.threshold(178);
  return image.png().toBuffer();
};

const scoreResult = (result) => {
  const text = normalizeText(result.text);
  const chars = comparable(text).length;
  const tokens = tokenCount(text);
  return Number(result.confidence || 0) + Math.min(35, chars / 12) + Math.min(20, tokens * 1.4);
};

const checkpoint = () => {
  const items = [...resultByKey.values()].sort(
    (left, right) =>
      left.companyId.localeCompare(right.companyId, "es") ||
      left.platform.localeCompare(right.platform, "es") ||
      left.externalId.localeCompare(right.externalId, "es"),
  );
  const payload = {
    schema: "redvitalia-ad-ocr-run-v2",
    generatedAt: new Date().toISOString(),
    engine: "tesseract.js@7",
    scope: processAll ? "all_exact_creative_assets" : "exact_creative_assets_missing_usable_text",
    totalPlanned: tasks.length,
    processed: items.length,
    usable: items.filter((item) => item.usable).length,
    noText: items.filter((item) => item.status === "sin_texto").length,
    failed: items.filter((item) => item.status === "fallido").length,
    items,
  };
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
};

for (const group of GROUPS.concat(fallbackGroup)) {
  const pending = tasks.filter(
    (task) => task.group.id === group.id && !resultByKey.has(keyOf(task)),
  );
  if (!pending.length) continue;
  console.error(
    `${group.id}: ${pending.length} creatividades · OCR ${group.languages}`,
  );
  const scheduler = createScheduler();
  const workerCount = Math.min(workersRequested, pending.length);
  for (let index = 0; index < workerCount; index += 1) {
    const worker = await createWorker(group.languages, 1, {
      cachePath: cacheDir,
      logger: () => {},
    });
    scheduler.addWorker(worker);
  }

  let completed = 0;
  let nextTask = 0;
  const processTask = async (task) => {
      const base = {
        companyId: task.identity.companyId,
        name: task.company?.name || task.identity.companyId,
        country: task.country,
        platform: task.identity.platform,
        externalId: task.identity.externalId,
        file: task.identity.file,
        variantCount: task.identity.variantCount,
        ocrLanguages: group.languages,
        engine: "tesseract.js@7",
      };
      if (!existsSync(task.diskPath)) {
        resultByKey.set(keyOf(task), {
          ...base,
          status: "fallido",
          usable: false,
          confidence: 0,
          attempts: 0,
          text: "",
          reason: "archivo_local_inexistente",
        });
        return;
      }
      const bytes = readFileSync(task.diskPath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      try {
        const firstInput = await preprocess(task.diskPath, "normalized");
        const first = await scheduler.addJob("recognize", firstInput);
        const candidates = [
          {
            mode: "normalized",
            text: normalizeText(first.data.text),
            confidence: Math.round(first.data.confidence || 0),
          },
        ];
        if (
          Number(first.data.confidence || 0) < 68 ||
          !usefulText(first.data.text)
        ) {
          const secondInput = await preprocess(task.diskPath, "threshold");
          const second = await scheduler.addJob("recognize", secondInput, {
            tessedit_pageseg_mode: "11",
          });
          candidates.push({
            mode: "threshold_sparse",
            text: normalizeText(second.data.text),
            confidence: Math.round(second.data.confidence || 0),
          });
        }
        candidates.sort((left, right) => scoreResult(right) - scoreResult(left));
        const best = candidates[0];
        const usable = usefulText(best.text);
        resultByKey.set(keyOf(task), {
          ...base,
          status: usable ? "completo" : "sin_texto",
          usable,
          confidence: best.confidence,
          attempts: candidates.length,
          selectedMode: best.mode,
          text: best.text,
          reason: usable ? null : "sin_texto_suficiente_tras_doble_pasada",
          archivoSha256: sha256,
        });
      } catch (error) {
        resultByKey.set(keyOf(task), {
          ...base,
          status: "fallido",
          usable: false,
          confidence: 0,
          attempts: 1,
          text: "",
          reason: String(error).slice(0, 500),
          archivoSha256: sha256,
        });
      }
  };
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextTask < pending.length) {
        const task = pending[nextTask];
        nextTask += 1;
        await processTask(task);
        completed += 1;
        if (completed % 20 === 0 || completed === pending.length) {
          console.error(`  ${completed}/${pending.length}`);
          checkpoint();
        }
      }
    }),
  );
  await scheduler.terminate();
  checkpoint();
}

checkpoint();
console.log(outputPath);
