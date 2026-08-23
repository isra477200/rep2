import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("las etiquetas en negrita no terminan con un asterisco escapado ambiguo", async () => {
  const plan = JSON.parse(await readFile("research/deep/v3/notion-plan.json", "utf8"));
  const malformed = plan.records.flatMap((record) =>
    record.section
      .split("\n")
      .filter((line) => line.includes("\\***"))
      .map((line) => `${record.name}: ${line}`),
  );
  assert.deepEqual(malformed, []);
});

test("el contenido dinámico no activa emojis personalizados de Notion", async () => {
  const plan = JSON.parse(await readFile("research/deep/v3/notion-plan.json", "utf8"));
  assert.equal(plan.records.filter((record) => /\/remove:yes:/i.test(record.section)).length, 0);
  assert.equal(plan.records.filter((record) => /[\u200B-\u200D\uFEFF]/.test(record.section)).length, 0);
  assert.equal(plan.records.filter((record) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(record.section)).length, 0);
  // eslint-disable-next-line no-control-regex -- contrato explícito contra controles C0/DEL.
  assert.equal(plan.records.filter((record) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(record.section)).length, 0);
});

test("ningún bloque de texto supera el límite seguro de Notion", async () => {
  const plan = JSON.parse(await readFile("research/deep/v3/notion-plan.json", "utf8"));
  const oversized = plan.records.flatMap((record) => record.section
    .split(/\r?\n/)
    .filter((line) => line.length > 2_000)
    .map((line) => ({ id: record.id, length: line.length })));
  assert.deepEqual(oversized, []);
});

test("el plan conserva las 712 fichas madre y no incluye referencias privadas", async () => {
  const plan = JSON.parse(await readFile("research/deep/v3/notion-plan.json", "utf8"));
  assert.equal(plan.records.length, 712);
  assert.equal(plan.records.filter((record) => record.properties["Anuncios hijos"] !== null).length, 0);
  assert.equal(plan.records.filter((record) => record.properties["Ficha madre"] !== null).length, 0);
  assert.equal(plan.records.filter((record) => record.properties["Tarea operativa vinculada"] !== null).length, 0);
  assert.equal(plan.records.filter((record) => record.properties["Pendientes de ficha"] !== null).length, 0);
  const corpus = plan.records
    .map((record) => `${record.section}\n${JSON.stringify(record.properties)}`)
    .join("\n")
    .replace(/https?:\/\/[^\s<>"']+/gi, "");
  assert.doesNotMatch(corpus, /Puente\s+(?:de\s+)?IA|(?:www\.)?notion\.(?:so|com)|\.notion\.site|file:\/\/|[A-Z]:\\Users\\|\/Users\/|\.codex/i);
});
