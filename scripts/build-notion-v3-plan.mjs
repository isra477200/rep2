import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";
const REVIEW_DIR = "research/deep/v3/reviews";
const RENDERED_DIR = "research/deep/v3/rendered";
const ID_MAP_FILE = "research/deep/public-id-map.json";
const OUTPUT_FILE = "research/deep/v3/notion-plan.json";
const PUBLIC_BASE = "https://redvitalia.srv1480016.hstgr.cloud";
const STAGE_LABELS = {
  observado: "🟢 Observado",
  inferido: "🟡 Inferido",
  "no observable": "⚪ No observable",
  "no aplica": "⚫ No aplica",
};
const FORBIDDEN_TEXT = /Puente\s+(?:de\s+)?IA|(?:www\.)?notion\.(?:so|com)|\.notion\.site|file:\/\/|[A-Z]:\\Users\\|\/Users\/|\.codex|agent-handoffs|research\/deep|manual-wave|Bandeja de registro|Origen de la migraci[oó]n/i;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value, limit = 1_900) {
  const text = clean(value);
  return text.length <= limit ? text : `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
}

function escapeRich(value) {
  return clean(value).replace(/([\\*~`$<>{}|^]|\[|\])/g, "\\$1");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (/^(?:l|lm)\.facebook\.com$/i.test(url.hostname) && url.pathname === "/l.php") {
      const destination = url.searchParams.get("u");
      return destination ? safeUrl(destination) : null;
    }
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return null;
    if (/(?:^|\.)validate\.perfdrive\.com$/i.test(url.hostname)) return null;
    if ([...url.searchParams.keys()].some((key) => /^(?:token|signature|x-amz-|x-goog-)/i.test(key))) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    if (/^request\.angi\.com$/i.test(url.hostname) && /^\/service-request\//i.test(url.pathname)) url.search = "";
    return url.href;
  } catch {
    return null;
  }
}

function containsForbidden(value) {
  let unsafeUrl = false;
  const withoutPublicUrls = String(value || "").replace(/https?:\/\/[^\s<>"']+/gi, (candidate) => {
    if (!safeUrl(candidate.replace(/[.,;:]+$/, ""))) unsafeUrl = true;
    return "";
  });
  return unsafeUrl || FORBIDDEN_TEXT.test(withoutPublicUrls);
}

function objectStatement(value) {
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (!value || typeof value !== "object") return "";
  return clean(value.statement || value.text || value.detail || value.explanation || value.summary || value.finding || value.value || value.label || value.name);
}

function collectRows(value, prefix = "", rows = [], seen = new Set()) {
  if (value === null || value === undefined || value === "" || rows.length >= 160) return rows;
  if (typeof value === "string" || typeof value === "number") {
    const text = clean(value);
    if (text && !containsForbidden(text)) rows.push(prefix ? `${prefix}: ${text}` : text);
    return rows;
  }
  if (typeof value === "boolean") return rows;
  if (typeof value !== "object" || seen.has(value)) return rows;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((child) => collectRows(child, prefix, rows, seen));
    return rows;
  }
  const direct = objectStatement(value);
  if (direct && !containsForbidden(direct)) rows.push(prefix ? `${prefix}: ${direct}` : direct);
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:evidenceIds|supports|id|recordId|portalId|marker|qa|url|href|sourceUrl|pageUrl|file|sha256|bytes|status|statement|text|detail|explanation|summary|finding|value|label|name)$/i.test(key)) continue;
    const label = key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
    collectRows(child, prefix || label, rows, seen);
  }
  return rows;
}

function bullets(value, empty = "No observable públicamente.", limit = 40) {
  const rows = [...new Set(collectRows(value))].filter(Boolean).slice(0, limit);
  return rows.length ? rows.map((row) => `- ${escapeRich(truncate(row, 1_500))}`).join("\n") : `- ${escapeRich(empty)}`;
}

function fieldLabel(field) {
  return clean(field.label || field.name || field.placeholder || field.type) || "Campo sin etiqueta visible";
}

function dimensionStatus(value) {
  const status = clean(value?.status).toLowerCase();
  return STAGE_LABELS[status] || (status ? escapeRich(status) : "⚪ No observable");
}

function primaryCta(review) {
  const value = review.ctaLadder?.primary;
  return objectStatement(value);
}

function headline(review) {
  return objectStatement(review.messageArchitecture?.headline || review.messageArchitecture?.hero || review.messageArchitecture?.promise);
}

function formSummary(review) {
  const forms = Array.isArray(review.captureAndQualification?.forms) ? review.captureAndQualification.forms : [];
  const fields = forms.reduce((sum, form) => sum + Number(form.visibleFieldCount ?? form.fields?.length ?? 0), 0);
  const required = forms.reduce((sum, form) => sum + Number(form.requiredFieldCount ?? (form.fields || []).filter((field) => field.required).length), 0);
  return { forms, fields, required };
}

function captureType(review, forms) {
  if (review.classification?.status === "no aplica") return "No aplica";
  if (forms.length) return "Formulario";
  const corpus = JSON.stringify([review.captureAndQualification, review.ctaLadder]).toLowerCase();
  if (/calendly|agenda|booking|reserva|appointment/.test(corpus)) return "Agenda";
  if (/whatsapp|wa\.me/.test(corpus)) return "WhatsApp";
  if (/\bchat\b|intercom|crisp|tidio|drift/.test(corpus)) return "Chat";
  if (/checkout|payment|pago|stripe/.test(corpus)) return "Checkout";
  if (/tel[eé]fono|phone|email|correo|mailto|tel:/.test(corpus)) return "Teléfono / email";
  return "Sin captura visible";
}

function priceSummary(review) {
  const price = review.offerEconomics || {};
  const rows = collectRows([
    price.publicPriceLocal,
    price.normalizedPrice,
    price.eurConversion,
    price.manualPriceConversions,
    price.productsOrPlans,
    price.manualTerms,
  ]).filter((row) => /\d|precio|price|tarifa|fee|mes|lead|cita|eur|€|usd|gbp|aed|mxn|brl|pln|try|dkk/i.test(row));
  return truncate([...new Set(rows)].slice(0, 8).join(" · ") || "No hay precio público inequívoco; la ausencia está explicada en la ficha.");
}

function voiceSummary(review) {
  const message = review.messageArchitecture || {};
  const rows = collectRows([message.tone, message.voiceAnalysis, message.languagePatterns]).slice(0, 10);
  return truncate(rows.join(" · ") || "Tono no clasificable con evidencia pública suficiente.");
}

function frictionSummary(review, stats) {
  if (!stats.forms.length) return "Sin formulario comercial público medible; no equivale a que no exista una ruta privada.";
  const levels = stats.forms.map((form) => clean(typeof form.friction === "string" ? form.friction : form.friction?.level || form.friction?.reported)).filter(Boolean);
  return truncate(`${stats.forms.length} formulario(s), ${stats.fields} campos visibles y ${stats.required} obligatorios. Fricción: ${[...new Set(levels)].join(" / ") || "calculada en la ficha"}.`);
}

function formBlocks(forms) {
  if (!forms.length) return "- No se observó un formulario comercial público suficientemente medible.";
  return forms.map((form, formIndex) => {
    const url = safeUrl(form.sourceUrl || form.pageUrl);
    const title = escapeRich(form.purpose || `Formulario ${formIndex + 1}`);
    const fields = form.fields || [];
    const rows = fields.length
      ? fields.map((field, fieldIndex) => {
          const options = Array.isArray(field.options) && field.options.length ? ` · opciones: ${field.options.map(clean).join(" / ")}` : "";
          return `\t${fieldIndex + 1}. **${escapeRich(fieldLabel(field))}** · ${escapeRich(field.type || "tipo no visible")} · ${field.required ? "obligatorio" : "opcional"}${escapeRich(options)}`;
        }).join("\n")
      : "\t- No se recuperaron controles visibles.";
    return `<details color="green_bg">\n<summary>${title} · ${fields.length} campos</summary>\n\t${url ? `[Abrir superficie pública](${url})` : "Destino no observable públicamente."}\n\t**Método:** ${escapeRich(form.method || "no visible")} · **obligatorios:** ${Number(form.requiredFieldCount || 0)} · **envío durante la investigación:** no.\n${rows}\n</details>`;
  }).join("\n");
}

function funnelTable(review) {
  const rows = (review.funnel || []).map((stage, index) => `<tr>\n<td>${index + 1}. ${escapeRich(stage.stage)}</td>\n<td>${dimensionStatus(stage)}</td>\n<td>${escapeRich(truncate(stage.detail || stage.statement || stage.limitation || "Sin explicación pública", 1_600))}</td>\n</tr>`).join("\n");
  return `<table fit-page-width="true" header-row="true">\n<tr>\n<td>Etapa</td>\n<td>Estado</td>\n<td>Evidencia, lectura o límite</td>\n</tr>\n${rows}\n</table>`;
}

function evidenceBlocks(review) {
  const byUrl = new Map();
  for (const source of review.evidence || []) {
    const url = safeUrl(source.url);
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, new Set());
    byUrl.get(url).add(escapeRich(truncate(source.title || source.sourceType || "Fuente pública", 110)));
  }
  const links = [...byUrl.entries()].map(([url, titles], index) => {
    const labels = [...titles];
    const label = `${labels.slice(0, 2).join(" · ")}${labels.length > 2 ? ` · +${labels.length - 2} lecturas` : ""}`;
    return `[E${String(index + 1).padStart(3, "0")} · ${label}](${url})`;
  });
  if (!links.length) return "- No hay una URL pública utilizable; la limitación está explicada.";
  const chunks = [];
  for (let index = 0; index < links.length; index += 8) chunks.push(`- ${links.slice(index, index + 8).join(" · ")}`);
  return chunks.join("\n");
}

function imageBlocks(publicId, screenshots) {
  if (!screenshots) return "- No se obtuvo una captura pública verificable para esta ficha.";
  return Array.from({ length: screenshots }, (_, index) => `![Evidencia visual ${index + 1}](${PUBLIC_BASE}/evidence/${publicId}/funnel-${String(index + 1).padStart(2, "0")}.webp)`).join("\n");
}

function section(review, item, publicId, digest, screenshots) {
  const stats = formSummary(review);
  const portalUrl = `${PUBLIC_BASE}/?empresa=${encodeURIComponent(publicId)}`;
  const jsonUrl = `${PUBLIC_BASE}/data/funnel-v3/records/${encodeURIComponent(publicId)}.json`;
  const marker = `REDVITALIA-AUDITORIA:${digest}`;
  const message = review.messageArchitecture || {};
  const evidenceReferences = Array.isArray(review.evidence) ? review.evidence.length : 0;
  const uniqueEvidenceUrls = new Set((review.evidence || []).map((source) => safeUrl(source.url)).filter(Boolean)).size;
  const content = `## 🧠 Auditoría comercial profunda · RedVitalia
<callout icon="🧭" color="green_bg">
\t**Estado:** ${escapeRich(review.status)} · **Cobertura pública:** ${Number(review.coveragePercent || 0)}% · **Revisión:** ${escapeRich(review.reviewedAt || "2026-08-22")}
\tHechos públicos, inferencias y zonas no observables permanecen separados. No se enviaron formularios, no se crearon cuentas y no se contactó a la empresa.
</callout>
**Acceso rápido:** [Abrir ficha visual completa](${portalUrl}) · [Descargar expediente JSON](${jsonUrl})
### 1. Identidad, mercado y encaje competitivo
**Clasificación:** ${dimensionStatus(review.classification)}
${bullets(review.classification, "Clasificación limitada por falta de identidad pública.", 28)}
### 2. Cómo habla, qué promete y a quién
**Mensaje principal:** ${escapeRich(headline(review) || "No observable públicamente")}
**Promesa:** ${escapeRich(objectStatement(message.promise) || "No observable públicamente")}
**Voz comercial:** ${escapeRich(voiceSummary(review))}
<details color="blue_bg">
<summary>Arquitectura de mensaje, dolores, mecanismo, resultados y contradicciones</summary>
\t${bullets(message, "No se recuperó copy comercial suficiente.", 80).replaceAll("\n", "\n\t")}
</details>
### 3. Funnel de venta reconstruido · 12 etapas
${funnelTable(review)}
### 4. CTA, captura, campos y fricción
**CTA principal:** ${escapeRich(primaryCta(review) || "No observable públicamente")}
**Inventario:** ${stats.forms.length} formulario(s) · ${stats.fields} campos visibles · ${stats.required} obligatorios.
**Fricción:** ${escapeRich(frictionSummary(review, stats))}
${formBlocks(stats.forms)}
<details color="gray_bg">
<summary>Escalera completa de CTA y cualificación</summary>
\t${bullets([review.ctaLadder, review.captureAndQualification], "No observable públicamente.", 100).replaceAll("\n", "\n\t")}
</details>
### 5. Oferta, precios, contrato y garantía
**Precio local + EUR:** ${escapeRich(priceSummary(review))}
${bullets(review.offerEconomics, "No hay términos económicos públicos suficientes.", 80)}
### 6. Prueba, confianza, objeciones y cierre
<columns>
\t<column ratio="50">
\t\t#### Prueba y confianza
\t\t${bullets(review.proofAndTrust, "No observable públicamente.", 55).replaceAll("\n", "\n\t\t")}
\t</column>
\t<column ratio="50">
\t\t#### Objeciones y venta
\t\t${bullets(review.objectionsAndSales, "No observable públicamente.", 55).replaceAll("\n", "\n\t\t")}
\t</column>
</columns>
### 7. Adquisición, tecnología y seguimiento
<columns>
\t<column ratio="50">
\t\t#### Adquisición atribuible
\t\t${bullets(review.acquisition, "No se pudo atribuir un canal de descubrimiento.", 55).replaceAll("\n", "\n\t\t")}
\t</column>
\t<column ratio="50">
\t\t#### Tecnología y nurture
\t\t${bullets(review.technologyAndNurture, "No se observó una firma concluyente.", 55).replaceAll("\n", "\n\t\t")}
\t</column>
</columns>
### 8. Entrega y operación
${bullets(review.deliveryOperations, "La operación privada no es observable sin contratar.", 70)}
### 9. Lectura accionable para RedVitalia
${bullets(review.competitiveAssessment, "No procede una recomendación sin evidencia suficiente.", 90)}
### 10. Evidencias públicas y capturas verificadas
**Cobertura:** ${uniqueEvidenceUrls} URL(s) pública(s) única(s) en esta ficha, procedentes de ${evidenceReferences} referencia(s) analítica(s). Las repeticiones exactas se agrupan sin eliminar sus lecturas del expediente JSON.
${evidenceBlocks(review)}
${imageBlocks(publicId, screenshots)}
### 11. Limitaciones explícitas
${bullets(review.limitations, "Sin limitaciones adicionales.", 60)}
<callout icon="✅" color="blue_bg">
\tLa información íntegra y ampliable permanece en esta ficha madre y en su expediente público. No se han creado subpáginas ni se han añadido enlaces a espacios internos.
</callout>`;
  if (containsForbidden(content)) throw new Error(`Contenido privado detectado en ${item.name}.`);
  return { content, marker, portalUrl, jsonUrl, stats };
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, path);
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const idMap = JSON.parse(await readFile(ID_MAP_FILE, "utf8")).ids || {};
if (queue.items.length !== 712 || Object.keys(idMap).length !== 712) throw new Error("El plan de Notion exige exactamente 712 identidades biyectivas.");

const plan = [];
for (const item of queue.items) {
  if (item.synthesis?.status !== "complete" || item.qa?.status !== "complete") throw new Error(`No se puede planificar Notion antes de aprobar V3: ${item.name}.`);
  const review = JSON.parse(await readFile(`${REVIEW_DIR}/${item.id}.json`, "utf8"));
  let rendered = null;
  try { rendered = JSON.parse(await readFile(`${RENDERED_DIR}/${item.id}.json`, "utf8")); } catch { rendered = null; }
  const publicId = idMap[item.id];
  const digest = createHash("sha256").update(JSON.stringify(review)).digest("hex").slice(0, 16);
  const screenshots = Math.min(2, (rendered?.pages || []).filter((page) => page.screenshot).length);
  const built = section(review, item, publicId, digest, screenshots);
  const manual = Boolean(item.manualSources?.length);
  const excluded = item.scope === "Excluir — fuente/no negocio";
  plan.push({
    id: item.id,
    name: item.name,
    publicId,
    digest,
    marker: built.marker,
    section: built.content,
    properties: {
      "Estado de auditoría comercial": excluded ? "No aplica verificado" : manual ? "Verificada + manual" : Number(review.coveragePercent || 0) < 25 ? "Limitada documentada" : "Verificada",
      "Cobertura comercial (%)": Number(review.coveragePercent || 0),
      "Mensaje principal observado": truncate(headline(review) || "No observable públicamente; limitación documentada."),
      "CTA principal observado": truncate(primaryCta(review) || "No observable públicamente; limitación documentada."),
      "Mecanismo de captación": captureType(review, built.stats.forms),
      "Formularios observados": built.stats.forms.length,
      "Campos visibles observados": built.stats.fields,
      "Campos obligatorios observados": built.stats.required,
      "Evidencias verificadas": new Set((review.evidence || []).map((source) => safeUrl(source.url)).filter(Boolean)).size,
      "Capturas del embudo": screenshots,
      "Tono y lenguaje comercial": voiceSummary(review),
      "Fricción de conversión": frictionSummary(review, built.stats),
      "Precios públicos · local + EUR": priceSummary(review),
      "Limitaciones documentadas": truncate(collectRows(review.limitations).join(" · ") || "Sin limitaciones adicionales."),
      "Ficha pública RedVitalia": built.portalUrl,
      "date:Fecha de auditoría comercial:start": review.reviewedAt || "2026-08-22",
      "date:Fecha de auditoría comercial:is_datetime": 0,
      "Estado revisión integral": excluded ? "No aplica" : "Completa",
      "Estado del análisis": excluded ? "Descartado" : "Analizado",
      "Estado operativo": "Sin acción",
      "Auditoría comercial verificada": "__YES__",
      "Capturas verificadas": screenshots > 0 ? "__YES__" : "__NO__",
      "Pendientes de ficha": [],
      "Guion mystery shopping": "No ejecutado: esta auditoría utiliza solo evidencia pública consultable. No hay una acción pendiente y no se contactó a la empresa.",
      "Revisado por": ["ChatGPT"],
      "date:Última revisión:start": review.reviewedAt || "2026-08-22",
      "date:Última revisión:is_datetime": 0,
    },
  });
}

await writeJsonAtomic(OUTPUT_FILE, {
  format: "rv-notion-funnel-v3-plan-1",
  generatedAt: new Date().toISOString(),
  total: plan.length,
  records: plan,
});

const offsetArg = process.argv.find((arg) => arg.startsWith("--offset="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const offset = Number(offsetArg?.split("=")[1] || 0);
const limit = Number(limitArg?.split("=")[1] || 0);
console.log(JSON.stringify(limit ? plan.slice(offset, offset + limit) : { total: plan.length, output: OUTPUT_FILE }));
