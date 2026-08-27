import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const stagingProject = resolve(process.argv[2] || ".");
const dataRoot = resolve(stagingProject, "dist", "client", "data");

async function walk(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else if (entry.name.endsWith(".json")) files.push(path);
    }
  }
  return files;
}

let beforeBytes = 0;
let afterBytes = 0;
const files = await walk(dataRoot);
for (const path of files) {
  const source = await readFile(path, "utf8");
  const compact = JSON.stringify(JSON.parse(source));
  const temporary = `${path}.rvcompact`;
  await writeFile(temporary, compact, "utf8");
  await rename(temporary, path);
  beforeBytes += Buffer.byteLength(source);
  afterBytes += Buffer.byteLength(compact);
}

console.log(JSON.stringify({ files: files.length, beforeBytes, afterBytes, savedBytes: beforeBytes - afterBytes }, null, 2));
