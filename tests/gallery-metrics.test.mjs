import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deriveGalleryMetrics } from "../app/gallery-metrics.ts";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("gallery metrics keep the summary as a safe initial-load fallback", () => {
  const fallback = { companies: 712, withMedia: 154, media: 3_957 };

  assert.deepEqual(deriveGalleryMetrics(undefined, fallback), {
    ...fallback,
    source: "summary-fallback",
  });
  assert.deepEqual(deriveGalleryMetrics([], fallback), {
    ...fallback,
    source: "summary-fallback",
  });
});

test("gallery metrics are recomputed from the loaded company index", () => {
  const fallback = { companies: 712, withMedia: 154, media: 3_957 };
  const companies = [
    { media: [{ file: "/one.jpg" }, { file: "/two.jpg" }] },
    { media: [] },
    { media: [{ file: "/three.mp4" }] },
  ];

  assert.deepEqual(deriveGalleryMetrics(companies, fallback), {
    companies: 3,
    withMedia: 2,
    media: 3,
    source: "companies-index",
  });
});

test("the Ads counters match the real loaded index instead of the stale base summary", async () => {
  const [companies, summary] = await Promise.all([
    readJson("public/data/companies-index.json"),
    readJson("public/data/summary.json"),
  ]);
  const metrics = deriveGalleryMetrics(companies, summary);
  const directMedia = companies.reduce(
    (total, company) => total + (Array.isArray(company.media) ? company.media.length : 0),
    0,
  );
  const directWithMedia = companies.filter(
    (company) => Array.isArray(company.media) && company.media.length > 0,
  ).length;

  assert.equal(metrics.source, "companies-index");
  assert.equal(metrics.companies, companies.length);
  assert.equal(metrics.withMedia, directWithMedia);
  assert.equal(metrics.media, directMedia);
  assert.ok(metrics.companies > summary.companies, "the imported company fichas must be counted");
  assert.ok(metrics.withMedia > summary.withMedia, "the imported galleries must be counted");
  assert.ok(metrics.media > summary.media, "the imported media assets must be counted");
});
