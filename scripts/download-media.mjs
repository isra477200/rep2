import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath, mediaDir] = process.argv;
if (!inputPath || !outputPath || !mediaDir)
  throw new Error("Uso: input output mediaDir");

const items = JSON.parse(await readFile(inputPath, "utf8"));
await mkdir(mediaDir, { recursive: true });

function extension(type, url, buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "jpg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  )
    return "png";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF")
    return "pdf";
  if (
    buffer
      .toString("utf8", 0, Math.min(buffer.length, 256))
      .trimStart()
      .startsWith("<svg")
  )
    return "svg";
  if (type?.includes("png")) return "png";
  if (type?.includes("svg")) return "svg";
  if (type?.includes("webp")) return "webp";
  if (type?.includes("gif")) return "gif";
  if (type?.includes("video/mp4")) return "mp4";
  if (type?.includes("video/webm")) return "webm";
  if (type?.includes("pdf")) return "pdf";
  const clean = url.split("?")[0].toLowerCase();
  const direct = clean.match(
    /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|pdf|svg)$/,
  )?.[1];
  if (direct) return direct === "jpeg" ? "jpg" : direct;
  return "jpg";
}

let index = 0;
const results = [];
async function worker() {
  while (index < items.length) {
    const current = items[index++];
    try {
      const response = await fetch(current.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error("vacío");
      const ext = extension(type, current.url, buffer);
      const filename = `${current.companyId}-${String(current.order).padStart(3, "0")}.${ext}`;
      await writeFile(path.join(mediaDir, filename), buffer);
      results.push({
        ...current,
        ok: true,
        file: `/media/${filename}`,
        bytes: buffer.length,
        contentType: type,
      });
    } catch (error) {
      results.push({
        ...current,
        ok: false,
        error: String(error?.message || error),
      });
    }
  }
}

await Promise.all(Array.from({ length: 10 }, worker));
results.sort(
  (a, b) => a.companyId.localeCompare(b.companyId) || a.order - b.order,
);
await writeFile(outputPath, JSON.stringify(results));
console.log(
  JSON.stringify({
    total: results.length,
    ok: results.filter((x) => x.ok).length,
    failed: results.filter((x) => !x.ok).length,
  }),
);
