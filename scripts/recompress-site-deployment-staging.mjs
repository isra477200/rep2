import { access, readFile, readdir, rename, stat, unlink } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";

const stagingProject = resolve(process.argv[2] || ".");
const clientRoot = resolve(stagingProject, "dist", "client");
const targets = [
  {
    root: resolve(clientRoot, "evidence"),
    kind: "evidence",
  },
  {
    root: resolve(clientRoot, "asset-previews"),
    kind: "asset-preview",
  },
];
const extensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const concurrency = 6;
const boundedEnv = (name, fallback, minimum, maximum) => {
  const value = Number(process.env[name] || fallback);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : fallback));
};
const assetPreviewWidth = boundedEnv("SITES_ASSET_PREVIEW_WIDTH", 600, 360, 960);
const assetPreviewQuality = boundedEnv("SITES_ASSET_PREVIEW_QUALITY", 34, 20, 70);
const evidenceWidth = boundedEnv("SITES_EVIDENCE_WIDTH", 700, 420, 1_000);
const evidenceQuality = boundedEnv("SITES_EVIDENCE_QUALITY", 40, 24, 75);
const evidenceThumbWidth = boundedEnv("SITES_EVIDENCE_THUMB_WIDTH", 420, 300, 700);
const evidenceThumbQuality = boundedEnv("SITES_EVIDENCE_THUMB_QUALITY", 38, 20, 70);

async function walk(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else if (entry.name.includes(".rvstage.")) await unlink(path);
      else if (extensions.has(extname(entry.name).toLowerCase())) files.push(path);
    }
  }
  return files;
}

function settings(path, kind) {
  if (kind === "asset-preview") {
    return { width: assetPreviewWidth, quality: assetPreviewQuality };
  }
  if (/-thumb\.webp$/i.test(path)) {
    return { width: evidenceThumbWidth, quality: evidenceThumbQuality };
  }
  return { width: evidenceWidth, quality: evidenceQuality };
}

async function optimize(path, kind) {
  const before = (await stat(path)).size;
  const source = await readFile(path);
  const extension = extname(path).toLowerCase();
  const temporary = `${path}.rvstage${extension}`;
  const target = settings(path, kind);
  try {
    let pipeline = sharp(source, { limitInputPixels: false, sequentialRead: true })
      .rotate()
      .resize({ width: target.width, withoutEnlargement: true });
    if (extension === ".webp") pipeline = pipeline.webp({ quality: target.quality, effort: 6, smartSubsample: true });
    else if (extension === ".png") pipeline = pipeline.png({ compressionLevel: 9, effort: 10, palette: true, quality: target.quality, colours: 96 });
    else pipeline = pipeline.jpeg({ quality: target.quality, effort: 8, mozjpeg: true });
    await pipeline.toFile(temporary);
    const after = (await stat(temporary)).size;
    if (after >= before) {
      await unlink(temporary);
      return { path, before, after: before, changed: false };
    }
    await rename(temporary, path);
    return { path, before, after, changed: true };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    return { path, before, after: before, changed: false, error: String(error?.message || error) };
  }
}

async function runPool(items, worker) {
  let cursor = 0;
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

const report = [];
await Promise.all(targets.map((target) => access(target.root)));
for (const target of targets) {
  const files = await walk(target.root);
  const results = await runPool(files, (path) => optimize(path, target.kind));
  report.push({
    kind: target.kind,
    files: files.length,
    changed: results.filter((result) => result.changed).length,
    errors: results.filter((result) => result.error).length,
    errorSamples: results
      .filter((result) => result.error)
      .slice(0, 10)
      .map(({ path, error }) => ({ path, error })),
    beforeBytes: results.reduce((sum, result) => sum + result.before, 0),
    afterBytes: results.reduce((sum, result) => sum + result.after, 0),
  });
}

console.log(JSON.stringify({
  concurrency,
  settings: {
    assetPreviewWidth,
    assetPreviewQuality,
    evidenceWidth,
    evidenceQuality,
    evidenceThumbWidth,
    evidenceThumbQuality,
  },
  targets: report,
}, null, 2));
if (report.some((target) => target.errors > 0)) process.exitCode = 1;
