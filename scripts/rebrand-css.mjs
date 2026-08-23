#!/usr/bin/env node
/**
 * Rebranding automático del CSS: convierte la paleta verde original en un
 * sistema azul/neutro tipo "producto Google/Microsoft".
 * Regla: colores verdes saturados → azul primario (hue 217);
 *        verdes oscuros/apagados (superficies) → grises neutros fríos;
 *        verdes muy claros (fondos) → azules muy claros.
 * Uso: node scripts/rebrand-css.mjs app/globals.css app/market-insights.css app/completion.css
 */
import { readFileSync, writeFileSync } from "node:fs";

const BLUE_HUE = 217;

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}
function hslToRgb(h, s, l) {
  h /= 360;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/** verde = hue 80–200 con algo de saturación */
const isGreen = (h, s) => h >= 80 && h <= 200 && s > 0.06;

function mapRgb(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (!isGreen(h, s)) return null;
  if (l >= 0.82) return hslToRgb(BLUE_HUE, Math.min(0.85, s + 0.15), Math.min(0.97, l + 0.01)); // fondos claros → azul claro
  if (s >= 0.4 && l >= 0.2 && l <= 0.72) return hslToRgb(BLUE_HUE, Math.min(0.9, s), l); // acentos → azul
  if (l < 0.2) return hslToRgb(222, 0.12, l * 0.9); // superficies oscuras → gris azulado casi negro
  return hslToRgb(222, Math.min(0.14, s * 0.35), l); // apagados → neutro frío
}

for (const file of process.argv.slice(2)) {
  let css = readFileSync(file, "utf8");
  let hexCount = 0, rgbaCount = 0;
  css = css.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) => {
    const [r, g, b] = hexToRgb(m);
    const mapped = mapRgb(r, g, b);
    if (!mapped) return m;
    hexCount++;
    return toHex(...mapped);
  });
  css = css.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\.?[\d.]+)\)/g, (m, r, g, b, a) => {
    const mapped = mapRgb(Number(r), Number(g), Number(b));
    if (!mapped) return m;
    rgbaCount++;
    return `rgba(${mapped[0]},${mapped[1]},${mapped[2]},${a})`;
  });
  writeFileSync(file, css);
  console.log(`${file}: ${hexCount} hex + ${rgbaCount} rgba recoloreados`);
}
