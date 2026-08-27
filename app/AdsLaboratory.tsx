"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AdCoverageData, AnuncioReal, AnunciosRealesData } from "./data-types";
import { parseAdQuery, type AdLanguageMode, type AdSearchScope, type AdSort } from "./ad-lab-model";
import {
  buildAssociationSignals,
  buildPatternSignals,
  buildPhraseSignals,
  creativeFormatForAd,
  detectHookFamilies,
  detectOfferMechanics,
  parseAdDate,
  patternIdentityForAd,
  semanticCopyForAd,
  type AssociationSignal,
  type PatternObservation,
  type PatternSignal,
  type PhraseSignal,
  type SemanticAdCopy,
} from "./ad-pattern-engine";

type LabSection = "explore" | "patterns" | "matrix";
type PatternDimension = "hook" | "angle" | "promise" | "mechanic" | "format" | "cta";
type PatternView = "signals" | "combinations" | "phrases" | "contrasts";
type PatternWeighting = "companies" | "identities";

type PromiseEvidence = {
  label: string;
  evidence: string;
};

type LabAd = {
  ad: AnuncioReal;
  key: string;
  index: number;
  platform: string;
  format: string;
  angles: string[];
  promises: PromiseEvidence[];
  hooks: string[];
  mechanics: string[];
  ctaGroup: string;
  patternEligible: boolean;
  hasEvidenceMetadata: boolean;
  semanticCopy: SemanticAdCopy;
  qualityScore: number;
  identityKey: string;
  searchText: string;
};

type MatrixOption = {
  value: string;
  source: LabAd;
  evidence: string;
};

type MatrixRow = {
  id: string;
  label: string;
  instruction: string;
  metric: string;
  control: MatrixOption;
  challengers: MatrixOption[];
};

type LeadMarketSnapshot = {
  id: string;
  observedAt: string;
  note: string;
  methodology: {
    apiCallsOrCredits: number;
    analyzedAds: number;
    discardedAsNoise: number;
    limitation: string;
  };
  kpis: {
    analyzedAds: number;
    providerAds: number;
    providerPages: number;
    detailedCreatives: number;
    detailedPages: number;
    uniqueCopyBodies: number;
    uniqueImages: number;
    copyCloneClusters: number;
  };
  editorialReview: {
    matchedPageIds: number;
    matchedCompanyIds: number;
    quarantinedPageIds: number;
    watchlistPageIds: number;
    policy: string;
  };
  cloneClusters: Array<{
    id: string;
    title: string;
    pages: string[];
    adCount: number;
    listedExternalIdCount: number;
    countConsistent: boolean;
  }>;
  qualityWarnings: string[];
};

export type AdsLaboratoryProps = {
  /** Si no se pasa, el componente carga /data/ad-corpus.json por sí solo. */
  data?: AnunciosRealesData | null;
  /** Si se omite, intenta cargar /data/ad-coverage.json. `null` desactiva esa carga. */
  coverageData?: AdCoverageData | null;
  onOpenCompany?: (companyId: string) => void;
  initialSection?: LabSection;
  initialQuery?: string;
};

const ALL = "__all__";
const NO_PROMISE = "Sin promesa clasificable";
const EVIDENCE_ELIGIBLE = "eligibility:yes";
const EVIDENCE_EXCLUDED = "eligibility:no";
const EVIDENCE_FILE = "asset:file";
const EVIDENCE_SOURCE = "asset:source";
const EVIDENCE_EXTERNAL_ID = "asset:external-id";
const CONFIDENCE_HIGH = "confidence:high";
const CONFIDENCE_MEDIUM = "confidence:medium";
const CONFIDENCE_LOW = "confidence:low";
const CONFIDENCE_OTHER = "confidence:other";
const CONFIDENCE_NONE = "confidence:none";
const DEFAULT_VISIBLE = 24;
const MAX_SELECTION = 12;

const LANGUAGE_STATUS_LABELS: Record<string, string> = {
  no_necesaria: "Original en español",
  automatica: "Traducción automática",
  revisada: "Traducción revisada",
  pendiente: "Traducción pendiente",
  requiere_revision: "Requiere revisión",
  no_disponible: "Sin traducción automática",
  no_aplica: "Sin texto que traducir",
};

const OCR_STATUS_LABELS: Record<string, string> = {
  no_necesario: "Texto verificado / OCR no necesario",
  completo_alta: "OCR · confianza alta",
  completo_media: "OCR · confianza media",
  completo_baja: "OCR · confianza baja",
  sin_texto: "OCR · sin texto legible",
  fallido: "OCR · fallo técnico",
  pendiente: "OCR · pendiente",
};

const PLATFORM_FAMILY_LABELS: Record<string, string> = {
  meta: "Meta",
  instagram: "Instagram",
  google: "Google",
  display: "Display",
  unknown: "Plataforma sin determinar",
};

const PROMISE_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Garantía / riesgo invertido",
    pattern: /garant(?:ía|ia)|devolv|reembols|100\s*%\s*(?:de\s*)?(?:tu\s*)?dinero|sin riesgo|riesgo cero|si no funciona|no cobramos/i,
  },
  {
    label: "Resultado cuantificado",
    pattern: /(?:\d+[\d.,]*|cien|mil)\s*(?:\+\s*)?(?:x\s*)?(?:leads?|contactos?|clientes?|citas?|pacientes?|ventas?|campañas?|reformas?|visitas?|solicitudes?|reuniones?|casos?|%\s*(?:m[aá]s\s*)?(?:ventas?|conversi[oó]n|crecimiento|clientes?))/i,
  },
  {
    label: "Rapidez / plazo",
    pattern: /(?:\d+[\d.,]*\s*(?:minutos?|horas?|días?|semanas?|meses?))|24\s*\/\s*7|tiempo real|inmediat|rápid|en menos de|cada día/i,
  },
  {
    label: "Precio / ahorro",
    pattern: /(?:\d+[\d.,]*\s*(?:€|euros?))|desde\s+\d|precio|cuota|gratis|gratuit|descuento|ahorr|oferta|promoción/i,
  },
  {
    label: "Exclusividad / territorio",
    pattern: /exclusiv|territori|tu zona|tu ciudad|de tu ciudad|una sola empresa|todas las reformas de/i,
  },
  {
    label: "Demanda cualificada / agenda",
    pattern: /citas?\s+(?:cualificad|agendad)|agenda|lead(?:s)?\s+(?:cualificad|interesad)|contactos?\s+interesad|cliente potencial|oportunidades?\s+cualificad/i,
  },
  {
    label: "Escala / crecimiento",
    pattern: /escal|crec(?:e|er|imiento)|multiplica|aumenta|más clientes|más ventas|llenar tu agenda|llena tu agenda/i,
  },
  {
    label: "Autoridad / prueba social",
    pattern: /caso de éxito|testimoni|reseñas?|reviews?|líder|expertos?|top\s*\d|más de \d|\d+[\d.,]*\+|campañas exitosas|hemos generado/i,
  },
  {
    label: "Simplicidad / hecho por ti",
    pattern: /todo en uno|nos ocupamos|nos encargamos|llave en mano|sin complicaciones|automatiz|una sola factura|lo hacemos por ti/i,
  },
  {
    label: "Flexibilidad / sin permanencia",
    pattern: /sin permanencia|sin cuota|sin costes? fijos?|cancela cuando|sin compromiso/i,
  },
];

const DIMENSION_LABELS: Record<PatternDimension, string> = {
  hook: "Apertura",
  angle: "Ángulo",
  promise: "Promesa",
  mechanic: "Mecánica de oferta",
  format: "Formato",
  cta: "CTA",
};

const DIMENSION_SHORT_LABELS: Record<string, string> = {
  hook: "Apertura",
  angle: "Ángulo",
  promise: "Promesa",
  mechanic: "Oferta",
  format: "Formato",
  cta: "CTA",
  phrase: "Frase",
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

const OTHER_ANGLE_FAMILY = "Otro / sin clasificar";

const ANGLE_FAMILY_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Autoridad / prueba social",
    pattern: /prueba social|autoridad|testimoni|caso (?:de exito|real)|resenas?|reviews?|chats? reales?|lider(?:azgo)?|n[ºo°]?\s*1|numero 1|top\s*\d*|ranking|mejor(?:es)? (?:agencia|especialista|valorad)|experiencia|congreso|marca paraguas|listado|voto|premio|del mes/i,
  },
  {
    label: "Dolor / agitación",
    pattern: /dolor|agitacion|miedo|problema|pierd[ea]|perdida|sangr|frustr|cuello de botella|capacidad ociosa|paralisis|incertidumbre|desaprovech|sin respuesta|coste de inactividad|agenda vacia|cena fria|no dejar de atraer|apagon/i,
  },
  {
    label: "Resultado / crecimiento",
    pattern: /resultado|crec(?:er|imiento)|escal(?:a|ar)|expansi|facturacion|ventas?|clientes? cualific|leads? cualific|citas?|pacientes?|llenar agenda|altas del|captacion|generacion(?: de)? leads?|prospeccion|rentabilidad|roas|conversion|ratio de cierre|demanda lista|previsibilidad|oportunidad|multiplic|aumentar?|mas (?:clientes|ventas|citas)|pipeline/i,
  },
  {
    label: "Precio / ahorro",
    pattern: /precio|ahorr|barat|low[- ]ticket|coste|costos|cuota|pago|gratis|gratuit|oferta|descuento|promocion|presupuestos?|comparar|renting|inversion|sin costes? fijos?|sin cuota/i,
  },
  {
    label: "Velocidad / urgencia",
    pattern: /velocidad|\bsla\b|rapid|urgencia|inmediat|al instante|24\s*h|24\s*\/\s*7|plazo|fecha limite|tiempo real|reserva inmediata|cada dia|dias? en circulacion|meses? vista|disponibilidad/i,
  },
  {
    label: "Garantía / riesgo",
    pattern: /garantia|riesgo(?: cero| invertido)?|devolucion|reembolso|pago por resultados?|pago a exito|trabajar gratis hasta|garantizad|sin permanencia|sin compromiso|garantia contractual/i,
  },
  {
    label: "Anti-competencia",
    pattern: /anti[- ](?:compet|directorio|cuota|leads?|comision|gasto|promesa|landing|portales?|crecimiento)|ataque (?:directo|triple)|competidor|habitissimo|milanuncios|doctoralia|contrarian|david\s+vs\s+goliat|frente a (?:la|el)|reencuadre|independencia del boca a boca/i,
  },
  {
    label: "Especialización / nicho",
    pattern: /especializ|micro[- ]?nicho|nicho|sector(?:ial)?|vertical|territori|local(?:idad)?|region|zona|ciudad|\bb2b\b|\bb2c\b|dental|clinica|fisioterapia|gimnasio|centros? (?:de )?formacion|industrial|asesorias|cirugia|implantes|reformas?|hogar|educativ|propietarios|auditiv|boda|franquicia|marketplace|multiservicio/i,
  },
  {
    label: "Automatización / facilidad",
    pattern: /automatiz|inteligencia artificial|agentes? ia|\bia\b|todo en uno|facil|simplic|done[- ]for[- ]you|llave en mano|end[- ]to[- ]end|acompanamiento|delegad|externaliz|sin (?:mas )?plantilla|saas|whatsapp|software|hardware|flywheel|eficiencia|sistema circular/i,
  },
  {
    label: "Transparencia / método",
    pattern: /transparen|metodo|medicion|datos?|matematica|analisis|auditoria|evaluacion|demo|proceso|implementacion real|no teoria|resultados? medibles?|comparacion|sistema (?:comercial|con nombre propio)|ratio|estadistica|paso a paso/i,
  },
  {
    label: "Educación / contenido",
    pattern: /lead magnet|contenido|educacion|educacional|formacion|masterclass|webinar|\bvsl\b|advertorial|prensa|guia|libro|comunidad|evento|tutorial|curso|carrera|directa gratuita|analisis gratuito|auditoria gratuita/i,
  },
  {
    label: "Escasez",
    pattern: /escasez|plazas?|lista de espera|seleccion inversa|casting|solo\s+\d|\bfomo\b|fecha limite|estacionalidad|exclusiv|oferta de lanzamiento/i,
  },
  {
    label: "Humor",
    pattern: /humor|meme|parodia|broma|satir|iron|tono costumbrista/i,
  },
];

const angleFamilies = (editorialAngle: string) => {
  const value = normalize(editorialAngle || "");
  if (!value || /sin angulo|sin etiqueta|no etiquetad|sin clasificar/.test(value)) {
    return [OTHER_ANGLE_FAMILY];
  }
  const matches = ANGLE_FAMILY_RULES
    .filter((rule) => rule.pattern.test(value))
    .map((rule) => rule.label);
  return matches.length ? matches : [OTHER_ANGLE_FAMILY];
};

const compact = (value: string, max = 150) => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
};

const sentenceCase = (value: string) =>
  value ? `${value.charAt(0).toLocaleUpperCase("es")}${value.slice(1)}` : value;

const basename = (file: string) => file.split(/[\\/]/).pop() || file;

type ConfidenceBand = "high" | "medium" | "low" | "other" | "none";

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const safeExternalUrl = (value: unknown) => {
  const url = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(url) ? url : "";
};

const safeMediaPath = (value: unknown) => {
  const path = typeof value === "string" ? value.trim() : "";
  return path && !/^(?:javascript|data:text\/html):/i.test(path) ? path : "";
};

const videoPath = (value: string) =>
  /\.(?:mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i.test(value);

const imagePath = (value: string) =>
  /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value);

type PresentableMediaAsset = {
  kind: "image" | "video" | "poster" | "other";
  src: string;
  poster: string;
};

const presentableAsset = (
  asset: NonNullable<AnuncioReal["mediaAssets"]>[number],
): PresentableMediaAsset | null => {
  if (typeof asset === "string") {
    const src = safeMediaPath(asset);
    if (!src) return null;
    return {
      kind: videoPath(src) ? "video" : imagePath(src) ? "image" : "other",
      src,
      poster: "",
    };
  }
  const src = safeMediaPath(
    asset.localFile || asset.file || asset.url || asset.sourceUrl,
  );
  const poster = safeMediaPath(asset.posterFile || asset.posterUrl);
  if (!src && !poster) return null;
  const declared = normalize(`${asset.type || asset.kind || ""} ${asset.mimeType || ""}`);
  const kind = declared.includes("video") || videoPath(src)
    ? "video"
    : declared.includes("poster")
      ? "poster"
      : declared.includes("image") || imagePath(src)
        ? "image"
        : "other";
  return { kind, src: src || poster, poster };
};

const presentableMedia = (ad: AnuncioReal) => {
  const assets = (ad.mediaAssets || [])
    .map(presentableAsset)
    .filter((asset): asset is PresentableMediaAsset => Boolean(asset));
  const legacyFile = safeMediaPath(ad.file);
  const explicitVideo = safeMediaPath(ad.videoFile);
  const video =
    explicitVideo ||
    assets.find((asset) => asset.kind === "video")?.src ||
    (ad.mediaType === "video" || videoPath(legacyFile) ? legacyFile : "");
  const legacyImage = legacyFile && (ad.mediaType === "image" || imagePath(legacyFile))
    ? legacyFile
    : "";
  const poster =
    safeMediaPath(ad.posterFile) ||
    assets.find((asset) => asset.kind === "video" && asset.poster)?.poster ||
    assets.find((asset) => asset.kind === "poster")?.src ||
    (video ? legacyImage : "");
  const image =
    assets.find((asset) => asset.kind === "image")?.src ||
    legacyImage ||
    (!video && poster ? poster : "");
  return {
    video,
    poster,
    image,
    openFile: video || image || legacyFile || assets[0]?.src || "",
    assetCount: assets.length,
  };
};

const resolvedMediaType = (ad: AnuncioReal) => {
  const media = presentableMedia(ad);
  if (media.video) return "video";
  if (media.image) return "image";
  return ad.mediaType || (ad.file ? "other" : "none");
};

const displayDate = (value: AnuncioReal["startDate"] | AnuncioReal["endDate"]) => {
  if (!hasValue(value)) return "";
  const text = String(value).trim();
  const numeric = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const deliveryRange = (ad: AnuncioReal) => {
  const start = displayDate(ad.startDate);
  const end = displayDate(ad.endDate);
  if (start && end) return `${start} — ${end}`;
  if (start) return `Desde ${start}`;
  if (end) return `Hasta ${end}`;
  return "";
};

const sortableAdDate = (ad: AnuncioReal) => {
  if (typeof ad.startDate === "number") {
    return ad.startDate < 1_000_000_000_000 ? ad.startDate * 1000 : ad.startDate;
  }
  return parseAdDate(ad.startDate || ad.fecha);
};

const captionTrackFor = (transcript: string) => {
  const cue = transcript.replaceAll("-->", "→").trim();
  const vtt = cue
    ? `WEBVTT\n\n00:00:00.000 --> 23:59:59.999\n${cue}\n`
    : "WEBVTT\n\n";
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
};

const confidenceBand = (value: AnuncioReal["confianza"]): ConfidenceBand => {
  if (!hasValue(value)) return "none";
  const raw = String(value).trim();
  const numeric = Number(raw.replace("%", "").replace(",", "."));
  if (Number.isFinite(numeric)) {
    if (numeric >= 90) return "high";
    if (numeric >= 75) return "medium";
    return "low";
  }
  const normalized = normalize(raw);
  if (/\b(?:alta|alto|high)\b/.test(normalized)) return "high";
  if (/\b(?:media|medio|medium)\b/.test(normalized)) return "medium";
  if (/\b(?:baja|bajo|low)\b/.test(normalized)) return "low";
  return "other";
};

const confidenceLabel = (value: AnuncioReal["confianza"]) => {
  const labels: Record<ConfidenceBand, string> = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
    other: "Declarada",
    none: "Sin dato",
  };
  return labels[confidenceBand(value)];
};

const confidenceSortValue = (ad: AnuncioReal) => {
  const ocr = Number(ad.confianzaOcr);
  if (Number.isFinite(ocr)) return ocr;
  const numeric = Number(String(ad.confianza ?? "").replace("%", "").replace(",", "."));
  if (Number.isFinite(numeric)) return numeric;
  return ({ high: 95, medium: 82, low: 55, other: 50, none: -1 } as const)[confidenceBand(ad.confianza)];
};

const platformLabel = (platform: string) => {
  const value = normalize(platform);
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("meta")) return "Meta";
  if (value.includes("google") || value.includes("transparencia")) return "Google";
  if (value.includes("display")) return "Display";
  return platform.trim() || "Plataforma no indicada";
};

const formatEvidence = (ad: AnuncioReal) => {
  const platform = normalize(ad.plataforma);
  if (/carrusel|carousel|reels?|\b(?:video|vídeo|imagen|image|bild|foto|text|texto)\b/.test(platform))
    return `Tipo explícito en la fuente: “${ad.plataforma}”. El copy no interviene en esta clasificación.`;
  const mediaType = resolvedMediaType(ad);
  if (mediaType && ["video", "document"].includes(mediaType))
    return `Metadato del archivo archivado: “${mediaType}”. La fuente “${ad.plataforma}” no declara un formato creativo más preciso.`;
  const video = presentableMedia(ad).video;
  if (video)
    return `Archivo de vídeo verificable “${basename(video)}”; el copy no interviene.`;
  if (platform === "google")
    return "Fuente heredada normalizada como anuncio de búsqueda; el copy no interviene en la clasificación.";
  return `La fuente “${ad.plataforma || "no indicada"}” no permite asegurar un formato creativo; no se ha inferido desde el copy.`;
};

const ctaLabel = (cta: string) => {
  const value = normalize(cta);
  if (!value || /^[-—–]+$/.test(value)) return "Sin CTA visible";
  if (/mas informacion|learn more|saber mas|ver mas|watch/.test(value)) return "Más información";
  if (/whatsapp|mensaje|escrib/.test(value)) return "WhatsApp / mensaje";
  if (/solicitud|contact|presupuesto|cotiza|quote|diagnostico|auditoria|consulta|apply|aplica|llam|call|formular|agenda/.test(value)) return "Solicitar / contactar";
  if (/visitar|sitio|web|enlace|abrir|descubr/.test(value)) return "Visitar web";
  if (/comprar|oferta|reserv|book|probar|empieza|comenzar|get started/.test(value)) return "Comprar / reservar / probar";
  if (/descarg|download|install/.test(value)) return "Descargar / instalar";
  return "Otro CTA visible";
};

const evidenceSnippet = (ad: AnuncioReal, pattern: RegExp, semanticCopy?: SemanticAdCopy) => {
  const segments = semanticCopy
    ? [semanticCopy.headline, semanticCopy.body, semanticCopy.price].filter(Boolean)
    : [ad.titular, ad.texto, ad.precioVisible].filter(Boolean);
  for (const segment of segments) {
    const match = segment.match(pattern);
    if (!match || match.index === undefined) continue;
    const start = Math.max(0, match.index - 54);
    const end = Math.min(segment.length, match.index + match[0].length + 72);
    return `${start > 0 ? "…" : ""}${segment.slice(start, end).trim()}${end < segment.length ? "…" : ""}`;
  }
  return compact(semanticCopy?.headline || semanticCopy?.body || ad.titular || ad.texto, 140);
};

const evidenceQualityScore = (ad: AnuncioReal) => {
  const ocrScore: Record<string, number> = {
    no_necesario: 96,
    completo_alta: 90,
    completo_media: 76,
    completo_baja: 48,
    sin_texto: 18,
    fallido: 12,
    pendiente: 45,
  };
  let score = ocrScore[ad.estadoOcr || "pendiente"] ?? 55;
  if (ad.aptaPatrones === false) score = Math.min(score, 42);
  if (ad.externalId) score += 3;
  if (ad.fuenteUrl) score += 3;
  if (presentableMedia(ad).openFile) score += 2;
  if (ad.estadoTraduccion === "automatica") score -= 8;
  if (ad.estadoTraduccion === "requiere_revision") score -= 15;
  return Math.max(0, Math.min(100, score));
};

const classifyRealAd = (ad: AnuncioReal, index: number): LabAd => {
  // La taxonomía sirve para filtrar; la etiqueta editorial literal permanece en `ad.angulo`
  // y se sigue mostrando íntegra en toda la evidencia y trazabilidad.
  const angles = angleFamilies(ad.angulo);
  // La semántica usa el original español o una traducción separada y trazable.
  // Una traducción automática aporta una pista exploratoria, nunca cambia la aptitud de la pieza.
  const semanticCopy = semanticCopyForAd(ad);
  const promises = PROMISE_RULES.filter((rule) => rule.pattern.test(semanticCopy.all))
    .map((rule) => ({ label: rule.label, evidence: evidenceSnippet(ad, rule.pattern, semanticCopy) }));
  const platform = ad.platformFamily
    ? (PLATFORM_FAMILY_LABELS[ad.platformFamily] || platformLabel(ad.plataforma))
    : platformLabel(ad.plataforma);
  const format = creativeFormatForAd(ad);
  const ctaGroup = ctaLabel(semanticCopy.cta || ad.cta);
  const hooks = detectHookFamilies(semanticCopy.headline, semanticCopy.body);
  const mechanics = detectOfferMechanics(semanticCopy.all);
  const patternEligible = ad.aptaPatrones !== false;
  const hasEvidenceMetadata = [
    ad.externalId,
    ad.fuenteUrl,
    ad.origen,
    ad.transcripcion,
    ad.confianza,
    ad.estadoEvidencia,
    ad.atribucion,
    ad.archivoSha256,
    ad.corpusKey,
    ad.anunciante,
    ad.pageId,
    ad.landingUrl,
    ad.videoFile,
    ad.posterFile,
    ad.transcript,
  ].some(hasValue) || ad.aptaPatrones !== undefined;
  return {
    ad,
    key: `${ad.corpusKey || ad.file || ad.externalId || ad.id || "ad"}::${index}`,
    index,
    platform,
    format,
    angles,
    promises,
    hooks,
    mechanics,
    ctaGroup,
    patternEligible,
    hasEvidenceMetadata,
    semanticCopy,
    qualityScore: evidenceQualityScore(ad),
    identityKey: patternIdentityForAd(ad, `${ad.id}:${index}`),
    searchText: normalize(
      [
        ad.name,
        ad.id,
        ad.country || "",
        ad.titular,
        ad.texto,
        ad.cta,
        ad.precioVisible,
        ad.angulo,
        ad.vertical || "",
        ad.plataforma,
        platform,
        format,
        ctaGroup,
        ad.externalId || "",
        ad.pageId || "",
        ad.fuenteUrl || "",
        ad.landingUrl || "",
        ad.origen || "",
        ad.transcripcion || "",
        ad.transcript || "",
        hasValue(ad.isActive) ? (ad.isActive ? "anuncio activo" : "anuncio inactivo") : "",
        hasValue(ad.startDate) ? String(ad.startDate) : "",
        hasValue(ad.endDate) ? String(ad.endDate) : "",
        hasValue(ad.confianza) ? String(ad.confianza) : "",
        confidenceLabel(ad.confianza),
        ad.estadoEvidencia || "",
        ad.atribucion || "",
        ad.archivoSha256 || "",
        ad.corpusKey || "",
        ad.anunciante || "",
        ad.idioma || "",
        ad.idiomaNombre || "",
        ad.estadoTraduccion || "",
        ad.traduccionEs?.titular || "",
        ad.traduccionEs?.texto || "",
        ad.traduccionEs?.cta || "",
        ad.estadoOcr || "",
        ad.mediaType || "",
        ad.aptaPatrones === false ? "fuera de patrones no apta" : "apta para patrones",
        ...angles,
        ...promises.map((promise) => promise.label),
        ...hooks,
        ...mechanics,
      ].join(" "),
    ),
  };
};

const patternEvidence = (
  ad: LabAd,
  dimension: PatternDimension,
  label: string,
) => {
  if (dimension === "hook") return `Apertura detectada sobre ${ad.semanticCopy.label.toLocaleLowerCase("es")}: “${compact(ad.semanticCopy.headline || ad.semanticCopy.body, 145)}”`;
  if (dimension === "angle") return `Etiqueta editorial almacenada: “${ad.ad.angulo || "sin ángulo"}”`;
  if (dimension === "promise")
    return `${ad.promises.find((promise) => promise.label === label)?.evidence || "No se detectó una promesa textual."} · ${ad.semanticCopy.label}.`;
  if (dimension === "mechanic") return `Mecánica detectada sobre ${ad.semanticCopy.label.toLocaleLowerCase("es")}: “${compact(ad.semanticCopy.all, 165)}”`;
  if (dimension === "format") return formatEvidence(ad.ad);
  return ad.semanticCopy.cta
    ? `CTA analizado sobre ${ad.semanticCopy.label.toLocaleLowerCase("es")}: “${ad.semanticCopy.cta}”. Original: “${ad.ad.cta || "sin CTA separado"}”.`
    : "La captura no muestra un CTA legible.";
};

const matrixValue = (ad: LabAd, axis: MatrixRow["id"]): MatrixOption => {
  if (axis === "headline")
    return {
      value: ad.semanticCopy.headline || ad.ad.titular || "(sin titular visible)",
      source: ad,
      evidence: `${ad.semanticCopy.label}. Original: “${compact(ad.ad.titular || "sin titular separado", 160)}”. Fuente: ${sourceLine(ad)}.`,
    };
  if (axis === "angle")
    return {
      value: ad.angles.join(" + "),
      source: ad,
      evidence: `Etiqueta editorial de ángulo: “${ad.ad.angulo || "sin ángulo"}”.`,
    };
  if (axis === "promise")
    return {
      value: ad.promises.map((promise) => promise.label).join(" + ") || "Sin promesa clasificable",
      source: ad,
      evidence: ad.promises.map((promise) => promise.evidence).join(" | ") || "No hay promesa detectada por las reglas.",
    };
  if (axis === "mechanic")
    return {
      value: ad.mechanics.join(" + ") || "Sin mecánica explícita",
      source: ad,
      evidence: `${ad.semanticCopy.label}: “${compact(ad.semanticCopy.all, 220)}”`,
    };
  if (axis === "format")
    return {
      value: ad.format,
      source: ad,
      evidence: formatEvidence(ad.ad),
    };
  return {
    value: ad.semanticCopy.cta || ad.ctaGroup,
    source: ad,
    evidence: `${ad.semanticCopy.label}. CTA original: “${ad.ad.cta || "sin CTA separado"}”.`,
  };
};

const makeMatrix = (selected: LabAd[], baseline: LabAd | undefined): MatrixRow[] => {
  if (!baseline || selected.length < 2) return [];
  const axes: Array<Omit<MatrixRow, "control" | "challengers">> = [
    {
      id: "headline",
      label: "Apertura / titular",
      instruction: "Conserva oferta, formato y CTA; cambia solo la apertura literal.",
      metric: "Respuesta inicial: CTR y coste por contacto cualificado.",
    },
    {
      id: "angle",
      label: "Ángulo",
      instruction: "Mantén la misma ejecución y enfrenta dos enfoques ya observados.",
      metric: "Calidad: contactos válidos y citas por 100 contactos.",
    },
    {
      id: "promise",
      label: "Promesa",
      instruction: "No añadas cifras: usa únicamente la promesa respaldada por cada captura.",
      metric: "Conversión: contacto o cita por visita a la landing.",
    },
    {
      id: "mechanic",
      label: "Mecánica de oferta",
      instruction: "Mantén el mensaje y cambia solo precio, garantía, entrada gratuita, diagnóstico o condición comercial observada.",
      metric: "Intención: clic a contacto, contacto completado y tasa de cualificación.",
    },
    {
      id: "format",
      label: "Formato",
      instruction: "Repite el mensaje y cambia solo el formato observado.",
      metric: "Eficiencia: CTR, coste por contacto y tasa de cualificación.",
    },
    {
      id: "cta",
      label: "CTA",
      instruction: "Mantén titular, promesa y creatividad; sustituye únicamente la llamada a la acción.",
      metric: "Acción: clic a contacto y contacto completado por clic.",
    },
  ];
  return axes
    .map((axis) => {
      const control = matrixValue(baseline, axis.id);
      const seen = new Set([normalize(control.value)]);
      const challengers: MatrixOption[] = [];
      for (const ad of selected) {
        if (ad.key === baseline.key) continue;
        const option = matrixValue(ad, axis.id);
        const key = normalize(option.value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        challengers.push(option);
        if (challengers.length === 2) break;
      }
      return { ...axis, control, challengers };
    })
    .filter((row) => row.challengers.length > 0);
};

const sourceLine = (ad: LabAd) =>
  `${ad.ad.name} · ${presentableMedia(ad.ad).openFile ? basename(presentableMedia(ad.ad).openFile) : ad.ad.externalId || ad.ad.origen || ad.ad.plataforma || "sin archivo local"}${ad.patternEligible ? "" : " · fuera de patrones"}`;

const adAsText = (ad: LabAd) =>
  [
    `${ad.ad.name} — ${ad.ad.titular || "(sin titular visible)"}`,
    ad.ad.texto,
    ad.ad.cta ? `CTA: ${ad.ad.cta}` : "CTA: no visible",
    `Idioma original: ${ad.ad.idiomaNombre || ad.ad.idioma || "sin determinar"}`,
    ad.ad.traduccionEs?.titular ? `Traducción ES · titular: ${ad.ad.traduccionEs.titular}` : "",
    ad.ad.traduccionEs?.texto ? `Traducción ES · cuerpo: ${ad.ad.traduccionEs.texto}` : "",
    ad.ad.traduccionEs?.cta ? `Traducción ES · CTA: ${ad.ad.traduccionEs.cta}` : "",
    ad.ad.traduccionEs?.precioVisible ? `Traducción ES · oferta: ${ad.ad.traduccionEs.precioVisible}` : "",
    ad.ad.estadoTraduccion ? `Estado de traducción: ${ad.ad.estadoTraduccion}` : "",
    ad.ad.estadoOcr ? `Estado OCR: ${ad.ad.estadoOcr}${hasValue(ad.ad.confianzaOcr) ? ` · ${ad.ad.confianzaOcr}%` : ""}` : "",
    ad.ad.precioVisible ? `Precio/oferta visible: ${ad.ad.precioVisible}` : "",
    `Ángulo etiquetado: ${ad.ad.angulo || "sin etiqueta"}`,
    `Plataforma: ${ad.ad.plataforma}`,
    ad.ad.externalId ? `ID externo: ${ad.ad.externalId}` : "",
    ad.ad.pageId ? `Page ID: ${ad.ad.pageId}` : "",
    hasValue(ad.ad.isActive) ? `Estado en biblioteca: ${ad.ad.isActive ? "activo" : "inactivo"}` : "",
    deliveryRange(ad.ad) ? `Periodo observado: ${deliveryRange(ad.ad)}` : "",
    ad.ad.landingUrl ? `Landing: ${ad.ad.landingUrl}` : "",
    ad.ad.fuenteUrl ? `Fuente: ${ad.ad.fuenteUrl}` : "",
    ad.ad.origen ? `Origen: ${ad.ad.origen}` : "",
    ad.ad.transcripcion ? `Transcripción: ${ad.ad.transcripcion}` : "",
    ad.ad.transcript && ad.ad.transcript !== ad.ad.transcripcion ? `Transcripción de vídeo: ${ad.ad.transcript}` : "",
    hasValue(ad.ad.confianza) ? `Confianza: ${ad.ad.confianza} · ${confidenceLabel(ad.ad.confianza)}` : "",
    ad.ad.estadoEvidencia ? `Estado de evidencia: ${ad.ad.estadoEvidencia}` : "",
    ad.ad.atribucion ? `Atribución: ${ad.ad.atribucion}` : "",
    `Apta para patrones: ${ad.patternEligible ? "sí" : "no"}`,
    ad.ad.archivoSha256 ? `SHA-256: ${ad.ad.archivoSha256}` : "",
    ad.ad.corpusKey ? `Clave de corpus: ${ad.ad.corpusKey}` : "",
    ad.ad.anunciante ? `Anunciante: ${ad.ad.anunciante}` : "",
    `Archivo: ${ad.ad.file || "sin archivo visual local"}`,
    ad.ad.videoFile ? `Vídeo: ${ad.ad.videoFile}` : "",
    ad.ad.posterFile ? `Poster: ${ad.ad.posterFile}` : "",
    ad.ad.mediaAssets?.length ? `Activos asociados: ${ad.ad.mediaAssets.length}` : "",
  ].filter(Boolean).join("\n");

function EvidenceSource({ ad }: { ad: LabAd }) {
  const media = presentableMedia(ad.ad);
  if (media.openFile) {
    return <a href={media.openFile} target="_blank" rel="noreferrer">{sourceLine(ad)}</a>;
  }
  if (ad.ad.fuenteUrl && /^https?:\/\//i.test(ad.ad.fuenteUrl)) {
    return <a href={ad.ad.fuenteUrl} target="_blank" rel="noreferrer">{sourceLine(ad)}</a>;
  }
  return <span title="La transcripción no tiene un archivo visual local asociado">{sourceLine(ad)} · sin archivo local</span>;
}

type FacetOption = { value: string; label: string; count: number };

function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  limit = 7,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, limit);
  return (
    <fieldset className="ads-lab-facet">
      <legend>{title}</legend>
      {visible.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
          <b>{option.count}</b>
        </label>
      ))}
      {options.length > limit && (
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Ver menos" : `Mostrar ${options.length - limit} más`}
        </button>
      )}
    </fieldset>
  );
}

function BilingualCopy({ ad, mode }: { ad: AnuncioReal; mode: AdLanguageMode }) {
  const [originalExpanded, setOriginalExpanded] = useState(false);
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const hasTranslation = Boolean(ad.traduccionEs && ad.estadoTraduccion !== "no_necesaria");
  const translationStatus = ad.estadoTraduccion === "revisada"
    ? { label: "Revisada", note: "Copy contrastado editorialmente con el original." }
    : ad.estadoTraduccion === "automatica"
      ? { label: "Automática", note: "Ayuda de lectura: conserva siempre el original como evidencia." }
      : ad.estadoTraduccion === "requiere_revision"
        ? { label: "En revisión", note: "No se publica una salida dudosa." }
        : { label: "Pendiente", note: "Todavía no existe una traducción publicable." };
  if (!ad.copyAvailable) {
    return (
      <div className="ads-lab-no-copy">
        <strong>Sin texto legible tras OCR</strong>
        <p>La creatividad se conserva para revisión visual; no se ha inventado ningún copy.</p>
      </div>
    );
  }
  const original = (
    <section className={`ads-lab-copy-column original${originalExpanded ? " expanded" : ""}`} lang={ad.idioma === "und" ? undefined : ad.idioma} dir="auto">
      <header><span>ORIGINAL · {(ad.idioma || "und").toLocaleUpperCase("es")}</span></header>
      <h3>{ad.titular || "(sin titular separado)"}</h3>
      <p>{ad.texto || "(sin cuerpo separado)"}</p>
      {String(ad.texto || "").length > 420 && <button type="button" className="ads-lab-copy-expand" aria-expanded={originalExpanded} onClick={() => setOriginalExpanded((current) => !current)}>{originalExpanded ? "Mostrar menos" : "Leer texto completo"}</button>}
      {ad.cta && <small><b>CTA</b>{ad.cta}</small>}
      {ad.precioVisible && <small><b>Oferta</b>{ad.precioVisible}</small>}
    </section>
  );
  const translated = hasTranslation ? (
    <section className={`ads-lab-copy-column translated${translationExpanded ? " expanded" : ""}`} lang="es">
      <header>
        <span>TRADUCCIÓN · ES</span>
        <i title={ad.proveedorTraduccion}>{translationStatus.label}</i>
      </header>
      <h3>{ad.traduccionEs?.titular || "(sin titular separado)"}</h3>
      <p>{ad.traduccionEs?.texto || "(sin cuerpo separado)"}</p>
      {String(ad.traduccionEs?.texto || "").length > 420 && <button type="button" className="ads-lab-copy-expand" aria-expanded={translationExpanded} onClick={() => setTranslationExpanded((current) => !current)}>{translationExpanded ? "Mostrar menos" : "Leer traducción completa"}</button>}
      {ad.traduccionEs?.cta && <small><b>CTA</b>{ad.traduccionEs.cta}</small>}
      {ad.traduccionEs?.precioVisible && <small><b>Oferta</b>{ad.traduccionEs.precioVisible}</small>}
      <small className="ads-lab-translation-note">{translationStatus.note}</small>
    </section>
  ) : (
    <section className="ads-lab-copy-column translated pending" lang="es">
      <header><span>TRADUCCIÓN · ES</span><i>{translationStatus.label}</i></header>
      <p>{translationStatus.note}</p>
    </section>
  );
  if (mode === "original" || (ad.estadoTraduccion === "no_necesaria" && mode !== "es")) return original;
  if (mode === "es") return ad.estadoTraduccion === "no_necesaria" ? original : translated;
  return <div className="ads-lab-copy-parallel">{original}{translated}</div>;
}

const toPatternObservation = (item: LabAd): PatternObservation<LabAd> => {
  // El original extranjero pendiente se conserva como evidencia, pero no se fuerza
  // a pasar por reglas léxicas españolas. La traducción automática sí entra como
  // sensibilidad exploratoria y queda marcada por `semanticTrusted=false`.
  const semanticUsable = item.semanticCopy.source !== "original_extranjero";
  return {
    key: item.key,
    identityKey: item.identityKey,
    companyId: item.ad.id,
    companyName: item.ad.name,
    country: item.ad.country || "Sin país",
    platform: item.platform,
    quality: item.qualityScore,
    semanticTrusted: item.semanticCopy.trusted,
    evaluableDimensions: semanticUsable
      ? ["hook", "angle", "promise", "mechanic", "format", "cta"]
      : ["angle", "format"],
    dimensions: {
      hook: semanticUsable ? item.hooks : [],
      angle: item.angles,
      promise: semanticUsable ? (item.promises.length ? item.promises.map((promise) => promise.label) : [NO_PROMISE]) : [],
      mechanic: semanticUsable ? item.mechanics : [],
      format: [item.format],
      cta: semanticUsable ? [item.ctaGroup] : [],
    },
    phraseText: semanticUsable ? item.semanticCopy.headline || compact(item.semanticCopy.body, 180) : "",
    payload: item,
  };
};

type AnyPatternSignal = PatternSignal<LabAd> | AssociationSignal<LabAd> | PhraseSignal<LabAd>;

const STRENGTH_LABELS: Record<AnyPatternSignal["strength"], string> = {
  robusta: "Replicada",
  recurrente: "Recurrente",
  distintiva: "Diferencial frente al resto",
  exploratoria: "Exploratoria",
  indicio: "Indicio",
};

function PatternSignalRow({
  signal,
  weighting,
  onOpen,
  onSample,
}: {
  signal: AnyPatternSignal;
  weighting: PatternWeighting;
  onOpen: () => void;
  onSample: () => void;
}) {
  const primaryPresence = weighting === "companies" ? signal.companyAdoption : signal.identityPresence;
  const sample = signal.examples[0]?.payload;
  const association = "coOccurrenceIndex" in signal ? signal : null;
  const phrase = "phrase" in signal ? signal : null;
  const delta = Math.round(signal.deltaPoints);
  const sampleText = sample
    ? signal.dimension === "pair" || signal.dimension === "phrase"
      ? `${sample.semanticCopy.label}: “${compact(sample.semanticCopy.headline || sample.semanticCopy.body, 190)}”`
      : patternEvidence(sample, signal.dimension as PatternDimension, signal.label)
    : "Sin ejemplo representativo.";
  return (
    <article className={`ads-lab-signal-row ${signal.strength}`}>
      <div className="ads-lab-signal-main">
        <div className="ads-lab-signal-title">
          <span>{phrase ? "FRASE RECURRENTE" : association ? `COMBINACIÓN · ${DIMENSION_SHORT_LABELS[association.leftDimension] || association.leftDimension} × ${DIMENSION_SHORT_LABELS[association.rightDimension] || association.rightDimension}` : DIMENSION_SHORT_LABELS[signal.dimension] || "SEÑAL"}</span>
          <i>{STRENGTH_LABELS[signal.strength]}</i>
        </div>
        <h4>{signal.label}</h4>
        {association && (
          <p className="ads-lab-association-note">
            Índice descriptivo de coaparición {association.coOccurrenceIndex.toFixed(2)}×: parejas observadas dentro de una misma pieza frente al producto de adopciones empresariales · {(association.pairRateAmongLeftCompanies * 100).toFixed(0)}% de las empresas con {association.leftLabel} muestra además la pareja en una pieza · base de normalización {association.adoptionProductCompanies.toFixed(1)} empresas
          </p>
        )}
        <div className="ads-lab-signal-meter" aria-label={`${Math.round(primaryPresence * 100)} por ciento`}>
          <i style={{ width: `${Math.max(2, Math.round(primaryPresence * 100))}%` }} />
        </div>
        <small>
          {weighting === "companies" ? "Adopción entre empresas" : "Presencia entre copies únicos"} · {Math.round(primaryPresence * 100)}%
          {Math.abs(delta) >= 1 ? ` · ${delta > 0 ? "+" : ""}${delta} pp frente al resto (segmento n=${signal.universeCompanies}; referencia n=${signal.referenceUniverseCompanies})${signal.comparisonSufficient ? "" : " · comparación exploratoria"}` : ""}
        </small>
      </div>
      <dl className="ads-lab-signal-metrics">
        <div><dt>Empresas</dt><dd>{signal.companies}</dd></div>
        <div><dt>Copies únicos</dt><dd>{signal.identities}</dd></div>
        <div><dt>Piezas</dt><dd>{signal.pieces}</dd></div>
        <div title="Combina amplitud entre empresas, copies únicos, trazabilidad y concentración; no mide rendimiento"><dt>Solidez descriptiva</dt><dd>{signal.evidenceScore}/100</dd></div>
      </dl>
      <blockquote>{compact(sampleText, 235)}</blockquote>
      <div className="ads-lab-signal-context">
        <span>{signal.countries} países de ficha</span>
        <span>{signal.platforms} plataformas</span>
        <span>{Math.round(signal.semanticTrust * 100)}% semántica revisada/original</span>
        {signal.dominance >= 0.5 && <span className="warning">Concentrada en una empresa</span>}
      </div>
      <footer>
        <button type="button" onClick={onOpen}>Abrir evidencias</button>
        <button type="button" className="quiet" onClick={onSample}>+ Muestra diversa</button>
      </footer>
    </article>
  );
}

const matchesEvidenceFilter = (ad: LabAd, filter: string) => {
  if (filter === ALL) return true;
  if (filter === EVIDENCE_ELIGIBLE) return ad.patternEligible;
  if (filter === EVIDENCE_EXCLUDED) return !ad.patternEligible;
  if (filter === EVIDENCE_FILE) return Boolean(ad.ad.file);
  if (filter === EVIDENCE_SOURCE) return Boolean(ad.ad.fuenteUrl);
  if (filter === EVIDENCE_EXTERNAL_ID) return Boolean(ad.ad.externalId);
  if (filter.startsWith("confidence:")) return confidenceBand(ad.ad.confianza) === filter.slice("confidence:".length);
  if (filter.startsWith("status:")) return ad.ad.estadoEvidencia === filter.slice("status:".length);
  if (filter.startsWith("attribution:")) return ad.ad.atribucion === filter.slice("attribution:".length);
  return true;
};

const matrixAsText = (baseline: LabAd, rows: MatrixRow[]) => {
  const lines = [
    "LABORATORIO DE ANUNCIOS · CONSTRUCTOR DE HIPÓTESIS",
    `Control elegido: ${sourceLine(baseline)}`,
    "Uso: cada fila propone una hipótesis. Antes de lanzarla, iguala audiencia, presupuesto, ubicación, formato y periodo; cambia solo la variable indicada.",
    "",
  ];
  for (const row of rows) {
    lines.push(row.label.toLocaleUpperCase("es"));
    lines.push(`Método: ${row.instruction}`);
    lines.push(`A · CONTROL: ${row.control.value}`);
    lines.push(`  Evidencia: ${row.control.evidence}`);
    lines.push(`  Fuente: ${sourceLine(row.control.source)}`);
    row.challengers.forEach((challenger, index) => {
      lines.push(`${String.fromCharCode(66 + index)} · RETADOR: ${challenger.value}`);
      lines.push(`  Evidencia: ${challenger.evidence}`);
      lines.push(`  Fuente: ${sourceLine(challenger.source)}`);
    });
    lines.push(`Medición propuesta: ${row.metric}`);
    lines.push("");
  }
  lines.push("Límite: la frecuencia observada no demuestra rendimiento. Solo un test controlado permite llamar ganador a una variante.");
  return lines.join("\n");
};

export default function AdsLaboratory({
  data: suppliedData,
  coverageData: suppliedCoverage,
  onOpenCompany,
  initialSection = "explore",
  initialQuery = "",
}: AdsLaboratoryProps) {
  const [remoteData, setRemoteData] = useState<AnunciosRealesData | null>(null);
  const [remoteCoverage, setRemoteCoverage] = useState<AdCoverageData | null>(null);
  const [leadMarketSnapshot, setLeadMarketSnapshot] = useState<LeadMarketSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [section, setSection] = useState<LabSection>(initialSection);
  const [query, setQuery] = useState(initialQuery);
  const [vertical, setVertical] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [hook, setHook] = useState(ALL);
  const [angle, setAngle] = useState(ALL);
  const [promise, setPromise] = useState(ALL);
  const [mechanic, setMechanic] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [cta, setCta] = useState(ALL);
  const [evidenceFilter, setEvidenceFilter] = useState(ALL);
  const [countries, setCountries] = useState<string[]>([]);
  const [platformFamilies, setPlatformFamilies] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [translationStatuses, setTranslationStatuses] = useState<string[]>([]);
  const [ocrStatuses, setOcrStatuses] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [searchScope, setSearchScope] = useState<AdSearchScope>("both");
  const [languageMode, setLanguageMode] = useState<AdLanguageMode>("parallel");
  const [sort, setSort] = useState<AdSort>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDialogMode, setFilterDialogMode] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [leadMarketOnly, setLeadMarketOnly] = useState(false);
  const [visible, setVisible] = useState(DEFAULT_VISIBLE);
  const [patternDimension, setPatternDimension] = useState<PatternDimension>("angle");
  const [patternView, setPatternView] = useState<PatternView>("signals");
  const [patternWeighting, setPatternWeighting] = useState<PatternWeighting>("companies");
  const [patternLimit, setPatternLimit] = useState(18);
  const [includeIneligiblePatterns, setIncludeIneligiblePatterns] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [baselineKey, setBaselineKey] = useState("");
  const [signalEvidenceKeys, setSignalEvidenceKeys] = useState<string[]>([]);
  const [signalEvidenceLabel, setSignalEvidenceLabel] = useState("");
  const [notice, setNotice] = useState("");
  const filterRailRef = useRef<HTMLElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  const closeFilters = useCallback((restoreFocus = true) => {
    setFiltersOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => filterToggleRef.current?.focus());
  }, []);

  const toggleFacet = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) => setter((current) => current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]);

  useEffect(() => {
    if (suppliedData !== undefined) return;
    const controller = new AbortController();
    fetch("/data/ad-corpus.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AnunciosRealesData>;
      })
      .then(setRemoteData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("No se pudo cargar el corpus ampliado de anuncios.");
      });
    return () => controller.abort();
  }, [suppliedData]);

  useEffect(() => {
    if (suppliedCoverage !== undefined) return;
    const controller = new AbortController();
    fetch("/data/ad-coverage.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AdCoverageData>;
      })
      .then(setRemoteCoverage)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // La cobertura es informativa: un fallo no bloquea la exploración del corpus.
      });
    return () => controller.abort();
  }, [suppliedCoverage]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/lead-market-snapshot.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LeadMarketSnapshot>;
      })
      .then(setLeadMarketSnapshot)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Es una capa contextual; un fallo no bloquea el corpus principal.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1280px)");
    const updateMode = () => {
      setFilterDialogMode(media.matches);
      if (!media.matches)
        setFiltersOpen((current) => {
          if (current) requestAnimationFrame(() => filterToggleRef.current?.focus());
          return false;
        });
    };
    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    if (!filtersOpen || !filterDialogMode) return;
    const rail = filterRailRef.current;
    const focusable = () => Array.from(
      rail?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) || [],
    );
    requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeFilters, filterDialogMode, filtersOpen]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const data = suppliedData === undefined ? remoteData : suppliedData;
  const globalCoverage = suppliedCoverage === undefined ? remoteCoverage : suppliedCoverage;
  const ads = useMemo(
    () => (data?.items || []).map((ad, index) => classifyRealAd(ad, index)),
    [data],
  );
  const adByKey = useMemo(() => new Map(ads.map((ad) => [ad.key, ad])), [ads]);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedAds = useMemo(
    () => selectedKeys.map((key) => adByKey.get(key)).filter((ad): ad is LabAd => Boolean(ad)),
    [adByKey, selectedKeys],
  );

  const options = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const counted = (values: string[], labels: Record<string, string> = {}) =>
      [...values.reduce((map, value) => {
        const key = value || "unknown";
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map<string, number>()).entries()]
        .map(([value, count]) => ({ value, count, label: labels[value] || value }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
    return {
      verticals: unique(ads.map((ad) => ad.ad.vertical || "Sin vertical")),
      companies: [...new Map(ads.map((ad) => [ad.ad.id, ad.ad.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")),
      hooks: unique(ads.flatMap((ad) => ad.hooks)),
      angles: unique(ads.flatMap((ad) => ad.angles)),
      promises: unique([
        ...ads.flatMap((ad) => ad.promises.map((item) => item.label)),
        ...(ads.some((ad) => ad.promises.length === 0) ? [NO_PROMISE] : []),
      ]),
      mechanics: unique(ads.flatMap((ad) => ad.mechanics)),
      formats: unique(ads.map((ad) => ad.format)),
      ctas: unique(ads.map((ad) => ad.ctaGroup)),
      countries: counted(ads.map((ad) => ad.ad.country || "Sin país")),
      platformFamilies: counted(ads.map((ad) => ad.ad.platformFamily || "unknown"), PLATFORM_FAMILY_LABELS),
      languages: counted(ads.map((ad) => ad.ad.idioma || "und"), Object.fromEntries(ads.map((ad) => [ad.ad.idioma || "und", ad.ad.idiomaNombre || "Sin determinar"]))),
      translationStatuses: counted(ads.map((ad) => ad.ad.estadoTraduccion || "pendiente"), LANGUAGE_STATUS_LABELS),
      ocrStatuses: counted(ads.map((ad) => ad.ad.estadoOcr || "pendiente"), OCR_STATUS_LABELS),
      mediaTypes: counted(ads.map((ad) => resolvedMediaType(ad.ad)), {
        image: "Imagen",
        video: "Vídeo",
        document: "Documento",
        other: "Otro archivo",
        none: "Sin archivo local",
      }),
      evidence: [
        { value: ALL, label: "Toda la evidencia" },
        { value: EVIDENCE_ELIGIBLE, label: "Apta / legado no excluido" },
        { value: EVIDENCE_EXCLUDED, label: "Excluida de patrones" },
        { value: EVIDENCE_FILE, label: "Con archivo visual" },
        { value: EVIDENCE_SOURCE, label: "Con URL de fuente" },
        { value: EVIDENCE_EXTERNAL_ID, label: "Con ID externo" },
        { value: CONFIDENCE_HIGH, label: "Confianza alta · 90–100" },
        { value: CONFIDENCE_MEDIUM, label: "Confianza media · 75–89" },
        { value: CONFIDENCE_LOW, label: "Confianza baja · menos de 75" },
        { value: CONFIDENCE_OTHER, label: "Confianza declarada · sin escala" },
        { value: CONFIDENCE_NONE, label: "Sin dato de confianza" },
        ...unique(ads.map((ad) => ad.ad.estadoEvidencia || "")).map((value) => ({ value: `status:${value}`, label: `Estado · ${value}` })),
        ...unique(ads.map((ad) => ad.ad.atribucion || "")).map((value) => ({ value: `attribution:${value}`, label: `Atribución · ${value}` })),
      ],
    };
  }, [ads]);

  const filteredAds = useMemo(() => {
    const queryTerms = parseAdQuery(query);
    const result = ads.filter((ad) => {
      const originalSearch = normalize([
        ad.ad.name, ad.ad.id, ad.ad.country, ad.ad.titular, ad.ad.texto,
        ad.ad.cta, ad.ad.precioVisible, ad.ad.angulo, ad.ad.externalId,
        ad.ad.pageId, ad.ad.landingUrl, ad.ad.transcript, ad.ad.transcripcion,
      ].filter(Boolean).join(" "));
      const translatedSearch = normalize([
        ad.ad.traduccionEs?.titular, ad.ad.traduccionEs?.texto,
        ad.ad.traduccionEs?.cta, ad.ad.traduccionEs?.precioVisible,
      ].filter(Boolean).join(" "));
      const scopedSearch = searchScope === "original"
        ? originalSearch
        : searchScope === "translation"
          ? translatedSearch
          : `${ad.searchText} ${translatedSearch}`;
      if (queryTerms.some((term) => !scopedSearch.includes(term))) return false;
      if (countries.length && !countries.includes(ad.ad.country || "Sin país")) return false;
      if (platformFamilies.length && !platformFamilies.includes(ad.ad.platformFamily || "unknown")) return false;
      if (languages.length && !languages.includes(ad.ad.idioma || "und")) return false;
      if (translationStatuses.length && !translationStatuses.includes(ad.ad.estadoTraduccion || "pendiente")) return false;
      if (ocrStatuses.length && !ocrStatuses.includes(ad.ad.estadoOcr || "pendiente")) return false;
      if (mediaTypes.length && !mediaTypes.includes(resolvedMediaType(ad.ad))) return false;
      if (vertical !== ALL && (ad.ad.vertical || "Sin vertical") !== vertical) return false;
      if (company !== ALL && ad.ad.id !== company) return false;
      if (hook !== ALL && !ad.hooks.includes(hook)) return false;
      if (angle !== ALL && !ad.angles.includes(angle)) return false;
      if (promise !== ALL) {
        if (promise === NO_PROMISE && ad.promises.length > 0) return false;
        if (promise !== NO_PROMISE && !ad.promises.some((item) => item.label === promise)) return false;
      }
      if (mechanic !== ALL && !ad.mechanics.includes(mechanic)) return false;
      if (format !== ALL && ad.format !== format) return false;
      if (cta !== ALL && ad.ctaGroup !== cta) return false;
      if (!matchesEvidenceFilter(ad, evidenceFilter)) return false;
      if (liveOnly && !(ad.ad.isActive ?? ad.ad.capturaEnVivo)) return false;
      if (selectedOnly && !selectedSet.has(ad.key)) return false;
      if (signalEvidenceKeys.length && !signalEvidenceKeys.includes(ad.key)) return false;
      if (leadMarketOnly && ad.ad.researchSnapshotId !== leadMarketSnapshot?.id) return false;
      return true;
    });
    if (sort === "relevance" && queryTerms.length) {
      const relevance = (item: LabAd) => {
        const fields = {
          company: normalize(`${item.ad.name} ${item.ad.id}`),
          title: normalize(`${item.ad.titular} ${item.ad.traduccionEs?.titular || ""}`),
          cta: normalize(`${item.ad.cta} ${item.ad.traduccionEs?.cta || ""}`),
          body: normalize(`${item.ad.texto} ${item.ad.transcript || ""} ${item.ad.traduccionEs?.texto || ""}`),
          exact: normalize(`${item.ad.externalId || ""} ${item.ad.pageId || ""} ${item.key}`),
          tags: normalize(`${item.ad.angulo || ""} ${item.ad.vertical || ""}`),
        };
        return queryTerms.reduce(
          (score, term) =>
            score +
            (fields.exact === term ? 20 : fields.exact.includes(term) ? 10 : 0) +
            (fields.title.includes(term) ? 8 : 0) +
            (fields.company.includes(term) ? 6 : 0) +
            (fields.cta.includes(term) ? 5 : 0) +
            (fields.body.includes(term) ? 3 : 0) +
            (fields.tags.includes(term) ? 1 : 0),
          0,
        );
      };
      result.sort(
        (left, right) => relevance(right) - relevance(left) || left.index - right.index,
      );
    }
    if (sort === "relevance" && !queryTerms.length) result.sort((left, right) => right.qualityScore - left.qualityScore || left.index - right.index);
    if (sort === "company") result.sort((left, right) => left.ad.name.localeCompare(right.ad.name, "es") || left.index - right.index);
    if (sort === "confidence") result.sort((left, right) => confidenceSortValue(right.ad) - confidenceSortValue(left.ad) || left.index - right.index);
    if (sort === "newest") result.sort((left, right) => sortableAdDate(right.ad) - sortableAdDate(left.ad) || left.index - right.index);
    return result;
  }, [ads, angle, company, countries, cta, evidenceFilter, format, hook, languages, leadMarketOnly, leadMarketSnapshot?.id, liveOnly, mechanic, mediaTypes, ocrStatuses, platformFamilies, promise, query, searchScope, selectedOnly, selectedSet, signalEvidenceKeys, sort, translationStatuses, vertical]);

  const coverage = useMemo(() => {
    const companies = new Map<string, { name: string; count: number }>();
    for (const ad of ads) {
      const current = companies.get(ad.ad.id) || { name: ad.ad.name, count: 0 };
      current.count += 1;
      companies.set(ad.ad.id, current);
    }
    const rows = [...companies.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    return {
      rows,
      totalCompanies: rows.length,
      oneAd: rows.filter((row) => row.count === 1).length,
      withFive: rows.filter((row) => row.count >= 5).length,
      withTen: rows.filter((row) => row.count >= 10).length,
      missingToFive: rows.reduce((sum, row) => sum + Math.max(0, 5 - row.count), 0),
      missingToTen: rows.reduce((sum, row) => sum + Math.max(0, 10 - row.count), 0),
    };
  }, [ads]);

  const globalCoverageStats = useMemo(() => {
    if (!globalCoverage) return null;
    const corpusCounts = new Map<string, number>();
    for (const ad of ads) {
      corpusCounts.set(ad.ad.id, (corpusCounts.get(ad.ad.id) || 0) + 1);
    }
    const targetReached = globalCoverage.items.reduce((sum, item) => {
      const corpusCount = corpusCounts.get(item.companyId) || 0;
      return sum + Math.min(item.targetCount, corpusCount);
    }, 0);
    const corpusTargetGap = globalCoverage.items.reduce((sum, item) => {
      const corpusCount = corpusCounts.get(item.companyId) || 0;
      return sum + Math.max(0, item.targetCount - Math.min(item.targetCount, corpusCount));
    }, 0);
    return {
      availableEvidence: globalCoverage.items.reduce(
        (sum, item) => sum + Math.max(0, item.availableEvidenceCount || 0),
        0,
      ),
      sampledEvidence: globalCoverage.summary.sampledEvidence ?? globalCoverage.summary.targetTotal,
      pending: globalCoverage.summary.statusCounts["pendiente/no atribuible"] || 0,
      noEvidence: globalCoverage.summary.statusCounts["sin evidencia"] || 0,
      patternReady: ads.filter((ad) => ad.patternEligible).length,
      corpusCompanies: coverage.totalCompanies,
      targetReached,
      corpusTargetGap,
    };
  }, [ads, coverage.totalCompanies, globalCoverage]);

  const patternAds = useMemo(
    () => includeIneligiblePatterns ? filteredAds : filteredAds.filter((ad) => ad.patternEligible),
    [filteredAds, includeIneligiblePatterns],
  );
  const referencePatternAds = useMemo(
    () => {
      const universe = includeIneligiblePatterns ? ads : ads.filter((ad) => ad.patternEligible);
      const segmentKeys = new Set(patternAds.map((ad) => ad.key));
      const complement = universe.filter((ad) => !segmentKeys.has(ad.key));
      return complement.length ? complement : universe;
    },
    [ads, includeIneligiblePatterns, patternAds],
  );
  const excludedFromPatterns = filteredAds.length - filteredAds.filter((ad) => ad.patternEligible).length;
  const patternRecords = useMemo(() => patternAds.map(toPatternObservation), [patternAds]);
  const referencePatternRecords = useMemo(
    () => referencePatternAds.map(toPatternObservation),
    [referencePatternAds],
  );
  const simpleSignals = useMemo(
    () => buildPatternSignals(patternRecords, patternDimension, referencePatternRecords),
    [patternDimension, patternRecords, referencePatternRecords],
  );
  const associationSignals = useMemo(
    () => buildAssociationSignals(patternRecords, referencePatternRecords),
    [patternRecords, referencePatternRecords],
  );
  const phraseSignals = useMemo(
    () => buildPhraseSignals(patternRecords, referencePatternRecords),
    [patternRecords, referencePatternRecords],
  );
  const contrastSignals = useMemo(
    () => (Object.keys(DIMENSION_LABELS) as PatternDimension[])
      .flatMap((dimension) => buildPatternSignals(patternRecords, dimension, referencePatternRecords))
      .filter((signal) => {
        if (Math.abs(signal.deltaPoints) < 4 || signal.companies < 3) return false;
        if (signal.dimension === "hook" && hook !== ALL) return false;
        if (signal.dimension === "angle" && angle !== ALL) return false;
        if (signal.dimension === "promise" && promise !== ALL) return false;
        if (signal.dimension === "mechanic" && mechanic !== ALL) return false;
        if (signal.dimension === "format" && format !== ALL) return false;
        if (signal.dimension === "cta" && cta !== ALL) return false;
        return true;
      })
      .sort((left, right) =>
        Math.abs(right.deltaPoints) * right.evidenceScore - Math.abs(left.deltaPoints) * left.evidenceScore ||
        right.companies - left.companies,
      ),
    [angle, cta, format, hook, mechanic, patternRecords, promise, referencePatternRecords],
  );
  const visiblePatternSignals = useMemo<AnyPatternSignal[]>(() => {
    const source: AnyPatternSignal[] = patternView === "signals"
      ? simpleSignals
      : patternView === "combinations"
        ? associationSignals
        : patternView === "phrases"
          ? phraseSignals
          : contrastSignals;
    if (patternView === "contrasts") return source;
    return [...source].sort((left, right) => patternWeighting === "companies"
      ? right.companies - left.companies || ("coOccurrenceIndex" in right && "coOccurrenceIndex" in left ? right.coOccurrenceIndex - left.coOccurrenceIndex : 0) || right.identities - left.identities
      : right.identities - left.identities || right.companies - left.companies || ("coOccurrenceIndex" in right && "coOccurrenceIndex" in left ? right.coOccurrenceIndex - left.coOccurrenceIndex : 0));
  }, [associationSignals, contrastSignals, patternView, patternWeighting, phraseSignals, simpleSignals]);
  const patternUniverse = useMemo(() => {
    const identities = [...new Map(patternRecords.map((item) => [item.identityKey, item])).values()];
    return {
      companies: new Set(patternRecords.map((item) => item.companyId)).size,
      identities: identities.length,
      countries: new Set(patternRecords.map((item) => item.country).filter((country) => country && country !== "Sin país")).size,
      trusted: identities.length ? Math.round((identities.filter((item) => item.semanticTrusted).length / identities.length) * 100) : 0,
    };
  }, [patternRecords]);

  const effectiveBaselineKey = selectedSet.has(baselineKey) ? baselineKey : selectedKeys[0] || "";
  const baseline = effectiveBaselineKey ? adByKey.get(effectiveBaselineKey) : undefined;
  const matrix = useMemo(() => makeMatrix(selectedAds, baseline), [baseline, selectedAds]);

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length >= MAX_SELECTION) {
        setNotice(`Máximo ${MAX_SELECTION} piezas por matriz.`);
        return current;
      }
      return [...current, key];
    });
  };

  const addAdsToSelection = (items: LabAd[]) => {
    setSelectedKeys((current) => {
      const next = [...current];
      for (const ad of items) {
        if (!next.includes(ad.key) && next.length < MAX_SELECTION) next.push(ad.key);
      }
      const added = next.length - current.length;
      setNotice(added
        ? `${added} ${added === 1 ? "pieza añadida" : "piezas añadidas"} a la matriz.`
        : current.length >= MAX_SELECTION
          ? `Máximo ${MAX_SELECTION} piezas por matriz.`
          : "La muestra ya estaba en la matriz.");
      return added ? next : current;
    });
  };

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
    } catch {
      setNotice("No se pudo copiar. Revisa el permiso del navegador.");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setVertical(ALL);
    setCompany(ALL);
    setHook(ALL);
    setAngle(ALL);
    setPromise(ALL);
    setMechanic(ALL);
    setFormat(ALL);
    setCta(ALL);
    setEvidenceFilter(ALL);
    setCountries([]);
    setPlatformFamilies([]);
    setLanguages([]);
    setTranslationStatuses([]);
    setOcrStatuses([]);
    setMediaTypes([]);
    setSearchScope("both");
    setLiveOnly(false);
    setSelectedOnly(false);
    setLeadMarketOnly(false);
    setSignalEvidenceKeys([]);
    setSignalEvidenceLabel("");
    setVisible(DEFAULT_VISIBLE);
  };

  const applyPatternDimension = (dimension: PatternDimension, label: string) => {
    if (dimension === "hook") setHook(label);
    if (dimension === "angle") setAngle(label);
    if (dimension === "promise") setPromise(label);
    if (dimension === "mechanic") setMechanic(label);
    if (dimension === "format") setFormat(label);
    if (dimension === "cta") setCta(label);
  };

  const goToSection = (next: LabSection) => {
    setSection(next);
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.getElementById(`ads-lab-tab-${next}`)?.focus()));
  };

  const openSignal = (signal: AnyPatternSignal) => {
    setSignalEvidenceKeys(signal.observations.map((item) => item.key));
    setSignalEvidenceLabel(signal.label);
    if ("phrase" in signal) {
      setQuery("");
    } else if ("coOccurrenceIndex" in signal) {
      applyPatternDimension(signal.leftDimension as PatternDimension, signal.leftLabel);
      applyPatternDimension(signal.rightDimension as PatternDimension, signal.rightLabel);
    } else {
      applyPatternDimension(signal.dimension as PatternDimension, signal.label);
    }
    setEvidenceFilter(includeIneligiblePatterns ? ALL : EVIDENCE_ELIGIBLE);
    goToSection("explore");
    setVisible(DEFAULT_VISIBLE);
  };

  const applyQuickPreset = (preset: "eligible" | "translated" | "reviewed" | "spain" | "meta" | "lead-market") => {
    if (preset === "eligible") setEvidenceFilter((current) => current === EVIDENCE_ELIGIBLE ? ALL : EVIDENCE_ELIGIBLE);
    if (preset === "translated") setTranslationStatuses((current) => current.length === 2 && current.includes("automatica") && current.includes("revisada") ? [] : ["automatica", "revisada"]);
    if (preset === "reviewed") setTranslationStatuses((current) => current.length === 1 && current[0] === "revisada" ? [] : ["revisada"]);
    if (preset === "spain") setCountries((current) => current.length === 1 && current[0] === "España" ? [] : ["España"]);
    if (preset === "meta") setPlatformFamilies((current) => current.length === 2 && current.includes("meta") && current.includes("instagram") ? [] : ["meta", "instagram"]);
    if (preset === "lead-market") setLeadMarketOnly((current) => !current);
    setVisible(DEFAULT_VISIBLE);
  };

  const activeFilterCount = [
    ...countries,
    ...platformFamilies,
    ...languages,
    ...translationStatuses,
    ...ocrStatuses,
    ...mediaTypes,
  ].length + [company, vertical, hook, angle, promise, mechanic, format, cta, evidenceFilter]
    .filter((value) => value !== ALL).length + (query.trim() ? 1 : 0) + (selectedOnly ? 1 : 0) + (liveOnly ? 1 : 0) + (leadMarketOnly ? 1 : 0) + (signalEvidenceKeys.length ? 1 : 0);

  const optionLabel = (group: FacetOption[], value: string) =>
    group.find((option) => option.value === value)?.label || value;

  if (!data) {
    return (
      <section className="ads-lab ads-lab-loading" aria-live="polite">
        <style>{LAB_CSS}</style>
        <strong>{loadError || "Cargando laboratorio de anuncios…"}</strong>
      </section>
    );
  }

  return (
    <section className="ads-lab" aria-labelledby="ads-lab-title">
      <style>{LAB_CSS}</style>
      <header className="ads-lab-product-head">
        <div>
          <p className="ads-lab-kicker">INTELIGENCIA PUBLICITARIA · MOTOR DE PATRONES</p>
          <h2 id="ads-lab-title">Laboratorio de anuncios</h2>
          <p>Explora evidencia bilingüe, descubre estructuras repetidas y convierte hallazgos en hipótesis trazables.</p>
        </div>
        <div className="ads-lab-head-actions">
          <details className="ads-lab-coverage-popover">
            <summary>Cobertura</summary>
            <div>
              <strong>{globalCoverage?.totalCompanies || coverage.totalCompanies} fichas revisadas</strong>
              <p>{ads.filter((ad) => ad.ad.copyAvailable).length} piezas con texto · {ads.filter((ad) => ad.ad.estadoOcr === "sin_texto").length} sin texto legible.</p>
              {globalCoverageStats && <p>{globalCoverageStats.availableEvidence} evidencias individualizables; un pendiente nunca se interpreta como cero anuncios.</p>}
            </div>
          </details>
          <button type="button" className="ads-lab-primary" onClick={() => goToSection("matrix")} disabled={selectedAds.length < 2}>
            Construir hipótesis · {selectedAds.length}
          </button>
        </div>
      </header>

      <section className="ads-lab-snapshot" aria-label="Resumen analítico del corpus">
        <article><span>Corpus observable</span><strong>{ads.length.toLocaleString("es-ES")}</strong><small>{coverage.totalCompanies} empresas</small></article>
        <article><span>Base estricta</span><strong>{ads.filter((item) => item.patternEligible).length}</strong><small>{new Set(ads.filter((item) => item.patternEligible).map((item) => item.ad.id)).size} empresas independientes</small></article>
        <article><span>Copies deduplicados</span><strong>{new Set(ads.filter((item) => item.patternEligible).map((item) => item.identityKey)).size}</strong><small>evita premiar repeticiones exactas</small></article>
        <article><span>Lectura bilingüe</span><strong>{ads.filter((item) => item.ad.traduccionEs).length}</strong><small>{ads.filter((item) => item.ad.estadoTraduccion === "revisada").length} piezas revisadas</small></article>
      </section>

      {leadMarketSnapshot && (
        <details className="ads-lab-market-study">
          <summary>
            <span><b>Estudio incorporado · 26 ago 2026</b><small>Meta Ads · mercado de leads en España</small></span>
            <strong>{leadMarketSnapshot.kpis.detailedCreatives} creatividades archivadas</strong>
          </summary>
          <div className="ads-lab-market-study-body">
            <section className="ads-lab-market-study-metrics" aria-label="Cobertura del estudio importado">
              <article><span>Universo analizado</span><b>{leadMarketSnapshot.kpis.analyzedAds}</b><small>según el informe</small></article>
              <article><span>Evidencia detallada</span><b>{leadMarketSnapshot.kpis.detailedCreatives}</b><small>{leadMarketSnapshot.kpis.detailedPages} páginas con ID + copy + imagen</small></article>
              <article><span>Diversidad real</span><b>{leadMarketSnapshot.kpis.uniqueCopyBodies}</b><small>copies únicos · {leadMarketSnapshot.kpis.uniqueImages} imágenes únicas</small></article>
              <article><span>Resolución editorial</span><b>{leadMarketSnapshot.editorialReview.matchedCompanyIds}</b><small>nuevas fichas aprobadas</small></article>
            </section>
            <div className="ads-lab-market-study-copy">
              <div>
                <h3>Qué aporta</h3>
                <p>Amplía el buscador con anuncios, posters, CTA, formatos, verticales y señales de oferta. Los duplicados se conservan como presión publicitaria, pero el motor deduplica el copy para no confundir repetición con diversidad.</p>
                <p><b>Límite:</b> {leadMarketSnapshot.methodology.limitation}</p>
              </div>
              <div>
                <h3>Control de calidad</h3>
                <p>{leadMarketSnapshot.editorialReview.quarantinedPageIds} páginas quedaron en cuarentena y {leadMarketSnapshot.editorialReview.watchlistPageIds} en observación. Las cifras monetarias no se tratan como precio salvo cuando el contexto de pago fue revisado.</p>
                <p>No hay gasto, impresiones ni conversiones: aquí “recurrente” significa observado en varias empresas, nunca ganador.</p>
              </div>
            </div>
            <section className="ads-lab-market-clones" aria-label="Copy compartido entre páginas">
              <header><h3>Copy compartido entre páginas</h3><small>Hipótesis de plantilla o sindicación; no prueba autoría común.</small></header>
              <div>{leadMarketSnapshot.cloneClusters.map((cluster) => (
                <article key={cluster.id}>
                  <b>{cluster.title}</b>
                  <span>{cluster.pages.join(" · ")}</span>
                  <small>{cluster.adCount} anuncios declarados · {cluster.listedExternalIdCount} IDs enumerados{cluster.countConsistent ? "" : " · inconsistencia conservada"}</small>
                </article>
              ))}</div>
            </section>
          </div>
        </details>
      )}

      <div className="ads-lab-tabs-shell">
        <div className="ads-lab-tabs" role="tablist" aria-label="Secciones del laboratorio">
          {([
            ["explore", "Explorar"],
            ["patterns", "Descubrir patrones"],
            ["matrix", `Construir hipótesis (${selectedAds.length})`],
          ] as Array<[LabSection, string]>).map(([id, label]) => (
            <button type="button" role="tab" id={`ads-lab-tab-${id}`} aria-controls={`ads-lab-panel-${id}`} aria-selected={section === id} tabIndex={section === id ? 0 : -1} className={section === id ? "active" : ""} key={id} onClick={() => setSection(id)} onKeyDown={(event) => {
              if (!(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(event.key)) return;
              event.preventDefault();
              const order: LabSection[] = ["explore", "patterns", "matrix"];
              const index = order.indexOf(id);
              const next = event.key === "Home" ? order[0] : event.key === "End" ? order.at(-1)! : order[(index + (event.key === "ArrowRight" ? 1 : -1) + order.length) % order.length];
              setSection(next);
              requestAnimationFrame(() => document.getElementById(`ads-lab-tab-${next}`)?.focus());
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="ads-lab-command-shell">
        {(section === "explore" || section === "patterns") && (
          <div className="ads-lab-command-bar">
            <label className="ads-lab-search">
              <span>Buscar</span>
              <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(DEFAULT_VISIBLE); }} placeholder="Copy, empresa, CTA o ID exacto…" />
            </label>
            <label><span>Empresa</span><select value={company} onChange={(event) => { setCompany(event.target.value); setVisible(DEFAULT_VISIBLE); }}><option value={ALL}>Todas las empresas</option>{options.companies.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
            <label><span>Buscar en</span><select value={searchScope} onChange={(event) => setSearchScope(event.target.value as AdSearchScope)}><option value="both">Original + traducción</option><option value="original">Solo original</option><option value="translation">Solo traducción</option></select></label>
            <label><span>Orden</span><select value={sort} onChange={(event) => setSort(event.target.value as AdSort)}><option value="relevance">{query.trim() ? "Relevancia" : "Calidad de evidencia"}</option><option value="company">Empresa</option><option value="confidence">Confianza OCR</option><option value="newest">Más recientes</option></select></label>
            <div className="ads-lab-language-mode" role="group" aria-label="Idioma mostrado">
              {(["original", "es", "parallel"] as AdLanguageMode[]).map((mode) => <button type="button" className={languageMode === mode ? "active" : ""} aria-pressed={languageMode === mode} key={mode} onClick={() => setLanguageMode(mode)}>{mode === "original" ? "Original" : mode === "es" ? "Español" : "Ambos"}</button>)}
            </div>
            <button ref={filterToggleRef} type="button" className="ads-lab-filter-toggle" aria-controls="ads-lab-filter-panel" aria-expanded={filterDialogMode ? filtersOpen : undefined} onClick={() => setFiltersOpen((current) => !current)}>Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ""}</button>
          </div>
        )}
        {(section === "explore" || section === "patterns") && (
          <div className="ads-lab-quick-presets" aria-label="Atajos de análisis">
            <span>Vistas rápidas</span>
            <button type="button" className={evidenceFilter === EVIDENCE_ELIGIBLE ? "active" : ""} onClick={() => applyQuickPreset("eligible")}>Solo base apta</button>
            <button type="button" className={translationStatuses.length === 2 && translationStatuses.includes("automatica") && translationStatuses.includes("revisada") ? "active" : ""} onClick={() => applyQuickPreset("translated")}>Traducidas</button>
            <button type="button" className={translationStatuses.length === 1 && translationStatuses[0] === "revisada" ? "active" : ""} onClick={() => applyQuickPreset("reviewed")}>Revisadas</button>
            <button type="button" className={countries.length === 1 && countries[0] === "España" ? "active" : ""} onClick={() => applyQuickPreset("spain")}>España</button>
            <button type="button" className={platformFamilies.length === 2 && platformFamilies.includes("meta") && platformFamilies.includes("instagram") ? "active" : ""} onClick={() => applyQuickPreset("meta")}>Meta + Instagram</button>
            {leadMarketSnapshot && <button type="button" className={leadMarketOnly ? "active" : ""} onClick={() => applyQuickPreset("lead-market")}>Estudio · 26 ago</button>}
          </div>
        )}
      </div>

      {(section === "explore" || section === "patterns") && activeFilterCount > 0 && (
        <div className="ads-lab-active-filters" aria-label="Filtros activos">
          {query.trim() && <button onClick={() => setQuery("")}>Búsqueda · {compact(query, 34)} ×</button>}
          {signalEvidenceKeys.length > 0 && <button onClick={() => { setSignalEvidenceKeys([]); setSignalEvidenceLabel(""); }}>Evidencias · {compact(signalEvidenceLabel, 34)} ×</button>}
          {company !== ALL && <button onClick={() => setCompany(ALL)}>Empresa · {options.companies.find(([id]) => id === company)?.[1] || company} ×</button>}
          {vertical !== ALL && <button onClick={() => setVertical(ALL)}>Vertical · {vertical} ×</button>}
          {hook !== ALL && <button onClick={() => setHook(ALL)}>Apertura · {hook} ×</button>}
          {angle !== ALL && <button onClick={() => setAngle(ALL)}>Ángulo · {sentenceCase(angle)} ×</button>}
          {promise !== ALL && <button onClick={() => setPromise(ALL)}>Promesa · {promise} ×</button>}
          {mechanic !== ALL && <button onClick={() => setMechanic(ALL)}>Oferta · {mechanic} ×</button>}
          {format !== ALL && <button onClick={() => setFormat(ALL)}>Formato · {format} ×</button>}
          {cta !== ALL && <button onClick={() => setCta(ALL)}>CTA · {cta} ×</button>}
          {evidenceFilter !== ALL && <button onClick={() => setEvidenceFilter(ALL)}>Evidencia · {options.evidence.find((item) => item.value === evidenceFilter)?.label || evidenceFilter} ×</button>}
          {countries.map((value) => <button key={`country-${value}`} onClick={() => toggleFacet(value, setCountries)}>País · {optionLabel(options.countries, value)} ×</button>)}
          {platformFamilies.map((value) => <button key={`platform-${value}`} onClick={() => toggleFacet(value, setPlatformFamilies)}>Canal · {optionLabel(options.platformFamilies, value)} ×</button>)}
          {languages.map((value) => <button key={`language-${value}`} onClick={() => toggleFacet(value, setLanguages)}>Idioma · {optionLabel(options.languages, value)} ×</button>)}
          {translationStatuses.map((value) => <button key={`translation-${value}`} onClick={() => toggleFacet(value, setTranslationStatuses)}>{optionLabel(options.translationStatuses, value)} ×</button>)}
          {ocrStatuses.map((value) => <button key={`ocr-${value}`} onClick={() => toggleFacet(value, setOcrStatuses)}>{optionLabel(options.ocrStatuses, value)} ×</button>)}
          {mediaTypes.map((value) => <button key={`media-${value}`} onClick={() => toggleFacet(value, setMediaTypes)}>Media · {optionLabel(options.mediaTypes, value)} ×</button>)}
          {selectedOnly && <button onClick={() => setSelectedOnly(false)}>Solo selección ×</button>}
          {liveOnly && <button onClick={() => setLiveOnly(false)}>Anuncio activo ×</button>}
          {leadMarketOnly && <button onClick={() => setLeadMarketOnly(false)}>Estudio mercado leads ×</button>}
          <button className="clear" onClick={resetFilters}>Limpiar todo</button>
        </div>
      )}

      {(section === "explore" || section === "patterns") && (
        <>
        {filtersOpen && filterDialogMode && <button type="button" className="ads-lab-filter-backdrop" aria-label="Cerrar filtros" onClick={() => closeFilters()} />}
        <aside ref={filterRailRef} id="ads-lab-filter-panel" className={`ads-lab-filter-rail${filtersOpen ? " open" : ""}`} aria-label="Filtros de anuncios" role={filtersOpen && filterDialogMode ? "dialog" : undefined} aria-modal={filtersOpen && filterDialogMode ? true : undefined}>
          <header><strong>Filtros</strong><span>{activeFilterCount > 0 && <button type="button" onClick={resetFilters}>Limpiar</button>}<button type="button" className="ads-lab-filter-close" onClick={() => closeFilters()}>Cerrar</button></span></header>
          <FacetGroup title="País de la empresa" options={options.countries} selected={countries} onToggle={(value) => toggleFacet(value, setCountries)} />
          <FacetGroup title="Familia de canal" options={options.platformFamilies} selected={platformFamilies} onToggle={(value) => toggleFacet(value, setPlatformFamilies)} />
          <FacetGroup title="Idioma original" options={options.languages} selected={languages} onToggle={(value) => toggleFacet(value, setLanguages)} />
          <FacetGroup title="Traducción" options={options.translationStatuses} selected={translationStatuses} onToggle={(value) => toggleFacet(value, setTranslationStatuses)} />
          <FacetGroup title="Estado OCR" options={options.ocrStatuses} selected={ocrStatuses} onToggle={(value) => toggleFacet(value, setOcrStatuses)} />
          <FacetGroup title="Creatividad" options={options.mediaTypes} selected={mediaTypes} onToggle={(value) => toggleFacet(value, setMediaTypes)} />
          <div className="ads-lab-advanced-selects">
            <label><span>Vertical declarada · {ads.filter((item) => Boolean(item.ad.vertical)).length}/{ads.length} piezas</span><select value={vertical} onChange={(event) => setVertical(event.target.value)}><option value={ALL}>Todas</option>{options.verticals.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Apertura / hook</span><select value={hook} onChange={(event) => setHook(event.target.value)}><option value={ALL}>Todas</option>{options.hooks.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Ángulo</span><select value={angle} onChange={(event) => setAngle(event.target.value)}><option value={ALL}>Todos</option>{options.angles.map((item) => <option value={item} key={item}>{sentenceCase(item)}</option>)}</select></label>
            <label><span>Promesa</span><select value={promise} onChange={(event) => setPromise(event.target.value)}><option value={ALL}>Todas</option>{options.promises.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Mecánica de oferta</span><select value={mechanic} onChange={(event) => setMechanic(event.target.value)}><option value={ALL}>Todas</option>{options.mechanics.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Formato</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value={ALL}>Todos</option>{options.formats.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>CTA</span><select value={cta} onChange={(event) => setCta(event.target.value)}><option value={ALL}>Todos</option>{options.ctas.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Evidencia</span><select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}>{options.evidence.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="check"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} /> Solo selección</label>
            <label className="check"><input type="checkbox" checked={liveOnly} onChange={(event) => setLiveOnly(event.target.checked)} /> Anuncio activo en la biblioteca</label>
          </div>
        </aside>
        </>
      )}

      {section === "explore" && (
        <div className="ads-lab-panel" role="tabpanel" id="ads-lab-panel-explore" aria-labelledby="ads-lab-tab-explore">
          <div className="ads-lab-result-head">
            <div>
              <strong>{filteredAds.length.toLocaleString("es-ES")} piezas</strong>
              <span> · {new Set(filteredAds.map((ad) => ad.ad.id)).size} empresas · {filteredAds.filter((ad) => ad.ad.traduccionEs).length} traducidas · {filteredAds.filter((ad) => ad.patternEligible).length} aptas para patrones</span>
            </div>
            <div>
              {selectedAds.length > 0 && <button type="button" className="quiet" onClick={() => setSelectedKeys([])}>Vaciar selección</button>}
            </div>
          </div>
          {filteredAds.length ? (
            <div className="ads-lab-grid">
              {filteredAds.slice(0, visible).map((item) => {
                const selected = selectedSet.has(item.key);
                const isBaseline = effectiveBaselineKey === item.key;
                const media = presentableMedia(item.ad);
                const landingUrl = safeExternalUrl(item.ad.landingUrl);
                const sourceUrl = safeExternalUrl(item.ad.fuenteUrl);
                const dateRange = deliveryRange(item.ad);
                const transcript = item.ad.transcript || item.ad.transcripcion;
                return (
                  <article className={`ads-lab-card${selected ? " selected" : ""}${item.patternEligible ? "" : " ineligible"}`} key={item.key}>
                    {media.video ? (
                      <div className="ads-lab-thumb video">
                        <span>VÍDEO ARCHIVADO</span>
                        <video controls playsInline preload="metadata" poster={media.poster || undefined} aria-label={`Vídeo del anuncio de ${item.ad.name}`}>
                          <source src={media.video} />
                          <track
                            kind="captions"
                            src={captionTrackFor(transcript || "")}
                            srcLang={item.ad.idioma && item.ad.idioma !== "und" ? item.ad.idioma : "es"}
                            label={transcript ? "Transcripción del anuncio" : "Sin transcripción disponible"}
                            default={Boolean(transcript)}
                          />
                          Tu navegador no puede reproducir este vídeo.
                        </video>
                        <a className="ads-lab-open-media" href={media.video} target="_blank" rel="noreferrer">Abrir archivo ↗</a>
                      </div>
                    ) : media.image ? (
                      <a className="ads-lab-thumb" href={media.openFile || media.image} target="_blank" rel="noreferrer" aria-label={`Abrir captura de ${item.ad.name}`}>
                        <span>ABRIR CAPTURA</span>
                        <img src={media.image} alt={`Anuncio de ${item.ad.name}: ${item.ad.titular}`} loading="lazy" />
                      </a>
                    ) : media.openFile ? (
                      <a className="ads-lab-thumb missing" href={media.openFile} target="_blank" rel="noreferrer" aria-label={`Abrir evidencia de ${item.ad.name}`}>
                        <span>ABRIR EVIDENCIA</span>
                        <small>{item.platform}</small>
                      </a>
                    ) : (
                      <div className="ads-lab-thumb missing" title="No existe un archivo visual local para esta transcripción">
                        <span>SOLO TRANSCRIPCIÓN</span>
                        <small>{item.platform}</small>
                      </div>
                    )}
                    <div className="ads-lab-card-body">
                      <div className="ads-lab-card-meta">
                        {onOpenCompany ? <button type="button" onClick={() => onOpenCompany(item.ad.id)}>{item.ad.name}</button> : <b>{item.ad.name}</b>}
                        <span>{item.ad.country || "Sin país"}</span>
                        <span>{item.platform}</span>
                        <span>{item.ad.idiomaNombre || "Idioma sin determinar"}</span>
                        {item.ad.fecha && <span title="Fecha de corte o revisión de la evidencia">Corte · {item.ad.fecha}</span>}
                        {typeof item.ad.isActive === "boolean" && <i className={item.ad.isActive ? "active" : "inactive"}>{item.ad.isActive ? "Activo" : "Inactivo"}</i>}
                        {dateRange && <span title="Periodo observado en la biblioteca">{dateRange}</span>}
                      </div>
                      <div className="ads-lab-evidence-badges" aria-label="Calidad de la evidencia">
                        <span className={item.patternEligible ? "eligible" : "ineligible"}>
                          {item.patternEligible ? "Apta para patrones" : "Solo lectura · fuera de patrones"}
                        </span>
                        <span>{OCR_STATUS_LABELS[item.ad.estadoOcr || "pendiente"] || item.ad.estadoOcr}</span>
                        <span>{LANGUAGE_STATUS_LABELS[item.ad.estadoTraduccion || "pendiente"] || item.ad.estadoTraduccion}</span>
                        <span title="OCR, atribución, fuente y traducción; no mide rendimiento creativo">Evidencia · {item.qualityScore}/100</span>
                        {item.ad.researchSnapshotId && <span className="market-study">Estudio España · 26 ago</span>}
                      </div>
                      <BilingualCopy ad={item.ad} mode={languageMode} />
                      <div className="ads-lab-tags">
                        {item.hooks.slice(0, 1).map((tag) => <span key={`hook-${tag}`}>Apertura · {tag}</span>)}
                        {item.angles.slice(0, 1).map((tag) => <span key={tag}>Ángulo · {tag}</span>)}
                        {item.promises.slice(0, 2).map((tag) => <span className="promise" key={tag.label} title={tag.evidence}>Promesa · {tag.label}</span>)}
                        {item.mechanics.slice(0, 1).map((tag) => <span key={`mechanic-${tag}`}>Oferta · {tag}</span>)}
                        <span>Formato · {item.format}</span>
                        {(item.hooks.length + item.angles.length + item.promises.length + item.mechanics.length) > 5 && <span className="more">+{item.hooks.length + item.angles.length + item.promises.length + item.mechanics.length - 5} señales</span>}
                      </div>
                      {(landingUrl || sourceUrl) && (
                        <nav className="ads-lab-card-links" aria-label={`Enlaces del anuncio de ${item.ad.name}`}>
                          {landingUrl && <a className="landing" href={landingUrl} target="_blank" rel="noreferrer">Abrir landing ↗</a>}
                          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Ver fuente ↗</a>}
                        </nav>
                      )}
                      <details className="ads-lab-transcript">
                        <summary>Ver evidencia y trazabilidad</summary>
                        <small><b>Estado:</b> {item.ad.estadoEvidencia || "sin estado editorial"}</small>
                        <small><b>OCR:</b> {OCR_STATUS_LABELS[item.ad.estadoOcr || "pendiente"] || item.ad.estadoOcr}{hasValue(item.ad.confianzaOcr) ? ` · ${item.ad.confianzaOcr}%` : ""}</small>
                        <small><b>Traducción:</b> {LANGUAGE_STATUS_LABELS[item.ad.estadoTraduccion || "pendiente"]}</small>
                        <small><b>Semántica usada:</b> {item.semanticCopy.label}</small>
                        {item.ad.proveedorTraduccion && <small><b>Método:</b> {item.ad.proveedorTraduccion}</small>}
                        {item.ad.traducidoEn && <small><b>Actualizada:</b> {item.ad.traducidoEn}</small>}
                        {item.ad.notaRevisionTraduccion && <small><b>Revisión:</b> {item.ad.notaRevisionTraduccion}</small>}
                        <small><b>Plataforma:</b> {item.ad.plataforma}</small>
                        {item.ad.externalId && <small><b>ID externo:</b> {item.ad.externalId}</small>}
                        {item.ad.pageId && <small><b>Page ID:</b> {item.ad.pageId}</small>}
                        {typeof item.ad.isActive === "boolean" && <small><b>Estado:</b> {item.ad.isActive ? "activo" : "inactivo"}</small>}
                        {dateRange && <small><b>Periodo:</b> {dateRange}</small>}
                        {Number(item.ad.variantCount || 1) > 1 && <small><b>Variantes agrupadas:</b> {item.ad.variantCount} archivos de la misma identidad</small>}
                        {media.assetCount > 0 && <small><b>Activos asociados:</b> {media.assetCount}</small>}
                        {item.ad.marketCategory && <small><b>Categoría del estudio:</b> {item.ad.marketCategory}</small>}
                        {item.ad.marketVerticals?.length ? <small><b>Verticales observadas:</b> {item.ad.marketVerticals.join(" · ")}</small> : null}
                        {item.ad.priceEvidenceRole === "currency_mentions_not_treated_as_price" && <small><b>Control monetario:</b> hay cifras en el copy, pero no se clasifican como precio sin contexto de pago.</small>}
                        {item.ad.origen && <small><b>Origen:</b> {item.ad.origen}</small>}
                        {item.ad.atribucion && <small><b>Atribución:</b> {item.ad.atribucion}</small>}
                        {item.ad.anunciante && <small><b>Anunciante:</b> {item.ad.anunciante}</small>}
                        {item.ad.corpusKey && <small><b>Clave de corpus:</b> {item.ad.corpusKey}</small>}
                        {transcript && <small><b>Transcripción:</b> {transcript}</small>}
                        {landingUrl && <a href={landingUrl} target="_blank" rel="noreferrer">Abrir landing del anuncio</a>}
                        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Abrir fuente verificable</a>}
                        {item.ad.archivoSha256 && <small title={item.ad.archivoSha256}><b>SHA-256:</b> {compact(item.ad.archivoSha256, 24)}</small>}
                        <button type="button" onClick={() => copyText(adAsText(item), "Transcripción copiada.")}>Copiar transcripción</button>
                      </details>
                      <footer>
                        <small>{item.ad.externalId ? `ID ${item.ad.externalId}` : media.openFile ? basename(media.openFile) : "sin archivo visual"}</small>
                        <button type="button" className={selected ? "remove" : ""} aria-pressed={selected} onClick={() => toggleSelected(item.key)}>
                          {selected ? (isBaseline ? "Control · quitar" : "Seleccionado · quitar") : "+ Usar en hipótesis"}
                        </button>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="ads-lab-empty"><strong>No hay piezas con estos filtros.</strong><button type="button" onClick={resetFilters}>Ver toda la base</button></div>}
          {visible < filteredAds.length && <button type="button" className="ads-lab-more" onClick={() => setVisible((current) => current + DEFAULT_VISIBLE)}>Mostrar {Math.min(DEFAULT_VISIBLE, filteredAds.length - visible)} más</button>}
        </div>
      )}

      {section === "patterns" && (
        <div className="ads-lab-panel" role="tabpanel" id="ads-lab-panel-patterns" aria-labelledby="ads-lab-tab-patterns">
          <div className="ads-lab-pattern-head">
            <div>
              <p className="ads-lab-kicker">PATTERN INTELLIGENCE · {patternUniverse.companies} EMPRESAS · {patternUniverse.identities} COPIES ÚNICOS</p>
              <h3>{patternView === "signals" ? `Señales de ${DIMENSION_LABELS[patternDimension].toLocaleLowerCase("es")}` : patternView === "combinations" ? "Arquitecturas que aparecen juntas" : patternView === "phrases" ? "Lenguaje recurrente entre empresas" : "Qué cambia dentro del segmento"}</h3>
              <p>
                La adopción entre empresas manda sobre el volumen bruto. Se deduplican copies, se mide concentración y cada conclusión conserva una muestra de evidencia diversa.
              </p>
            </div>
          </div>

          <div className="ads-lab-pattern-view-tabs" role="group" aria-label="Tipo de descubrimiento">
            {([
              ["signals", "Señales", "Hooks, promesas y ofertas"],
              ["combinations", "Combinaciones", "Arquitecturas A + B"],
              ["phrases", "Frases", "Lenguaje replicado"],
              ["contrasts", "Contrastes", "Diferencias del filtro"],
            ] as Array<[PatternView, string, string]>).map(([view, label, description]) => (
              <button type="button" aria-pressed={patternView === view} className={patternView === view ? "active" : ""} key={view} onClick={() => { setPatternView(view); setPatternLimit(18); }}>
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>

          <div className="ads-lab-pattern-toolbar">
            {patternView === "signals" ? (
              <div className="ads-lab-pattern-dimensions" role="group" aria-label="Dimensión del patrón">
                {(Object.keys(DIMENSION_LABELS) as PatternDimension[]).map((dimension) => (
                  <button
                    type="button"
                    aria-pressed={patternDimension === dimension}
                    className={patternDimension === dimension ? "active" : ""}
                    key={dimension}
                    onClick={() => { setPatternDimension(dimension); setPatternLimit(18); }}
                  >
                    {DIMENSION_LABELS[dimension]}
                  </button>
                ))}
              </div>
            ) : <p>{patternView === "combinations" ? "Índice descriptivo por empresa: exige 5 empresas, 6 copies, coaparición ≥1,15× y una base de normalización —producto de adopciones— equivalente a ≥3 empresas. No es significación estadística." : patternView === "phrases" ? "N-gramas de 2–3 palabras encontrados únicamente en originales españoles o traducciones revisadas." : "Compara el segmento con el resto del corpus apto; exige ±4 puntos y al menos 3 empresas, y oculta el criterio exacto usado para filtrar."}</p>}
            {patternView === "contrasts" ? (
              <div className="ads-lab-weighting static"><span>Ranking · diferencia absoluta × solidez</span></div>
            ) : (
              <div className="ads-lab-weighting" role="group" aria-label="Unidad principal del ranking">
                <span>Ordenar por</span>
                <button type="button" aria-pressed={patternWeighting === "companies"} className={patternWeighting === "companies" ? "active" : ""} onClick={() => setPatternWeighting("companies")}>Empresas</button>
                <button type="button" aria-pressed={patternWeighting === "identities"} className={patternWeighting === "identities" ? "active" : ""} onClick={() => setPatternWeighting("identities")}>Copies únicos</button>
              </div>
            )}
          </div>

          <div className="ads-lab-pattern-universe" aria-label="Universo de análisis actual">
            <article><span>Empresas</span><strong>{patternUniverse.companies}</strong><small>unidad principal</small></article>
            <article><span>Copies únicos</span><strong>{patternUniverse.identities}</strong><small>repeticiones deduplicadas</small></article>
            <article><span>Países asociados</span><strong>{patternUniverse.countries}</strong><small>fichas de empresa; no targeting</small></article>
            <article><span>Semántica fiable</span><strong>{patternUniverse.trusted}%</strong><small>sobre copies únicos · original ES o revisada</small></article>
          </div>

          <div className="ads-lab-pattern-scope">
            <div>
              <strong>{patternAds.length} de {filteredAds.length} piezas filtradas entran en el motor</strong>
              <p>
                <code>aptaPatrones=false</code> queda fuera por defecto. La traducción automática ayuda a explorar, pero no eleva por sí sola la fiabilidad semántica ni convierte una captura pendiente en evidencia apta.
              </p>
            </div>
            <label>
              <input type="checkbox" checked={includeIneligiblePatterns} onChange={(event) => setIncludeIneligiblePatterns(event.target.checked)} />
              Incluir {excludedFromPatterns} excluidas bajo mi criterio
            </label>
          </div>

          {visiblePatternSignals[0] && (
            <aside className="ads-lab-featured-signal">
              <div><span>LECTURA PRINCIPAL DEL CORTE ACTUAL</span><strong>{visiblePatternSignals[0].label}</strong></div>
              <p>{visiblePatternSignals[0].companies} empresas · {visiblePatternSignals[0].identities} copies únicos · {Math.round(visiblePatternSignals[0].companyAdoption * 100)}% de adopción empresarial.{visiblePatternSignals[0].dominance >= 0.5 ? " Atención: una sola empresa concentra al menos la mitad de los copies." : " La muestra está repartida entre anunciantes."}</p>
              <small>Es una regularidad observable, no un “ganador”: requiere métricas de campaña o un experimento controlado.</small>
            </aside>
          )}

          {visiblePatternSignals.length ? (
            <div className="ads-lab-signal-list">
              {visiblePatternSignals.slice(0, patternLimit).map((signal) => (
                <PatternSignalRow
                  key={signal.id}
                  signal={signal}
                  weighting={patternView === "contrasts" ? "companies" : patternWeighting}
                  onOpen={() => openSignal(signal)}
                  onSample={() => addAdsToSelection(signal.examples.map((item) => item.payload))}
                />
              ))}
            </div>
          ) : (
            <div className="ads-lab-empty">
              <strong>{patternView === "contrasts" && activeFilterCount === 0 ? "Aplica un segmento para descubrir qué lo hace diferente." : "No hay una señal que supere los mínimos de evidencia."}</strong>
              <p>{patternView === "contrasts" && activeFilterCount === 0 ? "Por ejemplo: España, Meta + Instagram, un idioma o un estado de traducción." : "Amplía el filtro o cambia de dimensión; el motor evita rellenar huecos con patrones débiles."}</p>
              {activeFilterCount > 0 && <button type="button" onClick={resetFilters}>Limpiar filtros</button>}
            </div>
          )}
          {patternLimit < visiblePatternSignals.length && <button type="button" className="ads-lab-more" onClick={() => setPatternLimit(visiblePatternSignals.length)}>Mostrar las {visiblePatternSignals.length} señales</button>}
        </div>
      )}

      {section === "matrix" && (
        <div className="ads-lab-panel" role="tabpanel" id="ads-lab-panel-matrix" aria-labelledby="ads-lab-tab-matrix">
          <div className="ads-lab-matrix-head">
            <div>
              <p className="ads-lab-kicker">CONSTRUCTOR DE HIPÓTESIS A/B/C</p>
              <h3>Convierte piezas reales en un plan de prueba</h3>
              <p>Los ingredientes mantienen su fuente. Antes de lanzar, iguala audiencia, presupuesto, ubicación, formato y periodo para aislar la variable.</p>
            </div>
            {selectedAds.length >= 2 && (
              <label>
                <span>Pieza de control</span>
                <select value={effectiveBaselineKey} onChange={(event) => setBaselineKey(event.target.value)}>
                  {selectedAds.map((ad) => <option value={ad.key} key={ad.key}>{ad.ad.name} · {compact(ad.ad.titular, 58)}</option>)}
                </select>
              </label>
            )}
          </div>

          {selectedAds.length < 2 || !baseline ? (
            <div className="ads-lab-empty matrix-empty">
              <strong>Selecciona al menos dos anuncios.</strong>
              <p>Elige piezas con aperturas, ángulos, promesas, ofertas, formatos o CTA distintos para crear retadores trazables.</p>
              <button type="button" onClick={() => goToSection("explore")}>Ir a explorar</button>
            </div>
          ) : (
            <>
              {selectedAds.some((ad) => !ad.patternEligible) && (
                <p className="ads-lab-quality-warning">
                  Esta selección contiene {selectedAds.filter((ad) => !ad.patternEligible).length} pieza(s) marcadas como no aptas para patrones. Se mantienen porque las seleccionaste de forma explícita; revisa su atribución antes de ejecutar el test.
                </p>
              )}
              {selectedAds.some((ad) => !ad.semanticCopy.trusted) && (
                <p className="ads-lab-quality-warning">
                  Esta selección contiene {selectedAds.filter((ad) => !ad.semanticCopy.trusted).length} pieza(s) cuya lectura semántica depende de traducción automática o de un original extranjero no revisado. El Lab conserva el original y la procedencia, pero estas variantes son exploratorias: revisa el copy antes de lanzarlo.
                </p>
              )}
              <div className="ads-lab-selected-strip">
                {selectedAds.map((ad) => (
                  <article className={`${ad.key === effectiveBaselineKey ? "control" : ""}${ad.patternEligible ? "" : " ineligible"}`} key={ad.key}>
                    <span>{ad.patternEligible ? (ad.key === effectiveBaselineKey ? "CONTROL" : "FUENTE") : "FUERA DE PATRONES"}</span>
                    <b>{ad.ad.name}</b>
                    <small>{compact(ad.ad.titular, 64)}</small>
                    <div><button type="button" onClick={() => setBaselineKey(ad.key)}>Usar de control</button><button type="button" onClick={() => toggleSelected(ad.key)}>Quitar</button></div>
                  </article>
                ))}
              </div>

              {matrix.length ? (
                <div className="ads-lab-tests">
                  {matrix.map((row) => (
                    <article key={row.id} className="ads-lab-test">
                      <header><div><span>HIPÓTESIS CONTROLABLE</span><h4>{row.label}</h4><p>{row.instruction}</p></div><button type="button" onClick={() => copyText(matrixAsText(baseline, [row]), `Brief de ${row.label} copiado.`)}>Copiar brief</button></header>
                      <div className="ads-lab-variants">
                        {[row.control, ...row.challengers].map((option, index) => (
                          <section className={index === 0 ? "control" : ""} key={`${row.id}-${option.source.key}`}>
                            <span>{index === 0 ? "A · CONTROL" : `${String.fromCharCode(65 + index)} · RETADOR`}</span>
                            <h5>{option.value}</h5>
                            <p>{compact(option.evidence, 240)}</p>
                            <EvidenceSource ad={option.source} />
                          </section>
                        ))}
                      </div>
                      <footer><span>MÉTRICA</span><p>{row.metric}</p></footer>
                    </article>
                  ))}
                </div>
              ) : <div className="ads-lab-empty"><strong>Las piezas seleccionadas no aportan aperturas, ofertas ni otras variables distintas.</strong><button type="button" onClick={() => goToSection("explore")}>Añadir otras piezas</button></div>}
              {matrix.length > 0 && (
                <div className="ads-lab-brief-bar">
                  <div><strong>{matrix.length} hipótesis preparadas</strong><span>Cada alternativa conserva su fuente; valida covariables antes de hablar de causalidad.</span></div>
                  <button type="button" onClick={() => copyText(matrixAsText(baseline, matrix), "Matriz completa copiada.")}>Copiar matriz completa</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="ads-lab-method">
        <b>Método:</b> no se inventan CTR, CPL, ROAS ni conversiones. El ranking principal pondera empresas, deduplica copies y muestra concentración, calidad y procedencia semántica. “Ganador” queda reservado al resultado de un test controlado.
      </p>
      {selectedAds.length > 0 && section !== "matrix" && (
        <aside className="ads-lab-selection-dock" aria-label="Selección para construir hipótesis">
          <div>
            <strong>{selectedAds.length} {selectedAds.length === 1 ? "pieza seleccionada" : "piezas seleccionadas"}</strong>
            <span>{selectedAds.slice(0, 3).map((item) => item.ad.name).join(" · ")}{selectedAds.length > 3 ? ` · +${selectedAds.length - 3}` : ""}</span>
            {notice && <small className="ads-lab-dock-notice" aria-live="polite">{notice}</small>}
          </div>
          <button type="button" className="quiet" onClick={() => setSelectedKeys([])}>Vaciar</button>
          <button type="button" onClick={() => goToSection("matrix")} disabled={selectedAds.length < 2}>{selectedAds.length < 2 ? "Añade una pieza más" : "Construir hipótesis"}</button>
        </aside>
      )}
      {(selectedAds.length === 0 || section === "matrix") && <div className="ads-lab-toast" aria-live="polite">{notice}</div>}
    </section>
  );
}

const LAB_CSS = String.raw`
.ads-lab{--lab-blue:var(--green,#0b57d0);--lab-blue2:var(--green2,#1a73e8);--lab-ink:var(--ink,#15161a);--lab-muted:var(--muted,#62656b);--lab-line:var(--line,#dbe2ec);--lab-pale:var(--pale,#f0f4fb);position:relative;border:1px solid var(--lab-line);border-radius:20px;overflow:hidden;background:#f7f9fc;color:var(--lab-ink);box-shadow:0 18px 55px rgba(29,35,48,.08)}
.ads-lab *{box-sizing:border-box}.ads-lab button,.ads-lab input,.ads-lab select{font:inherit}.ads-lab button:focus-visible,.ads-lab input:focus-visible,.ads-lab select:focus-visible,.ads-lab a:focus-visible,.ads-lab summary:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px #0b57d0}.ads-lab button:disabled{cursor:not-allowed;opacity:.45}.ads-lab-loading{min-height:190px;display:grid;place-items:center;color:var(--lab-muted)}
.ads-lab-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px;align-items:center;padding:34px 38px;background:radial-gradient(circle at 82% 0,rgba(66,127,225,.28),transparent 35%),#17191e;color:#f5f8ff}.ads-lab-kicker{margin:0 0 10px;font-size:10px;letter-spacing:.15em;font-weight:900;color:#78a7ef}.ads-lab-hero h2{max-width:780px;margin:0;font-size:clamp(26px,3vw,42px);line-height:1.04;letter-spacing:-.045em}.ads-lab-hero>div>p:last-child{max-width:720px;margin:14px 0 0;font-size:13px;line-height:1.6;color:#bdc5d2}.ads-lab-selection{min-width:135px;padding:17px;border:1px solid #3d424c;border-radius:14px;background:rgba(255,255,255,.05);text-align:center}.ads-lab-selection span,.ads-lab-selection strong{display:block}.ads-lab-selection span{font-size:9px;letter-spacing:.14em;color:#9fa8b8;font-weight:850}.ads-lab-selection strong{margin:5px 0 9px;font-size:28px}.ads-lab-selection button{border:0;border-radius:8px;padding:9px 12px;background:#4b83df;color:#fff;font-size:11px;font-weight:850}
.ads-lab-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#fff;border-bottom:1px solid var(--lab-line)}.ads-lab-kpis article{padding:18px 22px;border-right:1px solid var(--lab-line)}.ads-lab-kpis article:last-child{border-right:0}.ads-lab-kpis span,.ads-lab-kpis strong,.ads-lab-kpis small{display:block}.ads-lab-kpis span{font-size:9px;letter-spacing:.08em;color:var(--lab-muted);font-weight:850}.ads-lab-kpis strong{margin:5px 0 2px;font-size:27px;letter-spacing:-.04em}.ads-lab-kpis small{font-size:10px;color:var(--lab-muted)}.ads-lab-kpis .is-warning strong{color:#b45309}.ads-lab-kpis .is-good strong{color:#167044}
.ads-lab-coverage{margin:18px 24px 0;border:1px solid #efd49d;border-radius:13px;background:#fff9eb}.ads-lab-coverage summary{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.ads-lab-coverage summary span{padding:4px 7px;border-radius:99px;background:#f7dfad;color:#775109;font-size:9px;font-weight:900;letter-spacing:.07em}.ads-lab-coverage summary strong{font-size:12px}.ads-lab-coverage>p{margin:0;padding:0 16px 12px;max-width:900px;font-size:11px;line-height:1.55;color:#685e4c}.ads-lab-coverage-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:0 16px 16px}.ads-lab-coverage-list button{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:8px;padding:9px 10px 12px;border:1px solid #eadbbd;border-radius:8px;background:#fff;text-align:left;font-size:10px}.ads-lab-coverage-list button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ads-lab-coverage-list button b{color:#8a5c0b}.ads-lab-coverage-list button i{position:absolute;inset:auto auto 0 0;height:3px;background:#e4a932}
.ads-lab-tabs{display:flex;gap:7px;padding:20px 24px 0}.ads-lab-tabs button,.ads-lab-pattern-dimensions button{border:1px solid var(--lab-line);border-radius:99px;padding:9px 14px;background:#fff;color:var(--lab-ink);font-size:11px;font-weight:800}.ads-lab-tabs button.active,.ads-lab-pattern-dimensions button.active{border-color:var(--lab-ink);background:var(--lab-ink);color:#fff}
.ads-lab-filters{display:grid;grid-template-columns:2fr repeat(3,minmax(135px,1fr));gap:9px;margin:16px 24px 0;padding:15px;border:1px solid var(--lab-line);border-radius:14px;background:#fff}.ads-lab-filters label>span,.ads-lab-matrix-head label>span{display:block;margin:0 0 6px;font-size:9px;letter-spacing:.07em;color:var(--lab-muted);font-weight:850}.ads-lab-filters input[type=search],.ads-lab-filters select,.ads-lab-matrix-head select{width:100%;min-width:0;height:38px;border:1px solid var(--lab-line);border-radius:8px;background:#fff;padding:8px 10px;color:var(--lab-ink);font-size:11px}.ads-lab-checks{display:flex;gap:12px;align-items:center;flex-wrap:wrap;grid-column:span 2}.ads-lab-checks label{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--lab-muted);font-weight:750}.ads-lab-reset{justify-self:end;align-self:end;border:0;border-radius:8px;padding:10px 13px;background:#edf1f7;color:var(--lab-ink);font-size:10px;font-weight:800}
.ads-lab-panel{padding:22px 24px 28px}.ads-lab-result-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;font-size:11px}.ads-lab-result-head span{color:var(--lab-muted)}.ads-lab-result-head>div:last-child{display:flex;gap:7px}.ads-lab-result-head button,.ads-lab-pattern footer button,.ads-lab-test header button,.ads-lab-selected-strip button{border:0;border-radius:8px;padding:8px 10px;background:var(--lab-blue);color:#fff;font-size:10px;font-weight:800}.ads-lab button.quiet,.ads-lab-pattern footer button.quiet{border:1px solid var(--lab-line);background:#fff;color:var(--lab-ink)}
.ads-lab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ads-lab-card{display:grid;grid-template-columns:145px minmax(0,1fr);min-width:0;min-height:290px;border:1px solid var(--lab-line);border-radius:14px;overflow:hidden;background:#fff;transition:border-color .16s,box-shadow .16s,transform .16s}.ads-lab-card:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(26,35,50,.09)}.ads-lab-card.selected{border-color:#2c69c8;box-shadow:0 0 0 2px rgba(44,105,200,.12)}.ads-lab-thumb{position:relative;display:grid;place-items:center;min-height:100%;overflow:hidden;background:repeating-linear-gradient(135deg,#edf1f6,#edf1f6 8px,#f7f9fb 8px,#f7f9fb 16px);color:#596273;text-decoration:none}.ads-lab-thumb>span{position:absolute;z-index:0;font-size:9px;font-weight:900;letter-spacing:.08em}.ads-lab-thumb img{position:relative;z-index:1;width:100%;height:100%;max-height:390px;object-fit:contain;background:#eef1f5}.ads-lab-thumb:hover img{opacity:.9}.ads-lab-card-body{display:flex;min-width:0;flex-direction:column;padding:14px}.ads-lab-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ads-lab-card-meta button,.ads-lab-card-meta b{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;padding:0;color:var(--lab-blue);font-size:10px;font-weight:900}.ads-lab-card-meta span,.ads-lab-card-meta i{padding:3px 6px;border-radius:99px;background:#edf1f7;color:#586170;font-size:8px;font-style:normal;font-weight:800}.ads-lab-card-meta i{background:#e6f4ea;color:#17683e}.ads-lab-card h3{margin:9px 0 6px;font-size:14px;line-height:1.35}.ads-lab-card-body>p{display:-webkit-box;margin:0 0 8px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:5;font-size:11px;line-height:1.55;color:#545963}.ads-lab-card blockquote{margin:0 0 8px;padding:7px 9px;border-left:3px solid #d49a29;background:#fff8e8;font-size:10px;line-height:1.45;color:#67552d}.ads-lab-tags{display:flex;gap:5px;flex-wrap:wrap}.ads-lab-tags span{padding:4px 6px;border-radius:6px;background:#eff3f8;color:#555f6e;font-size:8px;line-height:1.25}.ads-lab-tags span.promise{background:#eaf1fc;color:#174d9e}.ads-lab-card footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:11px}.ads-lab-card footer small{overflow:hidden;color:var(--lab-muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.ads-lab-card footer button{flex:none;border:0;border-radius:8px;padding:8px 10px;background:var(--lab-ink);color:#fff;font-size:9px;font-weight:850}.ads-lab-card footer button.remove{background:#e9f0fb;color:#164d9f}
.ads-lab-more{display:block;margin:20px auto 0;border:0;border-radius:9px;padding:11px 16px;background:var(--lab-blue);color:#fff;font-size:11px;font-weight:850}.ads-lab-empty{display:grid;place-items:center;gap:10px;min-height:210px;padding:30px;border:1px dashed #bdc6d4;border-radius:13px;background:#fff;text-align:center;color:var(--lab-muted)}.ads-lab-empty button{border:0;border-radius:8px;padding:9px 13px;background:var(--lab-blue);color:#fff;font-size:10px;font-weight:800}.ads-lab-empty p{max-width:570px;margin:0;font-size:11px;line-height:1.55}
.ads-lab-pattern-head,.ads-lab-matrix-head{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:16px}.ads-lab-pattern-head h3,.ads-lab-matrix-head h3{margin:0;font-size:23px;letter-spacing:-.03em}.ads-lab-pattern-head>div>p:last-child,.ads-lab-matrix-head>div>p:last-child{max-width:690px;margin:7px 0 0;font-size:11px;line-height:1.55;color:var(--lab-muted)}.ads-lab-pattern-dimensions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.ads-lab-pattern-dimensions button{padding:7px 10px;font-size:10px}.ads-lab-pattern-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.ads-lab-pattern{display:flex;min-width:0;flex-direction:column;padding:15px;border:1px solid var(--lab-line);border-radius:13px;background:#fff}.ads-lab-pattern.repetido{border-top:3px solid #6d96d7}.ads-lab-pattern.amplio{border-top:3px solid #167044}.ads-lab-pattern header{display:flex;justify-content:space-between;align-items:center}.ads-lab-pattern header span{font-size:8px;letter-spacing:.1em;color:#7c838f;font-weight:900}.ads-lab-pattern header strong{font-size:24px;color:var(--lab-blue)}.ads-lab-pattern h4{min-height:36px;margin:5px 0 9px;font-size:14px;line-height:1.3}.ads-lab-pattern dl{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:0}.ads-lab-pattern dl div{padding:7px;border-radius:7px;background:#f2f5f9}.ads-lab-pattern dt{font-size:7px;color:var(--lab-muted);text-transform:uppercase}.ads-lab-pattern dd{margin:3px 0 0;font-size:12px;font-weight:850}.ads-lab-proof{display:flex;min-height:105px;flex-direction:column;margin:11px 0;padding:10px;border-left:3px solid #7b9ed5;background:#f3f6fb}.ads-lab-proof q{font-size:10px;line-height:1.5;color:#4e5560}.ads-lab-proof a{margin-top:auto;padding-top:7px;color:var(--lab-blue);font-size:8px;font-weight:800;text-decoration:none}.ads-lab-pattern footer{display:flex;gap:6px;margin-top:auto}
.ads-lab-matrix-head label{width:min(330px,42%)}.ads-lab-selected-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 13px}.ads-lab-selected-strip article{flex:0 0 235px;padding:11px;border:1px solid var(--lab-line);border-radius:10px;background:#fff}.ads-lab-selected-strip article.control{border-color:#2b65bf;background:#eff5ff}.ads-lab-selected-strip span,.ads-lab-selected-strip b,.ads-lab-selected-strip small{display:block}.ads-lab-selected-strip span{font-size:7px;letter-spacing:.09em;color:var(--lab-blue);font-weight:900}.ads-lab-selected-strip b{margin:5px 0;font-size:11px}.ads-lab-selected-strip small{min-height:29px;font-size:9px;line-height:1.4;color:var(--lab-muted)}.ads-lab-selected-strip div{display:flex;gap:5px;margin-top:8px}.ads-lab-selected-strip button{padding:6px 7px;background:#eef2f7;color:#4d5561;font-size:8px}.ads-lab-selected-strip article.control button:first-child{background:var(--lab-blue);color:#fff}.ads-lab-tests{display:grid;gap:12px}.ads-lab-test{overflow:hidden;border:1px solid var(--lab-line);border-radius:14px;background:#fff}.ads-lab-test>header{display:flex;justify-content:space-between;gap:16px;padding:15px 17px;border-bottom:1px solid var(--lab-line)}.ads-lab-test header span{font-size:8px;letter-spacing:.1em;color:var(--lab-blue);font-weight:900}.ads-lab-test h4{margin:4px 0;font-size:17px}.ads-lab-test header p{margin:0;font-size:10px;color:var(--lab-muted)}.ads-lab-test header button{align-self:center;white-space:nowrap;background:#eef3fb;color:#174f9f}.ads-lab-variants{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.ads-lab-variants section{min-width:0;padding:15px;border-right:1px solid var(--lab-line);background:#fff}.ads-lab-variants section:last-child{border-right:0}.ads-lab-variants section.control{background:#f0f5fd}.ads-lab-variants span{font-size:8px;letter-spacing:.1em;color:#5e6876;font-weight:900}.ads-lab-variants h5{margin:8px 0;font-size:13px;line-height:1.4}.ads-lab-variants p{min-height:48px;margin:0 0 9px;font-size:9px;line-height:1.5;color:var(--lab-muted)}.ads-lab-variants a{color:var(--lab-blue);font-size:8px;font-weight:800;text-decoration:none}.ads-lab-test>footer{display:flex;gap:10px;align-items:center;padding:10px 16px;background:#f6f8fb}.ads-lab-test>footer span{font-size:8px;letter-spacing:.1em;color:var(--lab-muted);font-weight:900}.ads-lab-test>footer p{margin:0;font-size:10px}.ads-lab-brief-bar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:14px;padding:16px;border-radius:12px;background:#17191e;color:#fff}.ads-lab-brief-bar strong,.ads-lab-brief-bar span{display:block}.ads-lab-brief-bar strong{font-size:14px}.ads-lab-brief-bar span{margin-top:4px;font-size:9px;color:#aeb7c6}.ads-lab-brief-bar button{border:0;border-radius:9px;padding:10px 14px;background:#4c83dc;color:#fff;font-size:10px;font-weight:850}
.ads-lab-global-coverage{margin:10px 24px 0;border:1px solid #cbd9ee;border-radius:13px;background:#f2f6fd}.ads-lab-global-coverage summary{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.ads-lab-global-coverage summary span{padding:4px 7px;border-radius:99px;background:#dce8fa;color:#174f9e;font-size:9px;font-weight:900;letter-spacing:.07em}.ads-lab-global-coverage summary strong{font-size:12px}.ads-lab-global-coverage>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:0 16px 10px}.ads-lab-global-coverage article{padding:10px;border:1px solid #d7e2f2;border-radius:9px;background:#fff}.ads-lab-global-coverage article span,.ads-lab-global-coverage article b,.ads-lab-global-coverage article small{display:block}.ads-lab-global-coverage article span{font-size:8px;color:var(--lab-muted);font-weight:850;text-transform:uppercase}.ads-lab-global-coverage article b{margin:4px 0;font-size:18px}.ads-lab-global-coverage article small{font-size:9px;color:var(--lab-muted)}.ads-lab-global-coverage>p{margin:0;padding:0 16px 10px;font-size:10px;line-height:1.5;color:#596477}.ads-lab-global-coverage>p:last-child{padding-bottom:13px}.ads-lab-global-coverage .ads-lab-coverage-caution{margin:0 16px 10px;padding:9px 10px;border:1px solid #e5c67a;border-radius:8px;background:#fff8df;color:#654d0a;font-weight:750}
.ads-lab-card.ineligible{border-style:dashed;border-color:#d9a768;background:#fffdf8}.ads-lab-evidence-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.ads-lab-evidence-badges span{padding:4px 6px;border-radius:5px;background:#f0f2f5;color:#5e6672;font-size:7px;line-height:1.25;font-weight:850}.ads-lab-evidence-badges span.eligible{background:#e6f4ea;color:#17663d}.ads-lab-evidence-badges span.ineligible{background:#fff0dc;color:#8b5208}.ads-lab-transcript a{display:block;margin:0 9px 8px;color:var(--lab-blue);font-size:9px;font-weight:800;overflow-wrap:anywhere}.ads-lab-pattern-scope{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:14px;padding:13px 15px;border:1px solid #d7e1ef;border-radius:11px;background:#f2f6fc}.ads-lab-pattern-scope strong{font-size:11px}.ads-lab-pattern-scope p{max-width:760px;margin:5px 0 0;font-size:10px;line-height:1.5;color:var(--lab-muted)}.ads-lab-pattern-scope code,.ads-lab-method code{padding:2px 4px;border-radius:4px;background:#e4ebf6;font-size:.95em}.ads-lab-pattern-scope label{display:flex;flex:none;align-items:center;gap:7px;font-size:10px;font-weight:800;color:#775109}.ads-lab-quality-warning{margin:0 0 12px;padding:11px 13px;border-left:3px solid #d68c25;border-radius:0 8px 8px 0;background:#fff5e5;color:#694e2b;font-size:10px;line-height:1.55}.ads-lab-selected-strip article.ineligible{border-style:dashed;border-color:#d5a05c;background:#fffaf1}.ads-lab-selected-strip article.ineligible>span{color:#965c0d}
.ads-lab-transcript{margin-top:9px;border:1px solid #dde4ee;border-radius:8px;background:#fafbfd}.ads-lab-transcript summary{padding:8px 9px;cursor:pointer;color:#315f9f;font-size:9px;font-weight:850}.ads-lab-transcript[open] summary{border-bottom:1px solid #e1e6ee}.ads-lab-transcript p{max-height:210px;overflow:auto;margin:0;padding:9px;font-size:10px;line-height:1.55;color:#4f5661;white-space:pre-wrap}.ads-lab-transcript small{display:block;padding:0 9px 7px;font-size:9px;line-height:1.45;color:#626b78}.ads-lab-transcript button{margin:2px 9px 9px;border:0;border-radius:7px;padding:7px 9px;background:#e8effa;color:#174e9b;font-size:9px;font-weight:850}.ads-lab-thumb.missing{display:flex;flex-direction:column;gap:8px}.ads-lab-thumb.missing>span{position:static}.ads-lab-thumb.missing>small{max-width:115px;text-align:center;font-size:9px;line-height:1.45;color:#747d8b}.ads-lab-proof>span{margin-top:auto;padding-top:7px;color:#687386;font-size:8px;font-weight:800}.ads-lab-variants section>span:last-child{color:#687386;font-size:8px;letter-spacing:0;font-weight:800}
.ads-lab-method{margin:0;padding:13px 24px;border-top:1px solid var(--lab-line);background:#fff;font-size:10px;line-height:1.55;color:var(--lab-muted)}.ads-lab-toast{position:sticky;z-index:22;bottom:12px;min-height:0;margin:0 auto;width:max-content;max-width:calc(100% - 28px);border-radius:99px;background:#17191e;color:#fff;font-size:10px;font-weight:800;box-shadow:0 8px 25px rgba(0,0,0,.2)}.ads-lab-toast:not(:empty){margin-bottom:12px;padding:9px 14px}
@media(max-width:1100px){.ads-lab-grid{grid-template-columns:1fr}.ads-lab-pattern-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.ads-lab-search{grid-column:span 2}.ads-lab-coverage-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.ads-lab-hero{grid-template-columns:1fr;padding:26px 22px}.ads-lab-selection{display:flex;align-items:center;gap:10px;text-align:left}.ads-lab-selection strong{margin:0}.ads-lab-selection button{margin-left:auto}.ads-lab-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-kpis article:nth-child(2){border-right:0}.ads-lab-kpis article:nth-child(-n+2){border-bottom:1px solid var(--lab-line)}.ads-lab-coverage-list,.ads-lab-global-coverage>div{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-tabs{overflow-x:auto}.ads-lab-tabs button{white-space:nowrap}.ads-lab-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-search{grid-column:1/-1}.ads-lab-pattern-head,.ads-lab-matrix-head{align-items:stretch;flex-direction:column}.ads-lab-pattern-dimensions{justify-content:flex-start}.ads-lab-pattern-scope{align-items:flex-start;flex-direction:column}.ads-lab-matrix-head label{width:100%}.ads-lab-variants{grid-template-columns:1fr}.ads-lab-variants section{border-right:0;border-bottom:1px solid var(--lab-line)}.ads-lab-variants section:last-child{border-bottom:0}}
@media(max-width:520px){.ads-lab-hero h2{font-size:27px}.ads-lab-kpis article{padding:14px}.ads-lab-coverage-list,.ads-lab-global-coverage>div{grid-template-columns:1fr}.ads-lab-tabs,.ads-lab-panel{padding-left:14px;padding-right:14px}.ads-lab-filters{grid-template-columns:1fr;margin-left:14px;margin-right:14px}.ads-lab-search,.ads-lab-checks{grid-column:auto}.ads-lab-card{grid-template-columns:1fr}.ads-lab-thumb{height:210px}.ads-lab-pattern-grid{grid-template-columns:1fr}.ads-lab-result-head{align-items:flex-start;flex-direction:column}.ads-lab-brief-bar{align-items:flex-start;flex-direction:column}}

/* Interfaz de producto profesional */
.ads-lab{overflow:visible;border:0;border-radius:0;background:#f7f9fc;box-shadow:none}
.ads-lab-product-head{display:flex;min-height:88px;align-items:center;justify-content:space-between;gap:24px;padding:20px 28px;border-bottom:1px solid #d7dee8;background:#fff}.ads-lab-product-head h2{margin:0;font-size:28px;line-height:34px;letter-spacing:-.025em}.ads-lab-product-head .ads-lab-kicker{margin-bottom:2px;color:#0b57d0;font-size:12px}.ads-lab-product-head p:last-child{margin:4px 0 0;color:#5f6368;font-size:13px;line-height:18px}.ads-lab-head-actions{display:flex;align-items:center;gap:10px}.ads-lab-primary,.ads-lab-coverage-popover>summary{min-height:40px;border:1px solid #d7dee8;border-radius:8px;padding:10px 14px;background:#fff;color:#15161a;font-size:13px;font-weight:700;cursor:pointer}.ads-lab-primary{border-color:#0b57d0;background:#0b57d0;color:#fff}.ads-lab-primary:hover{background:#0842a0}.ads-lab-coverage-popover{position:relative}.ads-lab-coverage-popover>summary{list-style:none}.ads-lab-coverage-popover>summary::-webkit-details-marker{display:none}.ads-lab-coverage-popover>div{position:absolute;z-index:20;top:48px;right:0;width:340px;padding:18px;border:1px solid #d7dee8;border-radius:12px;background:#fff;box-shadow:0 16px 40px rgba(21,22,26,.16)}.ads-lab-coverage-popover p{margin:8px 0 0;font-size:13px;line-height:20px;color:#5f6368}
.ads-lab-tabs-shell{position:sticky;z-index:9;top:74px;border-bottom:1px solid #e7ebf1;background:rgba(255,255,255,.97);backdrop-filter:blur(14px)}.ads-lab-tabs-shell .ads-lab-tabs{gap:22px;padding:0 28px}.ads-lab-tabs-shell .ads-lab-tabs button{min-height:44px;border:0;border-bottom:3px solid transparent;border-radius:0;padding:12px 2px;background:transparent;color:#5f6368;font-size:13px}.ads-lab-tabs-shell .ads-lab-tabs button.active{border-bottom-color:#0b57d0;background:transparent;color:#15161a}.ads-lab-command-shell{position:sticky;z-index:8;top:118px;border-bottom:1px solid #d7dee8;background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}.ads-lab-command-bar{display:grid;grid-template-columns:minmax(280px,1.8fr) minmax(180px,1fr) minmax(150px,.7fr) minmax(130px,.6fr) auto auto;gap:10px;align-items:end;padding:12px 28px}.ads-lab-command-bar label>span{display:block;margin-bottom:5px;color:#5f6368;font-size:12px;font-weight:650}.ads-lab-command-bar input,.ads-lab-command-bar select{width:100%;height:42px;border:1px solid #c8d0dc;border-radius:8px;background:#fff;padding:9px 11px;color:#15161a;font-size:13px}.ads-lab-command-bar input:focus,.ads-lab-command-bar select:focus{border-color:#0b57d0}.ads-lab-language-mode{display:flex;height:42px;padding:3px;border:1px solid #c8d0dc;border-radius:8px;background:#f7f9fc}.ads-lab-language-mode button{border:0;border-radius:6px;padding:0 10px;background:transparent;color:#5f6368;font-size:12px;font-weight:700}.ads-lab-language-mode button.active{background:#fff;color:#0b57d0;box-shadow:0 1px 4px rgba(21,22,26,.12)}.ads-lab-filter-toggle{display:none;height:42px;border:1px solid #c8d0dc;border-radius:8px;padding:0 13px;background:#fff;color:#15161a;font-size:13px;font-weight:700}
.ads-lab-active-filters{display:flex;gap:8px;flex-wrap:wrap;padding:10px 28px;border-bottom:1px solid #d7dee8;background:#fff}.ads-lab-active-filters button{min-height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 9px;background:#f0f4fb;color:#334155;font-size:12px}.ads-lab-active-filters button.clear{border-color:transparent;background:transparent;color:#0b57d0;font-weight:700}
.ads-lab-filter-rail{float:left;width:268px;max-height:calc(100vh - 150px);overflow:auto;margin:20px 0 24px 24px;border:1px solid #d7dee8;border-radius:12px;background:#fff}.ads-lab-filter-rail>header{position:sticky;z-index:1;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e7ef;background:#fff}.ads-lab-filter-rail>header strong{font-size:15px}.ads-lab-filter-rail>header button,.ads-lab-facet>button{border:0;background:transparent;color:#0b57d0;font-size:12px;font-weight:700}.ads-lab-facet{min-width:0;margin:0;padding:15px 16px;border:0;border-bottom:1px solid #edf0f4}.ads-lab-facet legend{width:100%;margin:0 0 10px;padding:0;color:#15161a;font-size:12px;font-weight:750}.ads-lab-facet label{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:32px;color:#3c4043;font-size:12px}.ads-lab-facet input{width:16px;height:16px;accent-color:#0b57d0}.ads-lab-facet label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ads-lab-facet label b{color:#7b8491;font-size:12px;font-weight:500}.ads-lab-facet>button{margin-top:7px;padding:4px 0}.ads-lab-advanced-selects{display:grid;gap:11px;padding:15px 16px}.ads-lab-advanced-selects label>span{display:block;margin-bottom:5px;color:#5f6368;font-size:12px;font-weight:650}.ads-lab-advanced-selects select{width:100%;height:40px;border:1px solid #c8d0dc;border-radius:8px;background:#fff;padding:8px;color:#15161a;font-size:12px}.ads-lab-advanced-selects label.check{display:flex;align-items:center;gap:8px;font-size:12px}.ads-lab-filter-rail+.ads-lab-panel{margin-left:304px}.ads-lab-panel{padding:20px 28px 32px}.ads-lab-method{clear:both;padding:16px 28px;font-size:12px;line-height:18px}
.ads-lab-result-head{margin-bottom:14px;font-size:13px}.ads-lab-result-head span{font-size:13px}.ads-lab-grid{grid-template-columns:1fr;gap:14px}.ads-lab-card{grid-template-columns:220px minmax(0,1fr);min-height:330px;border-color:#d7dee8;border-radius:12px;box-shadow:none;transform:none}.ads-lab-card:hover{transform:none;border-color:#b8c4d4;box-shadow:0 8px 24px rgba(21,22,26,.08)}.ads-lab-thumb{min-height:330px;border-right:1px solid #e2e7ef}.ads-lab-thumb>span{font-size:12px}.ads-lab-thumb img{max-height:520px}.ads-lab-card-body{padding:16px 18px}.ads-lab-card-meta{gap:7px}.ads-lab-card-meta button,.ads-lab-card-meta b{max-width:260px;font-size:15px}.ads-lab-card-meta span,.ads-lab-card-meta i{padding:4px 7px;border-radius:6px;font-size:12px;font-weight:600}.ads-lab-evidence-badges{margin:10px 0 12px}.ads-lab-evidence-badges span{padding:5px 7px;border-radius:6px;font-size:12px;font-weight:650}.ads-lab-copy-parallel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ads-lab-copy-column{min-width:0;padding:13px 14px;border:1px solid #e0e5ed;border-radius:10px;background:#fff}.ads-lab-copy-column.translated{background:#f7faff}.ads-lab-copy-column.pending{border-style:dashed}.ads-lab-copy-column header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}.ads-lab-copy-column header span{color:#5f6368;font-size:12px;font-weight:750;letter-spacing:.04em}.ads-lab-copy-column header i{border-radius:5px;padding:3px 5px;background:#e8f0fe;color:#0b57d0;font-size:12px;font-style:normal}.ads-lab-copy-column h3,.ads-lab-card .ads-lab-copy-column h3{margin:0 0 7px;font-size:18px;line-height:24px}.ads-lab-copy-column p{display:-webkit-box;overflow:hidden;margin:0;color:#3c4043;font-size:14px;line-height:22px;-webkit-box-orient:vertical;-webkit-line-clamp:6;white-space:pre-wrap}.ads-lab-copy-column small{display:flex;gap:8px;margin-top:10px;color:#3c4043;font-size:13px;line-height:18px}.ads-lab-copy-column small b{color:#0b57d0}.ads-lab-no-copy{padding:20px;border:1px dashed #d2a85d;border-radius:10px;background:#fffaf0}.ads-lab-no-copy strong{font-size:16px}.ads-lab-no-copy p{margin:6px 0 0;font-size:14px;line-height:21px;color:#685b43}.ads-lab-card blockquote{margin:10px 0;padding:9px 11px;font-size:13px;line-height:19px}.ads-lab-tags{margin-top:11px}.ads-lab-tags span{padding:5px 7px;font-size:12px;line-height:16px}.ads-lab-transcript{margin-top:11px}.ads-lab-transcript summary{padding:10px 11px;font-size:12px}.ads-lab-transcript small{padding:0 11px 8px;font-size:12px;line-height:18px}.ads-lab-transcript a{margin:0 11px 9px;font-size:12px}.ads-lab-transcript button{min-height:36px;margin:3px 11px 11px;font-size:12px}.ads-lab-card footer{padding-top:12px}.ads-lab-card footer small{font-size:12px}.ads-lab-card footer button{min-height:38px;padding:9px 12px;font-size:12px}.ads-lab-more,.ads-lab-empty button{min-height:40px;font-size:13px}.ads-lab-empty,.ads-lab-empty p{font-size:13px}
.ads-lab-pattern h4{font-size:16px}.ads-lab-pattern header span,.ads-lab-pattern dt,.ads-lab-proof a,.ads-lab-test header span,.ads-lab-selected-strip span{font-size:12px}.ads-lab-pattern-head>div>p:last-child,.ads-lab-pattern-scope p,.ads-lab-proof q,.ads-lab-test header p,.ads-lab-test>footer p,.ads-lab-variants p,.ads-lab-selected-strip small{font-size:12px;line-height:18px}.ads-lab-pattern-scope strong,.ads-lab-pattern-scope label,.ads-lab-pattern footer button,.ads-lab-test header button,.ads-lab-selected-strip button{font-size:12px}
@media(max-width:1280px){.ads-lab-command-bar{grid-template-columns:minmax(260px,1.5fr) minmax(180px,1fr) repeat(2,minmax(130px,.65fr)) auto}.ads-lab-language-mode{grid-column:span 2}.ads-lab-filter-toggle{display:block}.ads-lab-filter-rail{display:none;float:none}.ads-lab-filter-rail.open{position:fixed;z-index:30;inset:110px auto 20px 20px;display:block;width:340px;max-height:calc(100vh - 130px);margin:0;box-shadow:0 20px 55px rgba(21,22,26,.22)}.ads-lab-filter-rail+.ads-lab-panel{margin-left:0}}
@media(max-width:820px){.ads-lab-product-head{align-items:flex-start;padding:18px 16px}.ads-lab-head-actions{align-items:flex-end;flex-direction:column}.ads-lab-coverage-popover>div{right:0;width:min(340px,calc(100vw - 32px))}.ads-lab-tabs-shell .ads-lab-tabs{padding:0 16px;overflow-x:auto}.ads-lab-command-bar{grid-template-columns:1fr 1fr;padding:12px 16px}.ads-lab-command-bar .ads-lab-search{grid-column:1/-1}.ads-lab-language-mode{grid-column:1/-1}.ads-lab-active-filters{padding:9px 16px}.ads-lab-panel{padding:18px 16px 28px}.ads-lab-card{grid-template-columns:180px minmax(0,1fr)}.ads-lab-copy-parallel{grid-template-columns:1fr}.ads-lab-thumb{min-height:280px}.ads-lab-pattern-grid{grid-template-columns:1fr}}
@media(max-width:560px){.ads-lab-product-head{min-height:0;flex-direction:column}.ads-lab-product-head h2{font-size:24px}.ads-lab-head-actions{width:100%;align-items:stretch;flex-direction:row}.ads-lab-head-actions>*{flex:1}.ads-lab-command-bar{grid-template-columns:1fr}.ads-lab-command-bar>*{grid-column:1}.ads-lab-card{grid-template-columns:1fr}.ads-lab-thumb{height:260px;min-height:260px;border-right:0;border-bottom:1px solid #e2e7ef}.ads-lab-card-body{padding:14px}.ads-lab-card-meta button,.ads-lab-card-meta b{max-width:100%;width:100%;text-align:left}.ads-lab-copy-column h3,.ads-lab-card .ads-lab-copy-column h3{font-size:17px}.ads-lab-filter-rail.open{inset:72px 10px 10px;width:auto;max-height:calc(100vh - 82px)}.ads-lab-result-head{align-items:flex-start;flex-direction:column}}
.ads-lab-command-shell{top:118px}
.ads-lab-copy-column.expanded p{display:block;overflow:visible;-webkit-line-clamp:unset}.ads-lab-copy-expand{margin-top:9px;border:0;background:transparent;color:#0b57d0;font-size:12px;font-weight:750}.ads-lab-facet label b{color:#5f6368}.ads-lab-filter-backdrop{display:none}.ads-lab-filter-rail>header>span{display:flex;align-items:center;gap:10px}.ads-lab-filter-close{display:none}.ads-lab-matrix-table,.ads-lab-matrix-table a,.ads-lab-matrix-table small,.ads-lab-variants section>span:last-child{font-size:12px;line-height:18px}
@media(max-width:1280px){.ads-lab-filter-backdrop{position:fixed;z-index:29;inset:0;display:block;width:100%;height:100%;border:0;background:rgba(15,23,42,.38);backdrop-filter:blur(2px)}.ads-lab-filter-close{display:inline}.ads-lab-filter-rail.open{inset:138px auto 20px 20px;max-height:calc(100vh - 158px)}}
@media(max-width:560px){.ads-lab-coverage-popover>div{position:fixed;z-index:35;top:90px;right:16px;left:16px;width:auto}.ads-lab-filter-rail.open{inset:82px 10px 10px;max-height:calc(100vh - 92px)}}

/* Pattern intelligence · capa analítica y responsive */
.ads-lab{max-width:100%;overflow-x:clip}.ads-lab-panel{min-width:0}.ads-lab-snapshot{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #d7dee8;background:#f7f9fc;padding:14px 28px}.ads-lab-snapshot article{min-width:0;padding:8px 18px;border-right:1px solid #d7dee8}.ads-lab-snapshot article:first-child{padding-left:0}.ads-lab-snapshot article:last-child{border-right:0}.ads-lab-snapshot span,.ads-lab-snapshot strong,.ads-lab-snapshot small{display:block}.ads-lab-snapshot span{color:#5f6368;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.055em}.ads-lab-snapshot strong{margin:4px 0 2px;color:#15161a;font-size:24px;line-height:28px}.ads-lab-snapshot small{overflow:hidden;color:#5f6368;font-size:12px;line-height:17px;text-overflow:ellipsis}
.ads-lab-market-study{margin:14px 28px;border:1px solid #c8d5e8;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.06)}.ads-lab-market-study>summary{display:flex;justify-content:space-between;align-items:center;gap:24px;min-height:68px;padding:14px 18px;background:linear-gradient(135deg,#f4f8ff,#fff);cursor:pointer;list-style:none}.ads-lab-market-study>summary::-webkit-details-marker{display:none}.ads-lab-market-study>summary:after{content:"+";flex:none;display:grid;place-items:center;width:28px;height:28px;border:1px solid #c8d5e8;border-radius:50%;color:#0b57d0;font-size:18px;font-weight:500}.ads-lab-market-study[open]>summary:after{content:"−"}.ads-lab-market-study>summary span{min-width:0;flex:1}.ads-lab-market-study>summary b,.ads-lab-market-study>summary small,.ads-lab-market-study>summary strong{display:block}.ads-lab-market-study>summary b{color:#174f9f;font-size:14px;line-height:20px}.ads-lab-market-study>summary small{margin-top:2px;color:#5f6368;font-size:12px}.ads-lab-market-study>summary strong{flex:none;color:#15161a;font-size:15px}.ads-lab-market-study-body{border-top:1px solid #dfe6f0;padding:18px}.ads-lab-market-study-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;border:1px solid #dfe6f0;border-radius:10px}.ads-lab-market-study-metrics article{min-width:0;padding:12px 14px;border-right:1px solid #dfe6f0;background:#fafbfd}.ads-lab-market-study-metrics article:last-child{border-right:0}.ads-lab-market-study-metrics span,.ads-lab-market-study-metrics b,.ads-lab-market-study-metrics small{display:block}.ads-lab-market-study-metrics span{color:#697386;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.045em}.ads-lab-market-study-metrics b{margin:4px 0;color:#15161a;font-size:22px}.ads-lab-market-study-metrics small{color:#5f6368;font-size:11px;line-height:16px}.ads-lab-market-study-copy{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.ads-lab-market-study-copy>div{padding:14px 15px;border:1px solid #e0e5ed;border-radius:10px}.ads-lab-market-study-copy h3,.ads-lab-market-clones h3{margin:0 0 7px;color:#15161a;font-size:14px}.ads-lab-market-study-copy p{margin:0 0 7px;color:#4f5662;font-size:12px;line-height:18px}.ads-lab-market-study-copy p:last-child{margin-bottom:0}.ads-lab-market-clones{margin-top:14px}.ads-lab-market-clones>header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px}.ads-lab-market-clones>header h3{margin:0}.ads-lab-market-clones>header small{color:#697386;font-size:11px}.ads-lab-market-clones>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ads-lab-market-clones article{min-width:0;padding:11px 12px;border:1px solid #e0e5ed;border-radius:9px;background:#fafbfd}.ads-lab-market-clones b,.ads-lab-market-clones span,.ads-lab-market-clones article small{display:block}.ads-lab-market-clones b{color:#263244;font-size:12px}.ads-lab-market-clones span{overflow:hidden;margin:4px 0;color:#4f5662;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ads-lab-market-clones article small{color:#697386;font-size:10px;line-height:15px}.ads-lab-evidence-badges span.market-study{border:1px solid #b9cef0;background:#edf4ff;color:#174f9f}
.ads-lab-quick-presets{display:flex;gap:7px;align-items:center;overflow-x:auto;padding:8px 28px 10px;border-top:1px solid #edf0f4;background:#fff;scrollbar-width:thin}.ads-lab-quick-presets>span{flex:none;margin-right:3px;color:#697386;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em}.ads-lab-quick-presets button{flex:none;min-height:32px;border:1px solid #d7dee8;border-radius:999px;padding:6px 11px;background:#fff;color:#3c4043;font-size:12px;font-weight:650}.ads-lab-quick-presets button:hover{border-color:#9eb7df;background:#f7faff}.ads-lab-quick-presets button.active{border-color:#a8c7fa;background:#e8f0fe;color:#0b57d0}.ads-lab-translation-note{display:block!important;margin-top:9px!important;padding:8px 9px;border-radius:7px;background:#fff8e6;color:#6b5320!important;font-size:11px!important;line-height:16px!important}.ads-lab-tags span.more{border-style:dashed;background:#fff;color:#5f6368}
.ads-lab-pattern-head{display:block;margin-bottom:16px}.ads-lab-pattern-head>div{max-width:850px}.ads-lab-pattern-head h3{margin:3px 0 7px;color:#15161a;font-size:26px;line-height:32px;letter-spacing:-.02em}.ads-lab-pattern-head>div>p:last-child{max-width:800px;margin:0;color:#5f6368;font-size:13px;line-height:20px}.ads-lab-pattern-view-tabs{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:8px;overflow-x:auto;margin-bottom:12px}.ads-lab-pattern-view-tabs button{min-width:0;border:1px solid #d7dee8;border-radius:10px;padding:12px 13px;background:#fff;text-align:left}.ads-lab-pattern-view-tabs button:hover{border-color:#a8c7fa;background:#f7faff}.ads-lab-pattern-view-tabs button.active{border-color:#0b57d0;background:#edf4ff;box-shadow:inset 0 0 0 1px #0b57d0}.ads-lab-pattern-view-tabs strong,.ads-lab-pattern-view-tabs span{display:block}.ads-lab-pattern-view-tabs strong{color:#15161a;font-size:13px}.ads-lab-pattern-view-tabs span{margin-top:3px;color:#5f6368;font-size:11px;line-height:15px}.ads-lab-pattern-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:12px;padding:10px 12px;border:1px solid #e0e5ed;border-radius:10px;background:#fff}.ads-lab-pattern-toolbar>p{max-width:760px;margin:0;color:#5f6368;font-size:12px;line-height:18px}.ads-lab-pattern-dimensions{display:flex;gap:5px;flex-wrap:wrap}.ads-lab-pattern-dimensions button,.ads-lab-weighting button{min-height:34px;border:1px solid #d7dee8;border-radius:7px;padding:7px 9px;background:#fff;color:#3c4043;font-size:12px;font-weight:700}.ads-lab-pattern-dimensions button.active,.ads-lab-weighting button.active{border-color:#a8c7fa;background:#e8f0fe;color:#0b57d0}.ads-lab-weighting{display:flex;flex:none;align-items:center;gap:5px}.ads-lab-weighting>span{margin-right:3px;color:#5f6368;font-size:11px;font-weight:700}.ads-lab-pattern-universe{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;margin-bottom:12px;border:1px solid #d7dee8;border-radius:11px;background:#fff}.ads-lab-pattern-universe article{min-width:0;padding:12px 14px;border-right:1px solid #e4e8ee}.ads-lab-pattern-universe article:last-child{border-right:0}.ads-lab-pattern-universe span,.ads-lab-pattern-universe strong,.ads-lab-pattern-universe small{display:block}.ads-lab-pattern-universe span{color:#5f6368;font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.ads-lab-pattern-universe strong{margin:3px 0;color:#15161a;font-size:21px}.ads-lab-pattern-universe small{color:#697386;font-size:11px;line-height:15px}.ads-lab-featured-signal{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(260px,1.2fr);gap:10px 22px;align-items:center;margin-bottom:13px;padding:16px 18px;border:1px solid #b9cef0;border-radius:12px;background:linear-gradient(135deg,#edf4ff,#fff)}.ads-lab-featured-signal div span,.ads-lab-featured-signal div strong{display:block}.ads-lab-featured-signal div span{color:#0b57d0;font-size:10px;font-weight:850;letter-spacing:.07em}.ads-lab-featured-signal div strong{margin-top:4px;color:#15161a;font-size:17px;line-height:22px}.ads-lab-featured-signal p{margin:0;color:#3c4043;font-size:12px;line-height:18px}.ads-lab-featured-signal>small{grid-column:1/-1;color:#5f6368;font-size:11px}.ads-lab-signal-list{display:grid;gap:10px}.ads-lab-signal-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(210px,.65fr);gap:13px 18px;min-width:0;padding:16px 18px;border:1px solid #d7dee8;border-left:4px solid #8aa8d8;border-radius:11px;background:#fff}.ads-lab-signal-row.robusta{border-left-color:#168352}.ads-lab-signal-row.recurrente{border-left-color:#0b57d0}.ads-lab-signal-row.distintiva{border-left-color:#7c3aed}.ads-lab-signal-row.exploratoria{border-left-color:#d97706}.ads-lab-signal-row.indicio{border-left-color:#94a3b8}.ads-lab-signal-main{min-width:0}.ads-lab-signal-title{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.ads-lab-signal-title>span{color:#0b57d0;font-size:10px;font-weight:850;letter-spacing:.07em}.ads-lab-signal-title>i{border-radius:999px;padding:3px 7px;background:#eef2f7;color:#52606f;font-size:10px;font-style:normal;font-weight:750}.ads-lab-signal-row h4{margin:5px 0 7px;color:#15161a;font-size:17px;line-height:22px}.ads-lab-association-note{margin:0 0 9px;color:#5f6368;font-size:11px;line-height:16px}.ads-lab-signal-meter{height:7px;overflow:hidden;border-radius:99px;background:#e7ebf1}.ads-lab-signal-meter>i{display:block;height:100%;max-width:100%;border-radius:inherit;background:#0b57d0}.ads-lab-signal-main>small{display:block;margin-top:6px;color:#5f6368;font-size:11px;line-height:16px}.ads-lab-signal-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0}.ads-lab-signal-metrics div{padding:8px 9px;border-radius:8px;background:#f5f7fa}.ads-lab-signal-metrics dt{color:#697386;font-size:10px}.ads-lab-signal-metrics dd{margin:2px 0 0;color:#15161a;font-size:16px;font-weight:800}.ads-lab-signal-row>blockquote{grid-column:1/-1;margin:0;padding:11px 13px;border:0;border-radius:8px;background:#f7f9fc;color:#3c4043;font-size:12px;line-height:18px}.ads-lab-signal-context{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ads-lab-signal-context span{border-radius:999px;padding:4px 7px;background:#eef2f7;color:#52606f;font-size:10px;font-weight:650}.ads-lab-signal-context span.warning{background:#fff3d6;color:#77530b}.ads-lab-signal-row>footer{display:flex;justify-content:flex-end;gap:7px}.ads-lab-signal-row>footer button{min-height:35px;border:1px solid #0b57d0;border-radius:7px;padding:7px 10px;background:#0b57d0;color:#fff;font-size:11px;font-weight:750}.ads-lab-signal-row>footer button.quiet{border-color:#d7dee8;background:#fff;color:#0b57d0}
.ads-lab-selection-dock{position:sticky;z-index:18;bottom:14px;display:flex;gap:10px;align-items:center;width:min(760px,calc(100% - 32px));margin:0 auto 14px;padding:12px 13px;border:1px solid #b9c8dc;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 14px 38px rgba(15,23,42,.18);backdrop-filter:blur(14px)}.ads-lab-selection-dock>div{min-width:0;flex:1}.ads-lab-selection-dock strong,.ads-lab-selection-dock span{display:block}.ads-lab-selection-dock strong{font-size:13px}.ads-lab-selection-dock span{overflow:hidden;margin-top:2px;color:#5f6368;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ads-lab-selection-dock .ads-lab-dock-notice{display:block;overflow:visible;margin-top:5px;color:#174f9f;font-size:10px;line-height:14px;white-space:normal}.ads-lab-selection-dock button{min-height:38px;border:0;border-radius:8px;padding:8px 12px;background:#0b57d0;color:#fff;font-size:12px;font-weight:750}.ads-lab-selection-dock button.quiet{border:1px solid #d7dee8;background:#fff;color:#3c4043}.ads-lab-selection-dock button:disabled{background:#d8dee8;color:#687386}.ads-lab-primary:disabled{border-color:#d8dee8;background:#d8dee8;color:#687386;cursor:not-allowed}
.ads-lab-thumb.video{position:relative;display:flex;align-items:stretch;background:#101317}.ads-lab-thumb.video>span{z-index:2;top:9px;left:9px;border-radius:5px;padding:4px 6px;background:rgba(9,12,17,.78);color:#fff;pointer-events:none}.ads-lab-thumb video{position:relative;z-index:1;width:100%;height:100%;min-height:280px;object-fit:contain;background:#0b0e12}.ads-lab-open-media{position:absolute;z-index:3;top:8px;right:8px;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:5px 7px;background:rgba(9,12,17,.82);color:#fff;font-size:10px;font-weight:750;text-decoration:none;backdrop-filter:blur(8px)}.ads-lab-open-media:hover{background:#0b57d0}.ads-lab-card-meta i.inactive{background:#f1f3f4;color:#5f6368}.ads-lab-card-links{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:12px;padding:9px;border:1px solid #dce4ef;border-radius:9px;background:#f8faff}.ads-lab-card-links a{min-height:34px;border:1px solid #c9d4e3;border-radius:7px;padding:7px 10px;background:#fff;color:#315f9f;font-size:12px;font-weight:750;line-height:18px;text-decoration:none}.ads-lab-card-links a:hover{border-color:#0b57d0;background:#edf4ff}.ads-lab-card-links a.landing{border-color:#0b57d0;background:#0b57d0;color:#fff}.ads-lab-card-links a.landing:hover{background:#0849ad}
@media(max-width:1280px){.ads-lab-command-shell{position:relative;top:auto}.ads-lab-command-bar{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-command-bar .ads-lab-search{grid-column:1/-1}.ads-lab-command-bar>*{min-width:0}.ads-lab-language-mode{grid-column:auto}.ads-lab-filter-toggle{display:block}.ads-lab-copy-parallel{grid-template-columns:1fr}.ads-lab-card{grid-template-columns:190px minmax(0,1fr)}.ads-lab-thumb{min-height:300px}.ads-lab-pattern-toolbar{align-items:flex-start;flex-direction:column}.ads-lab-weighting{width:100%;justify-content:flex-end}}
@media(max-width:840px){.ads-lab-snapshot{grid-template-columns:repeat(2,minmax(0,1fr));padding:10px 16px}.ads-lab-snapshot article{padding:9px 12px}.ads-lab-snapshot article:nth-child(2){border-right:0}.ads-lab-snapshot article:nth-child(-n+2){border-bottom:1px solid #d7dee8}.ads-lab-snapshot article:nth-child(3){padding-left:0}.ads-lab-market-study{margin:12px 16px}.ads-lab-market-study-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-market-study-metrics article:nth-child(2){border-right:0}.ads-lab-market-study-metrics article:nth-child(-n+2){border-bottom:1px solid #dfe6f0}.ads-lab-quick-presets{padding-left:16px;padding-right:16px}.ads-lab-pattern-view-tabs{grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.ads-lab-pattern-universe{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-pattern-universe article:nth-child(2){border-right:0}.ads-lab-pattern-universe article:nth-child(-n+2){border-bottom:1px solid #e4e8ee}.ads-lab-featured-signal{grid-template-columns:1fr}.ads-lab-featured-signal>small{grid-column:1}.ads-lab-signal-row{grid-template-columns:1fr}.ads-lab-signal-row>blockquote{grid-column:1}.ads-lab-signal-row>footer{justify-content:flex-start}.ads-lab-weighting{justify-content:flex-start}}
@media(max-width:560px){.ads-lab-snapshot{grid-template-columns:1fr}.ads-lab-snapshot article,.ads-lab-snapshot article:nth-child(3){padding:9px 0;border-right:0;border-bottom:1px solid #d7dee8}.ads-lab-snapshot article:last-child{border-bottom:0}.ads-lab-market-study{margin:10px}.ads-lab-market-study>summary{align-items:flex-start;gap:10px;padding:13px}.ads-lab-market-study>summary strong{display:none}.ads-lab-market-study-body{padding:12px}.ads-lab-market-study-metrics,.ads-lab-market-study-copy,.ads-lab-market-clones>div{grid-template-columns:1fr}.ads-lab-market-study-metrics article,.ads-lab-market-study-metrics article:nth-child(2){border-right:0;border-bottom:1px solid #dfe6f0}.ads-lab-market-study-metrics article:last-child{border-bottom:0}.ads-lab-market-clones>header{align-items:flex-start;flex-direction:column}.ads-lab-command-bar{grid-template-columns:1fr}.ads-lab-command-bar>*{grid-column:1}.ads-lab-pattern-head h3{font-size:22px;line-height:28px}.ads-lab-pattern-view-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-pattern-universe{grid-template-columns:1fr}.ads-lab-pattern-universe article,.ads-lab-pattern-universe article:nth-child(2){border-right:0;border-bottom:1px solid #e4e8ee}.ads-lab-pattern-universe article:last-child{border-bottom:0}.ads-lab-weighting{align-items:stretch;flex-wrap:wrap}.ads-lab-weighting>span{width:100%}.ads-lab-signal-row{padding:14px 13px}.ads-lab-signal-row>footer{display:grid;grid-template-columns:1fr}.ads-lab-selection-dock{align-items:stretch;flex-wrap:wrap}.ads-lab-selection-dock>div{width:100%;flex-basis:100%}.ads-lab-selection-dock button{flex:1}.ads-lab-card-links{align-items:stretch;flex-direction:column}.ads-lab-card-links a{text-align:center}.ads-lab-thumb video{min-height:260px}}
@media(prefers-reduced-motion:reduce){.ads-lab *{scroll-behavior:auto!important;transition:none!important}}
`;
