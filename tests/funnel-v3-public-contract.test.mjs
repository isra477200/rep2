import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const EXPECTED_RECORDS = 712;
const DIMENSIONS = [
  "classification",
  "messageArchitecture",
  "acquisition",
  "ctaLadder",
  "captureAndQualification",
  "funnel",
  "offerEconomics",
  "proofAndTrust",
  "objectionsAndSales",
  "technologyAndNurture",
  "deliveryOperations",
  "competitiveAssessment",
];
const FUNNEL_STAGES = [
  "Descubrimiento / adquisición",
  "Landing / entrada",
  "Promesa y encaje",
  "Prueba / confianza",
  "CTA",
  "Captura",
  "Cualificación",
  "Reserva o contacto",
  "Conversación comercial",
  "Propuesta / cierre",
  "Onboarding / entrega",
  "Seguimiento / retención",
];
const CORE_STATUSES = new Set([
  "observado",
  "inferido",
  "no observable",
  "no aplica",
]);

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const safePublicUrl = (value) => {
  try {
    const raw = String(value || "").trim();
    if (!raw || raw.endsWith("\\") || /\[\[[^\]]+\]\]/.test(raw)) return false;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (/(^|\.)notion\.(?:com|so|site)$/i.test(host)) return false;
    if (
      /^(?:localhost|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(
        host,
      )
    )
      return false;
    if (host === "::1" || /^(?:f[cd]|fe[89ab])/i.test(host)) return false;
    return ![...url.searchParams.keys()].some((key) =>
      /(?:^|[-_])(?:access[-_]?token|refresh[-_]?token|security[-_]?token|api[-_]?key|password|secret|client[-_]?secret|authorization|credential|signature|x-amz-|x-goog-)/i.test(
        key,
      ),
    );
  } catch {
    return false;
  }
};

function evidenceReferences(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => evidenceReferences(child, result));
    return result;
  }
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidenceIds" && Array.isArray(child)) result.push(...child);
    else if (key !== "evidence") evidenceReferences(child, result);
  }
  return result;
}

const snapshotPromise = (async () => {
  const [index, companies, identity] = await Promise.all([
    readJson("public/data/funnel-v3/index.json"),
    readJson("public/data/companies.json"),
    readJson("research/deep/public-id-map.json"),
  ]);
  const filenames = (await readdir(new URL("public/data/funnel-v3/records/", root)))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const records = await Promise.all(
    filenames.map((name) => readJson(`public/data/funnel-v3/records/${name}`)),
  );
  return { index, companies, identity, filenames, records };
})();

test("the public V3 index is an exact 712-record projection", async () => {
  const { index, companies, identity, filenames, records } = await snapshotPromise;
  const expectedIds = Object.values(identity.ids).sort();
  const indexIds = index.records.map((row) => row.id).sort();
  const fileIds = filenames.map((name) => name.slice(0, -5)).sort();
  const recordIds = records.map((row) => row.id).sort();
  const companyIds = companies.map((row) => row.id).sort();

  assert.equal(index.format, "rv-funnel-forensics-public-index-v3");
  assert.equal(index.stats.total, EXPECTED_RECORDS);
  assert.equal(index.stats.verified, EXPECTED_RECORDS);
  assert.equal(index.records.length, EXPECTED_RECORDS);
  assert.equal(filenames.length, EXPECTED_RECORDS);
  assert.equal(new Set(indexIds).size, EXPECTED_RECORDS);
  assert.deepEqual(indexIds, expectedIds);
  assert.deepEqual(fileIds, expectedIds);
  assert.deepEqual(recordIds, expectedIds);
  assert.deepEqual(companyIds, expectedIds);
});

test("every V3 mother record exposes all dimensions and the ordered 12-stage funnel", async () => {
  const { records } = await snapshotPromise;
  const failures = [];

  for (const record of records) {
    if (record.format !== "rv-funnel-forensics-public-v3")
      failures.push({ id: record.id, issue: "format" });
    if (!Number.isFinite(record.coveragePercent) || record.coveragePercent < 0 || record.coveragePercent > 100)
      failures.push({ id: record.id, issue: "coverage" });
    if (
      record.verification?.qa !== "verificada" ||
      record.verification?.publicGetOnly !== true ||
      record.verification?.formsSubmitted !== false ||
      record.verification?.companyContacted !== false
    )
      failures.push({ id: record.id, issue: "verification" });

    for (const key of DIMENSIONS) {
      if (!(key in record)) failures.push({ id: record.id, issue: `missing:${key}` });
      if (key !== "funnel" && !CORE_STATUSES.has(record[key]?.status))
        failures.push({ id: record.id, issue: `status:${key}` });
    }
    if (!Array.isArray(record.funnel) || record.funnel.length !== FUNNEL_STAGES.length) {
      failures.push({ id: record.id, issue: "funnel-count" });
      continue;
    }
    record.funnel.forEach((stage, index) => {
      if (stage.stage !== FUNNEL_STAGES[index])
        failures.push({ id: record.id, issue: `funnel-order:${index}` });
      if (!CORE_STATUSES.has(stage.status))
        failures.push({ id: record.id, issue: `funnel-status:${index}` });
      if (!String(stage.detail || stage.limitation || "").trim())
        failures.push({ id: record.id, issue: `funnel-explanation:${index}` });
    });
  }

  assert.deepEqual(
    failures,
    [],
    `Fichas V3 incompletas (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});

test("forms, field counts and evidence references are internally consistent", async () => {
  const { records } = await snapshotPromise;
  const failures = [];

  for (const record of records) {
    const evidence = Array.isArray(record.evidence) ? record.evidence : [];
    const evidenceIds = new Set(evidence.map((row) => row.id));
    if (!evidence.length || evidenceIds.size !== evidence.length)
      failures.push({ id: record.id, issue: "evidence-inventory" });
    for (const row of evidence) {
      const unavailable = row.url === null
        && row.status === "no disponible documentada"
        && typeof row.limitation === "string"
        && row.limitation.trim()
        && (!Array.isArray(row.supports) || row.supports.length === 0);
      if (!row.id || (!unavailable && !safePublicUrl(row.url)))
        failures.push({ id: record.id, issue: "evidence-url" });
      if (row.status === "observado" && (!Array.isArray(row.supports) || !row.supports.length))
        failures.push({ id: record.id, issue: `evidence-supports:${row.id}` });
      if (!["official_site", "external_funnel_destination", null, undefined].includes(row.relation))
        failures.push({ id: record.id, issue: `evidence-relation:${row.id}` });
    }
    for (const reference of evidenceReferences(record)) {
      if (!evidenceIds.has(reference))
        failures.push({ id: record.id, issue: `orphan-evidence:${reference}` });
    }

    const forms = record.captureAndQualification?.forms || [];
    for (const [index, form] of forms.entries()) {
      const fields = form.fields || [];
      if (form.submissionPerformed !== false)
        failures.push({ id: record.id, issue: `form-submission:${index}` });
      if (form.visibleFieldCount !== fields.length)
        failures.push({ id: record.id, issue: `form-fields:${index}` });
      if (form.requiredFieldCount !== fields.filter((field) => field.required === true).length)
        failures.push({ id: record.id, issue: `form-required:${index}` });
      if (fields.some((field) => !field.type || typeof field.required !== "boolean"))
        failures.push({ id: record.id, issue: `form-field-shape:${index}` });
    }
  }

  assert.deepEqual(
    failures,
    [],
    `Inconsistencias de evidencia o formularios (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});

test("the V3 index totals are recomputed from the published records", async () => {
  const { index, records } = await snapshotPromise;
  const rows = records.map((record) => {
    const forms = record.captureAndQualification?.forms || [];
    return {
      manualEvidence: record.verification.manualEvidence,
      forms: forms.length,
      fields: forms.reduce((sum, form) => sum + form.visibleFieldCount, 0),
      evidence: record.evidence.length,
      usableEvidenceReferences: record.evidence.filter((row) => row.url).length,
      unavailableEvidenceReferences: record.evidence.filter((row) => !row.url).length,
      uniqueEvidenceUrls: new Set(record.evidence.map((row) => row.url).filter(Boolean)).size,
      screenshots: record.evidenceScreenshots.length,
      coverage: record.coveragePercent,
    };
  });
  const expected = {
    total: records.length,
    verified: records.length,
    manualEvidence: rows.filter((row) => row.manualEvidence).length,
    withForms: rows.filter((row) => row.forms > 0).length,
    forms: rows.reduce((sum, row) => sum + row.forms, 0),
    visibleFields: rows.reduce((sum, row) => sum + row.fields, 0),
    evidence: rows.reduce((sum, row) => sum + row.evidence, 0),
    evidenceReferences: rows.reduce((sum, row) => sum + row.evidence, 0),
    usableEvidenceReferences: rows.reduce((sum, row) => sum + row.usableEvidenceReferences, 0),
    unavailableEvidenceReferences: rows.reduce((sum, row) => sum + row.unavailableEvidenceReferences, 0),
    uniqueEvidenceUrlsWithinRecords: rows.reduce((sum, row) => sum + row.uniqueEvidenceUrls, 0),
    uniqueEvidenceUrlsGlobal: new Set(records.flatMap((record) => record.evidence.map((row) => row.url).filter(Boolean))).size,
    screenshots: rows.reduce((sum, row) => sum + row.screenshots, 0),
    averageCoverage:
      Math.round(
        (rows.reduce((sum, row) => sum + row.coverage, 0) / rows.length) * 10,
      ) / 10,
  };
  assert.deepEqual(index.stats, expected);
  assert.equal(index.stats.evidenceReferences, 15236);
  assert.equal(index.stats.usableEvidenceReferences, 15235);
  assert.equal(index.stats.unavailableEvidenceReferences, 1);
  assert.equal(index.stats.uniqueEvidenceUrlsWithinRecords, 14782);
  assert.equal(index.stats.uniqueEvidenceUrlsGlobal, 14539);
});

test("published dossiers contain no unpaired Unicode surrogate", async () => {
  const { records } = await snapshotPromise;
  for (const record of records) {
    assert.doesNotMatch(
      JSON.stringify(record),
      /\\u(?:d[89ab][0-9a-f]{2}|d[c-f][0-9a-f]{2})/i,
      record.id,
    );
    assert.doesNotMatch(JSON.stringify(record), /\\u00(?:0[0-8bcef]|1[0-9a-f]|7f)/i, record.id);
  }
});

test("the global commercial insights reconcile with all 712 published dossiers", async () => {
  const { index, records } = await snapshotPromise;
  assert.ok(index.insights);
  assert.equal(
    index.insights.coverageBands.reduce((sum, row) => sum + row.count, 0),
    EXPECTED_RECORDS,
  );
  assert.equal(index.insights.funnelStages.length, FUNNEL_STAGES.length);
  index.insights.funnelStages.forEach((row, stageIndex) => {
    assert.equal(row.stage, FUNNEL_STAGES[stageIndex]);
    assert.equal(
      CORE_STATUSES.size && [...CORE_STATUSES].reduce((sum, status) => sum + row[status], 0),
      EXPECTED_RECORDS,
    );
    const observed = records.filter(
      (record) => record.funnel[stageIndex].status === "observado",
    ).length;
    assert.equal(row.observado, observed);
    assert.equal(row.observedPercent, Math.round((observed / EXPECTED_RECORDS) * 1_000) / 10);
  });
  for (const row of index.insights.dimensions) {
    assert.equal(
      [...CORE_STATUSES].reduce((sum, status) => sum + row[status], 0),
      EXPECTED_RECORDS,
    );
  }
  const numericPrices = records.filter((record) =>
    Number.isFinite(record.offerEconomics?.normalizedPrice?.amount)
    || (record.offerEconomics?.manualPriceConversions || []).some((row) =>
      Number.isFinite(row?.local?.amount),
    ),
  ).length;
  assert.deepEqual(index.insights.commercialSignals, {
    primaryCtaObserved: index.records.filter((row) => row.primaryCta).length,
    withForms: index.records.filter((row) => row.forms).length,
    withoutForms: index.records.filter((row) => !row.forms).length,
    recordsWithNumericPublicPrice: numericPrices,
    manualEvidence: index.records.filter((row) => row.manualEvidence).length,
    explicitLimitations: index.records.reduce((sum, row) => sum + row.limitations, 0),
  });
});

test("all published V3 screenshots are local, valid and content-addressed", async () => {
  const { records } = await snapshotPromise;
  const failures = [];
  const paths = new Set();

  for (const record of records) {
    const screenshots = record.evidenceScreenshots || [];
    if (screenshots.length > 2)
      failures.push({ id: record.id, issue: "screenshot-cap" });
    for (const screenshot of screenshots) {
      if (!screenshot.file.startsWith(`/evidence/${record.id}/`)) {
        failures.push({ id: record.id, issue: "screenshot-path" });
        continue;
      }
      if (paths.has(screenshot.file))
        failures.push({ id: record.id, issue: "screenshot-duplicate" });
      paths.add(screenshot.file);
      try {
        const relative = screenshot.file.replace(/^\//, "");
        const url = new URL(`public/${relative}`, root);
        const buffer = await readFile(url);
        const metadata = await stat(url);
        const digest = createHash("sha256").update(buffer).digest("hex");
        if (
          screenshot.type !== "image/webp" ||
          buffer.toString("ascii", 0, 4) !== "RIFF" ||
          buffer.toString("ascii", 8, 12) !== "WEBP" ||
          screenshot.bytes !== metadata.size ||
          screenshot.sha256 !== digest
        )
          failures.push({ id: record.id, issue: "screenshot-integrity" });
      } catch {
        failures.push({ id: record.id, issue: "screenshot-missing" });
      }
    }
  }

  assert.deepEqual(
    failures,
    [],
    `Capturas V3 inválidas (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});
