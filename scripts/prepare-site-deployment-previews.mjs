import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import sharp from "sharp";

const stagingProject = resolve(process.argv[2] || ".");
const clientRoot = resolve(stagingProject, "dist", "client");
const dataRoot = resolve(clientRoot, "data");
const mediaRoot = resolve(clientRoot, "media");
const previewRoot = resolve(clientRoot, "asset-previews");
const mediaPrefix = `${mediaRoot}${sep}`;
const convertible = new Set([".jpg", ".jpeg", ".png", ".svg", ".webp"]);

async function walk(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else files.push(path);
    }
  }
  return files;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function rewrite(value, mappings) {
  if (typeof value === "string") {
    const direct = mappings.get(value);
    if (direct) return direct;
    if (value.startsWith("file:")) {
      const mappedFile = mappings.get(value.slice("file:".length));
      if (mappedFile) return `file:${mappedFile}`;
    }
    return value;
  }
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((child) => rewrite(child, mappings));
  const next = {};
  let mappedVisual = false;
  for (const [key, child] of Object.entries(value)) {
    if (
      typeof child === "string" &&
      (mappings.has(child) || (child.startsWith("file:") && mappings.has(child.slice("file:".length))))
    ) mappedVisual = true;
    next[key] = rewrite(child, mappings);
  }
  if (mappedVisual) {
    if (typeof next.mimeType === "string") next.mimeType = "image/webp";
    if (typeof next.type === "string" && next.type.startsWith("image/")) next.type = "image/webp";
  }
  return next;
}

function collectStaleReferences(value, mappings, stale) {
  if (typeof value === "string") {
    const publicPath = value.startsWith("file:") ? value.slice("file:".length) : value;
    if (mappings.has(publicPath)) stale.add(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectStaleReferences(child, mappings, stale);
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.rvpreviews`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

await mkdir(previewRoot, { recursive: true });
const mappings = new Map();
const previewByDigest = new Map();
let beforeBytes = 0;
let previewBytes = 0;
let convertedFiles = 0;
let retainedFiles = 0;
let errors = 0;

for (const path of await walk(mediaRoot)) {
  if (!resolve(path).startsWith(mediaPrefix)) throw new Error(`Ruta fuera de media: ${path}`);
  if (!convertible.has(extname(path).toLowerCase())) continue;
  const input = await readFile(path);
  const sourceBytes = input.byteLength;
  const digest = hashBuffer(input);
  let preview = previewByDigest.get(digest);
  if (!preview) {
    const outputPath = resolve(previewRoot, `${digest}.webp`);
    try {
      const output = await sharp(input, { density: 144, limitInputPixels: false, sequentialRead: true })
        .rotate()
        .resize({ width: 960, height: 1_700, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 54, effort: 6, smartSubsample: true })
        .toBuffer();
      if (output.byteLength >= sourceBytes) {
        retainedFiles += 1;
        continue;
      }
      await writeFile(outputPath, output);
      preview = {
        publicPath: `/asset-previews/${basename(outputPath)}`,
        path: outputPath,
        bytes: output.byteLength,
      };
      previewByDigest.set(digest, preview);
      previewBytes += output.byteLength;
    } catch (error) {
      errors += 1;
      console.error(`No se pudo convertir ${path}: ${String(error?.message || error)}`);
      continue;
    }
  }
  const publicPath = `/media/${relative(mediaRoot, path).replaceAll("\\", "/")}`;
  mappings.set(publicPath, preview.publicPath);
  beforeBytes += sourceBytes;
  convertedFiles += 1;
}

const jsonFiles = (await walk(dataRoot)).filter((path) => path.endsWith(".json"));
for (const path of jsonFiles) {
  const value = JSON.parse(await readFile(path, "utf8"));
  await writeJsonAtomic(path, rewrite(value, mappings));
}

const staleReferences = new Set();
for (const path of jsonFiles) {
  collectStaleReferences(JSON.parse(await readFile(path, "utf8")), mappings, staleReferences);
}
if (staleReferences.size) {
  throw new Error(
    `No se borran medios: quedan ${staleReferences.size} referencias antiguas (${[
      ...staleReferences,
    ].slice(0, 10).join(", ")})`,
  );
}

let removedBytes = 0;
for (const [publicPath] of mappings) {
  const path = resolve(clientRoot, publicPath.slice(1));
  if (!path.startsWith(mediaPrefix)) throw new Error(`Ruta reescrita fuera de media: ${path}`);
  removedBytes += (await stat(path)).size;
  await unlink(path);
}

console.log(JSON.stringify({
  jsonFiles: jsonFiles.length,
  convertedFiles,
  uniquePreviews: previewByDigest.size,
  retainedFiles,
  errors,
  beforeBytes,
  previewBytes,
  removedBytes,
  savedBytes: removedBytes - previewBytes,
  staleReferences: staleReferences.size,
}, null, 2));
if (errors > 0) process.exitCode = 1;
