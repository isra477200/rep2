import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function filesUnder(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory()
        ? filesUnder(path.join(directory, entry.name), relative)
        : [relative];
    }),
  );
  return nested.flat().sort();
}

async function digest(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

for (const directory of ["data", "media", "logos"]) {
  test(`the production build contains the exact current public/${directory} tree`, async () => {
    const sourceRoot = path.join(root, "public", directory);
    const buildRoot = path.join(root, "dist", "client", directory);
    const [sourceFiles, buildFiles] = await Promise.all([
      filesUnder(sourceRoot),
      filesUnder(buildRoot),
    ]);
    assert.deepEqual(buildFiles, sourceFiles, `${directory}: nombres distintos`);

    const mismatches = [];
    for (const relative of sourceFiles) {
      const [sourceHash, buildHash] = await Promise.all([
        digest(path.join(sourceRoot, relative)),
        digest(path.join(buildRoot, relative)),
      ]);
      if (sourceHash !== buildHash) mismatches.push(relative);
    }
    assert.deepEqual(
      mismatches,
      [],
      `${directory}: el build conserva ${mismatches.length} archivos desfasados`,
    );
  });
}
