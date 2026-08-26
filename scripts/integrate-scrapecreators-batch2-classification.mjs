#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const classificationPath = resolve(
  root,
  "work/scrapecreators-spain-leadgen-batch2/company-classification.json",
);
const companyMapPath = resolve(
  root,
  "scripts/data/scrapecreators-company-map.json",
);
const sourceCompaniesPath = resolve(root, "db/scrapecreators-companies.json");
const companiesIndexPath = resolve(root, "public/data/companies-index.json");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const clean = (value) => String(value || "").trim();
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const metaLibraryUrl = (pageId) =>
  `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ES&view_all_page_id=${pageId}`;
const validSourceUrl = (value) => {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (/(?:fbcdn\.net|cdninstagram\.com)$/i.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
};
const commercialLanding = (value) => {
  if (!validSourceUrl(value)) return false;
  const url = new URL(value);
  if (
    /(?:facebook\.com|instagram\.com|fb\.me|whatsapp\.com|wa\.me)$/i.test(
      url.hostname,
    )
  ) {
    return false;
  }
  return !/(?:privacy|privacidad|legal|terms|terminos|cookies|aviso|politica)/i.test(
    `${url.pathname}${url.search}`,
  );
};
const missingObservation = (label) =>
  `No se observó ${label} público en las piezas recuperadas.`;

const classification = await readJson(classificationPath);
const companyMap = await readJson(companyMapPath);
const sourceCompanies = await readJson(sourceCompaniesPath);
const companiesIndex = await readJson(companiesIndexPath);

if (!Array.isArray(classification.items) || classification.items.length !== 65) {
  throw new Error("Batch2: la clasificación debe contener exactamente 65 Page IDs");
}
if (!Array.isArray(sourceCompanies) || !Array.isArray(companiesIndex)) {
  throw new Error("Batch2: las fuentes de empresas no tienen el formato esperado");
}

const pageIds = classification.items.map((item) => clean(item.pageId));
if (new Set(pageIds).size !== pageIds.length || pageIds.some((id) => !/^\d{6,}$/.test(id))) {
  throw new Error("Batch2: hay Page IDs duplicadas o inválidas");
}

const sourceById = new Map(sourceCompanies.map((company) => [company.id, company]));
const indexById = new Map(companiesIndex.map((company) => [company.id, company]));
const newRows = [];
let matchedExisting = 0;
let quarantined = 0;
let updatedMapEntries = 0;

for (const item of classification.items) {
  const pageId = clean(item.pageId);
  const category = clean(item.classification);
  const companyId = clean(item.recommendedCompanyId) || null;
  const existingMap = companyMap.pageIds?.[pageId] || null;

  if (category === "quarantine") {
    if (companyId) throw new Error(`Batch2: cuarentena con companyId (${pageId})`);
    companyMap.pageIds[pageId] = {
      companyId: null,
      status: "quarantine",
      confidence: "low",
      note: clean(item.decisionReason) || "Fuera del alcance español de captación.",
    };
    quarantined += 1;
    updatedMapEntries += 1;
    continue;
  }

  if (!["matchedExisting", "companyNew", "adjacent"].includes(category)) {
    throw new Error(`Batch2: clasificación desconocida ${category} (${pageId})`);
  }
  if (!companyId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(companyId)) {
    throw new Error(`Batch2: companyId ausente o inválido (${pageId})`);
  }
  if (
    existingMap?.companyId &&
    existingMap.companyId !== companyId
  ) {
    throw new Error(
      `Batch2: ${pageId} ya pertenece a ${existingMap.companyId}, no a ${companyId}`,
    );
  }

  if (category === "matchedExisting") {
    if (!sourceById.has(companyId) && !indexById.has(companyId)) {
      throw new Error(`Batch2: la ficha existente no existe (${companyId})`);
    }
    matchedExisting += 1;
  } else {
    if (sourceById.has(companyId) || indexById.has(companyId)) {
      throw new Error(`Batch2: la nueva ficha ya existe (${companyId})`);
    }
    const evidenceLandingUrls = (item.evidence?.landingUrls || [])
      .map((entry) => clean(entry?.url || entry))
      .filter(commercialLanding)
      .slice(0, 3);
    const website = clean(item.website) || evidenceLandingUrls[0] || metaLibraryUrl(pageId);
    const commercial = item.commercial || {};
    const confidence = item.confidence === "high" ? "alta" : "media";
    const row = {
      id: companyId,
      name: clean(item.canonicalName),
      domain: clean(item.domain),
      website,
      country: "España",
      model:
        clean(commercial.modelObserved) ||
        (category === "adjacent"
          ? "Herramienta o servicio adyacente a la captación."
          : "Servicio de captación y generación de oportunidades comerciales."),
      offer:
        clean(commercial.offerObserved) ||
        clean(item.decisionReason) ||
        "Oferta comercial observada en anuncios dirigidos al mercado español.",
      priceLocal:
        clean(commercial.priceObserved) || missingObservation("un precio"),
      guarantee:
        clean(commercial.guaranteeObserved) || missingObservation("una garantía"),
      relevance:
        category === "adjacent" || confidence === "media" ? "Media" : "Alta",
      sources: unique([
        website,
        metaLibraryUrl(pageId),
        ...evidenceLandingUrls,
        ...(item.evidence?.adUrls || []).slice(0, 2),
      ]).filter(validSourceUrl),
      pageIds: [pageId],
      advertiserType: category === "adjacent" ? "adyacente" : "directo",
      confidence,
    };
    if (!row.name) throw new Error(`Batch2: ficha nueva sin nombre (${companyId})`);
    newRows.push(row);
    sourceById.set(companyId, row);
  }

  companyMap.pageIds[pageId] = {
    companyId,
    status: "matched",
    confidence: item.confidence === "high" ? "high" : "medium",
    note: clean(item.decisionReason) || "Identidad revisada en la tanda 2.",
  };
  updatedMapEntries += 1;

  const sourceRow = sourceById.get(companyId);
  if (sourceRow && sourceCompanies.includes(sourceRow)) {
    sourceRow.pageIds = unique([...(sourceRow.pageIds || []), pageId]);
    sourceRow.sources = unique([
      ...(sourceRow.sources || []),
      metaLibraryUrl(pageId),
      ...(item.evidence?.adUrls || []).slice(0, 1),
    ]).filter(validSourceUrl);
    if (!clean(sourceRow.domain) && clean(item.domain)) sourceRow.domain = clean(item.domain);
    if (
      (!clean(sourceRow.website) || /facebook\.com\/ads\/library/i.test(sourceRow.website)) &&
      clean(item.website)
    ) {
      sourceRow.website = clean(item.website);
    }
  }
}

const newIds = newRows.map((row) => row.id);
if (new Set(newIds).size !== newIds.length) {
  throw new Error("Batch2: hay IDs duplicados entre las fichas nuevas");
}
const allSourceRows = [
  ...sourceCompanies,
  ...newRows.sort((left, right) => left.name.localeCompare(right.name, "es")),
];
const allSourceIds = new Set(allSourceRows.map((row) => row.id));
if (allSourceIds.size !== allSourceRows.length) {
  throw new Error("Batch2: la fuente consolidada contiene IDs duplicados");
}

const pageOwners = new Map();
for (const row of allSourceRows) {
  for (const pageId of row.pageIds || []) {
    const owner = pageOwners.get(String(pageId));
    if (owner && owner !== row.id) {
      throw new Error(`Batch2: ${pageId} aparece en ${owner} y ${row.id}`);
    }
    pageOwners.set(String(pageId), row.id);
  }
}

companyMap.generatedAt = new Date().toISOString().slice(0, 10);
companyMap.note =
  "Unión revisada Page ID de Meta → ficha canónica. matched permite publicación; quarantine conserva hallazgos irrelevantes, no españoles o ambiguos sin atribuirlos.";

await Promise.all([
  writeFile(companyMapPath, `${JSON.stringify(companyMap, null, 2)}\n`, "utf8"),
  writeFile(sourceCompaniesPath, `${JSON.stringify(allSourceRows, null, 2)}\n`, "utf8"),
]);

console.log(
  JSON.stringify(
    {
      classified: classification.items.length,
      matchedExisting,
      newDirectCompanies: newRows.filter((row) => row.advertiserType === "directo").length,
      newAdjacentCompanies: newRows.filter((row) => row.advertiserType === "adyacente").length,
      quarantined,
      updatedMapEntries,
      sourceCompaniesBefore: sourceCompanies.length,
      sourceCompaniesAfter: allSourceRows.length,
    },
    null,
    2,
  ),
);
