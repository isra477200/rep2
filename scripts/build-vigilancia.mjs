#!/usr/bin/env node
/**
 * Genera public/data/vigilancia.json:
 *  - semaforo: las amenazas Alta/Media de España con sus señales de actividad
 *    (anuncios verificados, precio público, garantía, galería) en la instantánea actual.
 *  - grupos: redes multi-marca detectadas cruzando razones sociales, títulos y
 *    dominios de las 938 fichas (etiquetado Inferido cuando es cruce, no declaración).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));

/* ---------------- Semáforo España ---------------- */
const trafficLight = (c) => {
  const ads = (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0;
  const signals = [ads, c.price?.eur != null, (c.guarantee || "").length > 30, (c.media || []).length > 0].filter(Boolean).length;
  return ads && signals >= 3 ? "rojo" : signals >= 2 ? "ambar" : "verde";
};
const semaforo = companies
  .filter((c) => c.primaryCountry === "España" && (c.threat === "Alta" || c.threat === "Media"))
  .map((c) => ({
    id: c.id,
    name: c.name,
    agencyType: c.agencyType,
    threat: c.threat,
    score: c.score,
    adsActive: (c.metaAds || 0) > 0 || (c.googleAds || 0) > 0,
    metaAds: c.metaAds || 0,
    googleAds: c.googleAds || 0,
    pricePublic: c.price?.eur != null,
    priceLocal: (c.priceLocal || "").slice(0, 120),
    hasGuarantee: (c.guarantee || "").length > 30,
    nivel: trafficLight(c),
  }))
  .sort((a, b) => (a.nivel === "rojo" ? 0 : a.nivel === "ambar" ? 1 : 2) - (b.nivel === "rojo" ? 0 : b.nivel === "ambar" ? 1 : 2) || b.score - a.score);

/* ---------------- Redes multi-marca ---------------- */
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const legalTokens = (c) => {
  const text = norm(`${c.title} ${c.name}`);
  const matches = text.match(/([a-z0-9&.\- ]{4,40}?(?:s\.? ?l\.?u?\.?|s\.?a\.?|gmbh|ltd|llc|inc|b\.?v\.?|sp\. z o\.o\.|a\/s|oü|ug)(?= |$|\)|,))/g) || [];
  return matches.map((m) => m.trim()).filter((m) => m.length > 8);
};
const groupSignals = new Map();
const addSignal = (key, c, reason) => {
  if (!key || key.length < 6) return;
  if (!groupSignals.has(key)) groupSignals.set(key, { key, reason, members: new Map() });
  groupSignals.get(key).members.set(c.id, { id: c.id, name: c.name, country: c.primaryCountry, score: c.score });
};
const KNOWN = [
  { key: "grupo docplanner", re: /docplanner|doctoralia/i },
  { key: "instapro group", re: /instapro|habitissimo|myhammer|werkspot|travaux\.com|mybuilder/i },
  { key: "grupo vocento", re: /vocento|premium leads/i },
  { key: "nettbureau", re: /nettbureau|placassolares/i },
  { key: "gannett / usa today network", re: /localiq|gannett/i },
  { key: "hibu", re: /\bhibu\b/i },
  { key: "thryv", re: /thryv/i },
  { key: "italiaonline", re: /italiaonline|paginegialle/i },
  { key: "beedigital / qdq", re: /beedigital|qdq/i },
  { key: "sellwerk", re: /sellwerk|gelbe seiten/i },
  { key: "team issler", re: /issler|0711/i },
  { key: "scale group (japon)", re: /scale.?(lead|form|call|group)/i },
];
for (const c of companies) {
  const hay = `${c.title} ${c.name} ${c.offer}`;
  for (const k of KNOWN) if (k.re.test(hay)) addSignal(k.key, c, "marca/holding declarado");
  for (const token of legalTokens(c)) addSignal(token, c, "misma razón social en el título");
  const domain = norm(c.domain || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const parts = domain.split(".");
  if (parts.length >= 3) addSignal(parts.slice(-2).join("."), c, "mismo dominio raíz");
}
const grupos = [...groupSignals.values()]
  .map((g) => ({ ...g, members: [...g.members.values()] }))
  .filter((g) => g.members.length >= 2)
  .sort((a, b) => b.members.length - a.members.length)
  .slice(0, 40)
  .map((g) => ({ grupo: g.key, evidencia: g.reason, etiqueta: g.reason === "marca/holding declarado" ? "Observado" : "Inferido", marcas: g.members.sort((x, y) => y.score - x.score) }));

const out = {
  generatedAt: "23/08/2026",
  nota: "Instantánea del corte actual. El semáforo se recalcula con cada actualización de anuncios/precios de la base; los grupos marcados Inferido salen de cruces (razón social, dominio raíz), no de declaración pública.",
  semaforo,
  grupos,
};
writeFileSync(resolve(root, "public/data/vigilancia.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`vigilancia.json: ${semaforo.length} vigiladas España (${semaforo.filter((s) => s.nivel === "rojo").length} en rojo) · ${grupos.length} grupos multi-marca`);
