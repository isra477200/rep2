import { mkdir, access, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CAPTURE_UNITS, CREATIVES, CREATIVE_FORMATS } from "../app/ejecucion/catalog.ts";

const root = process.cwd();
const baseDir = path.join(root, "public", "assets", "ejecucion", "base");
const outDir = path.join(root, "public", "assets", "ejecucion", "adaptations");

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const wrap = (text, max) => {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
};

const textBlock = (lines, x, y, size, lineHeight, fill, weight = 760) => lines
  .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`)
  .join("");

const overlay = (creative, format) => {
  const { width, height } = format;
  const portrait = height > width * 1.25;
  const route = Number(creative.id.split("-").at(-2)) - 1;
  const margin = Math.round(width * 0.07);
  const headlineSize = Math.round(width * (portrait ? 0.068 : 0.052));
  const lineHeight = Math.round(headlineSize * 1.03);
  const copySize = Math.max(22, Math.round(width * 0.022));
  const headline = wrap(creative.headline, portrait ? 24 : 30);
  const copy = wrap(creative.copy, portrait ? 44 : 62).slice(0, portrait ? 4 : 3);
  const eyebrow = `${creative.mode} · ${creative.route.toLocaleUpperCase("es")}`;
  const brand = creative.mode === "B2B" ? "REDVITALIA" : "CONCEPTO PARA CLIENTE";
  const id = escapeXml(creative.id.toUpperCase());

  if (route === 1) {
    const panelHeight = Math.round(height * (portrait ? 0.43 : 0.48));
    const panelY = height - panelHeight;
    return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${margin}" y="${panelY - margin / 2}" width="${width - margin * 2}" height="${panelHeight}" rx="${Math.round(width * 0.018)}" fill="#ffffff" fill-opacity="0.96"/>
      <text x="${margin * 1.45}" y="${panelY + margin * 0.5}" fill="#2f6fe4" font-size="${Math.round(width * 0.018)}" font-weight="800" letter-spacing="2" font-family="Arial">${escapeXml(eyebrow)}</text>
      ${textBlock(headline, margin * 1.45, panelY + margin * 1.25, headlineSize, lineHeight, "#101826", 800)}
      ${textBlock(copy, margin * 1.45, panelY + margin * 1.25 + headline.length * lineHeight + copySize * 1.3, copySize, Math.round(copySize * 1.28), "#46536a", 430)}
      <rect x="${margin * 1.45}" y="${height - margin * 1.25}" width="${Math.round(width * 0.32)}" height="${Math.round(width * 0.062)}" rx="${Math.round(width * 0.031)}" fill="#2f6fe4"/>
      <text x="${margin * 1.45 + Math.round(width * 0.16)}" y="${height - margin * 1.25 + Math.round(width * 0.04)}" text-anchor="middle" fill="#ffffff" font-size="${Math.round(width * 0.02)}" font-weight="800" font-family="Arial">${escapeXml(creative.cta)}</text>
      <text x="${width - margin * 1.45}" y="${height - margin * 0.42}" text-anchor="end" fill="#68758b" font-size="${Math.round(width * 0.012)}" font-weight="700" font-family="Arial">${escapeXml(brand)} · ${id}</text>
    </svg>`);
  }

  if (route === 2) {
    const panelWidth = portrait ? width : Math.round(width * 0.55);
    const panelHeight = portrait ? Math.round(height * 0.56) : height;
    const panelY = portrait ? height - panelHeight : 0;
    return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${panelY}" width="${panelWidth}" height="${panelHeight}" fill="#0d1b32" fill-opacity="0.97"/>
      <rect x="${margin}" y="${panelY + margin}" width="${Math.round(width * 0.12)}" height="5" fill="#66a7ff"/>
      <text x="${margin}" y="${panelY + margin * 1.65}" fill="#87baff" font-size="${Math.round(width * 0.018)}" font-weight="800" letter-spacing="2" font-family="Arial">${escapeXml(eyebrow)}</text>
      ${textBlock(headline, margin, panelY + margin * 2.5, headlineSize, lineHeight, "#ffffff", 800)}
      ${textBlock(copy, margin, panelY + margin * 2.5 + headline.length * lineHeight + copySize * 1.4, copySize, Math.round(copySize * 1.3), "#c9d6e8", 430)}
      <rect x="${margin}" y="${panelY + panelHeight - margin * 1.4}" width="${Math.round(width * 0.34)}" height="${Math.round(width * 0.064)}" rx="${Math.round(width * 0.01)}" fill="#ffffff"/>
      <text x="${margin + Math.round(width * 0.17)}" y="${panelY + panelHeight - margin * 1.4 + Math.round(width * 0.041)}" text-anchor="middle" fill="#0d1b32" font-size="${Math.round(width * 0.02)}" font-weight="800" font-family="Arial">${escapeXml(creative.cta)}</text>
      <text x="${margin}" y="${panelY + panelHeight - margin * 0.45}" fill="#87baff" font-size="${Math.round(width * 0.012)}" font-weight="700" font-family="Arial">${escapeXml(brand)} · ${id}</text>
    </svg>`);
  }

  const maxWidth = portrait ? width - margin * 2 : Math.round(width * 0.62);
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#071426" stop-opacity="0.96"/><stop offset="0.62" stop-color="#0b1d36" stop-opacity="0.72"/><stop offset="1" stop-color="#0b1d36" stop-opacity="0.08"/></linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="${margin}" y="${margin}" width="${Math.round(width * 0.14)}" height="${Math.round(width * 0.04)}" rx="${Math.round(width * 0.02)}" fill="#2f6fe4"/>
    <text x="${margin + Math.round(width * 0.07)}" y="${margin + Math.round(width * 0.027)}" text-anchor="middle" fill="#ffffff" font-size="${Math.round(width * 0.015)}" font-weight="800" font-family="Arial">${escapeXml(creative.mode)}</text>
    <text x="${margin}" y="${margin * 2.2}" fill="#9ec7ff" font-size="${Math.round(width * 0.018)}" font-weight="800" letter-spacing="2" font-family="Arial">${escapeXml(creative.route.toLocaleUpperCase("es"))}</text>
    ${textBlock(headline, margin, margin * 3.1, headlineSize, lineHeight, "#ffffff", 820)}
    ${textBlock(copy, margin, margin * 3.1 + headline.length * lineHeight + copySize * 1.6, copySize, Math.round(copySize * 1.3), "#d8e3f2", 430)}
    <rect x="${margin}" y="${height - margin * 1.7}" width="${Math.min(Math.round(width * 0.38), maxWidth)}" height="${Math.round(width * 0.068)}" rx="${Math.round(width * 0.034)}" fill="#ffffff"/>
    <text x="${margin + Math.min(Math.round(width * 0.19), maxWidth / 2)}" y="${height - margin * 1.7 + Math.round(width * 0.044)}" text-anchor="middle" fill="#142746" font-size="${Math.round(width * 0.021)}" font-weight="800" font-family="Arial">${escapeXml(creative.cta)}</text>
    <text x="${margin}" y="${height - margin * 0.48}" fill="#9ec7ff" font-size="${Math.round(width * 0.012)}" font-weight="700" font-family="Arial">${escapeXml(brand)} · ${id}</text>
  </svg>`);
};

const ensureBaseWebp = async (unit) => {
  const png = path.join(baseDir, path.basename(unit.image).replace(/\.webp$/, ".png"));
  const webp = path.join(baseDir, path.basename(unit.image));
  try {
    await access(webp);
  } catch {
    await sharp(png).resize(1600, 900, { fit: "cover", position: "attention" }).webp({ quality: 84, effort: 5 }).toFile(webp);
  }
};

const renderOne = async (creative, format) => {
  const unit = CAPTURE_UNITS.find((item) => item.id === creative.unitId);
  if (!unit) throw new Error(`Unidad ausente: ${creative.unitId}`);
  const base = path.join(root, "public", unit.image.replace(/^\//, ""));
  const destination = path.join(outDir, path.basename(creative.adaptations.find((item) => item.id === format.id).file));
  const position = ["estetica", "auditivos"].includes(unit.id) ? "left" : "right";
  let image = sharp(base).resize(format.width, format.height, { fit: "cover", position });
  if (!format.id.startsWith("google-")) image = image.composite([{ input: overlay(creative, format), blend: "over" }]);
  await image.jpeg({ quality: 84, mozjpeg: true }).toFile(destination);
};

await mkdir(outDir, { recursive: true });
if (!path.resolve(outDir).startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Directorio de salida fuera del proyecto");
for (const filename of await readdir(outDir)) {
  if (/^cr-[a-z0-9-]+\.(?:webp|jpg)$/i.test(filename)) await unlink(path.join(outDir, filename));
}
for (const unit of CAPTURE_UNITS) await ensureBaseWebp(unit);

const jobs = CREATIVES.flatMap((creative) => CREATIVE_FORMATS.map((format) => ({ creative, format })));
let cursor = 0;
const workers = Array.from({ length: 8 }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    await renderOne(job.creative, job.format);
  }
});
await Promise.all(workers);

console.log(JSON.stringify({ baseImages: CAPTURE_UNITS.length, concepts: CREATIVES.length, formats: CREATIVE_FORMATS.length, adaptations: jobs.length, output: outDir }, null, 2));
