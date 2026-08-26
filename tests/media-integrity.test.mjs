import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const snapshotPromise = Promise.all([
  readJson("public/data/companies.json"),
  readJson("public/data/summary.json"),
  readJson("public/data/audit.json"),
  readJson("public/data/media-quality.json"),
  readJson("public/data/scrapecreators-media-index.json"),
]);

function validSignature(file, buffer) {
  const extension = file.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg")
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === "png")
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === "webp")
    return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (extension === "pdf") return buffer.toString("ascii", 0, 5) === "%PDF-";
  if (extension === "mp4")
    return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
  if (extension === "heic") {
    if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
    const brands = buffer.subarray(8, Math.min(buffer.length, 64)).toString("ascii");
    return /heic|heix|hevc|hevx|mif1|msf1/.test(brands);
  }
  if (extension === "svg") {
    const text = buffer.subarray(0, Math.min(buffer.length, 4_096)).toString("utf8");
    return /<svg\b/i.test(text) && !/<html\b|<!doctype\s+html/i.test(text);
  }
  return false;
}

test("all declared gallery assets exist locally, are unique and match their declared size", async () => {
  const [companies, summary, , , scrapeCreators] = await snapshotPromise;
  const legacyRows = companies.flatMap((company) =>
    company.media.map((media) => ({ companyId: company.id, ...media })),
  );
  const scrapeCreatorsRows = Object.values(scrapeCreators.items || {}).flatMap((ad) =>
    (ad.mediaAssets || []).map((media) => ({ companyId: ad.companyId, ...media })),
  );
  const rows = [...legacyRows, ...scrapeCreatorsRows];
  const failures = [];
  const referenced = new Set();

  assert.equal(legacyRows.length, summary.media);
  assert.equal(scrapeCreatorsRows.length, scrapeCreators.summary.assets);
  assert.equal(rows.length, summary.media + scrapeCreators.summary.assets);

  await Promise.all(
    rows.map(async (media) => {
      if (!media.file.startsWith("/media/")) {
        failures.push({ file: media.file, issue: "non-local-path" });
        return;
      }
      if (referenced.has(media.file)) failures.push({ file: media.file, issue: "duplicate-reference" });
      referenced.add(media.file);
      try {
        const url = new URL(`public/${media.file.replace(/^\//, "")}`, root);
        const [buffer, metadata] = await Promise.all([readFile(url), stat(url)]);
        if (metadata.size !== media.bytes)
          failures.push({ file: media.file, issue: "size" });
        if (!validSignature(media.file, buffer))
          failures.push({ file: media.file, issue: "signature" });
      } catch {
        failures.push({ file: media.file, issue: "missing" });
      }
    }),
  );

  const actual = (await readdir(new URL("public/media/", root), { recursive: true }))
    .map((name) => `/media/${String(name).replaceAll("\\", "/")}`)
    .filter((name) => /\.[a-z0-9]+$/i.test(name))
    .sort();
  const expected = [...referenced].sort();
  assert.deepEqual(actual, expected, "Hay archivos huérfanos o referencias sin archivo en public/media");
  assert.deepEqual(
    failures,
    [],
    `Medios inválidos (${failures.length}): ${JSON.stringify(failures.slice(0, 30))}`,
  );
});

test("declared, available, unavailable and excluded evidence reconcile exactly", async () => {
  const [companies, summary, audit, quality] = await snapshotPromise;
  const declared = companies.reduce((sum, company) => sum + company.mediaDeclared, 0);
  const available = companies.reduce((sum, company) => sum + company.media.length, 0);
  const unavailable = audit.failed.length;
  const excluded = quality.technicalArtifactsExcluded;

  assert.equal(declared, 3_979);
  assert.equal(available, 3_957);
  assert.equal(unavailable, 5);
  assert.equal(excluded, 17);
  assert.equal(declared, available + unavailable + excluded);
  assert.equal(summary.media, available);
  assert.equal(summary.mediaFailed, unavailable);
  assert.equal(summary.technicalArtifactsExcluded, excluded);
  assert.equal(summary.completion.orphanMedia, 0);
  assert.equal(quality.status, "VERIFICADO");
});
