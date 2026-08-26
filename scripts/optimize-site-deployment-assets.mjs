import { readdir, rename, stat, unlink } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";

const DIST_CLIENT = resolve("dist", "client");
const TARGETS = [
  {
    root: resolve(DIST_CLIENT, "evidence"),
    kind: "evidence",
    width: 1_000,
    jpegQuality: 55,
    webpQuality: 52,
    pngQuality: 72,
  },
  {
    root: resolve(DIST_CLIENT, "media"),
    kind: "media",
    width: 1_080,
    height: 1_920,
    jpegQuality: 58,
    webpQuality: 55,
    pngQuality: 70,
  },
];

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const CONCURRENCY = Math.max(2, Math.min(6, Number(process.env.SITES_IMAGE_WORKERS || 4)));

async function walk(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(path);
    }
  }
  return files;
}

function pipelineFor(path, target) {
  const extension = extname(path).toLowerCase();
  const resize = target.kind === "evidence"
    ? { width: target.width, withoutEnlargement: true }
    : {
        width: target.width,
        height: target.height,
        fit: "inside",
        withoutEnlargement: true,
      };
  let pipeline = sharp(path, { limitInputPixels: false, sequentialRead: true })
    .rotate()
    .resize(resize);
  if (extension === ".png") {
    pipeline = pipeline.png({
      compressionLevel: 9,
      effort: 10,
      palette: true,
      quality: target.pngQuality,
      colours: 128,
      dither: 0.55,
    });
  } else if (extension === ".webp") {
    pipeline = pipeline.webp({ quality: target.webpQuality, effort: 6, smartSubsample: true });
  } else {
    pipeline = pipeline.jpeg({ quality: target.jpegQuality, effort: 8, mozjpeg: true });
  }
  return pipeline;
}

async function optimize(path, target) {
  const before = (await stat(path)).size;
  const extension = extname(path);
  const temporary = `${path}.rvdeploy${extension}`;
  try {
    await pipelineFor(path, target).toFile(temporary);
    const after = (await stat(temporary)).size;
    if (after >= before) {
      await unlink(temporary);
      return { before, after: before, changed: false };
    }
    await rename(temporary, path);
    return { before, after, changed: true };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    return { before, after: before, changed: false, error: String(error?.message || error) };
  }
}

async function runPool(items, worker) {
  let cursor = 0;
  const results = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

const report = { concurrency: CONCURRENCY, targets: [], beforeBytes: 0, afterBytes: 0, savedBytes: 0 };
for (const target of TARGETS) {
  const files = await walk(target.root);
  const results = await runPool(files, (path) => optimize(path, target));
  const summary = {
    kind: target.kind,
    files: files.length,
    changed: results.filter((result) => result.changed).length,
    errors: results.filter((result) => result.error).length,
    beforeBytes: results.reduce((sum, result) => sum + result.before, 0),
    afterBytes: results.reduce((sum, result) => sum + result.after, 0),
  };
  report.targets.push(summary);
  report.beforeBytes += summary.beforeBytes;
  report.afterBytes += summary.afterBytes;
}
report.savedBytes = report.beforeBytes - report.afterBytes;

console.log(JSON.stringify(report, null, 2));
