import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const companiesPath = path.join(publicRoot, "data", "companies-index.json");
const corpusPath = path.join(publicRoot, "data", "ad-corpus.json");
const outputPath = path.join(publicRoot, "data", "gallery-index.json");

const fold = (value = "") => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

function normalizePlatform(row) {
  const value = fold(row.platformFamily || row.plataforma || "");
  if (value.includes("meta") || value.includes("facebook")) return "meta";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("google")) return "google";
  if (value.includes("display")) return "display";
  return "unknown";
}

function angleFamily(row) {
  const value = fold(`${row.angulo || ""} ${row.titular || ""} ${row.texto || ""}`);
  const rules = [
    ["price", /precio|tarifa|coste|por solo|desde \d|€|eur|descuento|oferta/],
    ["territory", /exclusiv|territori|zona|solo para|por localidad/],
    ["speed", /rapidez|velocidad|en \d+ (?:min|hora|dia)|inmediat|sla|tiempo real/],
    ["lead-magnet", /guia|ebook|descarga|checklist|plantilla|masterclass|webinar|gratis/],
    ["number", /\b\d+[.,]?\d*\b|cifra|porcentaje|%/],
    ["guarantee", /garanti|devol|sin riesgo|resultado asegur|reemplaz/],
    ["authority", /autoridad|experto|lider|caso de exito|testimonio|top \d|premio|anos de experiencia/],
    ["pain", /problema|dolor|pierdes|cansad|frustr|sin clientes|no consigues|deja de/],
    ["value", /propuesta de valor|beneficio|consigue|aumenta|genera|crece|multiplica|mejora/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || "other";
}

function orientation(width, height) {
  if (!width || !height) return "unknown";
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

function publicDiskPath(file) {
  return path.join(publicRoot, file.replace(/^\//, "").replaceAll("/", path.sep));
}

function compactSearchText(ad) {
  if (!ad) return null;
  const translated = ad.traduccionEs || {};
  const value = fold([
    ad.titular,
    ad.texto,
    ad.cta,
    ad.precioVisible,
    ad.transcripcion,
    ad.transcript,
    translated.titular,
    translated.texto,
    translated.cta,
    translated.precioVisible,
  ].filter(Boolean).join(" "))
    .replace(/\s+/g, " ")
    .trim();
  return value ? value.slice(0, 2_000) : null;
}

async function inspect(row) {
  const buffer = await readFile(publicDiskPath(row.media.file));
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  let width = Number(row.media.width) || null;
  let height = Number(row.media.height) || null;

  if ((!width || !height) && /image/i.test(row.media.type || "")) {
    try {
      const metadata = await sharp(buffer, { animated: false }).metadata();
      width = metadata.width || null;
      height = metadata.height || null;
    } catch {
      // El archivo permanece indexado aunque el decodificador no pueda medirlo.
    }
  }

  return { ...row, sha256, width, height };
}

async function mapLimit(rows, concurrency, mapper) {
  const output = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < rows.length) {
      const index = cursor++;
      output[index] = await mapper(rows[index], index);
    }
  }));
  return output;
}

const [companies, corpus] = await Promise.all([
  readFile(companiesPath, "utf8").then(JSON.parse),
  readFile(corpusPath, "utf8").then(JSON.parse),
]);

const adsByFile = new Map(
  corpus.items
    .filter((row) => typeof row.file === "string" && row.file.startsWith("/"))
    .map((row) => [row.file, row]),
);

const rows = companies.flatMap((company) => company.media.map((media) => ({
  companyId: company.id,
  media,
})));

const inspected = await mapLimit(rows, 8, inspect);
const companyHashCounts = new Map();
const globalHashCounts = new Map();

for (const row of inspected) {
  const companyKey = `${row.companyId}|${row.sha256}`;
  companyHashCounts.set(companyKey, (companyHashCounts.get(companyKey) || 0) + 1);
  globalHashCounts.set(row.sha256, (globalHashCounts.get(row.sha256) || 0) + 1);
}

const items = {};
const platformCounts = { meta: 0, instagram: 0, google: 0, display: 0, unknown: 0 };
let withAdData = 0;
let translated = 0;
let foreign = 0;
let patternReady = 0;

for (const row of inspected) {
  const ad = adsByFile.get(row.media.file);
  const platform = ad ? normalizePlatform(ad) : "archive";
  const language = ad?.idioma || "und";
  const foreignLanguage = Boolean(ad && !["es", "und", "zxx", "mul"].includes(language));
  const hasTranslation = Boolean(ad?.traduccionEs && ad?.estadoTraduccion !== "pendiente");
  const companyVariants = companyHashCounts.get(`${row.companyId}|${row.sha256}`) || 1;

  if (ad) {
    withAdData += 1;
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    if (foreignLanguage) foreign += 1;
    if (hasTranslation) translated += 1;
    if (ad.aptaPatrones === true) patternReady += 1;
  }

  items[row.media.file] = {
    h: row.sha256,
    w: row.width,
    y: row.height,
    o: orientation(row.width, row.height),
    v: companyVariants,
    g: globalHashCounts.get(row.sha256) || 1,
    p: platform,
    l: language,
    n: ad?.idiomaNombre || null,
    t: hasTranslation,
    s: ad?.estadoTraduccion || null,
    r: ad?.estadoOcr || null,
    a: ad?.aptaPatrones === true,
    e: typeof ad?.isActive === "boolean" ? ad.isActive : null,
    f: ad ? angleFamily(ad) : null,
    d: ad?.startDate || ad?.fecha || null,
    q: ad?.titular || null,
    c: ad?.cta || null,
    x: compactSearchText(ad),
  };
}

const result = {
  schema: "redvitalia-gallery-index-v1",
  generatedAt: new Date().toISOString(),
  stats: {
    companies: companies.filter((company) => company.media.length > 0).length,
    files: rows.length,
    unique: globalHashCounts.size,
    duplicates: rows.length - globalHashCounts.size,
    withAdData,
    withoutAdData: rows.length - withAdData,
    foreign,
    translated,
    patternReady,
    platforms: platformCounts,
  },
  items,
};

await writeFile(outputPath, `${JSON.stringify(result)}\n`, "utf8");
console.log(`Gallery index: ${result.stats.files} files, ${result.stats.unique} unique, ${result.stats.duplicates} duplicates.`);
