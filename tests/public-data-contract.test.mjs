import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const EXPECTED_RECORDS = 712;

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const jsonFileIds = async (relativeDirectory) =>
  (await readdir(new URL(relativeDirectory, root)))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();

const sortedIds = (records) => records.map(({ id }) => id).sort();

function assertUniqueIds(records, label) {
  const ids = records.map(({ id }) => id);
  assert.equal(ids.length, new Set(ids).size, `${label}: hay IDs duplicados`);
  assert.ok(ids.every(Boolean), `${label}: hay IDs vacíos`);
}

const snapshotPromise = (async () => {
  const [
    queue,
    companies,
    deepIndex,
    publicIdentity,
    canonicalRecordIds,
    reviewIds,
    publicRecordIds,
  ] = await Promise.all([
    readJson("research/deep/queue.json"),
    readJson("public/data/companies.json"),
    readJson("public/data/deep/index.json"),
    readJson("research/deep/public-id-map.json"),
    jsonFileIds("research/deep/records/"),
    jsonFileIds("research/deep/reviews/"),
    jsonFileIds("public/data/deep/records/"),
  ]);

  const publicRecords = await Promise.all(
    publicRecordIds.map((id) =>
      readJson(`public/data/deep/records/${id}.json`),
    ),
  );

  return {
    queue,
    companies,
    deepIndex,
    publicIdentity,
    canonicalRecordIds,
    reviewIds,
    publicRecordIds,
    publicRecords,
  };
})();

test("the private canonical IDs and public IDs form separate exact 712-record bijections", async () => {
  const {
    queue,
    companies,
    deepIndex,
    publicIdentity,
    canonicalRecordIds,
    reviewIds,
    publicRecordIds,
    publicRecords,
  } = await snapshotPromise;

  assert.equal(queue.items.length, EXPECTED_RECORDS, "cola canónica");
  assert.equal(companies.length, EXPECTED_RECORDS, "companies.json");
  assert.equal(deepIndex.records.length, EXPECTED_RECORDS, "deep/index.json");
  assert.equal(
    canonicalRecordIds.length,
    EXPECTED_RECORDS,
    "records canónicos",
  );
  assert.equal(reviewIds.length, EXPECTED_RECORDS, "reviews sintetizadas");
  assert.equal(
    publicRecordIds.length,
    EXPECTED_RECORDS,
    "deep records públicos",
  );
  assert.equal(publicRecords.length, EXPECTED_RECORDS, "deep records cargados");

  assertUniqueIds(queue.items, "cola canónica");
  assertUniqueIds(companies, "companies.json");
  assertUniqueIds(deepIndex.records, "deep/index.json");
  assertUniqueIds(publicRecords, "deep records públicos");

  const expectedPrivate = sortedIds(queue.items);
  const expectedPublic = Object.values(publicIdentity.ids).sort();
  assert.equal(Object.keys(publicIdentity.ids).length, EXPECTED_RECORDS);
  assert.deepEqual(Object.keys(publicIdentity.ids).sort(), expectedPrivate);
  assert.equal(new Set(expectedPublic).size, EXPECTED_RECORDS);
  assert.equal(
    expectedPublic.filter((id) => new Set(expectedPrivate).has(id)).length,
    0,
    "La identidad pública no puede reutilizar un ID canónico privado",
  );
  assert.deepEqual(sortedIds(companies), expectedPublic, "companies.json ≠ mapa público");
  assert.deepEqual(sortedIds(deepIndex.records), expectedPublic, "deep index ≠ mapa público");
  assert.deepEqual(canonicalRecordIds, expectedPrivate, "records canónicos ≠ cola");
  assert.deepEqual(reviewIds, expectedPrivate, "reviews ≠ cola");
  assert.deepEqual(publicRecordIds, expectedPublic, "archivos públicos ≠ mapa público");
  assert.deepEqual(
    sortedIds(publicRecords),
    expectedPublic,
    "contenido público ≠ mapa público",
  );

  for (const item of queue.items) {
    assert.equal(
      item.recordFile,
      `records/${item.id}.json`,
      `${item.id}: recordFile no apunta a su ficha canónica`,
    );
  }
  for (let index = 0; index < publicRecordIds.length; index += 1) {
    assert.equal(
      publicRecords[index].id,
      publicRecordIds[index],
      `${publicRecordIds[index]}: el ID público no coincide con el nombre de archivo`,
    );
  }
});

test("every public verification status is the exact private queue QA verification level", async () => {
  const { queue, deepIndex, publicIdentity, publicRecords } = await snapshotPromise;
  const queueById = new Map(queue.items.map((item) => [item.id, item]));
  const privateByPublic = new Map(
    Object.entries(publicIdentity.ids).map(([privateId, publicId]) => [publicId, privateId]),
  );
  const indexById = new Map(deepIndex.records.map((item) => [item.id, item]));
  const mismatches = [];

  for (const record of publicRecords) {
    const queued = queueById.get(privateByPublic.get(record.id));
    const indexed = indexById.get(record.id);
    const expected = queued?.qa?.verificationLevel;
    if (
      queued?.qa?.status !== "complete" ||
      !expected ||
      record.status !== expected ||
      indexed?.status !== expected
    ) {
      mismatches.push({
        id: record.id,
        qaStatus: queued?.qa?.status,
        expected,
        publicStatus: record.status,
        indexStatus: indexed?.status,
      });
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `Estados QA desincronizados (${mismatches.length}): ${JSON.stringify(mismatches.slice(0, 12))}`,
  );
});

test("published forensic stats are recomputed from all records, including manual evidence", async () => {
  const { deepIndex, publicRecords } = await snapshotPromise;
  const countStatus = (status) =>
    publicRecords.filter((record) => record.status === status).length;

  let evidenceUrls = 0;
  for (const record of publicRecords) {
    const urls = new Set(
      [
        ...(record.evidence || []).map((source) => source.url),
        ...(record.manual?.sources || []).map((source) => source.url),
      ].filter(Boolean),
    );
    evidenceUrls += urls.size;
  }

  const expected = {
    manualVerified: countStatus("Verificada manual"),
    structuralVerified: countStatus("Verificada estructural"),
    limited: countStatus("Limitada"),
    bookingObserved: publicRecords.filter(
      (record) => record.conversion?.bookingObserved === true,
    ).length,
    evidenceUrls,
    archivedEvidenceAssets: publicRecords.reduce(
      (sum, record) => sum + (record.archivedEvidenceCount || 0),
      0,
    ),
  };
  const publishedBooking =
    deepIndex.stats.bookingObserved ?? deepIndex.stats.withBooking;

  assert.deepEqual(
    {
      total: deepIndex.stats.total,
      manualVerified: deepIndex.stats.manualVerified,
      structuralVerified: deepIndex.stats.structuralVerified,
      limited: deepIndex.stats.limited,
      bookingObserved: publishedBooking,
      evidenceUrls: deepIndex.stats.evidenceUrls,
      archivedEvidenceAssets: deepIndex.stats.archivedEvidenceAssets,
    },
    { total: EXPECTED_RECORDS, ...expected },
    "Las reservas deben proceder de conversion.bookingObserved y evidenceUrls debe sumar la unión por ficha de fuentes automáticas y manuales",
  );
});

test("each deep-index evidenceCount is the per-record union of automatic and manual URLs", async () => {
  const { deepIndex, publicRecords } = await snapshotPromise;
  const indexById = new Map(deepIndex.records.map((item) => [item.id, item]));
  const evidenceCountMismatches = [];

  for (const record of publicRecords) {
    const expected = new Set(
      [
        ...(record.evidence || []).map((source) => source.url),
        ...(record.manual?.sources || []).map((source) => source.url),
      ].filter(Boolean),
    ).size;
    const published = indexById.get(record.id)?.evidenceCount;
    if (published !== expected) {
      evidenceCountMismatches.push({ id: record.id, expected, published });
    }
  }

  assert.equal(
    evidenceCountMismatches.length,
    0,
    `evidenceCount omite fuentes manuales en ${evidenceCountMismatches.length} fichas: ${JSON.stringify(evidenceCountMismatches.slice(0, 12))}`,
  );
});
