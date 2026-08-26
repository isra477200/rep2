#!/usr/bin/env node

/**
 * Audita y promociona una propuesta de targets de landing ya generada.
 *
 * La auditoría no usa red. La promoción exige que propuesta, auditoría y
 * fuentes sigan coincidiendo por SHA-256; conserva todos los targets previos,
 * excluye las decisiones rechazadas y crea un backup antes de escribir.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLandingTargetProposal,
  inspectCommercialUrl,
  targetIdentity,
} from "./update-scrapecreators-landing-targets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const WORK_ROOT = resolve(ROOT, "work");
const DEFAULTS = {
  normalized: resolve(ROOT, "db/scrapecreators-spain-leadgen.json"),
  companyMap: resolve(ROOT, "scripts/data/scrapecreators-company-map.json"),
  companies: resolve(ROOT, "public/data/companies-index.json"),
  companyDetails: resolve(ROOT, "public/data/company-details"),
  targets: resolve(ROOT, "scripts/data/scrapecreators-landing-targets.json"),
  proposal: resolve(WORK_ROOT, "scrapecreators-landing-targets-proposal.json"),
  audit: resolve(WORK_ROOT, "scrapecreators-landing-targets-audit.json"),
  backups: resolve(WORK_ROOT, "backups"),
};

const AUDIT_SCHEMA = "redvitalia-scrapecreators-landing-target-audit-v1";
const cleanText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const hashText = (value) => createHash("sha256").update(value).digest("hex");
const hashJson = (value) => hashText(JSON.stringify(value));
const asPath = (value) => (isAbsolute(value) ? resolve(value) : resolve(ROOT, value));
const isInside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

const usage = () => console.log(`
Auditoría/promoción segura de targets de landing

  --audit                    Genera la auditoría ligada por hashes.
  --promote                  Promociona solo las filas aceptadas por la auditoría.
  --proposal PATH            Propuesta dentro de work/.
  --audit-file PATH          Auditoría dentro de work/.
  --baseline PATH            Backup canónico base para reauditar una promoción previa.
  --reject id=motivo         Rechazo manual documentado; se puede repetir.
  --normalized PATH          Corpus normalizado alternativo (solo auditoría).
  --company-map PATH         Mapa de Page IDs alternativo (solo auditoría).
  --companies PATH           Índice de fichas alternativo (solo auditoría).
  --company-details PATH     Directorio de fichas alternativo (solo auditoría).
  --targets PATH             Target de entrada; promoción limitada al canónico.
  --help                     Muestra esta ayuda.

No realiza llamadas de red ni capturas.
`);

const parseArgs = (argv) => {
  const options = { mode: null, baseline: null, rejections: new Map(), ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`Falta valor para ${arg}`);
      return value;
    };
    const setMode = (mode) => {
      if (options.mode && options.mode !== mode) throw new Error("Elige --audit o --promote, no ambos");
      options.mode = mode;
    };
    if (arg === "--audit") setMode("audit");
    else if (arg === "--promote") setMode("promote");
    else if (arg === "--proposal") options.proposal = asPath(next());
    else if (arg === "--audit-file") options.audit = asPath(next());
    else if (arg === "--baseline") options.baseline = asPath(next());
    else if (arg === "--normalized") options.normalized = asPath(next());
    else if (arg === "--company-map") options.companyMap = asPath(next());
    else if (arg === "--companies") options.companies = asPath(next());
    else if (arg === "--company-details") options.companyDetails = asPath(next());
    else if (arg === "--targets") options.targets = asPath(next());
    else if (arg === "--reject") {
      const specification = next();
      const separator = specification.indexOf("=");
      if (separator < 1 || !cleanText(specification.slice(separator + 1))) {
        throw new Error("--reject debe usar id=motivo");
      }
      options.rejections.set(
        cleanText(specification.slice(0, separator)),
        cleanText(specification.slice(separator + 1)),
      );
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else throw new Error(`Argumento desconocido: ${arg}`);
  }
  if (!options.mode) throw new Error("Debes indicar --audit o --promote");
  return options;
};

const readJsonSource = async (path) => {
  const raw = await readFile(path, "utf8");
  return { path, raw, json: JSON.parse(raw), sha256: hashText(raw) };
};

const readDetailsSource = async (directory) => {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      const raw = await readFile(path, "utf8");
      return { name: entry.name, raw, json: JSON.parse(raw) };
    }),
  );
  const hash = createHash("sha256");
  for (const file of files) hash.update(file.name).update("\0").update(file.raw).update("\0");
  return { json: files.map((file) => file.json), sha256: hash.digest("hex") };
};

const loadSources = async (paths) => {
  const [normalized, companyMap, companies, targets, companyDetails] = await Promise.all([
    readJsonSource(paths.normalized),
    readJsonSource(paths.companyMap),
    readJsonSource(paths.companies),
    readJsonSource(paths.targets),
    readDetailsSource(paths.companyDetails),
  ]);
  return {
    normalized,
    companyMap,
    companies,
    targets,
    companyDetails,
    hashes: {
      normalized: normalized.sha256,
      companyMap: companyMap.sha256,
      companiesIndex: companies.sha256,
      companyDetails: companyDetails.sha256,
      canonicalTargets: targets.sha256,
    },
  };
};

const atomicWriteJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
};

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const decisionKey = (target) => `${target.id}\0${targetIdentity(target.url)}`;

export function createLandingTargetAudit({
  proposal,
  proposalSha256,
  currentTargets,
  expectedProposal,
  companyMap,
  companies,
  sourceHashes,
  manualRejections = new Map(),
  observedCanonical = null,
  observedCanonicalSha256 = null,
}) {
  const currentItems = asArray(currentTargets?.items);
  const proposedItems = asArray(proposal?.items);
  const expectedItems = asArray(expectedProposal?.document?.items);
  if (!sameJson(proposedItems, expectedItems)) {
    throw new Error("La propuesta ya no coincide con el selector y las fuentes actuales");
  }
  if (!sameJson(proposedItems.slice(0, currentItems.length), currentItems)) {
    throw new Error("La propuesta no conserva íntegramente el prefijo canónico");
  }

  const additions = proposedItems.slice(currentItems.length);
  const expectedAdditions = asArray(expectedProposal?.additions);
  if (!sameJson(additions, expectedAdditions)) {
    throw new Error("Las adiciones no coinciden con la propuesta regenerada");
  }
  const additionKeys = new Set(additions.map(decisionKey));
  const observedItems = asArray(observedCanonical?.items);
  const observedItemsHash = observedCanonical ? hashJson(observedItems) : null;
  if (observedCanonical && observedItemsHash !== hashJson(currentItems)) {
    if (!sameJson(observedItems.slice(0, currentItems.length), currentItems)) {
      throw new Error("El canónico observado no conserva el baseline íntegro");
    }
    const observedAdditions = observedItems.slice(currentItems.length);
    if (observedAdditions.some((item) => !additionKeys.has(decisionKey(item)))) {
      throw new Error("El canónico observado contiene filas ajenas a la propuesta");
    }
  }
  const companyIds = new Set(asArray(companies).map((company) => company.id));
  const matchedPagesByCompany = new Map();
  for (const [pageId, mapping] of Object.entries(companyMap?.pageIds || {})) {
    if (mapping?.status !== "matched" || !mapping.companyId) continue;
    if (!matchedPagesByCompany.has(mapping.companyId)) matchedPagesByCompany.set(mapping.companyId, []);
    matchedPagesByCompany.get(mapping.companyId).push(String(pageId));
  }
  const decisions = new Map(
    asArray(expectedProposal?.decisions).map((decision) => [decisionKey(decision), decision]),
  );
  const occurrenceCount = new Map();
  for (const item of proposedItems) {
    const identity = targetIdentity(item.url);
    if (identity) occurrenceCount.set(identity, (occurrenceCount.get(identity) || 0) + 1);
  }

  const reviewed = additions.map((target) => {
    const identity = targetIdentity(target.url);
    const inspected = inspectCommercialUrl(target.url);
    const sourceDecision = decisions.get(decisionKey(target));
    const pageIds = matchedPagesByCompany.get(target.id) || [];
    const checks = {
      knownCompany: companyIds.has(target.id),
      matchedPageId: pageIds.length > 0,
      commercialUrl: inspected.accepted,
      https: inspected.accepted && inspected.url.startsWith("https://"),
      uniqueUrl: Boolean(identity) && occurrenceCount.get(identity) === 1,
      reproducibleFromSources: Boolean(sourceDecision),
      plausibleIdentity: Boolean(
        sourceDecision && (
          sourceDecision.ownDomain ||
          sourceDecision.brandAligned ||
          inspected.hasOfferPath ||
          sourceDecision.sources?.includes("company_website")
        )
      ),
    };
    const failedChecks = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([check]) => check);
    const manualReason = manualRejections.get(target.id) || manualRejections.get(decisionKey(target));
    const status = failedChecks.length || manualReason ? "rejected" : "accepted";
    const reason = failedChecks.length
      ? `Fallo automático: ${failedChecks.join(", ")}`
      : manualReason || "URL comercial plausible y reproducible en evidencia local";
    return {
      id: target.id,
      name: target.name,
      url: inspected.accepted ? inspected.url : target.url,
      identity,
      hostname: inspected.accepted ? inspected.hostname : null,
      role: target.role,
      pageIds: [...pageIds].sort(),
      sources: sourceDecision ? [...sourceDecision.sources].sort() : [],
      ownDomain: Boolean(sourceDecision?.ownDomain),
      brandAligned: Boolean(sourceDecision?.brandAligned),
      checks,
      status,
      reason,
    };
  });
  const unusedManualRejections = [...manualRejections.keys()].filter(
    (key) => !reviewed.some((item) => item.id === key || decisionKey(item) === key),
  );
  if (unusedManualRejections.length) {
    throw new Error(`Rechazos manuales sin candidato: ${unusedManualRejections.join(", ")}`);
  }
  const acceptedKeys = new Set(
    reviewed.filter((item) => item.status === "accepted").map(decisionKey),
  );
  const acceptedItems = additions.filter((item) => acceptedKeys.has(decisionKey(item)));
  const rejected = reviewed.filter((item) => item.status === "rejected");
  return {
    schema: AUDIT_SCHEMA,
    generatedAt: new Date().toISOString(),
    reviewMethod: "Reglas reproducibles + revisión explícita de identidad, Page ID y plausibilidad",
    proposalSha256,
    sourceHashes: { ...sourceHashes },
    observedCanonicalSha256,
    observedCanonicalItemsHash: observedItemsHash,
    initialItemsHash: hashJson(currentItems),
    proposalItemsHash: hashJson(proposedItems),
    expectedPromotedItemsHash: hashJson([...currentItems, ...acceptedItems]),
    existingCount: currentItems.length,
    candidateCount: additions.length,
    acceptedCount: acceptedItems.length,
    rejectedCount: rejected.length,
    noLoss: true,
    rejected: rejected.map(({ id, name, url, reason }) => ({ id, name, url, reason })),
    items: reviewed,
  };
}

export function verifyHashBindings({ audit, proposalRaw, currentSourceHashes, allowPromoted = false }) {
  if (audit?.schema !== AUDIT_SCHEMA) throw new Error("Esquema de auditoría no reconocido");
  if (hashText(proposalRaw) !== audit.proposalSha256) throw new Error("Hash de propuesta no coincide");
  for (const [source, expectedHash] of Object.entries(audit.sourceHashes || {})) {
    if (allowPromoted && source === "canonicalTargets") continue;
    if (currentSourceHashes[source] !== expectedHash) {
      throw new Error(`Hash de fuente no coincide: ${source}`);
    }
  }
  return true;
}

export function prepareAuditedPromotion({ proposal, audit, currentTargets }) {
  const currentItems = asArray(currentTargets?.items);
  const currentItemsHash = hashJson(currentItems);
  if (currentItemsHash === audit.expectedPromotedItemsHash) {
    return { alreadyPromoted: true, document: currentTargets, accepted: [], rejected: audit.rejected };
  }
  const proposedItems = asArray(proposal?.items);
  if (hashJson(proposedItems) !== audit.proposalItemsHash) {
    throw new Error("Los items de la propuesta no coinciden con la auditoría");
  }
  const baselineItems = proposedItems.slice(0, audit.existingCount);
  const additions = proposedItems.slice(audit.existingCount);
  let reconciling = false;
  if (currentItemsHash === audit.initialItemsHash) {
    if (!sameJson(baselineItems, currentItems)) {
      throw new Error("La promoción perdería o alteraría targets existentes");
    }
  } else {
    if (currentItemsHash !== audit.observedCanonicalItemsHash) {
      throw new Error("El conjunto canónico cambió desde la auditoría");
    }
    if (!sameJson(currentItems.slice(0, baselineItems.length), baselineItems)) {
      throw new Error("La reconciliación perdería o alteraría el baseline");
    }
    const allowedKeys = new Set(additions.map(decisionKey));
    if (currentItems.slice(baselineItems.length).some((item) => !allowedKeys.has(decisionKey(item)))) {
      throw new Error("La reconciliación eliminaría filas ajenas a la propuesta");
    }
    reconciling = true;
  }
  const auditByKey = new Map(asArray(audit.items).map((item) => [decisionKey(item), item]));
  if (auditByKey.size !== additions.length || audit.candidateCount !== additions.length) {
    throw new Error("La auditoría no cubre exactamente todas las adiciones");
  }
  const accepted = [];
  for (const target of additions) {
    const review = auditByKey.get(decisionKey(target));
    if (!review) throw new Error(`Target sin auditoría: ${target.id}`);
    if (review.status === "accepted") {
      if (Object.values(review.checks || {}).some((passed) => passed !== true)) {
        throw new Error(`Target aceptado con controles fallidos: ${target.id}`);
      }
      accepted.push(target);
    } else if (review.status !== "rejected") {
      throw new Error(`Decisión de auditoría inválida: ${target.id}`);
    }
  }
  const promotedItems = [...baselineItems, ...accepted];
  if (hashJson(promotedItems) !== audit.expectedPromotedItemsHash) {
    throw new Error("El resultado promocionado no coincide con el hash aprobado");
  }
  if (!sameJson(promotedItems.slice(0, baselineItems.length), baselineItems)) {
    throw new Error("Fallo de no-loss en targets existentes");
  }
  return {
    alreadyPromoted: false,
    reconciling,
    document: { ...proposal, generatedAt: new Date().toISOString().slice(0, 10), items: promotedItems },
    accepted,
    rejected: audit.rejected,
  };
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  for (const [label, path] of Object.entries({
    normalized: options.normalized,
    companyMap: options.companyMap,
    companies: options.companies,
    companyDetails: options.companyDetails,
    targets: options.targets,
    proposal: options.proposal,
  })) {
    if (!existsSync(path)) throw new Error(`${label}: no existe ${path}`);
  }
  if (!isInside(WORK_ROOT, options.proposal) || !isInside(WORK_ROOT, options.audit)) {
    throw new Error("Propuesta y auditoría deben permanecer dentro de work/");
  }
  const [sources, proposalSource] = await Promise.all([
    loadSources(options),
    readJsonSource(options.proposal),
  ]);

  if (options.mode === "audit") {
    if (options.baseline && !isInside(WORK_ROOT, options.baseline)) {
      throw new Error("El baseline de reauditoría debe permanecer dentro de work/");
    }
    if (options.baseline && !existsSync(options.baseline)) {
      throw new Error(`baseline: no existe ${options.baseline}`);
    }
    const baselineSource = options.baseline
      ? await readJsonSource(options.baseline)
      : sources.targets;
    const expectedProposal = buildLandingTargetProposal({
      normalized: sources.normalized.json,
      companyMap: sources.companyMap.json,
      companies: sources.companies.json,
      companyDetails: sources.companyDetails.json,
      existingTargets: baselineSource.json,
    });
    const audit = createLandingTargetAudit({
      proposal: proposalSource.json,
      proposalSha256: proposalSource.sha256,
      currentTargets: baselineSource.json,
      expectedProposal,
      companyMap: sources.companyMap.json,
      companies: sources.companies.json,
      sourceHashes: { ...sources.hashes, canonicalTargets: baselineSource.sha256 },
      manualRejections: options.rejections,
      observedCanonical: sources.targets.json,
      observedCanonicalSha256: sources.targets.sha256,
    });
    await atomicWriteJson(options.audit, audit);
    console.log(JSON.stringify({
      mode: "audit",
      networkCalls: 0,
      captures: 0,
      candidates: audit.candidateCount,
      accepted: audit.acceptedCount,
      rejected: audit.rejectedCount,
      rejectedItems: audit.rejected,
      reconciliationFrom: audit.observedCanonicalItemsHash === audit.initialItemsHash
        ? null
        : audit.observedCanonicalItemsHash,
      proposalSha256: audit.proposalSha256,
      output: options.audit,
    }, null, 2));
    return;
  }

  if (resolve(options.targets) !== resolve(DEFAULTS.targets)) {
    throw new Error("La promoción solo está permitida sobre el target canónico conocido");
  }
  if (!existsSync(options.audit)) throw new Error(`audit: no existe ${options.audit}`);
  const auditSource = await readJsonSource(options.audit);
  const currentItemsHash = hashJson(asArray(sources.targets.json?.items));
  const alreadyPromoted = currentItemsHash === auditSource.json.expectedPromotedItemsHash;
  const reconciling = currentItemsHash === auditSource.json.observedCanonicalItemsHash;
  if (reconciling && sources.targets.sha256 !== auditSource.json.observedCanonicalSha256) {
    throw new Error("Hash del canónico observado no coincide con la reauditoría");
  }
  verifyHashBindings({
    audit: auditSource.json,
    proposalRaw: proposalSource.raw,
    currentSourceHashes: sources.hashes,
    allowPromoted: alreadyPromoted || reconciling,
  });
  const promotion = prepareAuditedPromotion({
    proposal: proposalSource.json,
    audit: auditSource.json,
    currentTargets: sources.targets.json,
  });
  if (promotion.alreadyPromoted) {
    console.log(JSON.stringify({
      mode: "promote",
      status: "already-promoted",
      networkCalls: 0,
      captures: 0,
      final: sources.targets.json.items.length,
      backup: null,
    }, null, 2));
    return;
  }

  await mkdir(options.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const backup = resolve(
    options.backups,
    `${basename(options.targets, ".json")}.${stamp}.${sources.targets.sha256.slice(0, 12)}.json`,
  );
  await writeFile(backup, sources.targets.raw, { encoding: "utf8", flag: "wx" });
  const backupHash = hashText(await readFile(backup, "utf8"));
  if (backupHash !== sources.targets.sha256) throw new Error("El backup no coincide con el canónico original");
  await atomicWriteJson(options.targets, promotion.document);
  const written = await readJsonSource(options.targets);
  if (hashJson(asArray(written.json?.items)) !== auditSource.json.expectedPromotedItemsHash) {
    throw new Error("La verificación posterior a escritura ha fallado");
  }
  console.log(JSON.stringify({
    mode: "promote",
    status: "promoted",
    reconciled: promotion.reconciling,
    networkCalls: 0,
    captures: 0,
    existingPreserved: auditSource.json.existingCount,
    accepted: promotion.accepted.length,
    rejected: promotion.rejected.length,
    final: written.json.items.length,
    canonicalSha256: written.sha256,
    backup,
    backupSha256: backupHash,
  }, null, 2));
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${cleanText(error?.message || error)}`);
    process.exitCode = 1;
  });
}
