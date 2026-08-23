import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";
const REVIEW_DIR = "research/deep/v3/reviews";
const REPORT_FILE = "research/deep/v3/qa-report.json";
const REQUIRED = [
  "classification", "messageArchitecture", "acquisition", "ctaLadder", "captureAndQualification", "funnel",
  "offerEconomics", "proofAndTrust", "objectionsAndSales", "technologyAndNurture", "deliveryOperations", "competitiveAssessment",
  "evidence", "limitations", "qa",
];
const DIMENSIONS = REQUIRED.slice(0, 12);
const FUNNEL_STAGES = [
  "Descubrimiento / adquisición", "Landing / entrada", "Promesa y encaje", "Prueba / confianza", "CTA", "Captura",
  "Cualificación", "Reserva o contacto", "Conversación comercial", "Propuesta / cierre", "Onboarding / entrega", "Seguimiento / retención",
];
const CORE_STATUSES = new Set(["observado", "inferido", "no observable", "no aplica"]);

const apply = process.argv.includes("--apply");
const strict = process.argv.includes("--strict");

async function readOptional(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function stageCounts(items, key) {
  return items.reduce((counts, item) => {
    const status = item[key]?.status || "missing";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safePublicUrl(value) {
  try {
    const raw = clean(value);
    if (!raw || raw.endsWith("\\") || /\[\[[^\]]+\]\]/.test(raw)) return false;
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return false;
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return false;
    return ![...url.searchParams.keys()].some((key) => /^(?:token|signature|x-amz-|x-goog-)/i.test(key));
  } catch { return false; }
}

function containsLocalPath(value) {
  const withoutPublicUrls = String(value || "").replace(/https?:\/\/[^\s<>"']+/gi, "");
  return /file:\/\/|[A-Z]:\\Users\\/i.test(withoutPublicUrls) || /\/Users\//.test(withoutPublicUrls);
}

function collectEvidenceRefs(value, path = "root", rows = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectEvidenceRefs(child, `${path}[${index}]`, rows));
    return rows;
  }
  if (!value || typeof value !== "object") return rows;
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidenceIds" && Array.isArray(child)) rows.push(...child.map((id) => ({ id, path: `${path}.evidenceIds` })));
    else if (key !== "evidence") collectEvidenceRefs(child, `${path}.${key}`, rows);
  }
  return rows;
}

function issue(severity, code, detail, path = null) {
  return { severity, code, detail, path };
}

function hasExplanation(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(clean(value.explanation || value.detail || value.limitation || value.reason || value.value))
    || (Array.isArray(value.unknowns) && value.unknowns.some(clean))
    || (Array.isArray(value.unanswered) && value.unanswered.some(clean));
}

function isUtilityEvidenceUrl(value) {
  try {
    const path = new URL(value).pathname.toLowerCase();
    return /(?:^|\/)(?:privacy|privacidad|privacy-policy|politica-de-privacidad|cookies?|politica-de-cookies|aviso-legal|legal-notice|terms(?:-and-conditions)?|terms-of-(?:use|service)|impressum|datenschutz|mentions-legales)(?:\/|$|\.)/i.test(path);
  } catch { return false; }
}

function reviewQa(item, review) {
  const issues = [];
  if (!review) return { status: "error", issues: [issue("error", "missing_review", "No existe archivo V3 sintetizado.")] };
  if (review.schemaVersion !== "rv-funnel-forensics-v3") issues.push(issue("error", "schema", `Schema inesperado: ${review.schemaVersion || "vacío"}.`, "schemaVersion"));
  if (review.recordId !== item.id) issues.push(issue("error", "record_id", "El identificador no coincide con la cola.", "recordId"));
  for (const key of REQUIRED) if (!(key in review)) issues.push(issue("error", "missing_dimension", `Falta ${key}.`, key));
  for (const key of DIMENSIONS) {
    const dimension = review[key];
    if (!dimension || typeof dimension !== "object") continue;
    if (Array.isArray(dimension)) continue;
    if (!CORE_STATUSES.has(dimension.status)) issues.push(issue("error", "dimension_status", `${key} no separa observado, inferido, no observable o no aplica.`, `${key}.status`));
    const refs = collectEvidenceRefs(dimension, key);
    if (["observado", "inferido"].includes(dimension.status) && !refs.length) issues.push(issue("error", "dimension_without_evidence", `${key} contiene una lectura material sin referencia de evidencia.`, key));
    if (["no observable", "no aplica"].includes(dimension.status) && !hasExplanation(dimension)) issues.push(issue("error", "dimension_unexplained", `${key} no explica por qué es ${dimension.status}.`, key));
  }
  if (!Array.isArray(review.evidence) || !review.evidence.length) issues.push(issue("error", "evidence_empty", "La ficha no tiene evidencia pública."));
  const evidenceIds = new Set();
  for (const [index, row] of (review.evidence || []).entries()) {
    if (!clean(row.id)) issues.push(issue("error", "evidence_id_empty", "Evidencia sin ID.", `evidence[${index}]`));
    if (evidenceIds.has(row.id)) issues.push(issue("error", "evidence_id_duplicate", `ID repetido: ${row.id}.`, `evidence[${index}]`));
    evidenceIds.add(row.id);
    const unavailable = row.url === null
      && row.status === "no disponible documentada"
      && clean(row.limitation)
      && !(row.supports || []).length;
    if (!unavailable && !safePublicUrl(row.url)) issues.push(issue("error", "unsafe_evidence_url", `URL no pública o temporal: ${row.url || "vacía"}.`, `evidence[${index}].url`));
    if (!clean(row.accessedAt)) issues.push(issue("warning", "evidence_date_empty", `Evidencia ${row.id} sin fecha de acceso.`, `evidence[${index}].accessedAt`));
    if (row.status === "observado" && (!Array.isArray(row.supports) || !row.supports.length)) issues.push(issue("error", "evidence_supports_empty", `La evidencia observada ${row.id} no declara qué afirmaciones sostiene.`, `evidence[${index}].supports`));
    if (row.relation === "external_funnel_destination" && (row.supports || []).some((path) => /^\$\.(?:messageArchitecture|proofAndTrust|offerEconomics|objectionsAndSales|deliveryOperations|competitiveAssessment)/.test(path))) {
      issues.push(issue("error", "external_platform_copy_contamination", `La plataforma externa ${row.id} se está usando como si fuera copy, prueba o economía del competidor.`, `evidence[${index}].supports`));
    }
  }
  for (const ref of collectEvidenceRefs(review)) if (!evidenceIds.has(ref.id)) issues.push(issue("error", "orphan_evidence_ref", `Referencia inexistente: ${ref.id}.`, ref.path));
  if (!Array.isArray(review.funnel) || review.funnel.length !== FUNNEL_STAGES.length) {
    issues.push(issue("error", "funnel_stage_count", `Se esperaban ${FUNNEL_STAGES.length} etapas y hay ${review.funnel?.length ?? 0}.`, "funnel"));
  }
  for (const [index, expected] of FUNNEL_STAGES.entries()) {
    const stage = review.funnel?.[index];
    if (!stage) continue;
    if (stage.stage !== expected) issues.push(issue("error", "funnel_stage_order", `Se esperaba “${expected}” y aparece “${stage.stage}”.`, `funnel[${index}].stage`));
    if (!CORE_STATUSES.has(stage.status)) issues.push(issue("error", "funnel_stage_status", `Estado no permitido: ${stage.status}.`, `funnel[${index}].status`));
    if (["inferido", "no observable", "no aplica"].includes(stage.status) && !clean(stage.detail || stage.limitation)) issues.push(issue("error", "funnel_stage_unexplained", `La etapa ${stage.stage} no explica su ${stage.status}.`, `funnel[${index}]`));
    if (["observado", "inferido"].includes(stage.status) && (!Array.isArray(stage.evidenceIds) || !stage.evidenceIds.length)) issues.push(issue("error", "funnel_stage_without_evidence", `La etapa ${stage.stage} se marca ${stage.status} sin evidencia.`, `funnel[${index}].evidenceIds`));
  }
  const forms = review.captureAndQualification?.forms;
  if (Array.isArray(forms)) {
    for (const [formIndex, form] of forms.entries()) {
      if (form.submissionPerformed !== false) issues.push(issue("error", "form_submission_state", "Todo formulario debe constar como no enviado.", `captureAndQualification.forms[${formIndex}]`));
      if (form.visibleFieldCount !== form.fields?.length) issues.push(issue("error", "field_count", "El total de campos no coincide con el inventario.", `captureAndQualification.forms[${formIndex}]`));
      const required = (form.fields || []).filter((field) => field.required).length;
      if (form.requiredFieldCount !== required) issues.push(issue("error", "required_count", "El total de obligatorios no coincide.", `captureAndQualification.forms[${formIndex}]`));
      for (const [fieldIndex, field] of (form.fields || []).entries()) {
        if (!clean(field.type)) issues.push(issue("error", "field_type_empty", "Campo visible sin tipo documentado.", `captureAndQualification.forms[${formIndex}].fields[${fieldIndex}].type`));
        if (typeof field.required !== "boolean") issues.push(issue("error", "field_required_unknown", "Campo visible sin estado obligatorio/opcional.", `captureAndQualification.forms[${formIndex}].fields[${fieldIndex}].required`));
      }
    }
  }
  const voice = review.messageArchitecture?.voiceAnalysis;
  const tone = review.messageArchitecture?.tone;
  const patterns = review.messageArchitecture?.languagePatterns;
  if (review.messageArchitecture?.status === "observado" && !voice && !(Array.isArray(tone) && tone.length && Array.isArray(patterns) && patterns.length)) {
    issues.push(issue("error", "voice_analysis_missing", "El mensaje es observable pero no se documenta cómo habla el competidor.", "messageArchitecture"));
  }
  const evidenceById = new Map((review.evidence || []).map((row) => [row.id, row]));
  for (const [path, rows] of [
    ["messageArchitecture.mechanism", review.messageArchitecture?.mechanism],
    ["messageArchitecture.painLanguage", review.messageArchitecture?.painLanguage],
    ["messageArchitecture.outcomeLanguage", review.messageArchitecture?.outcomeLanguage],
    ["proofAndTrust.publicSignals", review.proofAndTrust?.publicSignals],
    ["objectionsAndSales.visibleQuestionsAndAnswers", review.objectionsAndSales?.visibleQuestionsAndAnswers],
    ["deliveryOperations.serviceLevelSignals", review.deliveryOperations?.serviceLevelSignals],
    ["deliveryOperations.outcomeDefinitionSignals", review.deliveryOperations?.outcomeDefinitionSignals],
  ]) {
    for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
      const refs = (row.evidenceIds || []).map((id) => evidenceById.get(id)).filter(Boolean);
      if (refs.length && refs.every((evidence) => isUtilityEvidenceUrl(evidence.url))) issues.push(issue("error", "utility_page_as_commercial_evidence", `${path} usa exclusivamente una página legal o de privacidad como evidencia comercial.`, `${path}[${index}]`));
    }
  }
  if (review.qa?.formsSubmitted !== false) issues.push(issue("error", "qa_forms_submitted", "QA no confirma que no se enviaron formularios.", "qa.formsSubmitted"));
  if (review.qa?.companyContacted !== false) issues.push(issue("error", "qa_company_contacted", "QA no confirma que no se contactó a la empresa.", "qa.companyContacted"));
  if (!Array.isArray(review.limitations) || !review.limitations.some((row) => /no se (?:enviaron|contact[oó])|no se contact[oó]/i.test(row))) issues.push(issue("error", "contact_limitation", "Falta la limitación explícita de no contacto/no envío.", "limitations"));
  if (!Number.isFinite(review.coveragePercent) || review.coveragePercent < 0 || review.coveragePercent > 100) issues.push(issue("error", "coverage", "Cobertura fuera de 0–100.", "coveragePercent"));
  const body = JSON.stringify(review);
  const forbidden = [
    [/(?:https?:\/\/)?(?:www\.)?notion\.(?:so|com)|\.notion\.site/i, "notion_link"],
    [/(?:https?:\/\/)?validate\.perfdrive\.com/i, "challenge_url"],
    [/[?&](?:token|signature|x-amz-[^=]*|x-goog-[^=]*)=/i, "temporary_credential"],
    [/Puente IA|RVC-|RV-PUB-|manual-wave|Origen migraci[oó]n|Bandeja (?:IA|de migraci[oó]n|operativa interna)/i, "internal_process"],
  ];
  for (const [regex, code] of forbidden) if (regex.test(body)) issues.push(issue("error", code, "La ficha contiene una referencia privada, temporal o de proceso interno."));
  if (containsLocalPath(body)) issues.push(issue("error", "local_path", "La ficha contiene una ruta local privada."));
  if (review.offerEconomics?.normalizedPrice?.amount !== null && review.offerEconomics?.normalizedPrice?.amount !== undefined && review.offerEconomics?.normalizedPrice?.currency !== "EUR" && !review.offerEconomics?.eurConversion) {
    issues.push(issue("error", "missing_eur_conversion", "Precio local numérico sin conversión EUR documentada.", "offerEconomics.eurConversion"));
  }
  const normalizedPrice = review.offerEconomics?.normalizedPrice;
  const normalizedConversion = review.offerEconomics?.eurConversion;
  if (Number.isFinite(normalizedPrice?.amount) && normalizedPrice?.currency !== "EUR" && normalizedConversion) {
    const rate = Number(normalizedConversion.rateUnitsPerEur);
    const expected = rate > 0 ? normalizedPrice.amount / rate : null;
    if (!rate || !clean(normalizedConversion.rateDate) || !safePublicUrl(normalizedConversion.sourceUrl)) {
      issues.push(issue("error", "normalized_price_fx_trace_missing", "Conversión EUR principal sin tasa, fecha o fuente pública.", "offerEconomics.eurConversion"));
    } else if (!Number.isFinite(normalizedConversion.amount) || Math.abs(normalizedConversion.amount - expected) > Math.max(0.02, expected * 0.005)) {
      issues.push(issue("error", "normalized_price_fx_mismatch", "El equivalente EUR principal no coincide con la tasa declarada.", "offerEconomics.eurConversion.amount"));
    }
  }
  for (const [index, row] of (review.offerEconomics?.manualPriceConversions || []).entries()) {
    if (!Number.isFinite(row.local?.amount) || !clean(row.local?.currency)) issues.push(issue("error", "manual_price_local_invalid", "Precio manual sin importe o moneda local válida.", `offerEconomics.manualPriceConversions[${index}].local`));
    if (row.local?.currency !== "EUR" && (!Number.isFinite(row.eur?.amount) || row.eur?.currency !== "EUR")) issues.push(issue("error", "manual_price_eur_missing", "Precio manual en moneda local sin equivalente EUR.", `offerEconomics.manualPriceConversions[${index}].eur`));
    if (row.local?.currency !== "EUR" && (!clean(row.conversion?.rateDate) || !safePublicUrl(row.conversion?.sourceUrl))) issues.push(issue("error", "manual_price_fx_trace_missing", "Conversión EUR manual sin fecha o fuente pública del cambio.", `offerEconomics.manualPriceConversions[${index}].conversion`));
    if (row.local?.currency !== "EUR" && Number.isFinite(row.local?.amount) && Number.isFinite(row.eur?.amount)) {
      const rate = Number(row.conversion?.rateUnitsPerEur);
      const expected = rate > 0 ? row.local.amount / rate : null;
      if (!rate || Math.abs(row.eur.amount - expected) > Math.max(0.02, expected * 0.005)) issues.push(issue("error", "manual_price_fx_mismatch", "El equivalente EUR manual no coincide con la tasa declarada.", `offerEconomics.manualPriceConversions[${index}].eur.amount`));
    }
  }
  const errors = issues.filter((row) => row.severity === "error").length;
  const warnings = issues.filter((row) => row.severity === "warning").length;
  const status = errors ? "error" : review.qa?.publishReady === false ? "warning" : "pass";
  return { status, errors, warnings, issues };
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const rows = [];
for (const item of queue.items) {
  if (item.synthesis?.status !== "complete") continue;
  const review = await readOptional(`${REVIEW_DIR}/${item.id}.json`);
  const result = reviewQa(item, review);
  rows.push({ id: item.id, name: item.name, ...result });
  if (apply) {
    item.qa = {
      status: result.status === "pass" ? "complete" : result.status,
      attempts: (item.qa?.attempts || 0) + 1,
      updatedAt: new Date().toISOString(),
      error: result.issues.map((row) => `${row.code}: ${row.detail}`).join(" | ").slice(0, 8_000) || null,
    };
  }
}
const counts = rows.reduce((summary, row) => {
  summary[row.status] = (summary[row.status] || 0) + 1;
  summary.errors += row.errors || 0;
  summary.warnings += row.warnings || 0;
  return summary;
}, { pass: 0, warning: 0, error: 0, errors: 0, warnings: 0 });
const residual = {
  total: queue.items.length,
  synthesisPending: queue.items.filter((item) => item.synthesis?.status !== "complete").length,
  qaNotCompleteAfterReview: queue.items.filter((item) => item.qa?.status !== "complete").length,
};
const report = { schemaVersion: "rv-funnel-forensics-v3-qa-1", generatedAt: new Date().toISOString(), strict, applied: apply, reviewed: rows.length, residual, counts, rows };
await writeJsonAtomic(REPORT_FILE, report);
if (apply) {
  queue.updatedAt = new Date().toISOString();
  queue.stats.qa = stageCounts(queue.items, "qa");
  await writeJsonAtomic(QUEUE_FILE, queue);
}
console.log(JSON.stringify({ reviewed: rows.length, residual, counts }, null, 2));
if (strict && (counts.error || counts.warning || residual.synthesisPending || rows.length !== queue.items.length)) process.exitCode = 1;
