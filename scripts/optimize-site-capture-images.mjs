import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import sharp from "sharp";

const ROOT = resolve(".");
const PUBLIC_ROOT = resolve(ROOT, "public");
const MANIFEST_DIR = resolve(PUBLIC_ROOT, "data", "site-captures");
const EVIDENCE_ROOT = `${resolve(PUBLIC_ROOT, "evidence")}${sep}`;
const WEBP_MAX_DIMENSION = 16_383;
const THUMBNAIL_WIDTH = 520;
const CAPTURE_SUFFIX = /\.capture\.[a-z0-9]+$/i;
const IMAGE_FORMATS = {
  jpeg: { extension: "jpg", type: "image/jpeg" },
  png: { extension: "png", type: "image/png" },
  webp: { extension: "webp", type: "image/webp" },
};

function parseArgs(argv) {
  const args = { ids: [], limit: Infinity };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--ids") args.ids = String(argv[++index] || "").split(",").filter(Boolean);
    if (argv[index] === "--limit") args.limit = Math.max(0, Number(argv[++index] || 0));
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const selectedIds = new Set(args.ids);

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function hash(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function fromPublicPath(file) {
  if (!String(file || "").startsWith("/")) return null;
  const absolute = resolve(PUBLIC_ROOT, String(file).slice(1));
  return absolute.startsWith(EVIDENCE_ROOT) ? absolute : null;
}

function toPublicPath(path) {
  return `/${resolve(path).slice(PUBLIC_ROOT.length + 1).replaceAll("\\", "/")}`;
}

async function refreshWebpPage(page, input) {
  const source = await sharp(input, { limitInputPixels: false, sequentialRead: true }).metadata();
  if (!source.width || !source.height || source.width > WEBP_MAX_DIMENSION || source.height > WEBP_MAX_DIMENSION) {
    throw new Error(`WebP publicado fuera de límites o sin dimensiones: ${page.image.file}`);
  }
  const thumbnail = input.replace(/\.webp$/i, "-thumb.webp");
  await sharp(input, { limitInputPixels: false, sequentialRead: true })
    .resize({
      width: THUMBNAIL_WIDTH,
      height: WEBP_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 70, effort: 4 })
    .toFile(thumbnail);
  const [thumbMeta, imageStat, thumbStat] = await Promise.all([
    sharp(thumbnail, { limitInputPixels: false }).metadata(),
    stat(input),
    stat(thumbnail),
  ]);
  if (!thumbMeta.width || !thumbMeta.height) {
    throw new Error(`Thumbnail WebP inválido: ${page.image.file}`);
  }
  return {
    changed: true,
    page: {
      ...page,
      image: {
        file: toPublicPath(input),
        type: "image/webp",
        width: source.width,
        height: source.height,
        bytes: imageStat.size,
        sha256: await hash(input),
      },
      thumbnail: {
        file: toPublicPath(thumbnail),
        type: "image/webp",
        width: thumbMeta.width,
        height: thumbMeta.height,
        bytes: thumbStat.size,
        sha256: await hash(thumbnail),
      },
      imageOptimization: {
        status: "webp_optimized",
        maxWebpDimension: WEBP_MAX_DIMENSION,
      },
    },
  };
}

async function optimizePage(page) {
  const input = fromPublicPath(page.image?.file);
  if (input && page.image?.type === "image/webp" && /(?<!-thumb)\.webp$/i.test(input)) {
    return refreshWebpPage(page, input);
  }
  if (!input || !CAPTURE_SUFFIX.test(input)) return { page, changed: false };

  const source = await sharp(input, { limitInputPixels: false, sequentialRead: true }).metadata();
  const format = IMAGE_FORMATS[source.format];
  if (!format || !source.width || !source.height) {
    throw new Error(`Captura sin formato o dimensiones compatibles: ${page.image.file}`);
  }

  const base = input.replace(CAPTURE_SUFFIX, "");
  const output = `${base}.webp`;
  const thumbnail = `${base}-thumb.webp`;
  const exceedsWebpLimit = source.width > WEBP_MAX_DIMENSION || source.height > WEBP_MAX_DIMENSION;

  let retainedInput = input;
  if (exceedsWebpLimit) {
    const canonicalInput = `${base}.capture.${format.extension}`;
    if (canonicalInput !== input) {
      await rename(input, canonicalInput);
      retainedInput = canonicalInput;
    }
  } else {
    await sharp(input, { limitInputPixels: false, sequentialRead: true })
      .webp({ quality: 74, effort: 4 })
      .toFile(output);
  }

  await sharp(retainedInput, { limitInputPixels: false, sequentialRead: true })
    .resize({
      width: THUMBNAIL_WIDTH,
      height: WEBP_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 70, effort: 4 })
    .toFile(thumbnail);

  const imagePath = exceedsWebpLimit ? retainedInput : output;
  const [imageMeta, thumbMeta, imageStat, thumbStat] = await Promise.all([
    sharp(imagePath, { limitInputPixels: false }).metadata(),
    sharp(thumbnail, { limitInputPixels: false }).metadata(),
    stat(imagePath),
    stat(thumbnail),
  ]);
  if (!imageMeta.width || !imageMeta.height || !thumbMeta.width || !thumbMeta.height) {
    throw new Error(`Conversión visual inválida: ${page.image.file}`);
  }
  if (!exceedsWebpLimit) await unlink(input);

  return {
    changed: true,
    page: {
      ...page,
      image: {
        file: toPublicPath(imagePath),
        type: exceedsWebpLimit ? format.type : "image/webp",
        width: imageMeta.width,
        height: imageMeta.height,
        bytes: imageStat.size,
        sha256: await hash(imagePath),
      },
      thumbnail: {
        file: toPublicPath(thumbnail),
        type: "image/webp",
        width: thumbMeta.width,
        height: thumbMeta.height,
        bytes: thumbStat.size,
        sha256: await hash(thumbnail),
      },
      imageOptimization: exceedsWebpLimit
        ? {
            status: "original_retained",
            reason: "webp_dimension_limit",
            maxWebpDimension: WEBP_MAX_DIMENSION,
          }
        : {
            status: "webp_optimized",
            maxWebpDimension: WEBP_MAX_DIMENSION,
          },
    },
  };
}

const files = (await readdir(MANIFEST_DIR))
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .map((name) => join(MANIFEST_DIR, name));

let records = 0;
let images = 0;
let beforeBytes = 0;
let afterBytes = 0;
for (const file of files) {
  if (records >= args.limit) break;
  const record = JSON.parse(await readFile(file, "utf8"));
  if (selectedIds.size && !selectedIds.has(record.id)) continue;
  const nextPages = [];
  let changed = false;
  for (const page of record.pages || []) {
    const originalBytes = Number(page.image?.bytes || 0);
    const result = await optimizePage(page);
    nextPages.push(result.page);
    if (result.changed) {
      changed = true;
      images += 1;
      beforeBytes += originalBytes;
      afterBytes += Number(result.page.image?.bytes || 0) + Number(result.page.thumbnail?.bytes || 0);
    }
  }
  if (changed) {
    record.pages = nextPages;
    record.updatedAt = new Date().toISOString();
    await writeJsonAtomic(file, record);
    records += 1;
  }
}

console.log(JSON.stringify({ records, images, beforeBytes, afterBytes, savedBytes: beforeBytes - afterBytes }, null, 2));
