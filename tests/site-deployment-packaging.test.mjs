import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function runScript(name, staging) {
  return execFileAsync(process.execPath, [resolve(ROOT, "scripts", name), staging], {
    cwd: ROOT,
    windowsHide: true,
  });
}

async function fixture() {
  const staging = await mkdtemp(join(tmpdir(), "rv-site-package-"));
  await Promise.all([
    mkdir(join(staging, "dist", "client", "data"), { recursive: true }),
    mkdir(join(staging, "dist", "client", "media"), { recursive: true }),
    mkdir(join(staging, "dist", "client", "_next"), { recursive: true }),
    mkdir(join(staging, "dist", "client", ".vite"), { recursive: true }),
  ]);
  return staging;
}

test("los previews reescriben también firmas file: antes de retirar el original", async (t) => {
  const staging = await fixture();
  t.after(() => rm(staging, { recursive: true, force: true }));
  const media = join(staging, "dist", "client", "media", "creative.png");
  const pixels = randomBytes(800 * 600 * 3);
  await sharp(pixels, { raw: { width: 800, height: 600, channels: 3 } }).png().toFile(media);
  const dataPath = join(staging, "dist", "client", "data", "record.json");
  await writeFile(dataPath, JSON.stringify({
    asset: {
      file: "/media/creative.png",
      transcriptSignature: "file:/media/creative.png",
      mimeType: "image/png",
    },
  }));

  await runScript("prepare-site-deployment-previews.mjs", staging);

  const value = JSON.parse(await readFile(dataPath, "utf8"));
  assert.match(value.asset.file, /^\/asset-previews\/[a-f0-9]{64}\.webp$/);
  assert.equal(value.asset.transcriptSignature, `file:${value.asset.file}`);
  assert.equal(value.asset.mimeType, "image/webp");
  await assert.rejects(access(media));
  await access(join(staging, "dist", "client", value.asset.file.slice(1)));
});

test("la deduplicación conserva referencias directas y file: auditables", async (t) => {
  const staging = await fixture();
  t.after(() => rm(staging, { recursive: true, force: true }));
  const mediaRoot = join(staging, "dist", "client", "media");
  const original = Buffer.from("identical deployment fixture");
  await Promise.all([
    writeFile(join(mediaRoot, "a.bin"), original),
    writeFile(join(mediaRoot, "b.bin"), original),
  ]);
  const dataPath = join(staging, "dist", "client", "data", "record.json");
  await writeFile(dataPath, JSON.stringify({
    file: "/media/b.bin",
    transcriptSignature: "file:/media/b.bin",
  }));

  await runScript("finalize-site-deployment-staging.mjs", staging);
  await runScript("audit-site-deployment-staging.mjs", staging);

  const value = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal(value.file, "/media/a.bin");
  assert.equal(value.transcriptSignature, "file:/media/a.bin");
  await access(join(mediaRoot, "a.bin"));
  await assert.rejects(access(join(mediaRoot, "b.bin")));
});
