import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorial = JSON.parse(await readFile("public/data/editorial.json", "utf8"));
const companies = JSON.parse(await readFile("public/data/companies.json", "utf8"));
const handoff = JSON.parse(await readFile("../../agent-handoffs/editorial-public-reconstruction.json", "utf8"));
const privateIdMap = JSON.parse(await readFile("research/deep/public-id-map.json", "utf8"));
const serialized = JSON.stringify(editorial);
const companyIds = new Set(companies.map((company) => company.id));

test("las 115 referencias rotas quedan reconstruidas sin referencias privadas", () => {
  assert.doesNotMatch(serialized, /<\/?mention-(?:page|database|user)|notion\.(?:com|so|site)/i);
  for (const privateId of Object.keys(privateIdMap.ids || {})) assert.equal(serialized.toLowerCase().includes(privateId.toLowerCase()), false);
  const links = [...serialized.matchAll(/href=\\?"\?empresa=([^"\\]+)/g)].map((match) => match[1]);
  assert.equal(links.length, 107);
  assert.equal(new Set(links).size, 37);
  for (const id of links) assert.ok(companyIds.has(id), id);
});

test("el Top 15 conserva orden e identidad exactos", () => {
  const actual = [...editorial.blueprint.body.matchAll(/href="\?empresa=([^"]+)/g)].map((match) => match[1]).slice(0, 15);
  assert.deepEqual(actual, handoff.top15.map((row) => row.publicId));
});

test("las tres pestañas están completas y sin celdas o fuentes vacías", () => {
  for (const key of ["blueprint", "report", "execution"]) {
    assert.ok(editorial[key].title.trim());
    assert.ok(editorial[key].body.trim());
    assert.doesNotMatch(editorial[key].body, /<td>\s*(?:<\/td>)?\s*(?=<td>|<\/tr>)/i);
    assert.doesNotMatch(editorial[key].body, /^\s*[-*]\s*$/m);
  }
  assert.match(editorial.execution.body, /Ringba/);
  assert.match(editorial.execution.body, /Doctoralia \/ Docplanner/);
  assert.match(editorial.execution.body, /Clientify/);
});
