import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const portalDir = resolve(scriptDir, "..");
const workDir = resolve(portalDir, "..");
const workspaceDir = resolve(portalDir, "..", "..");
const editorialPath = resolve(portalDir, "public/data/editorial.json");
const companiesPath = resolve(portalDir, "public/data/companies.json");
const blueprintSourcePath = resolve(workDir, "phase2_notion_final.md");
const handoffPath = resolve(workspaceDir, "agent-handoffs/editorial-public-reconstruction.json");
const privateIdMapPath = resolve(portalDir, "research/deep/public-id-map.json");

const [editorial, companies, blueprintSource, handoff, privateIdMap] = await Promise.all([
  readFile(editorialPath, "utf8").then(JSON.parse),
  readFile(companiesPath, "utf8").then(JSON.parse),
  readFile(blueprintSourcePath, "utf8"),
  readFile(handoffPath, "utf8").then(JSON.parse),
  readFile(privateIdMapPath, "utf8").then(JSON.parse),
]);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const publicCompanyIds = new Set(companies.map((company) => company.id));
const occurrencesByTab = new Map(["blueprint", "report", "execution"].map((tab) => [
  tab,
  handoff.occurrences.filter((row) => row.tab === tab).sort((a, b) => a.tabOrdinal - b.tabOrdinal),
]));

for (const occurrence of handoff.occurrences) {
  if (occurrence.targetType === "company" && (!occurrence.publicId || !publicCompanyIds.has(occurrence.publicId))) {
    throw new Error(`Referencia empresarial sin ficha pública: ${occurrence.replacementText} (${occurrence.publicId || "sin ID"}).`);
  }
  if (occurrence.targetType === "company" && occurrence.publicHref !== `?empresa=${occurrence.publicId}`) {
    throw new Error(`Enlace público incoherente para ${occurrence.replacementText}.`);
  }
}

function renderOccurrence(row) {
  const label = escapeHtml(row.replacementText);
  return row.targetType === "company"
    ? `<a href="?empresa=${escapeHtml(row.publicId)}">${label}</a>`
    : label;
}

function replaceMentionsByOrder(body, rows) {
  let cursor = 0;
  const next = body.replace(
    /<mention-(?:page|database|user)\b[^>]*>[\s\S]*?<\/mention-(?:page|database|user)>/gi,
    () => {
      const row = rows[cursor++];
      if (!row) throw new Error("Hay más menciones que resoluciones autoritativas.");
      return renderOccurrence(row);
    },
  );
  if (cursor !== rows.length) throw new Error(`Resoluciones no consumidas: ${rows.length - cursor}.`);
  return next;
}

function buildBlueprint(source) {
  return replaceMentionsByOrder(source, occurrencesByTab.get("blueprint"))
    .replace(/^<callout\b[^>]*>\s*$/gim, "")
    .replace(/^<\/callout>\s*$/gim, "")
    .replace(/^<table_of_contents\s*\/>\s*$/gim, "")
    .replace(/^\t/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function repairReport(source) {
  const [blueprintReference] = occurrencesByTab.get("report");
  return source
    .replace(/Acceso directo:\s*(?=\n)/, `Acceso directo: ${renderOccurrence(blueprintReference)}.`)
    .trim();
}

function repairExecution(source) {
  const rows = occurrencesByTab.get("execution");
  const byContext = new Map(rows.map((row) => [row.context, row]));
  const analysis = renderOccurrence(byContext.get("decision.source.analysis"));
  const comparison = renderOccurrence(byContext.get("decision.source.world_comparison"));
  let body = source.replace(
    /Esta decisión se fundamenta en el análisis estratégico consolidado \([\s\S]*?(?=\n# La promesa que debe ordenar todo)/,
    `Esta decisión se fundamenta en ${analysis} y en ${comparison}.`,
  );
  const transfers = [
    ["Eventos, atribución y routing", "transfer.events_attribution_routing"],
    ["Agenda y ecosistema vertical", "transfer.agenda_vertical_ecosystem"],
    ["Catálogo y experiencia gestionada", "transfer.catalog_managed_experience"],
    ["Capacidad y feedback post-reunión", "transfer.capacity_post_meeting_feedback"],
    ["Productos por intención", "transfer.products_by_intent"],
    ["CRM, scoring y reason codes", "transfer.crm_scoring_reason_codes"],
  ];
  for (const [piece, context] of transfers) {
    const escaped = piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(<td>${escaped}<\\/td>\\s*<td>)\\s*(?=<td>)`, "i");
    body = body.replace(pattern, `$1${renderOccurrence(byContext.get(context))}</td>\n`);
  }
  const sources = [
    byContext.get("sources.canonical_base"),
    byContext.get("sources.blueprint"),
    byContext.get("sources.strategic_report"),
  ].map((row) => `- ${renderOccurrence(row)}`).join("\n");
  body = body.replace(/# Fuentes\s*\n-\s*\n-\s*\n-\s*\n---/, `# Fuentes públicas de esta sección\n${sources}\n---`);
  return body.trim();
}

const next = {
  ...editorial,
  generatedAt: new Date().toISOString(),
  blueprint: { ...editorial.blueprint, body: buildBlueprint(blueprintSource) },
  report: { ...editorial.report, body: repairReport(editorial.report.body) },
  execution: { ...editorial.execution, body: repairExecution(editorial.execution.body) },
};

const serialized = JSON.stringify(next);
const forbidden = [
  /<\/?mention-(?:page|database|user)\b/i,
  /https?:\/\/(?:www\.)?(?:app\.)?notion\.(?:com|so|site)\b/i,
];
for (const pattern of forbidden) if (pattern.test(serialized)) throw new Error(`El editorial público conserva una referencia privada: ${pattern}`);
for (const privateId of Object.keys(privateIdMap.ids || {})) if (serialized.toLowerCase().includes(privateId.toLowerCase())) throw new Error(`El editorial público conserva un identificador privado.`);

for (const [key, tab] of Object.entries({ blueprint: next.blueprint, report: next.report, execution: next.execution })) {
  if (!tab?.title?.trim() || !tab?.body?.trim()) throw new Error(`La pestaña editorial ${key} está vacía.`);
  if (/<td>\s*(?:<\/td>)?\s*(?=<td>|<\/tr>)/i.test(tab.body)) throw new Error(`La pestaña editorial ${key} conserva una celda vacía.`);
  if (/^\s*[-*]\s*$/m.test(tab.body)) throw new Error(`La pestaña editorial ${key} conserva una viñeta vacía.`);
}

const companyLinks = [...serialized.matchAll(/href=\\?"\?empresa=([^"\\]+)/g)].map((match) => match[1]);
if (companyLinks.length !== handoff.exactTotals.companyReferences) throw new Error(`Referencias empresariales: ${companyLinks.length} en vez de ${handoff.exactTotals.companyReferences}.`);
const top15Expected = handoff.top15.map((row) => row.publicId);
const blueprintCompanyLinks = [...next.blueprint.body.matchAll(/href="\?empresa=([^"]+)/g)].map((match) => match[1]);
if (JSON.stringify(blueprintCompanyLinks.slice(0, 15)) !== JSON.stringify(top15Expected)) throw new Error("El Top 15 no conserva el orden autoritativo.");

const temporary = `${editorialPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(next)}\n`, "utf8");
await rename(temporary, editorialPath);
console.log(JSON.stringify({
  tabs: 3,
  referencesResolved: handoff.exactTotals.brokenReferences,
  companyReferences: companyLinks.length,
  uniqueCompanies: new Set(companyLinks).size,
  documentReferences: handoff.exactTotals.documentReferences,
  emptyReferenceCells: 0,
  emptySourceBullets: 0,
  privateReferences: 0,
}, null, 2));
