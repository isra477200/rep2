/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import MAESTRO_CONTEXT from "./redvitalia-maestro-context.generated.json";
import MARKET_SEARCH from "./redvitalia-market-search.generated.json";
import INTELLIGENCE_SEARCH from "./redvitalia-intelligence-search.generated.json";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  REDVITALIA_AI_GATEWAY_SECRET?: string;
  REDVITALIA_AI_WEBHOOK_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type MarketRecord = (typeof MARKET_SEARCH.records)[number];
type DeepRecord = {
  id?: string;
  name?: string;
  reviewedAt?: string;
  status?: string;
  confidence?: string;
  coveragePercent?: number;
  message?: { hero?: string; priorSummary?: string; voice?: string; supportingHeadings?: string[] };
  conversion?: { primaryCta?: string; captureType?: string; bookingObserved?: boolean; checkoutObserved?: boolean; technologies?: string[]; formAnalysis?: unknown };
  offer?: { existingSummary?: string; audience?: string; prices?: string[]; guarantee?: string[]; proof?: string[]; objections?: string[] };
  funnel?: Array<{ stage?: string; status?: string; evidence?: string[]; note?: string | null }>;
  route?: string;
  evidence?: Array<{ url?: string; label?: string }>;
  limitations?: unknown;
  redVitalia?: unknown;
  researchReadiness?: string;
};

const SEARCH_STOP_WORDS = new Set([
  "para", "como", "cual", "cuales", "donde", "desde", "hasta", "entre", "sobre", "esta", "este", "esto", "estas", "estos",
  "tiene", "tienen", "hacer", "quiero", "necesito", "puede", "puedes", "mejor", "ahora", "dime", "redvitalia", "maestro", "aplicacion",
  "empresa", "empresas", "agencia", "agencias", "competidor", "competidores", "mercado", "datos", "analiza", "comparar", "compara",
]);
const INTELLIGENCE_KIND_CUES: Record<string, string[]> = {
  "market-economics": ["precio", "precios", "mediana", "median", "euro", "euros", "economia"],
  "validated-pattern": ["patron", "patrones", "validado", "validados", "doblemente"],
  "creative-pattern": ["anuncio", "anuncios", "creativo", "creativos", "copy", "angulo"],
  hypothesis: ["hipotesis", "experimento", "experimentos"],
  playbook: ["playbook", "guion", "plan"],
  methodology: ["metodo", "metodologia", "evidencia", "limite", "limites", "inferencia"],
  guarantee: ["garantia", "garantias"],
  "market-gap": ["hueco", "huecos", "oportunidad", "oportunidades"],
  "vertical-gap": ["hueco", "huecos", "vertical", "oportunidad"],
  "landing-universal": ["landing", "landings", "formulario", "cta", "conversion"],
  "landing-vertical": ["landing", "landings", "formulario", "cta", "conversion", "vertical"],
};

const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
const clipText = (value: unknown, limit: number) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const clipJson = (value: unknown, limit: number) => JSON.stringify(value ?? null).slice(0, limit);

function findMarketMatches(question: string) {
  const query = normalizeSearch(question);
  const tokens = [...new Set(query.split(" ").filter((token) => (token.length >= 4 || ["seo", "crm", "b2b", "b2c", "ads"].includes(token)) && !SEARCH_STOP_WORDS.has(token)))].slice(0, 16);
  if (!tokens.length) return [];
  const discoveryIntent = /\b(empresa|empresas|agencia|agencias|competidor|competidores|ficha|fichas|pais|paises|oferta|canal|precio|quien|quienes|buscar|encuentra|lista)\b/.test(query);

  return MARKET_SEARCH.records.map((record) => {
    const name = normalizeSearch(record.name);
    const domain = normalizeSearch(record.domain);
    const country = normalizeSearch(record.country);
    const primary = `${name} ${domain} ${country}`;
    const secondary = normalizeSearch(`${record.scope} ${record.agencyType} ${record.offer} ${record.niche} ${record.channels.join(" ")} ${record.priceLocal}`);
    const exactName = name.length >= 4 && query.includes(name);
    let matched = 0;
    let score = exactName ? 180 : 0;
    for (const token of tokens) {
      if (primary.includes(token) || secondary.includes(token)) matched += 1;
      if (name.includes(token)) score += 24;
      else if (domain.includes(token)) score += 16;
      else if (country.includes(token)) score += 10;
      else if (secondary.includes(token)) score += 3;
    }
    const eligible = exactName || tokens.some((token) => country === token || name === token) || (discoveryIntent && matched >= 2);
    return { record, score, matched, eligible };
  }).filter((item) => item.eligible && item.score > 0).sort((a, b) => b.score - a.score || b.matched - a.matched || b.record.score - a.record.score).slice(0, 6);
}

function findIntelligenceMatches(question: string) {
  const query = normalizeSearch(question);
  const tokens = [...new Set(query.split(" ").filter((token) => (token.length >= 4 || ["seo", "crm", "b2b", "b2c", "ads"].includes(token)) && !SEARCH_STOP_WORDS.has(token)))].slice(0, 16);
  if (!tokens.length) return [];
  const ranked = INTELLIGENCE_SEARCH.entries.map((entry) => {
    const title = normalizeSearch(entry.title);
    const content = normalizeSearch(entry.content);
    const exactTitle = title.length >= 5 && query.includes(title);
    let matched = 0;
    let score = exactTitle ? 120 : 0;
    if ((INTELLIGENCE_KIND_CUES[entry.kind] || []).some((cue) => query.includes(cue))) score += 64;
    for (const token of tokens) {
      if (title.includes(token) || content.includes(token)) matched += 1;
      if (title.includes(token)) score += 22;
      else if (content.includes(token)) score += 3;
    }
    return { entry, matched, score, eligible: exactTitle || score >= 22 || matched >= 2 };
  }).filter((item) => item.eligible && item.score > 0).sort((a, b) => b.score - a.score || b.matched - a.matched);

  const perKind = new Map<string, number>();
  return ranked.filter(({ entry }) => {
    const count = perKind.get(entry.kind) || 0;
    if (count >= 3) return false;
    perKind.set(entry.kind, count + 1);
    return true;
  }).slice(0, 8);
}

function compactMarketRecord(record: MarketRecord) {
  return {
    id: record.id,
    name: record.name,
    domain: record.domain,
    country: record.country,
    scope: record.scope,
    agencyType: record.agencyType,
    offer: record.offer,
    priceLocal: record.priceLocal,
    priceEur: record.priceEur,
    channels: record.channels,
    score: record.score,
    threat: record.threat,
    relation: record.relation,
    decision: record.decision,
    evidence: record.evidence,
    proof: record.proof,
    cta: record.cta,
    funnel: record.funnel,
    niche: record.niche,
    advertising: record.advertising,
    deep: record.deep,
    takeaway: record.takeaway,
  };
}

function compactDeepRecord(record: DeepRecord) {
  return {
    id: record.id,
    name: record.name,
    reviewedAt: record.reviewedAt,
    status: record.status,
    confidence: record.confidence,
    coveragePercent: record.coveragePercent,
    researchReadiness: record.researchReadiness,
    message: record.message ? {
      hero: clipText(record.message.hero, 700),
      priorSummary: clipText(record.message.priorSummary, 900),
      voice: clipText(record.message.voice, 700),
      supportingHeadings: (record.message.supportingHeadings || []).slice(0, 12).map((item) => clipText(item, 180)),
    } : null,
    conversion: record.conversion ? {
      primaryCta: record.conversion.primaryCta,
      captureType: record.conversion.captureType,
      bookingObserved: record.conversion.bookingObserved,
      checkoutObserved: record.conversion.checkoutObserved,
      technologies: (record.conversion.technologies || []).slice(0, 12),
      formAnalysis: clipJson(record.conversion.formAnalysis, 1800),
    } : null,
    offer: record.offer ? {
      summary: clipText(record.offer.existingSummary, 1000),
      audience: clipText(record.offer.audience, 700),
      prices: (record.offer.prices || []).slice(0, 3).map((item) => clipText(item, 900)),
      guarantees: (record.offer.guarantee || []).slice(0, 2).map((item) => clipText(item, 700)),
      proof: (record.offer.proof || []).slice(0, 3).map((item) => clipText(item, 700)),
      objections: (record.offer.objections || []).slice(0, 3).map((item) => clipText(item, 500)),
    } : null,
    route: clipText(record.route, 1600),
    funnel: (record.funnel || []).slice(0, 12).map((stage) => ({ stage: stage.stage, status: stage.status, evidence: (stage.evidence || []).slice(0, 4).map((item) => clipText(item, 260)), note: clipText(stage.note, 320) })),
    sources: (record.evidence || []).slice(0, 10).map((item) => ({ label: item.label, url: item.url })),
    limitations: clipJson(record.limitations, 1800),
    redVitaliaReading: clipJson(record.redVitalia, 2200),
  };
}

async function retrieveKnowledgeContext(question: string, requestUrl: string, env: Env) {
  const matches = findMarketMatches(question);
  const intelligenceMatches = findIntelligenceMatches(question);
  if (!matches.length && !intelligenceMatches.length) return "";
  const deepRecords = (await Promise.all(matches.slice(0, 3).map(async ({ record }) => {
    if (!record.deep) return null;
    try {
      const response = await env.ASSETS.fetch(new Request(new URL(`/data/deep/records/${encodeURIComponent(record.id)}.json`, requestUrl)));
      if (!response.ok) return null;
      return compactDeepRecord(await response.json() as DeepRecord);
    } catch {
      return null;
    }
  }))).filter(Boolean);

  const base = {
    catalogCoverage: MARKET_SEARCH.records.length,
    strategicLibraryCoverage: INTELLIGENCE_SEARCH.entries.length,
    query: question,
    matches: matches.map(({ record }) => compactMarketRecord(record)),
    deepRecords,
    strategicMatches: intelligenceMatches.map(({ entry }) => entry),
  };
  let payload = JSON.stringify(base);
  if (payload.length > 55_000) payload = JSON.stringify({ ...base, deepRecords: deepRecords.slice(0, 1), strategicMatches: base.strategicMatches.slice(0, 4) });
  if (payload.length > 55_000) payload = JSON.stringify({ ...base, matches: base.matches.slice(0, 4), deepRecords: deepRecords.slice(0, 1), strategicMatches: base.strategicMatches.slice(0, 2) });
  return payload.slice(0, 55_000);
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/redvitalia-ai") {
      const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      if (request.method !== "POST" && request.method !== "GET") return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers });
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403, headers });
      if (!env.REDVITALIA_AI_GATEWAY_SECRET) return Response.json({ ok: false, error: "gateway_not_configured" }, { status: 503, headers });

      const webhookUrl = env.REDVITALIA_AI_WEBHOOK_URL || "https://n8n-wmlc.srv1480016.hstgr.cloud/webhook/redvitalia-maestro";
      const requestId = crypto.randomUUID().replaceAll("-", "");
      let body: Record<string, unknown> = { action: "status", requestId };
      if (request.method === "POST") {
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 60_000) return Response.json({ ok: false, error: "request_too_large" }, { status: 413, headers });
        try {
          const input = await request.json() as Record<string, unknown>;
          const history = Array.isArray(input.history) ? input.history.slice(-8) : [];
          body = {
            action: "ask",
            requestId,
            conversationId: String(input.conversationId || "").slice(0, 100),
            mode: String(input.mode || "ask").slice(0, 20),
            page: String(input.page || "/").slice(0, 180),
            question: String(input.question || "").slice(0, 8_000),
            pageContext: String(input.pageContext || "").slice(0, 6_000),
            history,
          };
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers });
        }

        body.appContext = JSON.stringify(MAESTRO_CONTEXT).slice(0, 70_000);
        body.retrievedContext = await retrieveKnowledgeContext(String(body.question || ""), request.url, env);
      }

      try {
        const upstream = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-RedVitalia-AI": env.REDVITALIA_AI_GATEWAY_SECRET },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(315_000),
        });
        const result = await upstream.json().catch(() => ({ ok: false, error: "invalid_upstream_response" }));
        return Response.json(result, { status: upstream.status, headers });
      } catch {
        return Response.json({ ok: false, error: "assistant_unavailable" }, { status: 503, headers });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
