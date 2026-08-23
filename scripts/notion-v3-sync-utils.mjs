const AUDIT_HEADING = /^[ \t]*## (?:🧬 Auditoría forense comercial V2|🧠 Auditoría comercial profunda · RedVitalia)[^\r\n]*$/gm;
const LEVEL_TWO_HEADING = /^[ \t]*## (?!#)[^\r\n]*$/gm;
const V3_END_MARKER = "La información íntegra y ampliable permanece en esta ficha madre";

export const PRIVATE_REFERENCE = /(?:<mention-(?:page|database|data-source)\b|(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\b|Puente\s+(?:de\s+)?IA|Radar\s+Competitivo|Universo\s+Activo|fuera\s+del\s+(?:\*\*)?Radar|[A-Z]:\\Users\\[^\r\n]*|(?<![:\w])\/Users\/[^\r\n]*|\.codex(?:[\\/][^\s)\]}>]*)?|agent-handoffs(?:[\\/][^\s)\]}>]*)?|research[\\/]deep(?:[\\/][^\s)\]}>]*)?|manual-(?:wave|pilot)(?:[\\/][^\s)\]}>]*)?|RedVitaliaMarketResearch|\b(?:RVC|RV-PUB)-[A-Za-z0-9-]+\b|\b(?:META-|GOOGLE-)?AGREGADO-\d+\b|fuente\s+de\s+trabajo(?:\s+previa)?(?:\s+consolidada)?|Bandeja\s+de\s+registro|Origen\s+(?:de\s+la\s+)?migraci[oó]n)/i;

export function normalizeNotionId(value) {
  return String(value || "").replaceAll("-", "").trim().toLowerCase();
}

export function selectPlanRecords(
  records,
  queueItems,
  { requested = new Set(), pendingOnly = false, offset = 0, limit = 0 } = {},
) {
  const queueById = new Map(
    queueItems.map((item) => [normalizeNotionId(item.id), item]),
  );
  return records
    .filter((record) => {
      const id = normalizeNotionId(record.id);
      if (requested.size && !requested.has(id)) return false;
      const notion = queueById.get(id)?.notion;
      if (pendingOnly && notion?.status === "complete" && notion?.digest === record.digest) {
        return false;
      }
      return true;
    })
    .slice(offset, limit ? offset + limit : undefined);
}

export function serializePropertyUpdates(properties, propertyTypes) {
  const output = {};
  for (const [name, value] of Object.entries(properties || {})) {
    const type = propertyTypes.get(name);
    output[name] = typeof value === "string" && ["text", "title"].includes(type)
      ? value.replace(/\/remove:yes:/gi, "/remove — yes:").replace(/([\\_*~`$<>{}|^]|\[|\])/g, "\\$1")
      : value;
  }
  return output;
}

export function resultText(result) {
  for (const block of result?.content || []) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    try {
      const parsed = JSON.parse(block.text);
      if (typeof parsed?.text === "string") return parsed.text;
    } catch {
      return block.text;
    }
  }
  return "";
}

export function parseFetchedPage(result) {
  const wrapper = resultText(result);
  const propertiesMatch = wrapper.match(/<properties>\r?\n([\s\S]*?)\r?\n<\/properties>/);
  const contentMatch = wrapper.match(/<content>\r?\n([\s\S]*?)\r?\n<\/content>/);
  if (!propertiesMatch || !contentMatch) throw new Error("La respuesta de Notion no contiene propiedades y contenido completos.");
  return {
    wrapper,
    properties: JSON.parse(propertiesMatch[1]),
    content: contentMatch[1],
  };
}

export function parsePropertyTypes(result) {
  const wrapper = resultText(result);
  const stateMatch = wrapper.match(/<data-source-state>\r?\n([\s\S]*?)\r?\n<\/data-source-state>/);
  if (!stateMatch) throw new Error("La respuesta de Notion no contiene el esquema del origen de datos.");
  const state = JSON.parse(stateMatch[1]);
  return new Map(Object.entries(state.schema || {}).map(([name, definition]) => [name, definition.type]));
}

export function auditRanges(content) {
  const auditStarts = [...content.matchAll(AUDIT_HEADING)].map((match) => match.index);
  const headings = [...content.matchAll(LEVEL_TWO_HEADING)].map((match) => match.index);
  return auditStarts.map((start) => {
    const marker = content.indexOf(V3_END_MARKER, start);
    const close = marker >= 0 ? content.indexOf("</callout>", marker) : -1;
    return {
      start,
      end: close >= 0 ? close + "</callout>".length : headings.find((heading) => heading > start) ?? content.length,
    };
  });
}

function covered(index, ranges) {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function replacementCandidates(content) {
  const candidates = [];
  const add = (pattern, replace) => {
    for (const match of content.matchAll(pattern)) {
      const replacement = typeof replace === "function" ? replace(match) : replace;
      if (match[0] !== replacement) candidates.push({ index: match.index, old_str: match[0], new_str: replacement });
    }
  };

  add(/^.*\\?<mention-(?:page|database|data-source)\b.*$/gmi, "Referencia interna retirada por privacidad");
  add(/<mention-(?:page|database|data-source)\b[^>]*>([\s\S]*?)<\/mention-(?:page|database|data-source)>/gi, (match) => match[1].trim() || "Referencia retirada por privacidad");
  add(/<mention-(?:page|database|data-source)\b[^>]*\/>/gi, "Referencia retirada por privacidad");
  add(/\[([^\]]+)\]\((?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^)]*\)/gi, (match) => match[1]);
  add(/<(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^>]*>/gi, "");
  add(/(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\/[^\s)\]}>]*/gi, "");
  add(/Puente\s+(?:de\s+)?IA/gi, "RedVitalia");
  add(/Radar\s+Competitivo/gi, "Inteligencia Mundial de Captación");
  add(/Universo\s+Activo/gi, "Inteligencia Mundial de Captación");
  add(/Esta fila evita que el actor vuelva a quedar fuera del (?:\*\*)?Radar(?:\*\*)?\. La existencia de la fuente y su asignación territorial proceden del barrido del 15–16\/08\/2026\. Oferta, precio, contrato, prueba, identidad visual, Meta Ads, Google Ads y funnel permanecen explícitamente pendientes hasta su auditoría individual; no se infieren datos ausentes\./gi, "Esta ficha forma parte de la cobertura mundial consolidada. La fuente y su asignación territorial proceden del barrido público del 15–16/08/2026. La auditoría comercial V3 está documentada al inicio de esta ficha; los datos no observables se mantienen expresamente limitados y no se completan con supuestos.");
  add(/[A-Z]:\\Users\\[^\r\n]*/gi, "Referencia privada retirada");
  add(/(?<![:\w])\/Users\/[^\r\n]*/gi, "Referencia privada retirada");
  add(/\.codex(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/agent-handoffs(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/research[\\/]deep(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/manual-(?:wave|pilot)(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/RedVitaliaMarketResearch/gi, "investigación pública RedVitalia");
  add(/\b(?:RVC|RV-PUB)-[A-Za-z0-9-]+\b/gi, "referencia catalogada");
  add(/\b(?:META-|GOOGLE-)?AGREGADO-\d+\b/gi, "Resultados agregados sin ID individual");
  add(/fuente\s+de\s+trabajo(?:\s+previa)?(?:\s+consolidada)?/gi, "evidencia pública consolidada");
  add(/Bandeja\s+de\s+registro/gi, "registro de investigación");
  add(/Origen\s+(?:de\s+la\s+)?migraci[oó]n/gi, "procedencia documentada");
  return candidates;
}

export function privacyReplacements(content, excludedRanges = []) {
  const byToken = new Map();
  for (const candidate of replacementCandidates(content)) {
    if (covered(candidate.index, excludedRanges)) continue;
    const key = `${candidate.old_str}\u0000${candidate.new_str}`;
    if (!byToken.has(key)) byToken.set(key, { old_str: candidate.old_str, new_str: candidate.new_str, replace_all_matches: true });
  }
  return [...byToken.values()];
}

export function auditContentAction(content, section) {
  if (PRIVATE_REFERENCE.test(section)) throw new Error("La nueva sección contiene una referencia privada.");
  const ranges = auditRanges(content);
  if (!ranges.length) return { command: "insert_content", content: section, position: { type: "start" }, ranges };
  return {
    command: "update_content",
    content_updates: ranges.map((range, index) => ({
      old_str: content.slice(range.start, range.end).trimEnd(),
      new_str: index === 0 ? section : "",
    })),
    ranges,
  };
}

export function scrubPropertyUpdates(properties, propertyTypes) {
  const updates = {};
  for (const [name, value] of Object.entries(properties || {})) {
    if (
      propertyTypes.get(name) === "relation"
      && ["Anuncios hijos", "Ficha madre", "Tarea operativa vinculada"].includes(name)
      && Array.isArray(value)
      && value.length
    ) {
      updates[name] = null;
      continue;
    }
    if (!PRIVATE_REFERENCE.test(String(value ?? ""))) continue;
    const type = propertyTypes.get(name);
    if (!new Set(["text", "url", "title"]).has(type) || typeof value !== "string") continue;
    let cleaned = value;
    for (const update of privacyReplacements(value)) cleaned = cleaned.split(update.old_str).join(update.new_str);
    cleaned = cleaned.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    updates[name] = cleaned;
  }
  return updates;
}

export function visiblePrivacyFindings(properties, content, propertyTypes) {
  const findings = [];
  for (const [name, value] of Object.entries(properties || {})) {
    const type = propertyTypes.get(name);
    if (type === "relation" && Array.isArray(value) && value.length) {
      findings.push(`property:${name}`);
      continue;
    }
    if (!["text", "url", "title"].includes(type) || typeof value !== "string") continue;
    if (PRIVATE_REFERENCE.test(value)) findings.push(`property:${name}`);
  }
  if (PRIVATE_REFERENCE.test(content)) findings.push("content");
  return findings;
}
