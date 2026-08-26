#!/usr/bin/env node
/**
 * Garantiza que toda fila del índice ligero tenga un archivo de detalle.
 * Migra body/sources que aún vivan en el índice y los vacía después para que
 * la carga inicial siga siendo pequeña y todas las fichas usen el mismo flujo.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "public/data/companies-index.json");
const detailsDirectory = resolve(root, "public/data/company-details");
const index = JSON.parse(readFileSync(indexPath, "utf8"));

mkdirSync(detailsDirectory, { recursive: true });
let created = 0;
let migrated = 0;

for (const company of index) {
  const detailPath = resolve(detailsDirectory, `${company.id}.json`);
  if (!existsSync(detailPath)) {
    writeFileSync(
      detailPath,
      `${JSON.stringify(
        {
          id: company.id,
          body: String(company.body || ""),
          sources: Array.isArray(company.sources) ? company.sources : [],
        },
        null,
        1,
      )}\n`,
    );
    created += 1;
  }
  if (company.body || company.sources?.length) migrated += 1;
  company.body = "";
  company.sources = [];
}

writeFileSync(indexPath, `${JSON.stringify(index, null, 1)}\n`);
console.log(
  `company-details: ${index.length} fichas · ${created} archivos creados · ${migrated} cargas retiradas del índice`,
);
