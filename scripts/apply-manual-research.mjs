import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const ROOT = "research/deep";
const REVIEW_DIR = `${ROOT}/reviews`;
const COMPANIES_FILE = "public/data/companies.json";
const companies = JSON.parse(await readFile(COMPANIES_FILE, "utf8"));

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value, length = 1_800) {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function unique(values, limit = Infinity) {
  return [...new Set((values || []).map(clean).filter(Boolean))].slice(0, limit);
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return clean(value);
  if (Array.isArray(value)) return unique(value.map(textOf)).join(" · ");
  if (typeof value === "object") {
    const preferred = ["label", "headline", "promise", "summary", "detail", "finding", "observation", "term", "value", "name", "technology", "type", "assessment", "marketing", "termsOrOtherPage"];
    const pieces = preferred.filter((key) => value[key] != null).map((key) => textOf(value[key]));
    const extras = Object.entries(value)
      .filter(([key, child]) => !preferred.includes(key) && !["status", "id", "url", "destination", "evidence", "evidenceIds", "supports", "accessedAt"].includes(key) && child != null)
      .map(([key, child]) => `${key}: ${textOf(child)}`);
    return unique([...pieces, ...extras].length ? [...pieces, ...extras] : Object.values(value).map(textOf)).join(" — ");
  }
  return clean(value);
}

function listOf(value, limit = 20) {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return unique(items.map(textOf), limit);
}

function safeUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : value?.url);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function escapeMarkdown(value) {
  return clean(value)
    .replaceAll("\\", "\\\\")
    .replace(/([*~`$<>{}|^])/g, "\\$1")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function link(label, url) {
  const safe = safeUrl(url);
  return safe ? `[${escapeMarkdown(label)}](${safe})` : escapeMarkdown(label);
}

function sourcesOf(raw) {
  const candidates = [
    ...(raw.sources || []),
    ...(raw.officialUrls || []),
    ...(raw.evidence || []),
  ];
  const seen = new Set();
  return candidates.flatMap((candidate, index) => {
    const url = safeUrl(candidate);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, label: candidate?.role || candidate?.id || `Fuente manual ${index + 1}`, status: candidate?.status || (candidate?.verified ? "observado" : "observado") }];
  });
}

function normalizeForms(forms) {
  return (forms || []).map((form) => ({
    url: safeUrl(form.url || form.pageUrl),
    purpose: form.purpose || form.type || "Captura o contacto",
    fields: Array.isArray(form.fields) ? form.fields.map((field) => textOf(field)).filter(Boolean) : [],
    fieldCount: form.fieldCount ?? form.visibleFieldCount ?? form.visibleFields ?? (Array.isArray(form.fields) ? form.fields.length : null),
    friction: textOf(form.friction || form.notes || form.requiredStatus),
    submitted: false,
  }));
}

function normalizeFunnel(value) {
  const stages = Array.isArray(value) ? value : value?.primaryPath || value?.stages || [];
  return stages.map((stage, index) => ({
    stage: stage.name || stage.stage || `Etapa ${index + 1}`,
    status: stage.status || stage.evidence || "observado",
    detail: stage.details || stage.detail || stage.note || textOf(stage),
  }));
}

function normalizeLessons(value = {}) {
  return {
    copy: listOf(value.copy || value.copyOrAdapt || value.adopt || value.copiar),
    adapt: unique([
      ...listOf(value.adapt || value.adaptar),
      ...listOf(value.experiment),
      ...listOf(value.strategicLesson),
    ]),
    avoid: listOf(value.avoid || value.evitar),
    test: listOf(value.test || value.tests || value.probar),
  };
}

function waveOf(raw, sourceFile, fallback = "manual") {
  return (
    raw.wave ||
    sourceFile.match(/(?:^|\/)(manual-(?:wave-\d+|pilot))(?:\/|$)/i)?.[1] ||
    fallback
  );
}

function normalizeManual(raw, sourceFile) {
  if (raw.observed) {
    const observed = raw.observed;
    return {
      schemaVersion: raw.schemaVersion,
      sourceFile,
      wave: waveOf(raw, sourceFile, "manual-pilot"),
      reviewedAt: raw.reviewedAt,
      message: {
        headline: observed.messageAndVoice?.headline,
        promise: observed.messageAndVoice?.promise,
        positioning: observed.messageAndVoice?.positioning,
        audience: textOf(observed.offer?.fitCriteria),
        voice: listOf(observed.messageAndVoice?.voice),
        patterns: listOf(observed.messageAndVoice?.problemLanguage),
      },
      cta: {
        primary: observed.conversion?.primaryCtas?.[0] || observed.conversion?.booking,
        secondary: listOf(observed.conversion?.primaryCtas?.slice(1)),
        forms: normalizeForms(observed.conversion?.forms),
      },
      funnel: normalizeFunnel(observed.funnel),
      terms: {
        pricing: listOf(observed.offer?.pricing),
        contract: listOf(observed.offer?.contractTerms),
        guarantee: listOf(observed.offer?.guarantee),
      },
      proof: listOf(observed.proof),
      objections: listOf(observed.objectionsHandled),
      technology: listOf(observed.technology),
      contradictions: listOf(observed.termsAndContradictions),
      inferences: listOf(raw.inferred),
      notObservable: listOf(raw.notObservable),
      limitations: listOf(raw.limitations),
      lessons: normalizeLessons(raw.redVitaliaLessons),
      sources: sourcesOf(raw),
    };
  }

  if (raw.messageAndVoice) {
    return {
      schemaVersion: raw.schemaVersion,
      sourceFile,
      wave: waveOf(raw, sourceFile),
      reviewedAt: raw.reviewedAt,
      message: {
        headline: raw.messageAndVoice.headline,
        promise: raw.messageAndVoice.promise,
        positioning: raw.classification?.scope,
        audience: raw.messageAndVoice.audience,
        voice: listOf(raw.messageAndVoice.tone),
        patterns: listOf(raw.messageAndVoice.languagePatterns),
      },
      cta: {
        primary: textOf(raw.ctaAndForms?.primaryCta?.label || raw.ctaAndForms?.primaryCta),
        secondary: listOf(raw.ctaAndForms?.secondaryCtas),
        forms: normalizeForms(raw.ctaAndForms?.forms),
      },
      funnel: normalizeFunnel(raw.funnel),
      terms: {
        pricing: listOf(raw.commercialTerms?.pricing),
        contract: listOf(raw.commercialTerms?.contract),
        guarantee: listOf(raw.commercialTerms?.guarantee),
      },
      proof: listOf(raw.commercialTerms?.proof || raw.proof),
      objections: listOf(raw.commercialTerms?.objections || raw.objections),
      technology: unique([
        ...listOf(raw.stack?.detectedOnPublicSite),
        ...listOf(raw.stack?.claimedDeliveryStack),
      ]),
      contradictions: listOf(raw.commercialTerms?.contradictionsOrAmbiguities),
      inferences: normalizeFunnel(raw.funnel).filter((stage) => /inferido/i.test(stage.status)).map((stage) => `${stage.stage}: ${stage.detail}`),
      notObservable: unique([
        ...listOf(raw.funnel?.unknowns),
        ...listOf(raw.stack?.notObservable),
        ...(/no observable/i.test(raw.ctaAndForms?.postSubmit?.status || "") ? listOf(raw.ctaAndForms?.postSubmit?.detail) : []),
      ]),
      limitations: listOf(raw.limitations),
      lessons: normalizeLessons(raw.redVitaliaLessons),
      sources: sourcesOf(raw),
    };
  }

  return {
    schemaVersion: raw.schemaVersion,
    sourceFile,
    wave: waveOf(raw, sourceFile),
    reviewedAt: raw.reviewedAt,
    message: {
      headline: raw.voice?.headline || raw.offer?.headline || raw.message?.headline,
      promise: raw.voice?.promise || raw.voice?.primaryPromise || raw.offer?.promise || raw.offer?.serviceModel || raw.message?.promise,
      positioning: raw.offer?.positioning || raw.voice?.archetype || raw.classification?.scope,
      audience: raw.offer?.audience || raw.offer?.fit || raw.niche,
      voice: listOf(raw.voice?.tone || raw.voice?.toneSignals || raw.voice?.signals || raw.voice),
      patterns: listOf(raw.voice?.patterns || raw.voice?.languagePatterns || raw.voice?.recurringLanguage),
    },
    cta: {
      primary: textOf(raw.conversion?.primaryCta || raw.conversion?.primaryCtas?.[0] || raw.cta?.primary),
      secondary: listOf(raw.conversion?.secondaryCtas || raw.conversion?.ctas || raw.cta?.secondary),
      forms: normalizeForms(raw.conversion?.forms || raw.forms),
    },
    funnel: normalizeFunnel(raw.funnel),
    terms: {
      pricing: listOf(raw.offer?.pricing || raw.terms?.pricing),
      contract: listOf(raw.offer?.contract || raw.offer?.contractTerms || raw.terms?.contract),
      guarantee: listOf(raw.offer?.guarantee || raw.terms?.guarantee),
    },
    proof: listOf(raw.proof),
    objections: listOf(raw.objections),
    technology: listOf(raw.technology),
    contradictions: listOf(raw.contradictions),
    inferences: listOf(raw.inferred),
    notObservable: listOf(raw.notObservable),
    limitations: listOf(raw.limitations),
    lessons: normalizeLessons(raw.redVitalia),
    sources: sourcesOf(raw),
  };
}

function uniqueObjects(values, keyOf) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyOf(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeManuals(manuals) {
  const latest = manuals.at(-1);
  const lastText = (path) => {
    for (let index = manuals.length - 1; index >= 0; index -= 1) {
      const value = path(manuals[index]);
      if (clean(value)) return value;
    }
    return null;
  };
  const mergeList = (path, limit = 40) => unique(manuals.flatMap((manual) => path(manual) || []), limit);
  return {
    schemaVersion: latest.schemaVersion,
    sourceFile: manuals.map((manual) => manual.sourceFile).join(" | "),
    wave: unique(manuals.map((manual) => manual.wave)).join(" + "),
    reviewedAt: manuals.map((manual) => manual.reviewedAt).filter(Boolean).sort().at(-1),
    message: {
      headline: lastText((manual) => manual.message.headline),
      promise: lastText((manual) => manual.message.promise),
      positioning: lastText((manual) => manual.message.positioning),
      audience: lastText((manual) => manual.message.audience),
      voice: mergeList((manual) => manual.message.voice),
      patterns: mergeList((manual) => manual.message.patterns),
    },
    cta: {
      primary: lastText((manual) => manual.cta.primary),
      secondary: mergeList((manual) => manual.cta.secondary),
      forms: uniqueObjects(
        manuals.flatMap((manual) => manual.cta.forms),
        (form) => `${form.url || ""}|${form.purpose}|${form.fieldCount ?? ""}`,
      ),
    },
    funnel: uniqueObjects(
      manuals.flatMap((manual) => manual.funnel),
      (stage) => `${stage.stage}|${stage.status}|${stage.detail}`,
    ),
    terms: {
      pricing: mergeList((manual) => manual.terms.pricing),
      contract: mergeList((manual) => manual.terms.contract),
      guarantee: mergeList((manual) => manual.terms.guarantee),
    },
    proof: mergeList((manual) => manual.proof),
    objections: mergeList((manual) => manual.objections),
    technology: mergeList((manual) => manual.technology),
    contradictions: mergeList((manual) => manual.contradictions),
    inferences: mergeList((manual) => manual.inferences),
    notObservable: mergeList((manual) => manual.notObservable),
    limitations: mergeList((manual) => manual.limitations),
    lessons: {
      copy: mergeList((manual) => manual.lessons.copy),
      adapt: mergeList((manual) => manual.lessons.adapt),
      avoid: mergeList((manual) => manual.lessons.avoid),
      test: mergeList((manual) => manual.lessons.test),
    },
    sources: uniqueObjects(
      manuals.flatMap((manual) => manual.sources),
      (source) => source.url,
    ),
  };
}

function bullets(values, fallback) {
  return values?.length ? values.map((value) => `- ${escapeMarkdown(value)}`).join("\n") : `- ${escapeMarkdown(fallback)}`;
}

function manualMarkdown(manual) {
  const forms = manual.cta.forms.length
    ? manual.cta.forms.map((form) => `- ${form.url ? link(form.purpose, form.url) : escapeMarkdown(form.purpose)} — ${form.fieldCount ?? "número no observable"} campos; ${escapeMarkdown(form.friction || "fricción no medible")}; no enviado.`).join("\n")
    : "- No se observó o no se pudo inspeccionar manualmente un formulario; la limitación queda declarada.";
  const funnel = manual.funnel.length
    ? manual.funnel.map((stage, index) => `${index + 1}. **${escapeMarkdown(stage.stage)}** — ${escapeMarkdown(stage.status)} — ${escapeMarkdown(stage.detail)}`).join("\n")
    : "- No se pudo reconstruir manualmente una ruta pública adicional.";
  const sources = manual.sources.length
    ? manual.sources.map((source) => `- ${link(source.label, source.url)} — ${escapeMarkdown(source.status)}`).join("\n")
    : "- Sin fuente manual adicional; se conservan las fuentes del rastreo automático.";
  const lessons = unique([
    ...manual.lessons.copy.map((value) => `Copiar: ${value}`),
    ...manual.lessons.adapt.map((value) => `Adaptar: ${value}`),
    ...manual.lessons.avoid.map((value) => `Evitar: ${value}`),
    ...manual.lessons.test.map((value) => `Probar: ${value}`),
  ]);
  return `## 🧠 Revisión manual prioritaria
<callout icon="🧠" color="purple_bg">
	**Evidencia revisada manualmente · ${escapeMarkdown(manual.wave)} · ${escapeMarkdown(manual.reviewedAt || "22/08/2026")}**
	Las fuentes se abrieron y contrastaron sin enviar formularios, reservar citas, pagar ni contactar a la empresa.
</callout>
### Mensaje y voz
**Titular / promesa:** ${escapeMarkdown(manual.message.headline || "No observable en la revisión manual.")}

**Promesa desarrollada:** ${escapeMarkdown(manual.message.promise || "No observable en la revisión manual.")}

**Posicionamiento:** ${escapeMarkdown(manual.message.positioning || "No observable en la revisión manual.")}

**Audiencia:** ${escapeMarkdown(manual.message.audience || "No observable en la revisión manual.")}

**Tono:** ${escapeMarkdown(manual.message.voice.join(" · ") || "No medible")}

**Patrones de lenguaje:**
${bullets(manual.message.patterns, "No se aislaron patrones adicionales.")}
### Conversión y recorrido
**CTA principal:** ${escapeMarkdown(manual.cta.primary || "No observable")}

**CTA secundarios:**
${bullets(manual.cta.secondary, "No se aislaron CTA secundarios.")}

**Formularios:**
${forms}

**Funnel manual:**
${funnel}
### Términos, prueba y objeciones
**Precios:**
${bullets(manual.terms.pricing, "No se localizó un precio manual adicional.")}

**Contrato:**
${bullets(manual.terms.contract, "No se localizaron condiciones contractuales adicionales.")}

**Garantía / riesgo:**
${bullets(manual.terms.guarantee, "No se localizó una garantía adicional.")}

**Prueba:**
${bullets(manual.proof, "No se localizó prueba adicional suficientemente verificable.")}

**Objeciones tratadas:**
${bullets(manual.objections, "No se localizaron objeciones explícitas adicionales.")}

**Tecnología observable o declarada:**
${bullets(manual.technology, "No se detectó tecnología adicional.")}
### Contradicciones, inferencias y límites
**Contradicciones o ambigüedades:**
${bullets(manual.contradictions, "No se localizó una contradicción material adicional.")}

**Inferencias separadas de hechos:**
${bullets(manual.inferences, "No se añadió ninguna inferencia manual.")}

**No observable:**
${bullets(manual.notObservable, "No se añadió ninguna ausencia manual.")}

**Limitaciones:**
${bullets(manual.limitations, "Sin limitaciones adicionales a las del rastreo.")}
### Decisiones para RedVitalia
${bullets(lessons, "No se formuló una lección manual adicional.")}
### Fuentes manuales exactas
${sources}
`;
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const entries = await readdir(ROOT, { withFileTypes: true });
const manualDirs = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("manual-")).map((entry) => join(ROOT, entry.name)).sort();
let applied = 0;
const skipped = [];
const grouped = new Map();

for (const dir of manualDirs) {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json") && file !== "manifest.json").sort();
  for (const file of files) {
    const sourcePath = join(dir, file);
    const raw = JSON.parse(await readFile(sourcePath, "utf8"));
    const company = companies.find((candidate) => candidate.id === (raw.id || raw.recordId))
      || companies.find((candidate) => candidate.name.toLowerCase() === clean(raw.name).toLowerCase());
    if (!company) {
      skipped.push({ file: sourcePath, reason: "No se encontró ID o nombre canónico." });
      continue;
    }
    const manual = normalizeManual(raw, sourcePath.replaceAll("\\", "/"));
    const existing = grouped.get(company.id) || { company, manuals: [] };
    existing.manuals.push(manual);
    grouped.set(company.id, existing);
  }
}

for (const { company, manuals } of grouped.values()) {
    const reviewPath = `${REVIEW_DIR}/${company.id}.json`;
    const review = JSON.parse(await readFile(reviewPath, "utf8"));
    const manual = mergeManuals(manuals);
    const previousMarker = review.marker;
    review.manual = manual;
    const materialManualReview = manual.sources.length > 0 && Boolean(manual.message.headline || manual.message.promise || manual.funnel.length || manual.terms.pricing.length || manual.cta.primary);
    review.status = materialManualReview ? "Verificada manual" : "Limitada";
    review.confidence = materialManualReview ? (manual.sources.length >= 2 ? "Alta" : "Media") : "Limitada";
    if (manual.message.headline) review.message.hero = manual.message.headline;
    if (manual.message.voice.length || manual.message.patterns.length) {
      review.message.voice = truncate(`Revisión manual: ${manual.message.voice.join(", ")}. ${manual.message.patterns.join(" ")}`);
    }
    // El CTA manual se conserva en el panel de revisión, pero no sustituye al
    // CTA automático si no aporta el mismo objeto estructurado (texto, URL y
    // destino). Así evitamos presentar una síntesis editorial como CTA literal.
    if (manual.funnel.length) review.route = manual.funnel.map((stage) => `${stage.stage} [${stage.status}]`).join(" → ");
    review.notionProperties["Hero / mensaje V2"] = truncate(review.message.hero);
    review.notionProperties["Funnel V2 estado"] = review.status;
    review.notionProperties["Tono comercial V2"] = truncate(review.message.voice);
    review.notionProperties["CTA primario V2"] = truncate(review.conversion.primaryCta || "No observable; ausencia documentada.");
    review.notionProperties["Ruta funnel V2"] = truncate(review.route);
    review.notionProperties["Limitación funnel V2"] = truncate(unique([...review.limitations, ...manual.limitations]).join(" "));
    review.notionProperties["Evidencias funnel V2"] = new Set([...review.evidence.map((source) => source.url), ...manual.sources.map((source) => source.url)]).size;
    const hashInput = JSON.stringify({ ...review, marker: undefined, notionMarkdown: undefined });
    review.marker = `RV-FUNNEL-V2:${review.id}:${createHash("sha256").update(hashInput).digest("hex").slice(0, 16)}`;
    const automaticHeading = "## 🧬 Auditoría forense comercial V2";
    const automaticIndex = review.notionMarkdown.indexOf(automaticHeading);
    const automaticMarkdown = automaticIndex >= 0
      ? review.notionMarkdown.slice(automaticIndex)
      : review.notionMarkdown;
    review.notionMarkdown = `${manualMarkdown(manual)}\n${automaticMarkdown.replaceAll(previousMarker, review.marker)}`;
    await writeJsonAtomic(reviewPath, review);
    applied += 1;
}

console.log(JSON.stringify({ manualDirs, inputReviews: [...grouped.values()].reduce((sum, entry) => sum + entry.manuals.length, 0), applied, skipped }, null, 2));
