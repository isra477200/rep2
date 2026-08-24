#!/usr/bin/env node
/**
 * Analiza la luminancia real de cada logo local (webp con alfa) y añade a
 * public/data/logos.json un campo `tone` por ficha:
 *   - "light"  → logo mayormente claro/blanco; invisible sobre fondo blanco,
 *                 debe renderizarse sobre chip oscuro.
 *   - "dark"   → logo mayormente oscuro; correcto sobre fondo claro.
 *   - "mixed"  → contraste suficiente en ambos fondos.
 *   - "opaque" → la imagen trae su propio fondo (sin alfa útil); se muestra tal cual.
 *
 * Uso: npm i --no-save sharp && node scripts/build-logo-tones.mjs
 * (sharp NO es dependencia del proyecto: el resultado queda horneado en logos.json)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST = path.join(ROOT, "public/data/logos.json");

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
let done = 0, light = 0, dark = 0, mixed = 0, opaque = 0, missing = 0;

for (const record of Object.values(manifest)) {
  if (!record || !record.file) continue;
  const file = path.join(ROOT, "public", record.file.replace(/^\//, ""));
  try {
    const { data, info } = await sharp(file)
      .resize(48, 48, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = info.width * info.height;
    let visible = 0, transparent = 0, sumLum = 0, lightPx = 0, darkPx = 0;
    for (let i = 0; i < px; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      if (a < 26) { transparent++; continue; }
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const weight = a / 255;
      visible += weight;
      sumLum += lum * weight;
      if (lum > 0.82) lightPx += weight;
      if (lum < 0.35) darkPx += weight;
    }
    let tone;
    if (transparent / px < 0.02) {
      tone = "opaque"; // fondo propio: se ve bien tal cual
    } else if (!visible) {
      tone = "light";
    } else {
      const mean = sumLum / visible;
      const lightRatio = lightPx / visible;
      const darkRatio = darkPx / visible;
      if (lightRatio > 0.55 || (mean > 0.72 && darkRatio < 0.2)) tone = "light";
      else if (darkRatio > 0.55 || mean < 0.3) tone = "dark";
      else tone = "mixed";
    }
    record.tone = tone;
    if (tone === "light") light++; else if (tone === "dark") dark++; else if (tone === "mixed") mixed++; else opaque++;
    done++;
  } catch {
    missing++;
  }
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`tone añadido a ${done} logos · light=${light} dark=${dark} mixed=${mixed} opaque=${opaque} · errores=${missing}`);
