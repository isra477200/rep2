import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, readdir, rename, stat, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const ROOTS = [
  resolve("dist", "client", "media"),
  resolve("dist", "client", "evidence"),
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

function hash(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    const digest = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", () => resolvePromise(digest.digest("hex")));
  });
}

const files = (await Promise.all(ROOTS.map(walk))).flat();
const bySize = new Map();
for (const path of files) {
  const size = (await stat(path)).size;
  if (!bySize.has(size)) bySize.set(size, []);
  bySize.get(size).push(path);
}

let duplicateFiles = 0;
let logicalBytesSaved = 0;
let errors = 0;
for (const [size, candidates] of bySize) {
  if (size === 0 || candidates.length < 2) continue;
  const canonicalByHash = new Map();
  for (const path of candidates) {
    const digest = await hash(path);
    const canonical = canonicalByHash.get(digest);
    if (!canonical) {
      canonicalByHash.set(digest, path);
      continue;
    }
    const pathRoot = ROOTS.find((root) => resolve(path).startsWith(`${root}${sep}`));
    if (!pathRoot) throw new Error(`Ruta fuera del dist permitido: ${path}`);
    const temporary = `${path}.rvlink`;
    try {
      const [canonicalStat, pathStat] = await Promise.all([stat(canonical), stat(path)]);
      if (canonicalStat.ino && canonicalStat.ino === pathStat.ino) continue;
      await link(canonical, temporary);
      await unlink(path);
      await rename(temporary, path);
      duplicateFiles += 1;
      logicalBytesSaved += size;
    } catch (error) {
      errors += 1;
      await unlink(temporary).catch(() => undefined);
      console.error(`No se pudo deduplicar ${path}: ${String(error?.message || error)}`);
    }
  }
}

console.log(JSON.stringify({ files: files.length, duplicateFiles, logicalBytesSaved, errors }, null, 2));
