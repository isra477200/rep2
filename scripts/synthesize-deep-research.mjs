import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/queue.json";
const COMPANIES_FILE = "public/data/companies.json";
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const companies = JSON.parse(await readFile(COMPANIES_FILE, "utf8"));
const companyById = new Map(companies.map((company) => [company.id, company]));

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value, length = 1_800) {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function unique(values, limit = Infinity) {
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit);
}

function commercialSnippets(values, limit = 6) {
  const boilerplate = /(?:cookie|privacy policy|pol[ií]tica de privacidad|terms of use|all rights reserved|skip to content|main menu)/i;
  const scored = unique((values || []).map((value) => truncate(value, 360)), 80)
    .filter((value) => value.split(/\s+/).length >= 3 && !boilerplate.test(value))
    .map((value) => ({
      value,
      score: (/[€$£¥₹₩]|\b(?:usd|eur|gbp|aed|sar|brl|mxn|ars|cop|clp|pen|mes|month|año|year|garant|refund|case stud|testimonial|cliente|client|resultado|result)/i.test(value) ? 20 : 0)
        + (/(?:^|\s)\d+(?:[.,]\d+)?(?:%|\s|$)/.test(value) ? 10 : 0)
        - Math.max(0, value.length - 260) / 30,
    }));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ value }) => value);
}

function escapeMarkdown(value) {
  return clean(value)
    .replaceAll("\\", "\\\\")
    .replace(/([*~`$[\]<>{}|^])/g, "\\$1");
}

function safeLink(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(parsed.hostname) || /\.notion\.site$/i.test(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function link(label, url) {
  const safe = safeLink(url);
  return safe ? `[${escapeMarkdown(label)}](${safe})` : escapeMarkdown(label);
}

function statusLabel(status) {
  return {
    observado: "✅ Observado",
    inferido: "🟡 Inferido",
    "no observable": "⚪ No observable",
    "no aplica": "🔵 No aplica",
  }[status] || escapeMarkdown(status);
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function ctaScore(value) {
  const text = clean(value).toLowerCase();
  let score = 0;
  if (/book|agenda|reserva|schedule|demo|consulta|consult|audit|auditor|diagn[oó]stico|health check/.test(text)) score += 100;
  if (/contact|contacto|quote|presupuesto|cotiza|apply|solicita|request/.test(text)) score += 80;
  if (/start|empieza|comenzar|free|gratis|download|descarga|whatsapp|llama|call/.test(text)) score += 60;
  if (/お問い合わせ|無料相談|資料請求|見積もり|費用を診断|문의하기|무료 상담|견적 요청|تواصل معنا|احجز|استشارة|დაგვიკავშირდით|კონსულტაცია|связаться|консультаци/.test(text)) score += 100;
  if (/learn|saber|más información|more/.test(text)) score += 20;
  if (/cookie|men[uú]|aceptar|rechazar|anterior|siguiente|privacy|privacidad|newsletter/.test(text)) score -= 100;
  score += Math.max(0, 30 - text.length / 4);
  return score;
}

function chooseHero(record) {
  const noise = /^(?:home|inicio|contact|contacto|tel[eé]fono|servicios?|services?|about|nosotros|company|empresa|menu|men[uú]|お問い合わせ|会社概要|モバイル下部)$/i;
  const evidence = [...(record.commercialForensics.message.heroEvidence || [])]
    .filter((hero) => hero.text && !noise.test(clean(hero.text)))
    .sort((a, b) => Number(b.isRoot) - Number(a.isRoot)
      || ({ offer: 4, conversion: 3, pricing: 2, other: 1 }[b.pageCategory] || 0) - ({ offer: 4, conversion: 3, pricing: 2, other: 1 }[a.pageCategory] || 0));
  return evidence[0]?.text || null;
}

function choosePrimaryCta(record) {
  const social = /(?:^|\b)(?:share on|compartir en|facebook|instagram|linkedin|youtube|twitter|tiktok)(?:\b|$)/i;
  const socialDestination = /(?:facebook|instagram|linkedin|youtube|twitter|tiktok)\.com/i;
  const navigation = /\/(?:blog|articles?|help|faq|case-stud|reviews?|careers?|about|team|industries?)(?:[/?#-]|$)/i;
  const candidates = (record.commercialForensics.conversion.ctaEvidence || [])
    .filter((cta) => cta.kind === "conversion" && clean(cta.text).length >= 3 && clean(cta.text).length <= 110 && !social.test(clean(cta.text)) && !socialDestination.test(cta.href || ""))
    .map((cta) => ({
      ...cta,
      score: ctaScore(cta.text)
        + (cta.href && !navigation.test(new URL(cta.href).pathname) ? 35 : 0)
        + (/\/(?:contact|book|schedule|agenda|demo|quote|apply|start|checkout)(?:[/?#-]|$)/i.test(cta.href || "") ? 80 : 0)
        + (new URL(cta.pageUrl).pathname === "/" ? 20 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return candidates.find((cta) => cta.score > 45) || null;
}

function dedupeForms(forms) {
  const signatures = new Set();
  const result = [];
  for (const form of forms || []) {
    const signature = JSON.stringify((form.fields || []).map((field) => [field.type, field.name, field.label, field.required]));
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    result.push(form);
  }
  return result;
}

function describeForms(forms) {
  if (!forms.length) return {
    text: "No se observó un formulario HTML público en las páginas recuperadas; puede existir uno dinámico o una ruta alternativa.",
    friction: "No medible",
    minFields: 0,
    maxFields: 0,
    qualification: [],
  };
  const counts = forms.map((form) => form.visibleFieldCount || 0);
  const minFields = Math.min(...counts);
  const maxFields = Math.max(...counts);
  const allFields = forms.flatMap((form) => form.fields || []);
  const qualification = unique(allFields.map((field) => field.label || field.name || field.placeholder).filter((name) => /company|empresa|puesto|cargo|role|budget|presupuesto|revenue|factur|sector|industry|servicio|objetivo|goal|area|ciudad|city|territor|website|web|team|equipo/i.test(name)), 12);
  const friction = minFields <= 3 ? "Baja" : minFields <= 7 ? "Media" : "Alta";
  const required = Math.min(...forms.map((form) => form.requiredFieldCount || 0));
  return {
    text: `${forms.length} diseño(s) de formulario distinto(s); entre ${minFields} y ${maxFields} campos visibles, mínimo ${required} obligatorio(s). Fricción ${friction.toLowerCase()} en la variante más corta.${qualification.length ? ` Cualifica mediante: ${qualification.join(", ")}.` : " No se detectaron campos explícitos de presupuesto, tamaño o objetivo."}`,
    friction,
    minFields,
    maxFields,
    qualification,
  };
}

function captureType(record, forms) {
  const conversion = record.commercialForensics.conversion;
  if (conversion.checkoutObserved && conversion.checkoutEvidence?.length) return "Checkout verificado";
  if (conversion.bookingDestinationObserved && conversion.bookingEvidence?.length) return "Agenda";
  if (forms.some((form) => form.kind === "booking")) return "Agenda mediante formulario";
  if (forms.some((form) => form.kind === "listing")) return "Alta / listado profesional";
  if (forms.length) return "Formulario";
  if (conversion.bookingIntentObserved) return "Intención de agenda";
  if (conversion.contacts.includes("WhatsApp")) return "WhatsApp";
  if (conversion.technologies.some((technology) => /Intercom|Drift|Crisp|Tidio|HubSpot/i.test(technology))) return "Chat";
  if (conversion.contacts.some((channel) => /Teléfono|Email/i.test(channel))) return "Teléfono / email";
  return record.pages.length ? "Sin captura visible" : (record.scope === "Excluir — fuente/no negocio" ? "No aplica" : "Sin captura visible");
}

function notionCaptureType(capture) {
  if (capture === "Checkout verificado") return "Checkout";
  if (capture.startsWith("Agenda")) return "Agenda";
  if (capture === "Alta / listado profesional") return "Formulario";
  if (capture === "Intención de agenda") return "Sin captura visible";
  return capture;
}

function voiceSummary(record) {
  const baseSignals = record.commercialForensics.message.voice.signals || [];
  const metrics = record.commercialForensics.message.voice.metrics || {};
  const heroes = record.commercialForensics.message.heroes || [];
  const numeric = metrics.numericTokens || 0;
  const usablePages = record.commercialForensics.coverage.usablePageCount || record.pages.length || 1;
  const wordsPerPage = Math.round((metrics.words || 0) / usablePages);
  const signals = unique([
    ...baseSignals,
    (metrics.firstPersonPlural || 0) > (metrics.secondPerson || 0) * 1.25 ? "centrado en la marca" : null,
    (metrics.questions || 0) >= 5 ? "consultivo / basado en preguntas" : null,
    wordsPerPage >= 750 ? "explicativo" : null,
    wordsPerPage > 0 && wordsPerPage <= 260 ? "conciso" : null,
    (record.commercialForensics.conversion.ctaEvidence || []).length >= 5 ? "orientado a la acción" : null,
    (record.commercialForensics.offer.guarantee || []).length ? "apoya la venta en reversión de riesgo" : null,
    (record.commercialForensics.offer.proof || []).length >= 3 ? "apoya la promesa en prueba social" : null,
  ], 12);
  const evidence = heroes.slice(0, 3).map((hero) => `“${hero}”`).join(" · ");
  return truncate(`Tono ${signals.join(", ")}. ${numeric ? `Usa ${numeric} cifras o porcentajes en las páginas revisadas.` : "La argumentación visible usa pocas cifras."} Densidad aproximada: ${wordsPerPage || "no medible"} palabras por página comercial recuperada.${evidence ? ` Muestras breves: ${evidence}.` : ""}`, 1_500);
}

function funnelRoute(record) {
  const visible = (record.commercialForensics.funnel || []).filter((stage) => stage.status !== "no observable");
  if (!visible.length) return "No se pudo reconstruir una ruta pública; acceso limitado o entidad sin funnel comercial verificable.";
  return visible.map((stage) => `${stage.stage} [${stage.status}]`).join(" → ");
}

function redVitaliaLessons(record, company, formAnalysis, primaryCta) {
  const conversion = record.commercialForensics.conversion;
  const offer = record.commercialForensics.offer;
  const lessons = [];
  if (primaryCta) lessons.push(`**Adaptar:** una acción principal inequívoca como “${primaryCta}”, manteniendo una sola ruta dominante por landing.`);
  if (formAnalysis.minFields > 0 && formAnalysis.minFields <= 3) lessons.push(`**Probar:** captura de baja fricción (${formAnalysis.minFields} campos) y cualificación después, midiendo calidad y tasa de cita.`);
  if (formAnalysis.minFields >= 8) lessons.push(`**Evitar o testear:** el formulario más corto ya pide ${formAnalysis.minFields} campos; dividir cualificación y reserva puede reducir abandono.`);
  if (offer.guarantee.length) lessons.push("**Adaptar:** convertir la reversión de riesgo visible en una condición contractual medible, no en una promesa ambigua.");
  if (offer.proof.length) lessons.push("**Copiar con control:** presentar casos con cliente, periodo, inversión, denominador y resultado; distinguir siempre datos autodeclarados de auditoría independiente.");
  if (offer.objections.length) lessons.push("**Copiar:** responder objeciones de precio, plazo, permanencia y resultados antes del CTA de alto compromiso.");
  if (conversion.contacts.includes("WhatsApp")) lessons.push("**Probar:** WhatsApp como vía rápida, con consentimiento, SLA de respuesta y trazabilidad en CRM.");
  if (conversion.technologies.length) lessons.push(`**Replicar la disciplina de medición:** el stack público detectado (${conversion.technologies.slice(0, 5).join(", ")}) indica una captación instrumentada; RedVitalia debe mantener atribución de fuente a venta.`);
  if (!record.pages.length) lessons.push("**No copiar todavía:** falta evidencia pública accesible; mantener esta referencia fuera de decisiones hasta una revisión visual o una fuente alternativa.");
  if (company.scope === "Excluir — fuente/no negocio") lessons.push("**Clasificación a validar:** confirmar que es fuente/no negocio antes de declarar el funnel como no aplicable.");
  return lessons.slice(0, 6);
}

function makeEvidenceRows(record) {
  const sourceUrls = unique([
    ...(record.pages || []).map((page) => page.url),
    ...(record.sourceAudit?.cleanPublicUrls || []),
  ], 30).filter(safeLink);
  return sourceUrls.map((url, index) => ({ id: index + 1, url, label: `Fuente pública ${index + 1}` }));
}

function buildMarkdown(review, record, company) {
  const { message, conversion, offer, funnel, evidence, limitations, redVitalia } = review;
  const formLines = conversion.forms.length
    ? conversion.forms.slice(0, 6).map((form) => `- ${link(new URL(form.pageUrl).pathname || "Formulario", form.pageUrl)} — ${form.visibleFieldCount} campos visibles; ${form.requiredFieldCount} obligatorios; envío no realizado.`).join("\n")
    : "- No se observó un formulario HTML recuperable. Esto no demuestra que no exista: puede cargarse con JavaScript o vivir tras un CTA.";
  const funnelRows = funnel.map((stage) => {
    const evidenceText = stage.evidence?.length ? escapeMarkdown(stage.evidence.slice(0, 3).join(" · ")) : escapeMarkdown(stage.note || "Sin evidencia pública adicional.");
    return `<tr>\n<td>${escapeMarkdown(stage.stage)}</td>\n<td>${statusLabel(stage.status)}</td>\n<td>${evidenceText}</td>\n</tr>`;
  }).join("\n");
  const sourceLines = evidence.map((source) => `- ${link(source.label, source.url)}`).join("\n") || "- No se recuperó una URL pública; véase la limitación documentada.";
  const ctaList = conversion.ctas.length ? conversion.ctas.slice(0, 12).map((cta) => `- ${escapeMarkdown(cta)}`).join("\n") : "- No se observó un CTA legible.";
  const tech = conversion.technologies.length ? conversion.technologies.map(escapeMarkdown).join(" · ") : "No detectado en el HTML público; no significa que no exista.";
  const objections = offer.objections.length ? offer.objections.slice(0, 8).map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "- No se localizaron objeciones explícitas en las páginas recuperadas.";
  const observedPrices = offer.prices.length ? offer.prices.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "- No se localizó una señal de precio suficientemente legible en las páginas recuperadas.";
  const observedGuarantees = offer.guarantee.length ? offer.guarantee.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "- No se localizó una garantía o reversión de riesgo explícita en las páginas recuperadas.";
  const observedProof = offer.proof.length ? offer.proof.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "- No se localizó una prueba comercial suficientemente legible en las páginas recuperadas.";
  const observedUrgency = offer.urgency.length ? offer.urgency.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "- No se localizó una señal explícita de urgencia o escasez.";
  const limitationsText = limitations.map((item) => `- ${escapeMarkdown(item)}`).join("\n");

  return `## 🧬 Auditoría forense comercial V2
<callout icon="🔬" color="blue_bg">
	**${review.marker}**
	**Estado:** ${escapeMarkdown(review.status)} · **Cobertura observable:** ${review.coveragePercent}% · **Confianza:** ${escapeMarkdown(review.confidence)} · **Revisión:** 22/08/2026
	Solo se registran hechos públicos. No se enviaron formularios, no se reservaron citas y no se contactó a la empresa.
</callout>
### 1. Mensaje, posicionamiento y manera de hablar
**Hero principal:** ${escapeMarkdown(message.hero)}

**Lectura de voz:** ${escapeMarkdown(message.voice)}

**Oferta ya documentada:** ${escapeMarkdown(company.offer || "No publicada o no aplicable.")}

**Público objetivo:** ${escapeMarkdown(company.niche || "No se pudo identificar con precisión; queda documentado como no observable.")}
### 2. Recorrido comercial reconstruido
<table fit-page-width="true" header-row="true">
<tr>
<td>Etapa</td>
<td>Estado</td>
<td>Evidencia o límite</td>
</tr>
${funnelRows}
</table>
**Ruta primaria resumida:** ${escapeMarkdown(review.route)}
### 3. CTA, formularios y fricción
**CTA principal:** ${escapeMarkdown(conversion.primaryCta || "No observable")}

**Escalera de CTA observada:**
${ctaList}

**Captura principal:** ${escapeMarkdown(conversion.captureType)}

**Diagnóstico de fricción:** ${escapeMarkdown(conversion.formAnalysis.text)}

${formLines}
### 4. Oferta, prueba, riesgo y objeciones
**Precio:** ${escapeMarkdown(company.priceLocal || "No publicado o no convertible; no se inventa.")}

**Contrato / permanencia:** ${escapeMarkdown(company.contract || "No publicado; ausencia documentada.")}

**Garantía / riesgo:** ${escapeMarkdown(company.guarantee || "No publicada; ausencia documentada.")}

**Prueba social:** ${escapeMarkdown(company.proof || "No localizada públicamente; ausencia documentada.")}

**Señales textuales actuales de precio:**
${observedPrices}

**Señales textuales actuales de garantía / reversión de riesgo:**
${observedGuarantees}

**Señales textuales actuales de prueba:**
${observedProof}

**Urgencia o escasez observable:**
${observedUrgency}

Estos fragmentos sirven para localizar evidencia; no sustituyen la lectura de la fuente ni convierten una afirmación autodeclarada en un hecho independiente.

**Objeciones visibles:**
${objections}
### 5. Tecnología comercial observable
${escapeMarkdown(tech)}

La detección se basa en scripts, iframes, acciones de formulario y enlaces públicos. **“No detectado” no equivale a “no existe”.**
### 6. Lectura accionable para RedVitalia
${redVitalia.join("\n")}
### 7. Evidencias públicas revisadas
${sourceLines}
### 8. Limitaciones y contradicciones
${limitationsText}
`;
}

function buildReview(record, company) {
  const forms = dedupeForms(record.commercialForensics.conversion.forms || []);
  const formAnalysis = describeForms(forms);
  const primaryCtaEvidence = choosePrimaryCta(record);
  const ctas = unique((record.commercialForensics.conversion.ctaEvidence || []).filter((cta) => cta.kind === "conversion").map((cta) => cta.text), 30).sort((a, b) => ctaScore(b) - ctaScore(a));
  const primaryCta = primaryCtaEvidence?.text || null;
  const capture = captureType(record, forms);
  const observedHero = chooseHero(record);
  const hero = observedHero || "No se recuperó un hero actual verificable; la síntesis previa se conserva separada y no se presenta como titular observado.";
  const route = funnelRoute(record);
  const evidence = makeEvidenceRows(record);
  const rawCoverage = record.commercialForensics.coverage.observedPercent || 0;
  const usablePages = record.commercialForensics.coverage.usablePageCount ?? record.pages.length;
  const status = usablePages ? "Borrador automático" : "Limitada";
  const confidence = usablePages >= 2 && rawCoverage >= 40 ? "Media" : "Limitada";
  const observedOffer = {
    ...record.commercialForensics.offer,
    prices: commercialSnippets(record.commercialForensics.offer.prices, 6),
    guarantee: commercialSnippets(record.commercialForensics.offer.guarantee, 6),
    proof: commercialSnippets(record.commercialForensics.offer.proof, 6),
    objections: commercialSnippets(record.commercialForensics.offer.objections, 8),
    urgency: commercialSnippets(record.commercialForensics.offer.urgency, 6),
  };
  const limitations = unique([
    ...(record.limitations || []),
    ...record.commercialForensics.coverage.dimensions
      .filter((dimension) => dimension.status === "no observable")
      .map((dimension) => dimension.explanation || `${dimension.name}: no se localizó evidencia pública en las páginas recuperadas.`),
  ], 30);
  const review = {
    schemaVersion: record.schemaVersion,
    id: record.id,
    name: record.name,
    reviewedAt: new Date().toISOString(),
    status,
    confidence,
    coveragePercent: rawCoverage,
    message: { hero, heroObserved: Boolean(observedHero), priorSummary: company.offer || null, voice: voiceSummary(record), supportingHeadings: record.commercialForensics.message.supportingHeadings || [] },
    conversion: {
      primaryCta,
      primaryCtaEvidence,
      ctas,
      captureType: capture,
      forms,
      formAnalysis,
      contacts: record.commercialForensics.conversion.contacts,
      bookingObserved: record.commercialForensics.conversion.bookingObserved,
      checkoutObserved: record.commercialForensics.conversion.checkoutObserved,
      technologies: record.commercialForensics.conversion.technologies,
    },
    offer: observedOffer,
    funnel: record.commercialForensics.funnel.map((stage) => ({
      ...stage,
      note: stage.note || (stage.status === "no observable" ? `${stage.stage}: no se localizó evidencia pública y no se ejecutó ninguna conversión.` : null),
    })),
    route,
    evidence,
    limitations,
    redVitalia: redVitaliaLessons(record, company, formAnalysis, primaryCta),
  };
  const hash = createHash("sha256").update(JSON.stringify(review)).digest("hex").slice(0, 16);
  review.marker = `RV-FUNNEL-V2:${record.id}:${hash}`;
  review.notionProperties = {
    "Funnel V2 estado": status,
    "Cobertura funnel V2": rawCoverage,
    "date:Fecha revisión funnel V2:start": "2026-08-22",
    "date:Fecha revisión funnel V2:is_datetime": 0,
    "Hero / mensaje V2": truncate(hero),
    "Tono comercial V2": truncate(review.message.voice),
    "CTA primario V2": truncate(primaryCta || "No observable; ausencia documentada."),
    "Captura V2": notionCaptureType(capture),
    "Fricción formulario V2": truncate(formAnalysis.text),
    "Stack comercial V2": truncate(review.conversion.technologies.join(" · ") || "No detectado públicamente; no equivale a inexistente."),
    "Ruta funnel V2": truncate(route),
    "Limitación funnel V2": truncate(limitations.join(" ")),
    "Evidencias funnel V2": evidence.length,
  };
  review.notionMarkdown = buildMarkdown(review, record, company);
  return review;
}

let reviewed = 0;
let skipped = 0;
for (const item of queue.items) {
  if (!["complete", "limited"].includes(item.collect.status)) continue;
  const company = companyById.get(item.id);
  if (!company) continue;
  try {
    const record = JSON.parse(await readFile(`research/deep/${item.recordFile}`, "utf8"));
    if (record.schemaVersion !== queue.schemaVersion) {
      skipped += 1;
      continue;
    }
    const review = buildReview(record, company);
    await writeJsonAtomic(`research/deep/reviews/${item.id}.json`, review);
    item.review = { status: "complete", attempts: (item.review.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: null };
    reviewed += 1;
  } catch (error) {
    item.review = { status: "failed", attempts: (item.review.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: String(error.message || error) };
  }
}

queue.updatedAt = new Date().toISOString();
queue.stats.review = queue.items.reduce((counts, item) => {
  counts[item.review.status] = (counts[item.review.status] || 0) + 1;
  return counts;
}, {});
await writeJsonAtomic(QUEUE_FILE, queue);
console.log(JSON.stringify({ reviewed, skipped, review: queue.stats.review }, null, 2));
