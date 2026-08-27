#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "public", "data");
const readJson = async (name) =>
  JSON.parse(await readFile(path.join(dataRoot, name), "utf8"));
const writeJson = (name, value, spaces = 2) =>
  writeFile(path.join(dataRoot, name), `${JSON.stringify(value, null, spaces)}\n`, "utf8");

const [quality, summary, audit, portalQuality, finalAudit] = await Promise.all([
  readJson("logo-quality.json"),
  readJson("summary.json"),
  readJson("audit.json"),
  readJson("portal-quality.json"),
  readJson("final-audit.json"),
]);

summary.logos = quality;
if (summary.portalQuality) summary.portalQuality.brands = quality;
audit.logoQuality = quality;
portalQuality.brands = quality;
finalAudit.totals.authenticBrandAssets = quality.authentic;
finalAudit.totals.neutralLogoFallbacks = quality.fallback;
finalAudit.documentedLimitations.neutralLogoFallbacks = quality.fallback;

await Promise.all([
  writeJson("summary.json", summary),
  writeJson("audit.json", audit),
  writeJson("portal-quality.json", portalQuality, 0),
  writeJson("final-audit.json", finalAudit),
]);

console.log(
  `Identidad sincronizada: ${quality.authentic}/${quality.total} marcas verificadas · ${quality.fallback} respaldos honestos.`,
);
