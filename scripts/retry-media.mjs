import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = "public/data";
const mediaDir = "public/media";
const files = (await readdir(dataDir)).filter((x) =>
  /^media-map-\d+\.json$/.test(x),
);
let attempted = 0,
  recovered = 0;

function cleanUrl(url) {
  return url.split("](")[0].replace(/[),.;]+$/, "");
}
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
  if (type.includes("pdf")) return "pdf";
  if (type.includes("png")) return "png";
  if (type.includes("svg")) return "svg";
  if (type.includes("webp")) return "webp";
  if (type.includes("video/mp4")) return "mp4";
  const direct = url
    .split("?")[0]
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|pdf|svg)$/)?.[1];
  if (direct) return direct === "jpeg" ? "jpg" : direct;
  return "jpg";
}

for (const file of files) {
  const rows = JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
  let changed = false;
  for (const row of rows) {
    if (row.ok) continue;
    attempted++;
    const url = cleanUrl(row.url);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(60000),
        headers: { "user-agent": "Mozilla/5.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = extension(type, url, buffer);
      const filename = `${row.companyId}-${String(row.order).padStart(3, "0")}.${ext}`;
      await writeFile(path.join(mediaDir, filename), buffer);
      Object.assign(row, {
        url,
        ok: true,
        file: `/media/${filename}`,
        bytes: buffer.length,
        contentType: type,
      });
      delete row.error;
      recovered++;
      changed = true;
    } catch (error) {
      row.url = url;
      row.error = String(error?.message || error);
      changed = true;
    }
  }
  if (changed) await writeFile(path.join(dataDir, file), JSON.stringify(rows));
}
console.log(
  JSON.stringify({ attempted, recovered, remaining: attempted - recovered }),
);
