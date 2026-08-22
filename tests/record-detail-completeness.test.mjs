import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/RecordDetail.tsx", import.meta.url),
  "utf8",
);

const lineAt = (offset) => source.slice(0, offset).split("\n").length;

test("RecordDetail has no silent array cap; the only allowed slice is visible media pagination", () => {
  const slices = [...source.matchAll(/\.slice\(\s*0\s*,\s*([^)]+)\)/g)].map(
    (match) => ({
      argument: match[1].trim(),
      line: lineAt(match.index),
      source: match[0],
    }),
  );
  const silent = slices.filter(({ argument }) => argument !== "mediaVisible");

  assert.deepEqual(
    silent,
    [],
    `Recortes silenciosos en la ficha: ${JSON.stringify(silent)}`,
  );

  const mediaPagination = slices.filter(
    ({ argument }) => argument === "mediaVisible",
  );
  assert.equal(
    mediaPagination.length,
    1,
    "La galería debe paginar una sola colección",
  );
  assert.match(source, /mediaVisible\s*<\s*filteredMedia\.length/);
  assert.match(source, /Mostrar 24 materiales más/);
  assert.match(
    source,
    /setMediaVisible\(\(current\)\s*=>\s*current\s*\+\s*24\)/,
  );
});
