import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const stagingProject = resolve(process.argv[2] || ".");
const dataRoot = resolve(stagingProject, "dist", "client", "data");
const evidenceRoot = resolve(stagingProject, "dist", "client", "evidence");
const evidencePrefix = `${evidenceRoot}${sep}`;

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

function isEvidencePath(value) {
  return typeof value === "string" && value.startsWith("/evidence/");
}

function collectMappings(value, mappings) {
  if (!value || typeof value !== "object") return;
  if (
    !Array.isArray(value) &&
    isEvidencePath(value.image?.file) &&
    isEvidencePath(value.thumbnail?.file)
  ) {
    mappings.set(value.image.file, value.thumbnail.file);
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectMappings(child, mappings);
  }
}

function rewrite(value, mappings) {
  if (typeof value === "string") return mappings.get(value) || value;
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((child) => rewrite(child, mappings));
  const next = {};
  for (const [key, child] of Object.entries(value)) next[key] = rewrite(child, mappings);
  if (isEvidencePath(value.image?.file) && mappings.has(value.image.file) && value.thumbnail) {
    next.image = { ...next.thumbnail };
    next.imageOptimization = {
      status: "deployment_thumbnail",
      reason: "sites_archive_limit",
    };
  }
  return next;
}

function collectEvidenceReferences(value, references) {
  if (typeof value === "string") {
    if (isEvidencePath(value)) references.add(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectEvidenceReferences(child, references);
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.rvstaging`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const jsonFiles = (await walk(dataRoot)).filter((path) => path.endsWith(".json"));
const documents = [];
const mappings = new Map();
for (const path of jsonFiles) {
  const value = JSON.parse(await readFile(path, "utf8"));
  documents.push({ path, value });
  collectMappings(value, mappings);
}

const references = new Set();
for (const document of documents) {
  const next = rewrite(document.value, mappings);
  collectEvidenceReferences(next, references);
  await writeJsonAtomic(document.path, next);
}

let removedEvidenceFiles = 0;
let removedEvidenceBytes = 0;
for (const path of await walk(evidenceRoot)) {
  if (!resolve(path).startsWith(evidencePrefix)) throw new Error(`Ruta fuera de evidence: ${path}`);
  const publicPath = `/evidence/${relative(evidenceRoot, path).replaceAll("\\", "/")}`;
  if (references.has(publicPath)) continue;
  const bytes = (await readFile(path)).byteLength;
  await unlink(path);
  removedEvidenceFiles += 1;
  removedEvidenceBytes += bytes;
}

await mkdir(evidenceRoot, { recursive: true });
console.log(JSON.stringify({
  jsonFiles: jsonFiles.length,
  fullToThumbnailMappings: mappings.size,
  retainedEvidenceReferences: references.size,
  removedEvidenceFiles,
  removedEvidenceBytes,
}, null, 2));
