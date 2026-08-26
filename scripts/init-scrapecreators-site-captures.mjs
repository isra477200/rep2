#!/usr/bin/env node
/** Añade de forma no destructiva las landings prioritarias a Site Captures. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refreshIndex } from "./capture-site-pages-browser.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workRoot = resolve(root, "work");
const pruneArgumentIndex = process.argv.indexOf("--prune-audit");
const pruneAuditPath = pruneArgumentIndex >= 0
  ? resolve(root, process.argv[pruneArgumentIndex + 1] || "")
  : null;
if (pruneArgumentIndex >= 0 && !process.argv[pruneArgumentIndex + 1]) {
  throw new Error("Falta PATH para --prune-audit");
}
if (pruneAuditPath) {
  const relativeAuditPath = relative(workRoot, pruneAuditPath);
  if (isAbsolute(relativeAuditPath) || relativeAuditPath.startsWith("..")) {
    throw new Error("La auditoría de poda debe permanecer dentro de work/");
  }
}
const targets = JSON.parse(
  await readFile(resolve(root, "scripts/data/scrapecreators-landing-targets.json"), "utf8"),
).items;
const sourceCompanies = JSON.parse(
  await readFile(resolve(root, "db/scrapecreators-companies.json"), "utf8"),
);
const outputDir = resolve(root, "public/data/site-captures");
await mkdir(outputDir, { recursive: true });

const roleLabels = {
  homepage: "Página principal",
  landing: "Landing comercial",
  conversion: "Conversión o contacto",
  pricing: "Precios u oferta",
  proof: "Prueba y resultados",
};
const normalizeUrl = (value) => {
  const url = new URL(value);
  url.hash = "";
  return url.href;
};
const nextPageId = (record, role, usedIds = null) => {
  const used = usedIds || new Set((record.pages || []).map((page) => page.id));
  const base = `${record.id}-${role}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

let created = 0;
let updated = 0;
let repaired = 0;
let pruned = 0;
for (const target of targets) {
  const path = resolve(outputDir, `${target.id}.json`);
  const requestedUrl = normalizeUrl(target.url);
  let record;
  if (existsSync(path)) {
    record = JSON.parse(await readFile(path, "utf8"));
  } else {
    record = {
      schemaVersion: "rv-site-captures-v1",
      id: target.id,
      name: target.name,
      primaryCountry: "España",
      markets: ["España"],
      website: requestedUrl,
      status: "pending",
      coverage: { planned: 0, captured: 0, blocked: 0, failed: 0 },
      language: { original: "es", translationStatus: "not_needed" },
      commercialRead: {
        headline: null,
        promise: null,
        audience: null,
        offer: null,
        mechanism: [],
        primaryCta: null,
        proof: null,
        price: null,
        guarantee: null,
        funnel: [],
      },
      pages: [],
    };
    created += 1;
  }
  const usedPageIds = new Set();
  for (const page of record.pages || []) {
    if (!page.id || usedPageIds.has(page.id)) {
      page.id = nextPageId(record, page.role, usedPageIds);
      repaired += 1;
    }
    usedPageIds.add(page.id);
  }
  const existingPage = (record.pages || []).find(
    (page) => normalizeUrl(page.requestedUrl) === requestedUrl,
  );
  if (!existingPage) {
    record.pages = [
      ...(record.pages || []),
      {
        id: nextPageId(record, target.role),
        role: target.role,
        label: roleLabels[target.role] || "Página comercial",
        requestedUrl,
        finalUrl: null,
        title: null,
        status: "pending",
        capturedAt: null,
        fullPage: true,
        image: null,
        thumbnail: null,
        text: null,
        issue: null,
        source: "scrapecreators_landing_target",
      },
    ];
    updated += 1;
  }
  record.website ||= requestedUrl;
  const planned = record.pages.length;
  const captured = record.pages.filter((page) => page.status === "captured").length;
  const blocked = record.pages.filter((page) => page.status === "blocked").length;
  const failed = record.pages.filter((page) => page.status === "failed").length;
  record.coverage = { planned, captured, blocked, failed };
  record.status = captured === planned && planned
    ? "complete"
    : captured || blocked
      ? "partial"
      : failed === planned && planned
        ? "failed"
        : "pending";
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

if (pruneAuditPath) {
  const audit = JSON.parse(await readFile(pruneAuditPath, "utf8"));
  if (audit.schema !== "redvitalia-scrapecreators-landing-target-audit-v1") {
    throw new Error("Esquema de auditoría de poda no reconocido");
  }
  const rejectedByCompany = new Map();
  for (const rejected of audit.rejected || []) {
    if (!rejected?.id || !rejected?.url) continue;
    if (!rejectedByCompany.has(rejected.id)) rejectedByCompany.set(rejected.id, new Set());
    rejectedByCompany.get(rejected.id).add(normalizeUrl(rejected.url));
  }
  const sourceCompanyIds = new Set(sourceCompanies.map((company) => company.id));
  const canonicalByCompany = new Map();
  for (const target of targets) {
    if (!canonicalByCompany.has(target.id)) canonicalByCompany.set(target.id, []);
    canonicalByCompany.get(target.id).push(normalizeUrl(target.url));
  }
  for (const [companyId, rejectedUrls] of rejectedByCompany) {
    const path = resolve(outputDir, `${companyId}.json`);
    if (!existsSync(path)) continue;
    const record = JSON.parse(await readFile(path, "utf8"));
    const before = (record.pages || []).length;
    record.pages = (record.pages || []).filter((page) => {
      const safePending =
        page.status === "pending" &&
        !page.finalUrl &&
        !page.capturedAt &&
        !page.image &&
        !page.thumbnail &&
        !page.text;
      return !(safePending && rejectedUrls.has(normalizeUrl(page.requestedUrl)));
    });
    const removed = before - record.pages.length;
    if (!removed) continue;
    pruned += removed;
    const planned = record.pages.length;
    const captured = record.pages.filter((page) => page.status === "captured").length;
    const blocked = record.pages.filter((page) => page.status === "blocked").length;
    const failed = record.pages.filter((page) => page.status === "failed").length;
    record.coverage = { planned, captured, blocked, failed };
    if (!planned && sourceCompanyIds.has(companyId) && !canonicalByCompany.has(companyId)) {
      record.website = null;
      record.status = "no_url";
      record.noUrlReason = "No queda una URL comercial estable aprobada tras la auditoría local.";
    } else {
      record.website = record.pages[0]?.requestedUrl || canonicalByCompany.get(companyId)?.[0] || null;
      record.status = captured === planned && planned
        ? "complete"
        : captured || blocked
          ? "partial"
          : failed === planned && planned
            ? "failed"
            : "pending";
      delete record.noUrlReason;
    }
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }
}

// Las fichas sin web propia también necesitan un manifiesto explícito para que
// la interfaz diga "sin URL" en vez de aparentar que no se investigaron.
const targetedIds = new Set(targets.map((target) => target.id));
for (const company of sourceCompanies) {
  if (targetedIds.has(company.id)) continue;
  const path = resolve(outputDir, `${company.id}.json`);
  if (existsSync(path)) continue;
  const record = {
    schemaVersion: "rv-site-captures-v1",
    id: company.id,
    name: company.name,
    primaryCountry: "España",
    markets: ["España"],
    website: null,
    status: "no_url",
    coverage: { planned: 0, captured: 0, blocked: 0, failed: 0 },
    language: { original: "es", translationStatus: "not_needed" },
    commercialRead: {
      headline: null,
      promise: null,
      audience: company.model || null,
      offer: company.offer || null,
      mechanism: [],
      primaryCta: null,
      proof: null,
      price: null,
      guarantee: null,
      funnel: [],
    },
    pages: [],
    noUrlReason: "No se localizó una web o landing pública distinta de la ficha de Meta Ads.",
  };
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  created += 1;
}
const index = await refreshIndex(root);
console.log(`Site Captures ScrapeCreators: ${created} nuevos, ${updated} páginas añadidas, ${repaired} IDs reparados, ${pruned} pendientes rechazados retirados; ${index.stats.records} fichas totales.`);
