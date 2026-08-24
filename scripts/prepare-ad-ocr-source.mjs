#!/usr/bin/env node
/* eslint-disable no-control-regex */
/**
 * Normaliza las transcripciones OCR generadas a partir del archivo visual local.
 *
 * Uso:
 *   node scripts/prepare-ad-ocr-source.mjs <carpeta-con-ocr-ads-*.json>
 *
 * El OCR nunca se presenta como texto literal confirmado. Conserva confianza,
 * hash y archivo de origen para que cada línea pueda revisarse sobre la captura.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(process.argv[2] || resolve(root, "../ocr-work"));
const outputPath = resolve(root, "public/data/ad-ocr-transcripts.json");

if (!existsSync(sourceDir)) throw new Error(`No existe la carpeta OCR: ${sourceDir}`);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const comparisonText = (value) =>
  normalizeText(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value) =>
  new Set(comparisonText(value).split(" ").filter((token) => token.length > 2));

const similar = (left, right) => {
  const aText = comparisonText(left);
  const bText = comparisonText(right);
  if (!aText || !bText) return false;
  if (aText === bText) return true;
  const shorter = aText.length < bText.length ? aText : bText;
  const longer = aText.length < bText.length ? bText : aText;
  if (shorter.length >= 28 && longer.includes(shorter)) return true;
  const a = tokens(aText);
  const b = tokens(bText);
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union > 0 && intersection / union >= 0.76;
};

const boilerplate = [
  /^google(?: ads)? (?:centro|center)/i,
  /centro de transparencia publicitaria/i,
  /ads transparency (?:center|centre)/i,
  /^(?:inicio|home)\s*(?:>|›|$)/i,
  /^(?:preguntas frecuentes|frequently asked questions|faq)$/i,
  /^(?:acerca de|about|privacidad|privacy|t[eé]rminos|terms|pol[ií]ticas?(?: de google)?|policies)$/i,
  /^(?:detalles del anuncio|ad details|detalles de la campa[nñ]a)$/i,
  /(?:denunciar este anuncio|report this ad)/i,
  /(?:ver m[eéáa]s anuncios(?: de este anunciante)?|see more ads(?: from this advertiser)?)/i,
  /^(?:primera|[uú]ltima) (?:aparici[oó]n|impresi[oó]n)/i,
  /^(?:first|last) (?:shown|impression)/i,
  /^(?:formato|format)\s*:/i,
  /^(?:mostrado por|shown by|paid for by)\b/i,
  /la informaci[oóô]n (?:que|de|sobre) este anuncio/i,
  /anuncios? mostrados? en/i,
  /anuncio financiado por/i,
  /^this ad(?:vertiser)? information/i,
  /^cr\d{8,}$/i,
  /^ar\d{8,}$/i,
  /^publicidad\s*$/i,
  /^anuncio\s*$/i,
  /(?:privacidad|privacy).*(?:t[eé]rminos|terms).*(?:pol[ií]ticas|policies)/i,
  /(?:preguntas frecuentes|frequently asked questions).*(?:google ads|principios|blog)/i,
  /(?:vincular a anuncio|este anuncio proviene de un enlace)/i,
  /^(?:[©O@\s]*activo\b|identificador de la biblioteca|en circulaci[oóe]n desde|plataformas?\b|este anuncio tiene varias versiones|ver detalles del anuncio|transparencia de la ue|cerrar\b)/i,
  /^plataform/i,
  /^\W*\d*\s*(?:publicidad\b|transparencia.*\bue\b)/i,
  /^(?:inicio|home).*(?:detalles del anuncio|ad details)/i,
  /no podemos mostrarte esta variante/i,
  /^(?:patrocinado|sponsored|sponsorise|sponsoris[eé]|gesponsert|sponsorlu)$/i,
];

const cleanOcr = (value) => {
  const seen = new Set();
  const lines = normalizeText(value)
    .split("\n")
    .map((line) => line.replace(/[|¦]{2,}/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .filter((line) => !boilerplate.some((pattern) => pattern.test(line)))
    .filter((line) => {
      const key = comparisonText(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return normalizeText(lines.join("\n"));
};

const titleFrom = (text) => {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .filter((line) => line.length >= 4 && !/^https?:|^www\./i.test(line));
  const score = (line) => {
    const words = line.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || [];
    const symbols = (line.match(/[^\p{L}\p{N}\s.,:;!?€$%+'’/()-]/gu) || []).length;
    let value = Math.min(9, words.length) * 4 + Math.min(18, line.length / 5) - symbols * 2;
    if (line.length < 12 || line.length > 140) value -= 14;
    if (/^https?:|^www\.|\.(?:com|es|fr|de|pt|it|net)\b/i.test(line)) value -= 16;
    if (/^(?:sponsored|patrocinado|publicidad|anuncio)$/i.test(line)) value -= 30;
    return value;
  };
  const best = [...lines].sort((left, right) => score(right) - score(left))[0];
  return (best || "Creatividad sin titular legible").slice(0, 180);
};

const ctaFrom = (text) => {
  const pattern = /(m[aá]s informaci[oó]n|learn more|book|agenda|solicita|descubre|contacta|cont[aá]ctanos|empieza|comienza|quiero|reg[ií]strate|haz clic|click|visita|llama|escr[ií]benos|get started|apply|sign up|free quote|download)/i;
  return normalizeText(text)
    .split("\n")
    .reverse()
    .find((line) => pattern.test(line) && line.length <= 180) || "";
};

const priceFrom = (text) => {
  const matches = normalizeText(text).match(/(?:€|EUR|USD|US\$|\$)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|EUR|USD|US\$|\$)/gi);
  return matches ? [...new Set(matches)].slice(0, 3).join(" · ") : "";
};

const angleFrom = (text) => {
  const value = comparisonText(text);
  const rules = [
    [/(exclusiv|una sola empresa|one company|only one|tu zona|your area|territor)/, "Exclusividad territorial"],
    [/(garant|devolu|refund|money back|gratis si|free until|no cobr)/, "Garantía o riesgo invertido"],
    [/(\b\d+\s*(clientes|leads|citas|visitas|ventas|customers|appointments|calls|days|dias|horas|hours|%))/, "Resultado o cifra concreta"],
    [/(24 ?h|48 ?h|minut|rapido|rapid|instant|same day|today)/, "Velocidad o SLA"],
    [/(€|eur|usd|\$|precio|price|desde|from only|per lead|por lead)/, "Precio visible"],
    [/(caso de exito|testimoni|review|trusted by|years|anos|clientes satisfechos)/, "Prueba social o autoridad"],
    [/(sin suficientes|no tienes|problema|pierdes|perdiendo|struggl|tired of|stop wasting|competencia)/, "Dolor y agitación del problema"],
    [/(gratis|free|auditoria|audit|demo|diagnostico|consulta)/, "Entrada gratuita o lead magnet"],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || "Propuesta de valor";
};

const files = readdirSync(sourceDir)
  .filter((file) => /^ocr-ads-[a-z-]+\.json$/i.test(file))
  .sort((a, b) => a.localeCompare(b));

if (!files.length) throw new Error(`No hay borradores ocr-ads-*.json en ${sourceDir}`);

const byCompany = new Map();
const output = [];
for (const file of files) {
  const source = JSON.parse(readFileSync(resolve(sourceDir, file), "utf8"));
  for (const item of source.items || []) {
    if (Number(item.confianza || 0) < 55) continue;
    const text = cleanOcr(item.texto);
    if (comparisonText(text).length < 18 || tokens(text).size < 3) continue;
    const previous = byCompany.get(item.id) || [];
    if (previous.some((candidate) => similar(candidate, text))) continue;
    previous.push(text);
    byCompany.set(item.id, previous);
    output.push({
      ...item,
      titular: titleFrom(text),
      texto: text,
      cta: ctaFrom(text),
      precioVisible: priceFrom(text),
      angulo: angleFrom(text),
      origen: "ocr_captura",
      transcripcion: "OCR sobre captura local",
      estadoEvidencia: Number(item.confianza || 0) >= 70 ? "OCR alta · revisar literal" : "OCR media · revisar literal",
      atribucion: "asociada_a_ficha",
      aptaPatrones: false,
    });
  }
}

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  nota: "Transcripciones OCR trazables al archivo y hash local. Son buscables, pero quedan fuera de patrones hasta validar literal y atribución sobre la captura.",
  sourceFiles: files,
  total: output.length,
  companies: new Set(output.map((item) => item.id)).size,
  items: output,
};

writeFileSync(outputPath, `${JSON.stringify(data, null, 1)}\n`);
console.log(`${outputPath}: ${data.total} transcripciones OCR · ${data.companies} empresas · ${files.length} grupos`);
