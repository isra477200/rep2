import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloadScript = resolve(root, "scripts/download-scrapecreators-media.mjs");
const publishScript = resolve(root, "scripts/publish-scrapecreators-media.mjs");
const rawSha256 = "a".repeat(64);
const externalId = "123456789012345";
const pageId = "111111111111111";
const companyId = "acme";
const oldAssetKey = "sc-image-asset-one";
const publicFile = `/media/${companyId}-sc-meta-${externalId}-image.png`;

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const runNode = (script, args) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

const makePng = async () =>
  sharp(randomBytes(96 * 96 * 3), {
    raw: { width: 96, height: 96, channels: 3 },
  })
    .png()
    .toBuffer();

const createFixture = async () => {
  const directory = mkdtempSync(join(tmpdir(), "rv-sc-media-safety-"));
  const paths = {
    normalized: join(directory, "normalized.json"),
    manifest: join(directory, "media-manifest.json"),
    report: join(directory, "media-download-report.json"),
    map: join(directory, "company-map.json"),
    companies: join(directory, "companies-index.json"),
    identity: join(directory, "ad-media-identity.json"),
    outputIndex: join(directory, "scrapecreators-media-index.json"),
    staging: join(directory, "media-staging"),
    reuseStaging: join(directory, "batch1-media-staging"),
    publicMedia: join(directory, "public-media"),
  };
  mkdirSync(paths.staging, { recursive: true });
  mkdirSync(paths.reuseStaging, { recursive: true });
  mkdirSync(paths.publicMedia, { recursive: true });

  const image = await makePng();
  assert.ok(image.length > 500, "el fixture debe superar el mínimo del descargador");
  writeFileSync(join(paths.reuseStaging, `${oldAssetKey}.png`), image);
  writeFileSync(join(paths.staging, `${oldAssetKey}.png`), image);
  writeFileSync(join(paths.publicMedia, publicFile.split("/").at(-1)), image);

  const ad = {
    externalId,
    pageId,
    observedPageIds: [pageId],
    requestedPageIds: [pageId],
    requestedCompanyNames: ["Acme"],
    pageName: "Acme",
    sourceUrl: `https://www.facebook.com/ads/library/?id=${externalId}`,
    landing: { url: "https://example.test/landing" },
    isActive: true,
    startedAt: "2026-08-25",
    endedAt: null,
    transcription: { available: false },
    copy: { text: "Generación de leads" },
    media: {
      images: [{ assetKey: oldAssetKey }],
      posters: [],
      videos: [],
    },
  };
  writeJson(paths.normalized, {
    schema: "redvitalia-scrapecreators-ads-v1",
    generatedAt: "2026-08-26T00:00:00.000Z",
    source: { rawSha256, creditsCharged: 200 },
    items: [ad],
  });
  writeJson(paths.manifest, {
    schema: "redvitalia-scrapecreators-private-media-v1",
    sourceRawSha256: rawSha256,
    assets: [
      {
        assetKey: oldAssetKey,
        kind: "image",
        extensionHint: "png",
        candidates: [],
      },
    ],
  });
  writeJson(paths.map, {
    pageIds: {
      [pageId]: { status: "matched", companyId, confidence: "high" },
    },
  });
  writeJson(paths.companies, [
    {
      id: companyId,
      name: "Acme",
      media: [
        {
          file: publicFile,
          type: "image/png",
          bytes: image.length,
          width: 96,
          height: 96,
          label: "Anuncio Meta · imagen",
          title: `Acme · Meta ${externalId}`,
          order: 1,
        },
      ],
    },
  ]);
  writeJson(paths.identity, {
    schema: "redvitalia-ad-media-identity-v1",
    generatedAt: "2026-08-26",
    total: 1,
    items: [
      {
        companyId,
        platform: "meta",
        externalId,
        file: publicFile,
        variantCount: 1,
      },
    ],
  });
  writeJson(paths.outputIndex, {
    schema: "redvitalia-scrapecreators-media-index-v1",
    generatedAt: "2026-08-26T00:00:00.000Z",
    summary: { ads: 1, companies: 1, assets: 1 },
    items: {
      [externalId]: {
        externalId,
        companyId,
        pageId,
        pageIds: [pageId],
        file: publicFile,
        videoFile: null,
        posterFile: null,
        mediaAssets: [
          {
            assetKey: oldAssetKey,
            kind: "image",
            file: publicFile,
            type: "image/png",
          },
        ],
      },
    },
  });
  writeJson(paths.report, {
    schema: "redvitalia-scrapecreators-media-download-v1",
    generatedAt: "2026-08-26T00:00:00.000Z",
    source: {
      normalizedRawSha256: rawSha256,
      privateManifestRawSha256: rawSha256,
      canonicalCombined: true,
    },
    items: [
      {
        assetKey: oldAssetKey,
        kind: "image",
        status: "existing",
        stagedFile: `${oldAssetKey}.png`,
        selectedFor: [
          { adId: externalId, pageId, pageName: "Acme", reason: "representative_visual" },
        ],
      },
    ],
  });
  return { directory, paths, image };
};

const publishArgs = (paths) => [
  "--normalized",
  paths.normalized,
  "--report",
  paths.report,
  "--staging-dir",
  paths.staging,
  "--map",
  paths.map,
  "--companies",
  paths.companies,
  "--identity",
  paths.identity,
  "--output-index",
  paths.outputIndex,
  "--public-media-dir",
  paths.publicMedia,
];

test("el staging batch1 se reutiliza de forma idempotente", async (t) => {
  const { directory, paths, image } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  rmSync(paths.staging, { recursive: true, force: true });

  const args = [
    "--data",
    paths.normalized,
    "--manifest",
    paths.manifest,
    "--staging-dir",
    paths.staging,
    "--reuse-staging-dir",
    paths.reuseStaging,
    "--report",
    paths.report,
    "--company-map",
    paths.map,
    "--published-index",
    paths.outputIndex,
  ];
  const first = runNode(downloadScript, args);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstReport = JSON.parse(readFileSync(paths.report, "utf8"));
  assert.equal(firstReport.source.canonicalCombined, true);
  assert.equal(firstReport.summary.reused, 1);
  assert.equal(firstReport.items[0].status, "reused");
  const target = join(paths.staging, `${oldAssetKey}.png`);
  assert.deepEqual(readFileSync(target), image);

  const second = runNode(downloadScript, args);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondReport = JSON.parse(readFileSync(paths.report, "utf8"));
  assert.equal(secondReport.summary.existing, 1);
  assert.equal(secondReport.summary.reused, 0);
  assert.equal(secondReport.items[0].status, "existing");
  assert.deepEqual(readFileSync(target), image);
});

test("el top-N incorpora además todos los anuncios y assets ya publicados", async (t) => {
  const { directory, paths } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const newExternalId = "999999999999999";
  const newAssetKey = "sc-image-new-top";
  const normalized = JSON.parse(readFileSync(paths.normalized, "utf8"));
  normalized.items[0].isActive = false;
  normalized.items[0].copy.text = "Histórico";
  normalized.items.push({
    ...structuredClone(normalized.items[0]),
    externalId: newExternalId,
    isActive: true,
    transcription: { available: true },
    copy: { text: "Nuevo anuncio prioritario con transcripción" },
    media: {
      images: [{ assetKey: newAssetKey }],
      posters: [],
      videos: [],
    },
  });
  writeJson(paths.normalized, normalized);
  const manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
  manifest.assets.push({
    assetKey: newAssetKey,
    kind: "image",
    extensionHint: "png",
    candidates: [],
  });
  writeJson(paths.manifest, manifest);
  writeFileSync(join(paths.reuseStaging, `${newAssetKey}.png`), await makePng());
  rmSync(paths.staging, { recursive: true, force: true });

  const result = runNode(downloadScript, [
    "--data",
    paths.normalized,
    "--manifest",
    paths.manifest,
    "--staging-dir",
    paths.staging,
    "--reuse-staging-dir",
    paths.reuseStaging,
    "--report",
    paths.report,
    "--company-map",
    paths.map,
    "--published-index",
    paths.outputIndex,
    "--max-ads-per-page",
    "1",
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(paths.report, "utf8"));
  assert.deepEqual(new Set(report.selectedAdIds), new Set([externalId, newExternalId]));
  assert.equal(report.selection.maxAdsPerRequestedPage, 1);
  assert.equal(report.selection.selectedAds, 2);
  assert.equal(report.selection.selectedAssets, 2);
  assert.equal(report.selection.publishedBaselineAds, 1);
  assert.equal(report.selection.publishedBaselineAssetIdentities, 1);
  const historical = report.items.find((item) => item.assetKey === oldAssetKey);
  assert.ok(
    historical.selectedFor.some((selection) => selection.reason === "published_baseline"),
  );
});

test("el dry-run calcula el plan sin cambiar índices, fichas, identidades ni medios", async (t) => {
  const { directory, paths } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const tracked = [paths.companies, paths.identity, paths.outputIndex];
  const before = tracked.map((path) => readFileSync(path));
  const publicBefore = readFileSync(join(paths.publicMedia, publicFile.split("/").at(-1)));

  const result = runNode(publishScript, [...publishArgs(paths), "--dry-run"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"mode": "dry-run"/);
  assert.match(result.stdout, /"safeToPublish": true/);
  tracked.forEach((path, index) => assert.deepEqual(readFileSync(path), before[index]));
  assert.deepEqual(
    readFileSync(join(paths.publicMedia, publicFile.split("/").at(-1))),
    publicBefore,
  );
});

test("bloquea antes de mutar si se reemplaza un asset ya publicado", async (t) => {
  const { directory, paths } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const replacementKey = "sc-image-replacement";
  const replacement = await makePng();
  writeFileSync(join(paths.staging, `${replacementKey}.png`), replacement);
  const report = JSON.parse(readFileSync(paths.report, "utf8"));
  report.items[0].assetKey = replacementKey;
  report.items[0].stagedFile = `${replacementKey}.png`;
  writeJson(paths.report, report);

  const tracked = [paths.companies, paths.identity, paths.outputIndex];
  const before = tracked.map((path) => readFileSync(path));
  const publicPath = join(paths.publicMedia, publicFile.split("/").at(-1));
  const publicBefore = readFileSync(publicPath);
  const result = runNode(publishScript, publishArgs(paths));

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /Publicación bloqueada/);
  assert.match(`${result.stderr}\n${result.stdout}`, /"assetIdentities"/);
  tracked.forEach((path, index) => assert.deepEqual(readFileSync(path), before[index]));
  assert.deepEqual(readFileSync(publicPath), publicBefore);
});

test("una variante nueva conserva el nombre y representante del asset histórico", async (t) => {
  const { directory, paths } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const variantKey = "sc-image-new-variant";
  const variant = await makePng();
  writeFileSync(join(paths.staging, `${variantKey}.png`), variant);
  const normalized = JSON.parse(readFileSync(paths.normalized, "utf8"));
  normalized.items[0].media.images.push({ assetKey: variantKey });
  writeJson(paths.normalized, normalized);
  const report = JSON.parse(readFileSync(paths.report, "utf8"));
  report.items.push({
    assetKey: variantKey,
    kind: "image",
    status: "existing",
    stagedFile: `${variantKey}.png`,
    selectedFor: [
      { adId: externalId, pageId, pageName: "Acme", reason: "representative_visual" },
    ],
  });
  writeJson(paths.report, report);

  const result = runNode(publishScript, [...publishArgs(paths), "--dry-run"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"safeToPublish": true/);
  assert.match(result.stdout, /"externalIds": \{\s*"count": 0/);
  assert.match(result.stdout, /"replacements": \{\s*"count": 0/);
  assert.match(result.stdout, /"unchanged": 1/);
});

test("rechaza un manifiesto combinado que no corresponde al raw canónico", async (t) => {
  const { directory, paths } = await createFixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
  manifest.sourceRawSha256 = "b".repeat(64);
  writeJson(paths.manifest, manifest);

  const result = runNode(downloadScript, [
    "--data",
    paths.normalized,
    "--manifest",
    paths.manifest,
    "--staging-dir",
    paths.staging,
    "--report",
    paths.report,
    "--company-map",
    paths.map,
    "--published-index",
    paths.outputIndex,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /mismo raw canónico/);
});
