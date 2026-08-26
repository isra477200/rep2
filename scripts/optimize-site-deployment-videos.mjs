import { spawn } from "node:child_process";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

const MEDIA_ROOT = resolve("dist", "client", "media");
const FFMPEG = String(process.env.SITES_FFMPEG_PATH || "").trim();
const CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.SITES_VIDEO_WORKERS || 2)));
const WIDTH = Math.max(480, Math.min(960, Number(process.env.SITES_VIDEO_WIDTH || 640)));
const CRF = Math.max(28, Math.min(38, Number(process.env.SITES_VIDEO_CRF || 35)));
const AUDIO_KBPS = Math.max(32, Math.min(96, Number(process.env.SITES_VIDEO_AUDIO_KBPS || 48)));

if (!FFMPEG) {
  throw new Error("SITES_FFMPEG_PATH es obligatorio para optimizar los vídeos del despliegue.");
}

async function walk(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else if (/\.mp4$/i.test(entry.name)) files.push(path);
    }
  }
  return files;
}

function transcode(input, output) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(FFMPEG, [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", input,
      "-vf", `scale='min(${WIDTH},iw)':-2`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", String(CRF),
      "-c:a", "aac",
      "-b:a", `${AUDIO_KBPS}k`,
      "-movflags", "+faststart",
      output,
    ], { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(stderr.trim() || `ffmpeg terminó con código ${code}`));
    });
  });
}

async function optimize(path) {
  const before = (await stat(path)).size;
  const temporary = `${path}.rvdeploy.mp4`;
  try {
    await transcode(path, temporary);
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

const files = await walk(MEDIA_ROOT);
const results = await runPool(files, optimize);
const report = {
  concurrency: CONCURRENCY,
  width: WIDTH,
  crf: CRF,
  audioKbps: AUDIO_KBPS,
  files: files.length,
  changed: results.filter((result) => result.changed).length,
  errors: results.filter((result) => result.error).length,
  beforeBytes: results.reduce((sum, result) => sum + result.before, 0),
  afterBytes: results.reduce((sum, result) => sum + result.after, 0),
};
report.savedBytes = report.beforeBytes - report.afterBytes;

console.log(JSON.stringify(report, null, 2));
