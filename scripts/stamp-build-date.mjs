#!/usr/bin/env node
/**
 * Sella la fecha real de compilación (zona Europe/Madrid) en app/build-date.ts.
 * Se ejecuta en el paso "prebuild" antes de CADA compilación, así la fecha de
 * "CORTE" del portal siempre es la de la última subida sin tocar nada a mano.
 * Diseñado para NO romper nunca el build: ante cualquier error, deja el fichero
 * existente y sale con código 0.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const now = new Date();
  const tz = "Europe/Madrid";
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
  const day = get("day");
  const monthLong = get("month");
  const year = get("year");
  const ABBR = {
    enero: "ENE", febrero: "FEB", marzo: "MAR", abril: "ABR",
    mayo: "MAY", junio: "JUN", julio: "JUL", agosto: "AGO",
    septiembre: "SEP", octubre: "OCT", noviembre: "NOV", diciembre: "DIC",
  };
  const short = `${day} ${ABBR[monthLong.toLowerCase()] || monthLong.slice(0, 3).toUpperCase()} ${year}`;
  const long = `${day} ${monthLong} ${year}`;
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const out = `// Generado automáticamente por scripts/stamp-build-date.mjs en cada build. No editar a mano.
export const BUILD_DATE = ${JSON.stringify(short)};
export const BUILD_DATE_LONG = ${JSON.stringify(long)};
export const BUILD_DATE_ISO = ${JSON.stringify(iso)};
`;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  writeFileSync(resolve(root, "app/build-date.ts"), out);
  console.log(`build-date sellada: ${short}`);
} catch (e) {
  console.warn("stamp-build-date: no se pudo sellar la fecha, se mantiene la existente.", e && e.message);
}
process.exit(0);
