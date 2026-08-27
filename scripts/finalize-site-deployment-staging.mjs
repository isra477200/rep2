import { createHash } from "node:crypto";
import { readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const stagingProject = resolve(process.argv[2] || ".");
const clientRoot = resolve(stagingProject, "dist", "client");
const dataRoot = resolve(clientRoot, "data");
const mediaRoot = resolve(clientRoot, "media");
const dataPrefix = `${dataRoot}${sep}`;
const mediaPrefix = `${mediaRoot}${sep}`;
const runtimeRoots = [
  resolve(clientRoot, "_next"),
  resolve(clientRoot, ".vite"),
];
const runtimeTextExtensions = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json"]);
const unusedDataFiles = [
  "companies.json",
  "scrapecreators-media-index.json",
  "ad-ocr-audit.json",
  "ad-translations-es.json",
  "company-locations.json",
  "ad-media-identity.json",
  "scrapecreators-landing-analysis.json",
  "media-quality.json",
  "audit.json",
  "fx.json",
  "data-manifest.json",
  "portal-quality.json",
  "logo-quality.json",
];

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

async function walkOptional(root) {
  try {
    return await walk(root);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
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
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, rewrite(child, mappings)]),
  );
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
  const temporary = `${path}.rvfinalize`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, path);
}

const mediaFiles = (await walk(mediaRoot)).filter((path) => !path.includes(".rvstage."));
const groupsBySize = new Map();
for (const path of mediaFiles) {
  const bytes = (await stat(path)).size;
  if (!groupsBySize.has(bytes)) groupsBySize.set(bytes, []);
  groupsBySize.get(bytes).push(path);
}

const mappings = new Map();
let duplicateFiles = 0;
let duplicateBytes = 0;
for (const [bytes, candidates] of groupsBySize) {
  if (!bytes || candidates.length < 2) continue;
  const canonicalByDigest = new Map();
  for (const path of candidates.sort()) {
    const digest = createHash("sha256").update(await readFile(path)).digest("hex");
    const canonical = canonicalByDigest.get(digest);
    if (!canonical) {
      canonicalByDigest.set(digest, path);
      continue;
    }
    if (!path.startsWith(mediaPrefix) || !canonical.startsWith(mediaPrefix)) {
      throw new Error(`Ruta fuera del media permitido: ${path}`);
    }
    const from = `/media/${relative(mediaRoot, path).replaceAll("\\", "/")}`;
    const to = `/media/${relative(mediaRoot, canonical).replaceAll("\\", "/")}`;
    mappings.set(from, to);
    duplicateFiles += 1;
    duplicateBytes += bytes;
  }
}

const runtimeFiles = [];
for (const root of runtimeRoots) runtimeFiles.push(...await walkOptional(root));
for (const entry of await readdir(clientRoot, { withFileTypes: true })) {
  if (entry.isFile()) runtimeFiles.push(join(clientRoot, entry.name));
}
const runtimeReferences = [];
for (const path of runtimeFiles) {
  if (!runtimeTextExtensions.has(extname(path).toLowerCase())) continue;
  const content = await readFile(path, "utf8");
  for (const name of unusedDataFiles) {
    if (content.includes(`/data/${name}`)) runtimeReferences.push({ name, path });
  }
}
if (runtimeReferences.length) {
  throw new Error(
    `No se podan datos utilizados por el runtime: ${runtimeReferences
      .slice(0, 10)
      .map(({ name, path }) => `${name} en ${path}`)
      .join(", ")}`,
  );
}

const jsonFiles = (await walk(dataRoot)).filter((path) => path.endsWith(".json"));
for (const path of jsonFiles) {
  if (!resolve(path).startsWith(dataPrefix)) throw new Error(`Ruta fuera de data: ${path}`);
  const value = JSON.parse(await readFile(path, "utf8"));
  await writeJsonAtomic(path, rewrite(value, mappings));
}

const staleReferences = new Set();
for (const path of jsonFiles) {
  collectStaleReferences(JSON.parse(await readFile(path, "utf8")), mappings, staleReferences);
}
if (staleReferences.size) {
  throw new Error(
    `No se borran duplicados: quedan ${staleReferences.size} referencias antiguas (${[
      ...staleReferences,
    ].slice(0, 10).join(", ")})`,
  );
}

for (const publicPath of mappings.keys()) {
  const path = resolve(clientRoot, publicPath.slice(1));
  if (!path.startsWith(mediaPrefix)) throw new Error(`Duplicado fuera de media: ${path}`);
  await unlink(path);
}

let prunedFiles = 0;
let prunedBytes = 0;
for (const name of unusedDataFiles) {
  const path = resolve(dataRoot, name);
  if (!path.startsWith(dataPrefix)) throw new Error(`Poda fuera de data: ${path}`);
  try {
    prunedBytes += (await stat(path)).size;
    await unlink(path);
    prunedFiles += 1;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(JSON.stringify({
  mediaFiles: mediaFiles.length,
  duplicateFiles,
  duplicateBytes,
  rewrittenJsonFiles: jsonFiles.length,
  prunedFiles,
  prunedBytes,
  savedBytes: duplicateBytes + prunedBytes,
  staleReferences: staleReferences.size,
  runtimeReferences: runtimeReferences.length,
}, null, 2));
