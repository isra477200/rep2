#!/usr/bin/env node
/**
 * Barrido auditable de Google Ads para el mercado español.
 *
 * La clave se acepta exclusivamente por SERPAPI_API_KEY/SERPAPI_KEY o por la
 * primera línea de stdin. Nunca se guarda, imprime ni incorpora a una URL de
 * auditoría. El trabajo bruto vive bajo /work, que está excluido de Git y del
 * paquete público.
 *
 * Uso:
 *   node scripts/serpapi-google-ads-runner.mjs --dry-run
 *   node scripts/serpapi-google-ads-runner.mjs --execute
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { domainToASCII } from "node:url";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUN_DATE = "2026-08-27";
const DEFAULT_OUTPUT = resolve(ROOT, `work/serpapi-google-ads-spain-${RUN_DATE}`);
const args = new Set(process.argv.slice(2));
const EXECUTE = args.has("--execute");
const OUTPUT = (() => {
  const index = process.argv.indexOf("--out");
  return index >= 0 && process.argv[index + 1]
    ? resolve(ROOT, process.argv[index + 1])
    : DEFAULT_OUTPUT;
})();

const BASE_KEYWORDS = [
  // Compra y generación de leads · 25
  "comprar leads",
  "venta de leads",
  "proveedor de leads",
  "comprar leads cualificados",
  "leads exclusivos",
  "leads para empresas",
  "leads para pymes",
  "leads B2B",
  "comprar leads B2B",
  "comprar contactos comerciales",
  "base de datos de leads B2B",
  "generación de leads",
  "agencia generación de leads",
  "empresa generación de leads",
  "servicio generación de leads",
  "lead generation España",
  "agencia lead generation España",
  "captación de clientes",
  "agencia captación de clientes",
  "conseguir clientes potenciales",
  "servicio captación de clientes",
  "leads pago por resultados",
  "captación de clientes a comisión",
  "marketing pago por resultados",
  "citas comerciales garantizadas",
  // B2B, outbound y citas · 20
  "concertación de citas B2B",
  "agendar reuniones comerciales",
  "conseguir reuniones B2B",
  "reuniones comerciales cualificadas",
  "appointment setting España",
  "servicio appointment setting",
  "SDR externalizado",
  "equipo SDR externalizado",
  "outsourcing comercial B2B",
  "externalizar prospección comercial",
  "prospección comercial B2B",
  "prospección automatizada B2B",
  "agencia outbound sales",
  "servicio outbound sales",
  "telemarketing B2B",
  "call center captación de clientes",
  "generación de demanda B2B",
  "agencia demand generation",
  "captación clientes LinkedIn",
  "agencia LinkedIn B2B",
  // Performance y automatización · 15
  "agencia performance marketing leads",
  "agencia Google Ads captación clientes",
  "agencia Meta Ads captación clientes",
  "campañas generación de leads",
  "sistema de captación de clientes",
  "automatización captación de clientes",
  "embudo captación de clientes",
  "embudos de venta para empresas",
  "CRM captación de clientes",
  "chatbot captación de clientes",
  "WhatsApp captación de clientes",
  "agente IA captación clientes",
  "automatización comercial B2B",
  "agencia marketing de resultados",
  "publicidad para conseguir clientes",
  // Salud y clínicas · 15
  "comprar leads clínicas",
  "leads para clínicas",
  "captación de pacientes",
  "conseguir pacientes para clínicas",
  "agencia captación pacientes",
  "marketing para clínicas",
  "leads clínicas dentales",
  "captación pacientes dentales",
  "marketing dental captación pacientes",
  "leads medicina estética",
  "pacientes medicina estética",
  "leads trasplante capilar",
  "captación pacientes cirugía estética",
  "leads psicólogos",
  "captación pacientes psicólogos",
  // Reformas, solar y hogar · 15
  "comprar leads reformas",
  "leads para reformas",
  "leads de obras",
  "clientes para empresas de reformas",
  "presupuestos de reformas",
  "comprar leads placas solares",
  "leads placas solares",
  "leads autoconsumo",
  "clientes para instaladores solares",
  "leads energía",
  "leads luz y gas",
  "leads alarmas",
  "leads telecomunicaciones",
  "leads fibra",
  "clientes para instaladores",
  // Inmobiliario, seguros, legal y finanzas · 15
  "comprar leads inmobiliarios",
  "leads inmobiliarios exclusivos",
  "leads para inmobiliarias",
  "captación de propietarios inmobiliarios",
  "citas para inmobiliarias",
  "comprar leads seguros",
  "leads para seguros",
  "leads seguros salud",
  "leads seguros decesos",
  "captar clientes seguros",
  "comprar leads abogados",
  "leads para abogados",
  "captación clientes abogados",
  "leads hipotecas",
  "leads préstamos",
  // Automoción y verticales poco cubiertas · 10
  "comprar leads automoción",
  "leads para concesionarios",
  "clientes para compraventa de coches",
  "leads vender coche",
  "leads coches con cargas",
  "captar alumnos para cursos",
  "leads para gimnasios",
  "captación de franquiciados",
  "captación clientes restaurantes",
  "reservas directas hoteles",
];

const MOBILE_KEYWORDS = [
  "comprar leads", "venta de leads", "proveedor de leads", "comprar leads cualificados",
  "leads exclusivos", "leads B2B", "comprar leads B2B", "generación de leads",
  "agencia generación de leads", "lead generation España", "captación de clientes",
  "agencia captación de clientes", "leads pago por resultados",
  "captación de clientes a comisión", "marketing pago por resultados",
  "concertación de citas B2B", "agendar reuniones comerciales",
  "reuniones comerciales cualificadas", "appointment setting España", "SDR externalizado",
  "outsourcing comercial B2B", "prospección comercial B2B", "agencia outbound sales",
  "telemarketing B2B", "generación de demanda B2B", "comprar leads clínicas",
  "captación de pacientes", "leads clínicas dentales", "leads medicina estética",
  "comprar leads reformas", "leads para reformas", "comprar leads placas solares",
  "leads energía", "comprar leads inmobiliarios", "captación de propietarios inmobiliarios",
  "comprar leads seguros", "leads seguros salud", "comprar leads abogados",
  "captación clientes abogados", "leads hipotecas", "comprar leads automoción",
  "leads para concesionarios", "leads coches con cargas", "captar alumnos para cursos",
  "captación de franquiciados",
];

const GEO_KEYWORDS = [
  "comprar leads",
  "generación de leads",
  "agencia generación de leads",
  "captación de clientes",
  "leads B2B",
  "concertación de citas B2B",
  "comprar leads inmobiliarios",
  "comprar leads clínicas",
  "comprar leads reformas",
];

const GEO_LOCATIONS = [
  "Barcelona,Catalonia,Spain",
  "Valencia,Valencian Community,Spain",
  "Seville,Andalusia,Spain",
  "Bilbao,Basque Country,Spain",
  "Malaga,Andalusia,Spain",
];

const RESERVE_KEYWORDS = [
  "agencia marketing digital",
  "agencia Google Ads",
  "empresa marketing digital",
  "agencia publicidad online",
  "servicios marketing digital",
  "agencia ventas B2B",
  "consultoría comercial B2B",
  "externalización comercial",
  "call center ventas",
  "telemarketing empresas",
  "agencia marketing médico",
  "marketing clínica dental",
  "marketing inmobiliario",
  "marketing para abogados",
  "marketing empresas reformas",
  "marketing placas solares",
  "marketing para seguros",
  "marketing concesionarios",
  "agencia LinkedIn",
  "automatización de ventas",
  "CRM para ventas",
  "software prospección B2B",
  "base de datos empresas",
  "contactos de empresas",
  "generar clientes online",
  "agencia performance marketing",
  "agencia captación online",
  "consultoría generación demanda",
  "servicio prospección empresas",
  "concertar visitas comerciales",
];

const MADRID = "Madrid,Community of Madrid,Spain";
const normalizeText = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/\s+/g, " ")
  .trim();

const readJson = (path, fallback = null) => existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : fallback;
const writeJsonAtomic = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temp, path);
};

const discoveryParameters = (q, location, device) => ({
  engine: "google_ads",
  q,
  location,
  hl: "es",
  device,
  no_cache: "true",
  output: "json",
});

const discoveryPlan = () => {
  const requests = [];
  for (const q of BASE_KEYWORDS) requests.push({
    phase: "discovery",
    segment: "madrid_desktop",
    params: discoveryParameters(q, MADRID, "desktop"),
  });
  for (const q of MOBILE_KEYWORDS) requests.push({
    phase: "discovery",
    segment: "madrid_mobile",
    params: discoveryParameters(q, MADRID, "mobile"),
  });
  for (const q of GEO_KEYWORDS) for (const location of GEO_LOCATIONS) requests.push({
    phase: "discovery",
    segment: "geographic_desktop",
    params: discoveryParameters(q, location, "desktop"),
  });
  return requests.map((request, index) => ({
    ...request,
    id: `discovery-${String(index + 1).padStart(3, "0")}`,
  }));
};

const parseHost = (value) => {
  let input = String(value || "").trim();
  if (!input) return "";
  if (!/^https?:\/\//i.test(input)) input = `https://${input.replace(/^\/+/, "")}`;
  try {
    const host = domainToASCII(new URL(input).hostname.toLocaleLowerCase("en"));
    const clean = host.replace(/^www\./, "").replace(/\.$/, "");
    return clean.includes(".") ? clean : "";
  } catch {
    return "";
  }
};

const registrableDomain = (host) => {
  const clean = parseHost(host);
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const compound = new Set(["co.uk", "com.es", "org.es", "com.mx", "com.ar", "com.co", "com.br"]);
  const tail = parts.slice(-2).join(".");
  return compound.has(tail) ? parts.slice(-3).join(".") : tail;
};

const destinationFromAd = (ad) => {
  try {
    const target = new URL(String(ad?.tracking_link || "")).searchParams.get("adurl");
    if (/^https?:\/\//i.test(String(target || ""))) return target;
  } catch {
    // Si el enlace de tracking no es una URL válida, se prueban los destinos directos.
  }
  const direct = String(ad?.link || "");
  const directHost = parseHost(direct);
  if (directHost && !/(?:^|\.)google\.[a-z.]+$/i.test(directHost)) return direct;
  return String(ad?.displayed_link || "");
};

const hostFromAd = (ad) => {
  for (const value of [destinationFromAd(ad), ad?.displayed_link, ad?.source, ad?.link]) {
    const host = parseHost(value);
    if (host && !/(?:^|\.)google\.[a-z.]+$/i.test(host)) return host;
  }
  return "";
};

const currentCompanyDomains = () => {
  const companies = readJson(resolve(ROOT, "public/data/companies-index.json"), []);
  const rows = [];
  for (const company of companies) {
    const domain = registrableDomain(company.website || company.domain);
    if (!domain) continue;
    rows.push({
      id: company.id,
      name: company.name,
      domain,
      country: company.primaryCountry || company.country,
      scope: company.scope,
      agencyType: company.agencyType,
      googleStatus: company.googleStatus,
      googleAds: Number(company.googleAds || 0),
    });
  }
  return rows;
};

const providerSignal = (value) => {
  const text = normalizeText(value);
  const strong = [
    "comprar leads", "venta de leads", "generacion de leads", "lead generation",
    "leads cualificados", "leads exclusivos", "concertacion de citas", "appointment setting",
    "sdr externalizado", "prospeccion comercial", "captacion de clientes", "captacion de pacientes",
    "agencia de marketing", "agencia marketing", "outsourcing comercial", "telemarketing b2b",
  ];
  const medium = [
    "leads", "clientes", "citas", "reuniones", "captacion", "marketing", "agencia",
    "prospeccion", "outbound", "demand generation", "publicidad", "embudo",
  ];
  return strong.reduce((score, token) => score + (text.includes(token) ? 7 : 0), 0)
    + medium.reduce((score, token) => score + (text.includes(token) ? 2 : 0), 0);
};

const readRaw = (id) => readJson(resolve(OUTPUT, "raw", `${id}.json`));

const buildTransparencyCandidates = () => {
  const existing = currentCompanyDomains();
  const existingByDomain = new Map(existing.map((row) => [row.domain, row]));
  const buckets = new Map();
  for (const request of discoveryPlan()) {
    const data = readRaw(request.id);
    if (!data) continue;
    const actualQuery = String(data.search_parameters?.q || request.params.q);
    const actualLocation = String(
      data.search_parameters?.location_used
      || data.search_parameters?.location_requested
      || request.params.location,
    );
    const actualDevice = String(data.search_parameters?.device || request.params.device);
    for (const ad of Array.isArray(data.ads) ? data.ads : []) {
      const host = hostFromAd(ad);
      const domain = registrableDomain(host);
      if (!domain || /^(?:google|youtube|facebook|instagram|linkedin)\./.test(domain)) continue;
      const bucket = buckets.get(domain) || {
        domain,
        hosts: new Set(),
        titles: new Set(),
        descriptions: new Set(),
        queries: new Set(),
        locations: new Set(),
        devices: new Set(),
        positions: [],
        examples: [],
      };
      bucket.hosts.add(host);
      bucket.titles.add(String(ad.title || ""));
      bucket.descriptions.add(String(ad.description || ""));
      bucket.queries.add(actualQuery);
      bucket.locations.add(actualLocation);
      bucket.devices.add(actualDevice);
      if (Number.isFinite(Number(ad.position))) bucket.positions.push(Number(ad.position));
      if (bucket.examples.length < 5) bucket.examples.push({
        query: actualQuery,
        title: ad.title || "",
        description: ad.description || "",
        link: destinationFromAd(ad),
        source: ad.source || "",
      });
      buckets.set(domain, bucket);
    }
  }

  const candidates = [...buckets.values()].map((bucket) => {
    const existingCompany = existingByDomain.get(bucket.domain) || null;
    const copy = [...bucket.titles, ...bucket.descriptions, bucket.domain].join("\n");
    const score = providerSignal(copy)
      + Math.min(18, bucket.queries.size * 3)
      + Math.min(8, bucket.locations.size * 2)
      + (bucket.devices.size > 1 ? 4 : 0)
      + (existingCompany ? 18 : 0)
      + (existingCompany && /Núcleo|Vertical|BPO/i.test(existingCompany.scope || "") ? 8 : 0);
    return {
      domain: bucket.domain,
      hosts: [...bucket.hosts].sort(),
      score,
      existingCompany,
      observationCount: bucket.positions.length,
      queryCount: bucket.queries.size,
      locationCount: bucket.locations.size,
      devices: [...bucket.devices].sort(),
      bestPosition: bucket.positions.length ? Math.min(...bucket.positions) : null,
      queries: [...bucket.queries].sort((a, b) => a.localeCompare(b, "es")),
      examples: bucket.examples,
    };
  }).sort((a, b) => b.score - a.score
    || b.queryCount - a.queryCount
    || b.observationCount - a.observationCount
    || a.domain.localeCompare(b.domain, "es"));

  const selected = [];
  const selectedDomains = new Set();
  for (const candidate of candidates) {
    const explicitProvider = providerSignal([
      candidate.domain,
      ...candidate.examples.flatMap((row) => [row.title, row.description]),
    ].join(" ")) >= 8;
    if (!candidate.existingCompany && !explicitProvider) continue;
    selected.push({ ...candidate, selectionReason: candidate.existingCompany
      ? "dominio observado que ya pertenece a una ficha"
      : "dominio nuevo con oferta publicitaria explícita de leads, citas o captación" });
    selectedDomains.add(candidate.domain);
    if (selected.length === 30) break;
  }

  if (selected.length < 30) {
    const fallback = existing
      .filter((row) => row.country === "España")
      .filter((row) => /Núcleo|Vertical|BPO/i.test(row.scope || ""))
      .filter((row) => !selectedDomains.has(row.domain))
      .sort((a, b) => Number(a.googleAds || 0) - Number(b.googleAds || 0)
        || a.name.localeCompare(b.name, "es"));
    for (const company of fallback) {
      selected.push({
        domain: company.domain,
        hosts: [company.domain],
        score: 1,
        existingCompany: company,
        observationCount: 0,
        queryCount: 0,
        locationCount: 0,
        devices: [],
        bestPosition: null,
        queries: [],
        examples: [],
        selectionReason: "ficha española relevante con actividad Google todavía infradocumentada",
      });
      selectedDomains.add(company.domain);
      if (selected.length === 30) break;
    }
  }

  if (selected.length !== 30) throw new Error(`Solo se pudieron seleccionar ${selected.length}/30 dominios`);
  const output = {
    schema: "redvitalia-serpapi-transparency-candidates-v1",
    generatedAt: new Date().toISOString(),
    totalObservedDomains: candidates.length,
    selectedCount: selected.length,
    selected,
    allCandidates: candidates,
  };
  writeJsonAtomic(resolve(OUTPUT, "transparency-candidates.json"), output);
  return output;
};

const dateStamp = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
const transparencyPlan = (requestedCount = null) => {
  const candidates = readJson(resolve(OUTPUT, "transparency-candidates.json"))
    || buildTransparencyCandidates();
  const state = readJson(statePath, {});
  const count = Number.isFinite(Number(requestedCount))
    ? Number(requestedCount)
    : Number(state.adaptiveDistribution?.transparencyDomains || candidates.selected.length);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 180);
  return candidates.selected.slice(0, count).map((candidate, index) => ({
    id: `transparency-${String(index + 1).padStart(2, "0")}`,
    phase: "transparency",
    segment: candidate.existingCompany ? "known_domain" : "new_domain",
    candidateDomain: candidate.domain,
    params: {
      engine: "google_ads_transparency_center",
      text: candidate.domain,
      region: "2724",
      platform: "SEARCH",
      num: "100",
      start_date: dateStamp(start),
      end_date: dateStamp(end),
      no_cache: "true",
      output: "json",
    },
  }));
};

const buildDetailSelection = (requestedCount = null) => {
  const candidates = readJson(resolve(OUTPUT, "transparency-candidates.json"));
  const state = readJson(statePath, {});
  const targetCount = Number.isFinite(Number(requestedCount))
    ? Number(requestedCount)
    : Number(state.adaptiveDistribution?.creativeDetails || 15);
  const candidateByDomain = new Map((candidates?.selected || []).map((item) => [item.domain, item]));
  const creatives = [];
  for (const request of transparencyPlan(state.adaptiveDistribution?.transparencyDomains)) {
    const data = readRaw(request.id);
    if (!data) continue;
    for (const creative of Array.isArray(data.ad_creatives) ? data.ad_creatives : []) {
      const advertiserId = String(creative.advertiser_id || "");
      const creativeId = String(creative.ad_creative_id || "");
      if (!/^AR\d+$/.test(advertiserId) || !/^CR\d+$/.test(creativeId)) continue;
      const targetDomain = registrableDomain(creative.target_domain || request.candidateDomain);
      const candidate = candidateByDomain.get(request.candidateDomain);
      const exactTarget = !targetDomain || targetDomain === request.candidateDomain;
      if (!exactTarget) continue;
      const lastShown = Number(creative.last_shown || 0);
      const firstShown = Number(creative.first_shown || lastShown || 0);
      const daysVisible = lastShown && firstShown
        ? Math.max(0, Math.round((lastShown - firstShown) / 86400))
        : 0;
      creatives.push({
        candidateDomain: request.candidateDomain,
        existingCompany: candidate?.existingCompany || null,
        advertiserId,
        advertiser: String(creative.advertiser || ""),
        creativeId,
        format: String(creative.format || "unknown"),
        targetDomain,
        firstShown: firstShown || null,
        lastShown: lastShown || null,
        daysVisible,
        detailsLink: String(creative.details_link || ""),
        preview: String(creative.image || creative.link || ""),
        score: (candidate?.existingCompany ? 6 : 14)
          + Math.min(12, Number(candidate?.queryCount || 0) * 2)
          + Math.min(10, Math.floor(daysVisible / 30))
          + (lastShown ? 3 : 0),
      });
    }
  }
  creatives.sort((a, b) => b.score - a.score
    || Number(b.lastShown || 0) - Number(a.lastShown || 0)
    || a.creativeId.localeCompare(b.creativeId));

  const selected = [];
  const advertisers = new Set();
  for (const creative of creatives) {
    if (advertisers.has(creative.advertiserId)) continue;
    selected.push(creative);
    advertisers.add(creative.advertiserId);
    if (selected.length === targetCount) break;
  }
  if (selected.length < targetCount) {
    const seen = new Set(selected.map((item) => item.creativeId));
    for (const creative of creatives) {
      if (seen.has(creative.creativeId)) continue;
      selected.push(creative);
      seen.add(creative.creativeId);
      if (selected.length === targetCount) break;
    }
  }
  const output = {
    schema: "redvitalia-serpapi-detail-selection-v1",
    generatedAt: new Date().toISOString(),
    availableCreatives: creatives.length,
    requestedCount: targetCount,
    selectedCount: selected.length,
    selected,
  };
  writeJsonAtomic(resolve(OUTPUT, "detail-selection.json"), output);
  return output;
};

const detailsPlan = (requestedCount = null) => {
  const selection = readJson(resolve(OUTPUT, "detail-selection.json")) || buildDetailSelection(requestedCount);
  const selected = Number.isFinite(Number(requestedCount))
    ? selection.selected.slice(0, Number(requestedCount))
    : selection.selected;
  return selected.map((creative, index) => ({
    id: `details-${String(index + 1).padStart(2, "0")}`,
    phase: "details",
    segment: creative.existingCompany ? "known_advertiser" : "new_advertiser",
    candidateDomain: creative.candidateDomain,
    params: {
      engine: "google_ads_transparency_center_ad_details",
      advertiser_id: creative.advertiserId,
      creative_id: creative.creativeId,
      region: "2724",
      no_cache: "true",
      output: "json",
    },
  }));
};

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/api.?key|account_email|account_id/i.test(key)) continue;
    output[key] = redact(item);
  }
  return output;
};

const readKey = async () => {
  const fromEnvironment = String(process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || "").trim();
  if (fromEnvironment) return fromEnvironment;
  if (process.stdin.isTTY) {
    process.stdout.write("Clave SerpAPI (entrada oculta): ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolveKey, reject) => {
      let value = "";
      const finish = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
      };
      process.stdin.on("data", (chunk) => {
        for (const byte of chunk) {
          if (byte === 3) {
            finish();
            reject(new Error("Entrada cancelada"));
            return;
          }
          if (byte === 13 || byte === 10) {
            finish();
            const key = value.trim();
            if (!key) reject(new Error("La clave está vacía"));
            else resolveKey(key);
            return;
          }
          if (byte === 8 || byte === 127) value = value.slice(0, -1);
          else value += String.fromCharCode(byte);
        }
      });
    });
  }
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    const key = String(line || "").trim();
    if (key) return key;
  }
  throw new Error("Falta la clave de SerpAPI");
};

const fetchJson = async (url, retries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Respuesta no JSON (${response.status})`); }
      if (!response.ok || data.error) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        if (/hasn't returned any results|no results for this query/i.test(error.message)) {
          error.noRetry = true;
        }
        throw error;
      }
      return data;
    } catch (error) {
      lastError = error;
      if (error?.noRetry) throw error;
      if (attempt < retries) await new Promise((done) => setTimeout(done, attempt * 900));
    }
  }
  throw lastError;
};

const accountSnapshot = async (key) => {
  const url = new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key", key);
  const account = await fetchJson(url, 2);
  return {
    accountStatus: account.account_status || null,
    planName: account.plan_name || null,
    planSearchesLeft: Number(account.plan_searches_left ?? 0),
    extraCredits: Number(account.extra_credits ?? 0),
    totalSearchesLeft: Number(account.total_searches_left ?? 0),
    thisMonthUsage: Number(account.this_month_usage ?? 0),
    rateLimitPerHour: Number(account.account_rate_limit_per_hour ?? 0),
    observedAt: new Date().toISOString(),
  };
};

const statePath = resolve(OUTPUT, "run-state.json");
const ledgerPath = resolve(OUTPUT, "ledger.json");
const loadCompleted = () => new Set(
  (readJson(ledgerPath, { requests: [] }).requests || [])
    .filter((item) => item.status === "success")
    .map((item) => item.id),
);

const executePlan = async (requests, key, phase) => {
  const completed = loadCompleted();
  const pending = requests.filter((request) => !completed.has(request.id));
  if (!pending.length) {
    console.log(`${phase}: ${requests.length} peticiones ya completadas.`);
    return;
  }
  const account = await accountSnapshot(key);
  if (account.totalSearchesLeft < pending.length) {
    throw new Error(`${phase}: quedan ${account.totalSearchesLeft} créditos y faltan ${pending.length}`);
  }
  const ledger = readJson(ledgerPath, {
    schema: "redvitalia-serpapi-ledger-v1",
    startedAt: new Date().toISOString(),
    requests: [],
  });
  const priorById = new Map((ledger.requests || []).map((item) => [item.id, item]));
  let cursor = 0;
  let finished = 0;
  const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (cursor < pending.length) {
      const index = cursor++;
      const request = pending[index];
      const startedAt = new Date().toISOString();
      try {
        let data;
        let effectiveParams = { ...request.params };
        let fallbackFrom = null;
        for (let fallbackAttempt = 0; fallbackAttempt <= 3; fallbackAttempt += 1) {
          const url = new URL("https://serpapi.com/search.json");
          for (const [keyName, value] of Object.entries(effectiveParams)) url.searchParams.set(keyName, String(value));
          url.searchParams.set("api_key", key);
          try {
            data = await fetchJson(url);
            break;
          } catch (error) {
            if (
              request.phase !== "discovery" ||
              !/hasn't returned any results|no results for this query/i.test(String(error?.message || error)) ||
              fallbackAttempt === 3
            ) throw error;
            fallbackFrom ||= request.params.q;
            const numericId = Number(String(request.id).match(/\d+/)?.[0] || 0);
            effectiveParams = {
              ...effectiveParams,
              q: RESERVE_KEYWORDS[(numericId + fallbackAttempt) % RESERVE_KEYWORDS.length],
            };
          }
        }
        if (data.search_metadata?.status !== "Success") {
          throw new Error(`Estado inesperado: ${data.search_metadata?.status || "sin estado"}`);
        }
        writeJsonAtomic(resolve(OUTPUT, "raw", `${request.id}.json`), redact(data));
        priorById.set(request.id, {
          id: request.id,
          phase: request.phase,
          segment: request.segment,
          candidateDomain: request.candidateDomain || null,
          params: effectiveParams,
          requestedParams: fallbackFrom ? request.params : undefined,
          fallbackFrom,
          status: "success",
          searchId: data.search_metadata?.id || null,
          startedAt,
          completedAt: new Date().toISOString(),
          resultCounts: {
            ads: Array.isArray(data.ads) ? data.ads.length : 0,
            creatives: Array.isArray(data.ad_creatives) ? data.ad_creatives.length : 0,
          },
        });
      } catch (error) {
        priorById.set(request.id, {
          id: request.id,
          phase: request.phase,
          segment: request.segment,
          candidateDomain: request.candidateDomain || null,
          params: request.params,
          status: "failed",
          startedAt,
          completedAt: new Date().toISOString(),
          error: String(error?.message || error),
        });
        throw error;
      } finally {
        finished += 1;
        ledger.requests = [...priorById.values()].sort((a, b) => a.id.localeCompare(b.id));
        ledger.updatedAt = new Date().toISOString();
        writeJsonAtomic(ledgerPath, ledger);
        if (finished % 10 === 0 || finished === pending.length) {
          console.log(`${phase}: ${finished}/${pending.length} nuevas completadas.`);
        }
      }
    }
  });
  await Promise.all(workers);
};

const makePublicPlan = () => {
  const active = readJson(statePath, {}).adaptiveDistribution || null;
  return ({
  schema: "redvitalia-serpapi-google-ads-plan-v1",
  generatedAt: new Date().toISOString(),
  budget: 250,
  distribution: {
    googleAdsDiscovery: 205,
    transparencyDomains: 30,
    creativeDetails: 15,
  },
  activeDistribution: active,
  discovery: discoveryPlan(),
  safeguards: [
    "Clave solo en memoria; nunca se imprime ni se guarda.",
    "no_cache=true para obtener un corte actual y contabilizable.",
    "Reanudación por ID exacto para no repetir búsquedas completadas.",
    "Account API antes y después; no consume créditos.",
    "Presencia, posición y persistencia no se interpretan como rendimiento.",
  ],
  });
};

const main = async () => {
  if (BASE_KEYWORDS.length !== 115) throw new Error(`Plan base inválido: ${BASE_KEYWORDS.length}/115`);
  if (MOBILE_KEYWORDS.length !== 45) throw new Error(`Plan móvil inválido: ${MOBILE_KEYWORDS.length}/45`);
  if (GEO_KEYWORDS.length * GEO_LOCATIONS.length !== 45) throw new Error("Plan geográfico inválido");
  const discovery = discoveryPlan();
  if (discovery.length !== 205) throw new Error(`Descubrimiento inválido: ${discovery.length}/205`);
  mkdirSync(OUTPUT, { recursive: true });
  writeJsonAtomic(resolve(OUTPUT, "plan.json"), makePublicPlan());
  if (!EXECUTE) {
    console.log(`Plan validado: ${discovery.length} descubrimiento + 30 transparencia + 15 detalle = 250.`);
    console.log(`Salida de auditoría: ${OUTPUT}`);
    return;
  }

  const key = await readKey();
  const priorState = readJson(statePath, {});
  const before = priorState.accountBefore || await accountSnapshot(key);
  const current = await accountSnapshot(key);
  const completedBefore = loadCompleted().size;
  const ledgerBefore = readJson(ledgerPath, { requests: [] }).requests || [];
  const discoveryCompleted = ledgerBefore
    .filter((item) => item.phase === "discovery" && item.status === "success").length;
  const transparencyCompleted = ledgerBefore
    .filter((item) => item.phase === "transparency" && item.status === "success").length;
  const detailsCompleted = ledgerBefore
    .filter((item) => item.phase === "details" && item.status === "success").length;
  const pendingDiscovery = Math.max(0, discovery.length - discoveryCompleted);
  const creditsAfterDiscovery = current.totalSearchesLeft - pendingDiscovery;
  if (creditsAfterDiscovery < 0) {
    throw new Error(`Saldo insuficiente: quedan ${current.totalSearchesLeft} créditos para ${pendingDiscovery} búsquedas pendientes`);
  }
  const isFreshRun = current.totalSearchesLeft === before.totalSearchesLeft && completedBefore === 0;
  const extraDetails = isFreshRun
    ? 15
    : creditsAfterDiscovery >= 4
      ? Math.max(1, Math.min(3, Math.floor(creditsAfterDiscovery * 0.28)))
      : 0;
  const extraTransparency = isFreshRun ? 30 : creditsAfterDiscovery - extraDetails;
  const adaptive = {
    googleAdsDiscovery: discovery.length,
    transparencyDomains: transparencyCompleted + extraTransparency,
    creativeDetails: detailsCompleted + extraDetails,
  };
  writeJsonAtomic(statePath, {
    ...priorState,
    schema: "redvitalia-serpapi-run-state-v1",
    accountBefore: before,
    currentAccount: current,
    expectedCredits: 250,
    completed: completedBefore,
    chargedBeforeResume: Math.max(0, before.totalSearchesLeft - current.totalSearchesLeft),
    unavailableChargedResponsesBeforeResume: Math.max(
      0,
      before.totalSearchesLeft - current.totalSearchesLeft - completedBefore,
    ),
    adaptiveDistribution: adaptive,
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(resolve(OUTPUT, "plan.json"), makePublicPlan());

  await executePlan(discovery, key, "discovery");
  buildTransparencyCandidates();
  await executePlan(transparencyPlan(adaptive.transparencyDomains), key, "transparency");
  const detailSelection = extraDetails === 0
    ? readJson(resolve(OUTPUT, "detail-selection.json"), { selected: [] })
    : buildDetailSelection(adaptive.creativeDetails);
  const executableDetails = Math.min(adaptive.creativeDetails, detailSelection.selected.length);
  await executePlan(detailsPlan(executableDetails), key, "details");
  const detailShortfall = adaptive.creativeDetails - executableDetails;
  if (detailShortfall > 0) {
    await executePlan(
      transparencyPlan(adaptive.transparencyDomains + detailShortfall),
      key,
      "transparency-reserve",
    );
  }

  const after = await accountSnapshot(key);
  const ledger = readJson(ledgerPath, { requests: [] });
  const successful = ledger.requests.filter((item) => item.status === "success").length;
  const consumed = Math.max(0, before.totalSearchesLeft - after.totalSearchesLeft);
  const chargeableSuccessful = successful;
  const freeSuccessfulResponses = 0;
  const unavailableChargedResponses = Math.max(0, consumed - successful);
  const actualDistribution = Object.fromEntries(["discovery", "transparency", "details"].map((phase) => [
    phase,
    ledger.requests.filter((item) => item.phase === phase && item.status === "success").length,
  ]));
  const finalState = {
    schema: "redvitalia-serpapi-run-state-v1",
    accountBefore: before,
    accountAfter: after,
    expectedCredits: 250,
    successfulRequests: successful,
    chargeableSuccessfulResponses: chargeableSuccessful,
    freeSuccessfulResponses,
    unavailableChargedResponses,
    accountedCredits: chargeableSuccessful + unavailableChargedResponses,
    actualDistribution,
    creditsConsumed: consumed,
    completedAt: new Date().toISOString(),
  };
  writeJsonAtomic(statePath, finalState);
  if (chargeableSuccessful + unavailableChargedResponses !== 250 || consumed !== 250) {
    throw new Error(`Cierre no exacto: ${successful} respuestas guardadas y ${consumed} créditos consumidos`);
  }
  console.log(
    `SerpAPI completado: ${chargeableSuccessful} respuestas guardadas + `
    + `${unavailableChargedResponses} respuestas duplicadas cobradas durante pausas = `
    + "250/250 créditos verificados por Account API.",
  );
};

main().catch((error) => {
  console.error(`SerpAPI detenido: ${String(error?.message || error)}`);
  process.exitCode = 1;
});
