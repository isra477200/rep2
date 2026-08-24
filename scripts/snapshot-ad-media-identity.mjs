#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coveragePath = resolve(root, "public/data/ad-coverage.json");
const outputPath = resolve(root, "public/data/ad-media-identity.json");

if (!existsSync(coveragePath))
  throw new Error("Primero genera public/data/ad-coverage.json");

const coverage = JSON.parse(readFileSync(coveragePath, "utf8"));
const items = (coverage.creativeFiles || []).map((item) => ({
  companyId: item.companyId,
  platform: item.platform,
  externalId: item.externalId,
  file: item.file,
  variantCount: Math.max(1, Number(item.variantCount || 1)),
}));

if (items.length < 900)
  throw new Error(
    `El snapshot de identidad es demasiado pequeño (${items.length}); se conservó el archivo anterior.`,
  );

const keys = new Set(
  items.map((item) => `${item.companyId}:${item.platform}:${item.externalId}`),
);
if (keys.size !== items.length)
  throw new Error("El snapshot contiene identidades duplicadas");

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schema: "redvitalia-ad-media-identity-v1",
      generatedAt: new Date().toISOString().slice(0, 10),
      note: "Unión versionada entre ficha canónica, plataforma, ID externo y archivo público. No contiene rutas internas ni resultados de campaña.",
      total: items.length,
      items,
    },
    null,
    1,
  )}\n`,
  "utf8",
);
console.log(`ad-media-identity.json: ${items.length} uniones versionadas`);
