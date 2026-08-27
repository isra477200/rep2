import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const companies = read("public/data/companies-index.json");
const ids = new Set(companies.map((c) => c.id));

test("takeaways conserva IDs válidos y omite solo altas SerpAPI sin conclusión editorial", () => {
  const { items } = read("public/data/takeaways.json");
  const missing = companies.filter((company) => !items[company.id]).map((company) => company.id).sort();
  const intentionallyPending = companies.filter((company) => company.serpApiManaged === true).map((company) => company.id).sort();
  assert.deepEqual(missing, intentionallyPending);
  for (const [id, entry] of Object.entries(items)) {
    assert.ok(ids.has(id), `id desconocido en takeaways: ${id}`);
    assert.ok(typeof entry.t === "string" && entry.t.length > 20, `takeaway vacío: ${id}`);
    assert.ok(["alta", "media", "baja"].includes(entry.copiable), `copiable inválido: ${id}`);
  }
});

test("patterns.json es coherente con la base", () => {
  const patterns = read("public/data/patterns.json");
  assert.equal(patterns.universe, companies.length);
  assert.ok(patterns.findings.length >= 4);
  const totalModel = patterns.modelStats.reduce((sum, m) => sum + m.n, 0);
  assert.equal(totalModel, companies.length);
  for (const model of patterns.modelStats)
    for (const example of model.examples)
      assert.ok(ids.has(example.id), `ejemplo inexistente: ${example.id}`);
  for (const entry of patterns.doubleValidated)
    assert.ok(ids.has(entry.id), `doubleValidated inexistente: ${entry.id}`);
});

test("execution.json: 20 acciones con fuentes reales", () => {
  const { actions } = read("public/data/execution.json");
  assert.equal(actions.length, 20);
  for (const action of actions) {
    assert.ok(action.title && action.detail && action.categoria);
    assert.ok(action.impact >= 1 && action.impact <= 5);
    assert.ok(action.effort >= 1 && action.effort <= 5);
    assert.ok(action.sources.length >= 1);
    for (const source of action.sources)
      assert.ok(ids.has(source), `fuente inexistente en acción "${action.title}": ${source}`);
  }
});

test("dossiers.json: entradas válidas con fuentes y economía", () => {
  const { items } = read("public/data/dossiers.json");
  const entries = Object.values(items);
  assert.ok(entries.length >= 25, `esperados ~30 dossiers, hay ${entries.length}`);
  for (const dossier of entries) {
    assert.ok(ids.has(dossier.id), `dossier de ficha inexistente: ${dossier.id}`);
    assert.ok(dossier.resumen.length > 50);
    assert.ok(dossier.economics && dossier.economics.calculo);
    assert.ok(Array.isArray(dossier.fuentes));
    assert.ok(["alta", "media", "baja"].includes(dossier.confianza));
  }
});

test("logos.json: tone válido en los logos analizados", () => {
  const manifest = read("public/data/logos.json");
  const valid = new Set(["light", "dark", "mixed", "opaque"]);
  let withTone = 0;
  for (const record of Object.values(manifest)) {
    if (!record || !record.file) continue;
    assert.ok(record.tone && valid.has(record.tone), "logo con file sin tone válido");
    withTone++;
  }
  assert.ok(withTone >= 600, `esperados 615 tonos, hay ${withTone}`);
});
