import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_MAP_PATH = "research/deep/public-id-map.json";

export function slugifyPublic(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 72);
}

async function readExisting(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return parsed.ids && typeof parsed.ids === "object" ? parsed.ids : {};
  } catch {
    return {};
  }
}

export async function buildPublicIdentityMap(rows, path = DEFAULT_MAP_PATH) {
  const existing = await readExisting(path);
  const ids = {};
  const used = new Set();

  for (const row of rows) {
    const internalId = String(row.internalId || row.id || "").replaceAll("-", "");
    const current = existing[internalId];
    if (current && /^[a-z0-9][a-z0-9-]{1,95}$/.test(current) && !used.has(current)) {
      ids[internalId] = current;
      used.add(current);
    }
  }

  const pending = rows
    .map((row) => ({
      ...row,
      internalId: String(row.internalId || row.id || "").replaceAll("-", ""),
    }))
    .filter((row) => row.internalId && !ids[row.internalId])
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "es", {
        sensitivity: "base",
      }) ||
      String(a.domain || "").localeCompare(String(b.domain || "")) ||
      String(a.country || "").localeCompare(String(b.country || "")) ||
      a.internalId.localeCompare(b.internalId),
    );

  for (const row of pending) {
    const base = slugifyPublic(row.name) || "empresa";
    const contextual = slugifyPublic(row.domain || row.country).slice(0, 28);
    const candidates = [base, contextual ? `${base}-${contextual}` : ""];
    let publicId = candidates.find((candidate) => candidate && !used.has(candidate));
    if (!publicId) {
      let suffix = 2;
      while (used.has(`${base}-${suffix}`)) suffix += 1;
      publicId = `${base}-${suffix}`;
    }
    ids[row.internalId] = publicId;
    used.add(publicId);
  }

  if (Object.keys(ids).length !== rows.length || used.size !== rows.length) {
    throw new Error("No se pudo construir una identidad pública biyectiva.");
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        schemaVersion: "rv-public-identity-v1",
        generatedAt: new Date().toISOString(),
        ids,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return new Map(Object.entries(ids));
}

export async function readPublicIdentityMap(path = DEFAULT_MAP_PATH) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return new Map(Object.entries(parsed.ids || {}));
}
