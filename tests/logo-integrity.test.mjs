import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const snapshotPromise = Promise.all([
  readJson("public/data/companies-index.json"),
  readJson("public/data/logos.json"),
  readJson("public/data/logo-quality.json"),
  readJson("public/data/summary.json"),
  readJson("public/data/portal-quality.json"),
  readJson("public/data/final-audit.json"),
]);

test("every company has either a verified local brand asset or an explained neutral fallback", async () => {
  const [companies, logos] = await snapshotPromise;
  const companyIds = companies.map((company) => company.id).sort();
  const logoIds = Object.keys(logos).sort();
  const failures = [];

  assert.ok(companies.length >= 1_000, "el manifiesto debe cubrir el catálogo ampliado visible");
  assert.equal(logoIds.length, companies.length);
  assert.deepEqual(logoIds, companyIds);

  for (const company of companies) {
    const logo = logos[company.id];
    if (logo.status === "fallback") {
      if (logo.file || !String(logo.reason || "").trim())
        failures.push({ id: company.id, issue: "fallback-trace" });
      continue;
    }
    if (!logo.file?.startsWith(`/logos/${company.id}/`))
      failures.push({ id: company.id, issue: "local-path" });
    if (!logo.source || !/^https?:\/\//i.test(logo.source))
      failures.push({ id: company.id, issue: "public-source" });
    if (!["official", "favicon", "platform"].includes(logo.status))
      failures.push({ id: company.id, issue: "status" });
    if (!["high", "medium"].includes(logo.confidence))
      failures.push({ id: company.id, issue: "confidence" });
  }

  assert.deepEqual(
    failures,
    [],
    `Activos de marca sin traza (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});

test("all stored logo files exist and match their declared WebP hash and size", async () => {
  const [, logos] = await snapshotPromise;
  const failures = [];

  await Promise.all(
    Object.entries(logos).map(async ([id, logo]) => {
      if (!logo.file) return;
      try {
        const url = new URL(`public/${logo.file.replace(/^\//, "")}`, root);
        const [buffer, metadata] = await Promise.all([readFile(url), stat(url)]);
        const digest = createHash("sha256").update(buffer).digest("hex");
        if (
          logo.contentType !== "image/webp" ||
          buffer.toString("ascii", 0, 4) !== "RIFF" ||
          buffer.toString("ascii", 8, 12) !== "WEBP" ||
          logo.bytes !== metadata.size ||
          logo.sha256 !== digest ||
          !Number.isFinite(logo.width) ||
          !Number.isFinite(logo.height) ||
          logo.width < 16 ||
          logo.height < 16
        )
          failures.push({ id, issue: "integrity" });
      } catch {
        failures.push({ id, issue: "missing" });
      }
    }),
  );

  assert.deepEqual(
    failures,
    [],
    `Logos locales inválidos (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});

test("the logo-quality summary is exactly recomputed from the manifest", async () => {
  const [, logos, quality, summary, portalQuality, finalAudit] = await snapshotPromise;
  const rows = Object.values(logos);
  const authentic = rows.filter((row) => row.file && row.status !== "fallback").length;
  assert.equal(quality.total, rows.length);
  assert.equal(quality.official, rows.filter((row) => row.status === "official").length);
  assert.equal(quality.favicon, rows.filter((row) => row.status === "favicon").length);
  assert.equal(quality.platform, rows.filter((row) => row.status === "platform").length);
  assert.equal(quality.authentic, authentic);
  assert.equal(quality.fallback, rows.filter((row) => row.status === "fallback").length);
  assert.equal(quality.coveragePercent, Number(((authentic / rows.length) * 100).toFixed(1)));
  assert.equal(quality.locallyStored, true);
  assert.equal(quality.hotlinked, 0);
  assert.deepEqual(summary.logos, quality);
  assert.deepEqual(portalQuality.brands, quality);
  assert.equal(finalAudit.totals.authenticBrandAssets, quality.authentic);
  assert.equal(finalAudit.totals.neutralLogoFallbacks, quality.fallback);
  assert.equal(finalAudit.documentedLimitations.neutralLogoFallbacks, quality.fallback);
});
