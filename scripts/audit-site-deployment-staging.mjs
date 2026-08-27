import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const stagingProject = resolve(process.argv[2] || ".");
const clientRoot = resolve(stagingProject, "dist", "client");
const dataRoot = resolve(clientRoot, "data");
const clientPrefix = `${clientRoot}${sep}`;
const localAssetPattern = /^(?:file:)?(\/(?:media|evidence|asset-previews|document-previews)\/)/;

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

function collect(value, references) {
  if (typeof value === "string") {
    if (localAssetPattern.test(value)) {
      references.add(value.startsWith("file:") ? value.slice("file:".length) : value);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Array.isArray(value) ? value : Object.values(value)) collect(child, references);
}

const jsonFiles = (await walk(dataRoot)).filter((path) => path.endsWith(".json"));
const temporaryFiles = (await walk(clientRoot)).filter(
  (path) => /\.rv(?:stage\.|staging$|finalize$|previews$|documents$|compact$)/.test(path),
);
const references = new Set();
for (const path of jsonFiles) collect(JSON.parse(await readFile(path, "utf8")), references);

const missing = [];
for (const reference of references) {
  const path = resolve(clientRoot, reference.slice(1));
  if (!path.startsWith(clientPrefix)) throw new Error(`Referencia fuera de client: ${reference}`);
  try {
    await access(path);
  } catch {
    missing.push(reference);
  }
}

console.log(JSON.stringify({
  jsonFiles: jsonFiles.length,
  references: references.size,
  missing: missing.length,
  temporaryFiles: temporaryFiles.length,
}, null, 2));
if (missing.length || temporaryFiles.length) {
  console.error(missing.slice(0, 50).join("\n"));
  console.error(temporaryFiles.slice(0, 50).join("\n"));
  process.exitCode = 1;
}
