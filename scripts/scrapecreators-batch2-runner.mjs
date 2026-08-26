#!/usr/bin/env node

/**
 * Ejecuta una tanda incremental y auditable de ScrapeCreators.
 *
 * Seguridad por defecto:
 * - sin --execute solo calcula el plan (cero red, cero créditos);
 * - la clave se acepta exclusivamente en SCRAPECREATORS_API_KEY;
 * - todas las llamadas de pago son secuenciales y no se reintentan;
 * - el saldo se comprueba antes de cada llamada;
 * - una llamada dudosa queda "in_flight" y se reconcilia por saldo al reanudar;
 * - las peticiones ya presentes en volcados anteriores o en esta tanda se excluyen;
 * - el gasto se gobierna por credits_charged real, no por número de peticiones.
 *
 * Uso:
 *   node scripts/scrapecreators-batch2-runner.mjs --dry-run
 *   SCRAPECREATORS_API_KEY=... node scripts/scrapecreators-batch2-runner.mjs --execute
 *
 * Para un plan editorial explícito:
 *   node scripts/scrapecreators-batch2-runner.mjs --dry-run --plan work/plan.json
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DEFAULT_PRIOR_RAW = resolve(ROOT, "work/scrapecreators-spain-leadgen/raw.json");
const DEFAULT_NORMALIZED = resolve(ROOT, "db/scrapecreators-spain-leadgen.json");
const DEFAULT_COMPANY_MAP = resolve(ROOT, "scripts/data/scrapecreators-company-map.json");
const DEFAULT_OUT_DIR = resolve(ROOT, "work/scrapecreators-spain-leadgen-batch2");
const DEFAULT_API_BASE = "https://api.scrapecreators.com";
const BALANCE_PATH = "/v1/account/credit-balance";
const PAID_PATHS = new Set([
  "/v1/facebook/adLibrary/search/ads",
  "/v1/facebook/adLibrary/company/ads",
  "/v1/facebook/adLibrary/ad/transcript",
]);

const usage = () => {
  console.log(`
ScrapeCreators batch runner

  --dry-run                    Solo calcula y valida; es el modo por defecto.
  --execute                    Autoriza llamadas reales.
  --budget N                   Créditos exactos que se deben cargar (100 por defecto).
  --prior-raw PATH             Volcado anterior usado para deduplicar y paginar.
  --normalized PATH            Corpus normalizado para elegir vídeos relevantes.
  --company-map PATH           Mapa pageId -> ficha canónica.
  --plan PATH                  Plan JSON opcional en vez del plan derivado.
  --out-dir PATH               Carpeta privada de raw/ledger/estado.
  --allow-extra-balance        Permite saldo inicial superior al presupuesto.
  --timeout-ms N               Timeout por petición (45000 por defecto).
  --help                       Muestra esta ayuda.

Variables de entorno (solo ejecución):
  SCRAPECREATORS_API_KEY       Clave; nunca se guarda ni se imprime.
  SCRAPECREATORS_API_BASE      Base opcional (por defecto ${DEFAULT_API_BASE}).
`);
};

const parseInteger = (value, label, minimum = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} debe ser un entero >= ${minimum}`);
  }
  return parsed;
};

const asPath = (value) => (isAbsolute(value) ? value : resolve(ROOT, value));

const parseArgs = (argv) => {
  const options = {
    execute: false,
    budget: 100,
    priorRaw: DEFAULT_PRIOR_RAW,
    normalized: DEFAULT_NORMALIZED,
    companyMap: DEFAULT_COMPANY_MAP,
    plan: null,
    outDir: DEFAULT_OUT_DIR,
    allowExtraBalance: false,
    timeoutMs: 45_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`Falta valor para ${arg}`);
      return value;
    };
    if (arg === "--execute") options.execute = true;
    else if (arg === "--dry-run") options.execute = false;
    else if (arg === "--budget") options.budget = parseInteger(next(), "--budget");
    else if (arg === "--prior-raw") options.priorRaw = asPath(next());
    else if (arg === "--normalized") options.normalized = asPath(next());
    else if (arg === "--company-map") options.companyMap = asPath(next());
    else if (arg === "--plan") options.plan = asPath(next());
    else if (arg === "--out-dir") options.outDir = asPath(next());
    else if (arg === "--timeout-ms") {
      options.timeoutMs = parseInteger(next(), "--timeout-ms", 1_000);
    } else if (arg === "--allow-extra-balance") options.allowExtraBalance = true;
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else throw new Error(`Argumento desconocido: ${arg}`);
  }
  return options;
};

const cleanText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const normalizeText = (value) => cleanText(value).toLocaleLowerCase("es");
const asArray = (value) => (Array.isArray(value) ? value : []);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const atomicWriteJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined && value[key] !== null && value[key] !== "")
      .map((key) => [key, stableValue(value[key])]),
  );
};

const requestIdentity = (path, params = {}, responseData = null) => {
  const cursor = cleanText(params.cursor) || "FIRST";
  if (path.endsWith("/search/ads")) {
    return [
      "search",
      normalizeText(params.query),
      normalizeText(params.country),
      normalizeText(params.language),
      normalizeText(params.status),
      normalizeText(params.sort_by),
      cursor,
    ].join("|");
  }
  if (path.endsWith("/company/ads")) {
    const firstResult = asArray(responseData?.results)[0];
    const pageId = cleanText(
      params.pageId || firstResult?.page_id || firstResult?.snapshot?.page_id,
    );
    const company = pageId || `name:${normalizeText(params.companyName)}`;
    return [
      "company",
      company,
      normalizeText(params.country),
      normalizeText(params.status),
      normalizeText(params.sort_by),
      cursor,
    ].join("|");
  }
  if (path.endsWith("/ad/transcript")) {
    return `transcript|${cleanText(params.id || responseData?.ad_id)}`;
  }
  return `${path}|${JSON.stringify(stableValue(params))}`;
};

const identityHash = (identity) =>
  createHash("sha256").update(identity).digest("hex").slice(0, 20);

const containsSecretParam = (value) => {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    if (/(?:api.?key|authorization|token|secret)/iu.test(key)) return true;
    return containsSecretParam(nested);
  });
};

const validateOperation = (operation, index) => {
  if (!operation || typeof operation !== "object") {
    throw new Error(`Operación ${index + 1}: formato inválido`);
  }
  const path = cleanText(operation.path);
  const params = operation.params && typeof operation.params === "object" ? operation.params : {};
  if (!PAID_PATHS.has(path)) {
    throw new Error(`Operación ${index + 1}: endpoint no autorizado: ${path}`);
  }
  if (containsSecretParam(params)) {
    throw new Error(`Operación ${index + 1}: el plan no puede contener secretos`);
  }
  if (path.endsWith("/search/ads") && !cleanText(params.query)) {
    throw new Error(`Operación ${index + 1}: falta query`);
  }
  if (path.endsWith("/company/ads") && !cleanText(params.pageId)) {
    throw new Error(`Operación ${index + 1}: se exige pageId; companyName es ambiguo`);
  }
  if (path.endsWith("/ad/transcript") && !cleanText(params.id)) {
    throw new Error(`Operación ${index + 1}: falta id del anuncio`);
  }
  const expectedCost = Number(operation.expectedCost ?? 1);
  if (expectedCost !== 1) {
    throw new Error(`Operación ${index + 1}: estos endpoints deben planificarse a 1 crédito`);
  }
  const identity = requestIdentity(path, params);
  return {
    label: cleanText(operation.label) || `${path} ${index + 1}`,
    path,
    params: stableValue(params),
    expectedCost,
    kind: cleanText(operation.kind) || "custom",
    identity,
    fingerprint: identityHash(identity),
  };
};

const getBodyText = (item) => {
  const body = item?.copy?.text ?? item?.snapshot?.body?.text ?? item?.snapshot?.body;
  return cleanText(body);
};

const rowHasVideo = (row) => {
  const snapshot = row?.snapshot || {};
  if (asArray(snapshot.videos).length || asArray(snapshot.extra_videos).length) return true;
  return asArray(snapshot.cards).some((card) =>
    ["video_hd_url", "video_sd_url", "video_preview_image_url"].some((key) =>
      cleanText(card?.[key]),
    ),
  );
};

const roundRobin = (groups) => {
  const result = [];
  const queues = [...groups.values()].filter((queue) => queue.length);
  let remaining = queues.reduce((sum, queue) => sum + queue.length, 0);
  for (let offset = 0; remaining > 0; offset += 1) {
    for (const queue of queues) {
      if (offset < queue.length) {
        result.push(queue[offset]);
        remaining -= 1;
      }
    }
  }
  return result;
};

const buildDerivedOperations = async ({ priorRaw, normalized, companyMap }) => {
  const raw = await readJson(priorRaw);
  if (!raw || !Array.isArray(raw.requests)) {
    throw new Error("El volcado anterior no contiene requests[]");
  }

  const mapDocument = existsSync(companyMap) ? await readJson(companyMap) : { pageIds: {} };
  const pageMap = mapDocument.pageIds || {};
  const matchedPageIds = new Set(
    Object.entries(pageMap)
      .filter(([, value]) => value?.status === "matched")
      .map(([pageId]) => String(pageId)),
  );

  const previousIdentities = new Set();
  const transcriptIds = new Set();
  for (const request of raw.requests) {
    previousIdentities.add(requestIdentity(request.path, request.params, request.data));
    if (String(request.path || "").endsWith("/ad/transcript")) {
      transcriptIds.add(cleanText(request.params?.id || request.data?.ad_id));
    }
  }

  const companyPages = [];
  const searchPages = [];
  for (const request of raw.requests) {
    if (Number(request.status) !== 200 || !cleanText(request.data?.cursor)) continue;
    if (String(request.path).endsWith("/company/ads")) {
      const firstResult = asArray(request.data?.results)[0];
      const pageId = cleanText(
        request.params?.pageId || firstResult?.page_id || firstResult?.snapshot?.page_id,
      );
      if (!pageId) continue;
      const params = {
        ...request.params,
        pageId,
        cursor: request.data.cursor,
      };
      delete params.companyName;
      companyPages.push({
        label: `página 2 empresa: ${cleanText(firstResult?.page_name || request.label)}`,
        path: "/v1/facebook/adLibrary/company/ads",
        params,
        expectedCost: 1,
        kind: "company_page_2",
        score:
          (matchedPageIds.has(pageId) ? 100_000 : 0) +
          Number(request.data?.searchResultsCount || 0),
      });
    } else if (String(request.path).endsWith("/search/ads")) {
      const rows = asArray(request.data?.searchResults);
      const matchedHits = rows.filter((row) =>
        matchedPageIds.has(cleanText(row?.page_id || row?.snapshot?.page_id)),
      ).length;
      searchPages.push({
        label: `página 2 keyword: ${cleanText(request.params?.query)}`,
        path: "/v1/facebook/adLibrary/search/ads",
        params: { ...request.params, cursor: request.data.cursor },
        expectedCost: 1,
        kind: "search_page_2",
        score: matchedHits * 100_000 - Number(request.data?.searchResultsCount || 0),
      });
    }
  }

  companyPages.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
  searchPages.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

  let transcriptSource = [];
  if (existsSync(normalized)) {
    const document = await readJson(normalized);
    transcriptSource = asArray(document.items)
      .filter((item) => asArray(item?.media?.videos).length)
      .map((item) => ({
        id: cleanText(item.externalId),
        pageId: cleanText(item.pageId),
        pageName: cleanText(item.pageName),
        active: Boolean(item.isActive),
        bodyLength: getBodyText(item).length,
        startedAt: Date.parse(item.startedAt || "") || 0,
      }));
  } else {
    const ads = new Map();
    for (const request of raw.requests) {
      for (const row of [...asArray(request.data?.searchResults), ...asArray(request.data?.results)]) {
        const id = cleanText(row?.ad_archive_id || row?.ad_id);
        if (!id || !rowHasVideo(row)) continue;
        const current = ads.get(id) || {
          id,
          pageId: cleanText(row?.page_id || row?.snapshot?.page_id),
          pageName: cleanText(row?.page_name || row?.snapshot?.page_name),
          active: false,
          bodyLength: 0,
          startedAt: 0,
        };
        current.active ||= Boolean(row?.is_active);
        current.bodyLength = Math.max(current.bodyLength, getBodyText(row).length);
        current.startedAt = Math.max(current.startedAt, Number(row?.start_date || 0) * 1_000);
        ads.set(id, current);
      }
    }
    transcriptSource = [...ads.values()];
  }

  const uniqueTranscriptSource = new Map();
  for (const item of transcriptSource) {
    if (!item.id || transcriptIds.has(item.id)) continue;
    const current = uniqueTranscriptSource.get(item.id);
    if (!current || Number(item.active) > Number(current.active)) {
      uniqueTranscriptSource.set(item.id, item);
    }
  }

  const mappedGroups = new Map();
  const unmapped = [];
  for (const item of uniqueTranscriptSource.values()) {
    const mapping = pageMap[item.pageId];
    const companyId = mapping?.status === "matched" ? cleanText(mapping.companyId) : "";
    const operation = {
      label: `transcript: ${item.pageName || companyId || item.id} ${item.id}`,
      path: "/v1/facebook/adLibrary/ad/transcript",
      params: { id: item.id },
      expectedCost: 1,
      kind: companyId ? "mapped_video_transcript" : "fallback_video_transcript",
      active: item.active,
      bodyLength: item.bodyLength,
      startedAt: item.startedAt,
    };
    if (!companyId) unmapped.push(operation);
    else {
      if (!mappedGroups.has(companyId)) mappedGroups.set(companyId, []);
      mappedGroups.get(companyId).push(operation);
    }
  }

  const rankTranscript = (left, right) =>
    Number(right.active) - Number(left.active) ||
    right.startedAt - left.startedAt ||
    right.bodyLength - left.bodyLength ||
    left.label.localeCompare(right.label);
  for (const queue of mappedGroups.values()) queue.sort(rankTranscript);
  unmapped.sort(rankTranscript);
  const transcripts = [...roundRobin(mappedGroups), ...unmapped];

  const operations = [...companyPages, ...searchPages, ...transcripts].map((operation, index) =>
    validateOperation(operation, index),
  );
  return {
    source: "derived_from_first_batch",
    operations,
    previousIdentities,
    inventory: {
      companyPage2: companyPages.length,
      searchPage2: searchPages.length,
      mappedVideoTranscripts: transcripts.filter(
        (operation) => operation.kind === "mapped_video_transcript",
      ).length,
      fallbackVideoTranscripts: transcripts.filter(
        (operation) => operation.kind === "fallback_video_transcript",
      ).length,
      mappedCompaniesWithVideo: mappedGroups.size,
    },
  };
};

const loadOperations = async (options) => {
  if (!options.plan) return buildDerivedOperations(options);
  const plan = await readJson(options.plan);
  const operations = asArray(plan.operations).map(validateOperation);
  if (!operations.length) throw new Error("El plan no contiene operaciones");
  const prior = await readJson(options.priorRaw);
  const previousIdentities = new Set(
    asArray(prior.requests).map((request) =>
      requestIdentity(request.path, request.params, request.data),
    ),
  );
  return {
    source: options.plan,
    operations,
    previousIdentities,
    inventory: { custom: operations.length },
  };
};

const redact = (value, secret) => {
  const text = cleanText(value);
  return secret && text.includes(secret) ? text.split(secret).join("[REDACTED]") : text;
};

const apiCall = async ({ base, key, path, params = {}, timeoutMs }) => {
  const url = new URL(path, `${base.replace(/\/+$/u, "")}/`);
  for (const [name, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    if (Array.isArray(rawValue)) rawValue.forEach((value) => url.searchParams.append(name, value));
    else url.searchParams.set(name, String(rawValue));
  }
  const started = Date.now();
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "x-api-key": key },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { success: false, message: rawText.slice(0, 2_000) };
  }
  return { status: response.status, data, ms: Date.now() - started };
};

const getBalance = async (runtime, label) => {
  const result = await apiCall({
    ...runtime,
    path: BALANCE_PATH,
    params: {},
  });
  const balance = Number(result.data?.creditCount);
  if (result.status !== 200 || !Number.isInteger(balance) || balance < 0) {
    throw new Error(`No se pudo verificar el saldo (${result.status})`);
  }
  return {
    balance,
    request: {
      label,
      path: BALANCE_PATH,
      params: {},
      status: result.status,
      fetchedAt: new Date().toISOString(),
      ms: result.ms,
      data: result.data,
    },
  };
};

const statePaths = (outDir) => ({
  state: resolve(outDir, "run-state.json"),
  raw: resolve(outDir, "raw.json"),
  ledger: resolve(outDir, "ledger.json"),
});

const chargedOf = (request) => Math.max(0, Number(request?.data?.credits_charged || 0));

const persist = async (state, paths) => {
  state.updatedAt = new Date().toISOString();
  const totalCharged = state.requests.reduce((sum, request) => sum + chargedOf(request), 0);
  if (totalCharged !== state.spent) {
    throw new Error(`Estado inconsistente: requests=${totalCharged}, spent=${state.spent}`);
  }
  await atomicWriteJson(paths.state, state);
  await atomicWriteJson(paths.raw, {
    schema: "redvitalia-scrapecreators-raw-v1",
    generatedAt: state.updatedAt,
    requests: state.requests,
  });
  await atomicWriteJson(paths.ledger, {
    schema: "redvitalia-scrapecreators-ledger-v2",
    generatedAt: state.updatedAt,
    budget: state.budget,
    startingBalance: state.startingBalance,
    totalCharged,
    finalBalance: state.finalBalance ?? null,
    complete: totalCharged === state.budget && state.finalBalance !== null,
    inFlight: state.inflight
      ? { fingerprint: state.inflight.fingerprint, label: state.inflight.label }
      : null,
    requests: state.requests.map((request) => ({
      label: request.label,
      path: request.path,
      status: request.status,
      charged: chargedOf(request),
      remaining:
        Number.isFinite(Number(request.data?.credits_remaining))
          ? Number(request.data.credits_remaining)
          : Number.isFinite(Number(request.data?.creditCount))
            ? Number(request.data.creditCount)
            : null,
      ms: request.ms ?? null,
      fingerprint: request.fingerprint ?? null,
      recovered: Boolean(request.recovered),
    })),
  });
};

const summarizeSelection = (operations, budget) => {
  const selected = operations.slice(0, budget);
  const byKind = Object.fromEntries(
    [...new Set(selected.map((operation) => operation.kind))].map((kind) => [
      kind,
      selected.filter((operation) => operation.kind === kind).length,
    ]),
  );
  return { count: selected.length, byKind };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (resolve(options.priorRaw) === resolve(statePaths(options.outDir).raw)) {
    throw new Error("El raw de salida no puede ser el volcado anterior");
  }
  const plan = await loadOperations(options);
  const paths = statePaths(options.outDir);
  const existingState = existsSync(paths.state) ? await readJson(paths.state) : null;
  const completedIdentities = new Set(
    asArray(existingState?.completed).map((entry) => cleanText(entry.identity)),
  );
  const seen = new Set([...plan.previousIdentities, ...completedIdentities]);
  let blockedAsDuplicate = 0;
  const eligible = [];
  for (const operation of plan.operations) {
    if (seen.has(operation.identity)) {
      blockedAsDuplicate += 1;
      continue;
    }
    seen.add(operation.identity);
    eligible.push(operation);
  }

  const alreadySpent = Number(existingState?.spent || 0);
  const remainingBudget = options.budget - alreadySpent;
  if (remainingBudget < 0) throw new Error("El estado existente supera el presupuesto solicitado");
  if (eligible.length < remainingBudget) {
    throw new Error(
      `Solo hay ${eligible.length} operaciones nuevas para ${remainingBudget} créditos pendientes`,
    );
  }

  const drySummary = {
    mode: options.execute ? "execute" : "dry-run",
    networkCallsMade: 0,
    budget: options.budget,
    alreadySpent,
    remainingBudget,
    source: plan.source,
    inventory: plan.inventory,
    candidateOperations: plan.operations.length,
    blockedAsDuplicate,
    eligibleOperations: eligible.length,
    nextSelection: summarizeSelection(eligible, remainingBudget),
    outputDirectory: options.outDir,
  };
  if (!options.execute) {
    console.log(JSON.stringify(drySummary, null, 2));
    return;
  }

  const key = cleanText(process.env.SCRAPECREATORS_API_KEY);
  if (!key) throw new Error("Falta SCRAPECREATORS_API_KEY");
  const runtime = {
    base: cleanText(process.env.SCRAPECREATORS_API_BASE) || DEFAULT_API_BASE,
    key,
    timeoutMs: options.timeoutMs,
  };

  let state = existingState;
  if (!state) {
    if (existsSync(paths.raw) || existsSync(paths.ledger)) {
      throw new Error("Hay salidas sin run-state.json; no se sobrescriben automáticamente");
    }
    const initial = await getBalance(runtime, "saldo inicial batch 2");
    if (initial.balance < options.budget) {
      throw new Error(`Saldo ${initial.balance}: insuficiente para ${options.budget} créditos`);
    }
    if (!options.allowExtraBalance && initial.balance !== options.budget) {
      throw new Error(
        `Saldo ${initial.balance}: se esperaban exactamente ${options.budget}; ` +
          "use --allow-extra-balance si es deliberado",
      );
    }
    state = {
      schema: "redvitalia-scrapecreators-run-state-v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      budget: options.budget,
      startingBalance: initial.balance,
      spent: 0,
      finalBalance: null,
      requests: [initial.request],
      completed: [],
      inflight: null,
    };
    await persist(state, paths);
  } else if (Number(state.budget) !== options.budget) {
    throw new Error(`El estado existente usa budget=${state.budget}, no ${options.budget}`);
  }

  if (state.inflight) {
    const reconciliation = await getBalance(runtime, "saldo para reconciliar in_flight");
    state.requests.push(reconciliation.request);
    const before = Number(state.inflight.balanceBefore);
    const delta = before - reconciliation.balance;
    if (delta === 0) {
      state.inflight = null;
    } else if (delta === Number(state.inflight.expectedCost)) {
      const recovered = {
        label: `${state.inflight.label} [respuesta perdida; cargo reconciliado]`,
        path: state.inflight.path,
        params: state.inflight.params,
        status: 0,
        fetchedAt: new Date().toISOString(),
        ms: null,
        fingerprint: state.inflight.fingerprint,
        recovered: true,
        data: {
          success: false,
          credits_charged: delta,
          credits_remaining: reconciliation.balance,
          message: "Cargo inferido por diferencia de saldo; la respuesta no estaba disponible.",
        },
      };
      state.requests.push(recovered);
      state.spent += delta;
      state.completed.push({
        identity: state.inflight.identity,
        fingerprint: state.inflight.fingerprint,
        charged: delta,
        status: 0,
        recovered: true,
      });
      state.inflight = null;
    } else {
      await persist(state, paths);
      throw new Error(
        `No se puede reconciliar in_flight: saldo antes=${before}, ahora=${reconciliation.balance}`,
      );
    }
    await persist(state, paths);
  }

  const doneNow = new Set(asArray(state.completed).map((entry) => entry.identity));
  const queue = eligible.filter((operation) => !doneNow.has(operation.identity));

  for (const operation of queue) {
    if (state.spent === state.budget) break;
    if (state.spent + operation.expectedCost > state.budget) continue;

    const checkpoint = await getBalance(runtime, `saldo antes de ${operation.label}`);
    state.requests.push(checkpoint.request);
    const expectedBalance = state.startingBalance - state.spent;
    if (checkpoint.balance !== expectedBalance) {
      await persist(state, paths);
      throw new Error(
        `Saldo inesperado (${checkpoint.balance}, esperado ${expectedBalance}); ` +
          "posible uso simultáneo de la clave",
      );
    }

    state.inflight = {
      identity: operation.identity,
      fingerprint: operation.fingerprint,
      label: operation.label,
      path: operation.path,
      params: operation.params,
      expectedCost: operation.expectedCost,
      balanceBefore: checkpoint.balance,
      startedAt: new Date().toISOString(),
    };
    await persist(state, paths);

    let result;
    try {
      result = await apiCall({
        ...runtime,
        path: operation.path,
        params: operation.params,
      });
    } catch (error) {
      console.error(
        `Petición incierta; queda in_flight para reconciliar al reanudar: ${redact(error?.message, key)}`,
      );
      process.exitCode = 2;
      return;
    }

    let charged = Number(result.data?.credits_charged);
    if (!Number.isInteger(charged) || charged < 0) {
      const after = await getBalance(runtime, `saldo para inferir cargo de ${operation.label}`);
      state.requests.push(after.request);
      charged = checkpoint.balance - after.balance;
      if (![0, operation.expectedCost].includes(charged)) {
        await persist(state, paths);
        throw new Error(`Cargo ambiguo para ${operation.label}: diferencia ${charged}`);
      }
      result.data = {
        ...result.data,
        credits_charged: charged,
        credits_remaining: after.balance,
        charge_reconciled_from_balance: true,
      };
    }

    const requestRecord = {
      label: operation.label,
      path: operation.path,
      params: operation.params,
      status: result.status,
      fetchedAt: new Date().toISOString(),
      ms: result.ms,
      fingerprint: operation.fingerprint,
      data: result.data,
    };
    state.requests.push(requestRecord);
    state.spent += charged;
    state.completed.push({
      identity: operation.identity,
      fingerprint: operation.fingerprint,
      charged,
      status: result.status,
      recovered: false,
    });
    state.inflight = null;
    await persist(state, paths);

    if (charged > operation.expectedCost || state.spent > state.budget) {
      throw new Error(
        `El proveedor cargó ${charged} créditos en una operación prevista a ${operation.expectedCost}`,
      );
    }
    console.log(
      `[${state.spent}/${state.budget}] ${operation.label} · HTTP ${result.status} · cargo ${charged}`,
    );
  }

  if (state.spent !== state.budget) {
    throw new Error(
      `Se agotó la cola con ${state.spent}/${state.budget} créditos; no se fuerza ningún duplicado`,
    );
  }
  const final = await getBalance(runtime, "saldo final batch 2");
  state.requests.push(final.request);
  state.finalBalance = final.balance;
  const expectedFinal = state.startingBalance - state.budget;
  if (final.balance !== expectedFinal) {
    await persist(state, paths);
    throw new Error(`Saldo final ${final.balance}; se esperaba ${expectedFinal}`);
  }
  await persist(state, paths);
  console.log(
    JSON.stringify(
      {
        complete: true,
        charged: state.spent,
        startingBalance: state.startingBalance,
        finalBalance: state.finalBalance,
        raw: paths.raw,
        ledger: paths.ledger,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`ERROR: ${cleanText(error?.message || error)}`);
  process.exitCode = 1;
});

