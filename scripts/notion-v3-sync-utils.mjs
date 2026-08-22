const AUDIT_HEADING = /^## (?:🧬 Auditoría forense comercial V2|🧠 Auditoría comercial profunda · RedVitalia)[^\r\n]*$/gm;
const LEVEL_TWO_HEADING = /^## (?!#)[^\r\n]*$/gm;

export const PRIVATE_REFERENCE = /(?:<mention-(?:page|database|data-source)\b|(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\b|Puente\s+(?:de\s+)?IA|Radar\s+Competitivo|Universo\s+Activo|(?:[A-Z]:\\Users\\|\/Users\/)[^\r\n]*|\.codex(?:[\\/][^\s)\]}>]*)?|agent-handoffs(?:[\\/][^\s)\]}>]*)?|research[\\/]deep(?:[\\/][^\s)\]}>]*)?)/i;

export function normalizeNotionId(value) {
  return String(value || "").replaceAll("-", "").trim().toLowerCase();
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
  return auditStarts.map((start) => ({
    start,
    end: headings.find((heading) => heading > start) ?? content.length,
  }));
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

  add(/<mention-(?:page|database|data-source)\b[^>]*>([\s\S]*?)<\/mention-(?:page|database|data-source)>/gi, (match) => match[1].trim() || "Referencia retirada por privacidad");
  add(/<mention-(?:page|database|data-source)\b[^>]*\/>/gi, "Referencia retirada por privacidad");
  add(/\[([^\]]+)\]\((?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^)]*\)/gi, (match) => match[1]);
  add(/<(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^>]*>/gi, "");
  add(/(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\/[^\s)\]}>]*/gi, "");
  add(/Puente\s+(?:de\s+)?IA/gi, "RedVitalia");
  add(/Radar\s+Competitivo/gi, "Inteligencia Mundial de Captación");
  add(/Universo\s+Activo/gi, "Inteligencia Mundial de Captación");
  add(/(?:[A-Z]:\\Users\\|\/Users\/)[^\r\n]*/gi, "Referencia privada retirada");
  add(/\.codex(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/agent-handoffs(?:[\\/][^\s)\]}>]*)?/gi, "");
  add(/research[\\/]deep(?:[\\/][^\s)\]}>]*)?/gi, "");
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
    if (!["text", "url", "title"].includes(type) || typeof value !== "string") continue;
    if (PRIVATE_REFERENCE.test(value)) findings.push(`property:${name}`);
  }
  if (PRIVATE_REFERENCE.test(content)) findings.push("content");
  return findings;
}
