"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { AdCoverageData, AnuncioReal, AnunciosRealesData } from "./data-types";

type LabSection = "explore" | "patterns" | "matrix";
type PatternDimension = "angle" | "promise" | "format" | "cta";

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
  ctaGroup: string;
  patternEligible: boolean;
  hasEvidenceMetadata: boolean;
  searchText: string;
};

type PatternGroup = {
  label: string;
  ads: LabAd[];
  companies: number;
  share: number;
  strength: "amplio" | "repetido" | "indicio";
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

export type AdsLaboratoryProps = {
  /** Si no se pasa, el componente carga /data/ad-corpus.json por sí solo. */
  data?: AnunciosRealesData | null;
  /** Si se omite, intenta cargar /data/ad-coverage.json. `null` desactiva esa carga. */
  coverageData?: AdCoverageData | null;
  onOpenCompany?: (companyId: string) => void;
  initialSection?: LabSection;
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

const PROMISE_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Garantía / riesgo invertido",
    pattern: /garant(?:ía|ia)|devolv|reembols|100\s*%\s*(?:de\s*)?(?:tu\s*)?dinero|sin riesgo|riesgo cero|si no funciona|no cobramos/i,
  },
  {
    label: "Resultado cuantificado",
    pattern: /(?:\d+[\d.,]*|cien|mil)\s*(?:\+|x|%|€|euros?|leads?|contactos?|clientes?|citas?|pacientes?|ventas?|campañas?|reformas?|visitas?|solicitudes?)/i,
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
  angle: "Ángulo",
  promise: "Promesa",
  format: "Formato",
  cta: "CTA",
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

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

const platformLabel = (platform: string) => {
  const value = normalize(platform);
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("meta")) return "Meta";
  if (value.includes("google") || value.includes("transparencia")) return "Google";
  if (value.includes("display")) return "Display";
  return platform.trim() || "Plataforma no indicada";
};

const formatLabel = (ad: AnuncioReal) => {
  const source = normalize(`${ad.plataforma} ${ad.titular} ${ad.texto}`);
  if (/carrusel|carousel/.test(source)) return "Carrusel";
  if (/meme/.test(source)) return "Meme";
  if (/reels?|video|vídeo/.test(source)) return "Vídeo / Reel";
  if (normalize(ad.plataforma) === "google") return "Anuncio de búsqueda";
  if (platformLabel(ad.plataforma) === "Google") return "Google · formato no determinado";
  if (platformLabel(ad.plataforma) === "Display") return "Display estático";
  if (["Meta", "Instagram"].includes(platformLabel(ad.plataforma))) return "Social estático / no determinado";
  return "Formato no determinado";
};

const ctaLabel = (cta: string) => {
  const value = normalize(cta);
  if (!value || /^[-—–]+$/.test(value)) return "Sin CTA visible";
  if (/mas informacion|learn more|saber mas|ver mas|watch/.test(value)) return "Más información";
  if (/whatsapp|mensaje|escrib/.test(value)) return "WhatsApp / mensaje";
  if (/solicitud|contact|presupuesto|cotiza|quote|diagnostico|auditoria|consulta/.test(value)) return "Solicitar / contactar";
  if (/visitar|sitio|web|enlace|abrir|descubr/.test(value)) return "Visitar web";
  if (/comprar|oferta|reserv|book|probar|empieza|comenzar/.test(value)) return "Comprar / reservar / probar";
  if (/descarg/.test(value)) return "Descargar";
  return compact(cta.trim(), 48);
};

const evidenceSnippet = (ad: AnuncioReal, pattern: RegExp) => {
  const segments = [ad.titular, ad.texto, ad.precioVisible].filter(Boolean);
  for (const segment of segments) {
    const match = segment.match(pattern);
    if (!match || match.index === undefined) continue;
    const start = Math.max(0, match.index - 54);
    const end = Math.min(segment.length, match.index + match[0].length + 72);
    return `${start > 0 ? "…" : ""}${segment.slice(start, end).trim()}${end < segment.length ? "…" : ""}`;
  }
  return compact(ad.titular || ad.texto, 140);
};

export const classifyRealAd = (ad: AnuncioReal, index: number): LabAd => {
  const angles = ad.angulo
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  // La promesa se deriva solo del copy literal, nunca de la etiqueta analítica `angulo`.
  const literalCopy = `${ad.titular} ${ad.texto} ${ad.precioVisible}`;
  const promises = PROMISE_RULES.filter((rule) => rule.pattern.test(literalCopy))
    .map((rule) => ({ label: rule.label, evidence: evidenceSnippet(ad, rule.pattern) }));
  const platform = platformLabel(ad.plataforma);
  const format = formatLabel(ad);
  const ctaGroup = ctaLabel(ad.cta);
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
  ].some(hasValue) || ad.aptaPatrones !== undefined;
  return {
    ad,
    key: `${ad.corpusKey || ad.file || ad.externalId || ad.id || "ad"}::${index}`,
    index,
    platform,
    format,
    angles: angles.length ? angles : ["Sin ángulo etiquetado"],
    promises,
    ctaGroup,
    patternEligible,
    hasEvidenceMetadata,
    searchText: normalize(
      [
        ad.name,
        ad.id,
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
        ad.fuenteUrl || "",
        ad.origen || "",
        ad.transcripcion || "",
        hasValue(ad.confianza) ? String(ad.confianza) : "",
        confidenceLabel(ad.confianza),
        ad.estadoEvidencia || "",
        ad.atribucion || "",
        ad.archivoSha256 || "",
        ad.corpusKey || "",
        ad.anunciante || "",
        ad.aptaPatrones === false ? "fuera de patrones no apta" : "apta para patrones",
        ...promises.map((promise) => promise.label),
      ].join(" "),
    ),
  };
};

const valuesForDimension = (ad: LabAd, dimension: PatternDimension) => {
  if (dimension === "angle") return ad.angles;
  if (dimension === "promise")
    return ad.promises.length
      ? ad.promises.map((promise) => promise.label)
      : [NO_PROMISE];
  if (dimension === "format") return [ad.format];
  return [ad.ctaGroup];
};

export const groupRealAds = (
  ads: LabAd[],
  dimension: PatternDimension,
): PatternGroup[] => {
  const groups = new Map<string, LabAd[]>();
  for (const ad of ads) {
    for (const label of valuesForDimension(ad, dimension)) {
      const current = groups.get(label) || [];
      current.push(ad);
      groups.set(label, current);
    }
  }
  return [...groups.entries()]
    .map(([label, groupAds]) => {
      const companies = new Set(groupAds.map((item) => item.ad.id)).size;
      const strength: PatternGroup["strength"] =
        companies >= 5 && groupAds.length >= 8
          ? "amplio"
          : companies >= 3 && groupAds.length >= 4
            ? "repetido"
            : "indicio";
      return {
        label,
        ads: groupAds,
        companies,
        share: ads.length ? Math.round((groupAds.length / ads.length) * 100) : 0,
        strength,
      };
    })
    .sort((a, b) => b.ads.length - a.ads.length || b.companies - a.companies || a.label.localeCompare(b.label, "es"));
};

const patternEvidence = (
  ad: LabAd,
  dimension: PatternDimension,
  label: string,
) => {
  if (dimension === "angle") return `Etiqueta editorial almacenada: “${ad.ad.angulo || "sin ángulo"}”`;
  if (dimension === "promise")
    return ad.promises.find((promise) => promise.label === label)?.evidence || "No se detectó una promesa textual.";
  if (dimension === "format")
    return `Clasificado desde “${ad.ad.plataforma}”${/video|vídeo|reel|meme|carrusel/i.test(`${ad.ad.titular} ${ad.ad.texto}`) ? " y la descripción de la creatividad" : ""}.`;
  return ad.ad.cta ? `CTA literal: “${ad.ad.cta}”` : "La captura no muestra un CTA legible.";
};

const matrixValue = (ad: LabAd, axis: MatrixRow["id"]): MatrixOption => {
  if (axis === "headline")
    return {
      value: ad.ad.titular || "(sin titular visible)",
      source: ad,
      evidence: `Titular transcrito de ${basename(ad.ad.file)}.`,
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
  if (axis === "format")
    return {
      value: ad.format,
      source: ad,
      evidence: `Formato calculado desde “${ad.ad.plataforma}” y el texto visible de la pieza.`,
    };
  return {
    value: ad.ctaGroup,
    source: ad,
    evidence: ad.ad.cta ? `CTA literal: “${ad.ad.cta}”.` : "Sin CTA legible en la captura.",
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
  `${ad.ad.name} · ${ad.ad.file ? basename(ad.ad.file) : ad.ad.externalId || ad.ad.origen || ad.ad.plataforma || "sin archivo local"}${ad.patternEligible ? "" : " · fuera de patrones"}`;

const adAsText = (ad: LabAd) =>
  [
    `${ad.ad.name} — ${ad.ad.titular || "(sin titular visible)"}`,
    ad.ad.texto,
    ad.ad.cta ? `CTA: ${ad.ad.cta}` : "CTA: no visible",
    ad.ad.precioVisible ? `Precio/oferta visible: ${ad.ad.precioVisible}` : "",
    `Ángulo etiquetado: ${ad.ad.angulo || "sin etiqueta"}`,
    `Plataforma: ${ad.ad.plataforma}`,
    ad.ad.externalId ? `ID externo: ${ad.ad.externalId}` : "",
    ad.ad.fuenteUrl ? `Fuente: ${ad.ad.fuenteUrl}` : "",
    ad.ad.origen ? `Origen: ${ad.ad.origen}` : "",
    ad.ad.transcripcion ? `Transcripción: ${ad.ad.transcripcion}` : "",
    hasValue(ad.ad.confianza) ? `Confianza: ${ad.ad.confianza} · ${confidenceLabel(ad.ad.confianza)}` : "",
    ad.ad.estadoEvidencia ? `Estado de evidencia: ${ad.ad.estadoEvidencia}` : "",
    ad.ad.atribucion ? `Atribución: ${ad.ad.atribucion}` : "",
    `Apta para patrones: ${ad.patternEligible ? "sí" : "no"}`,
    ad.ad.archivoSha256 ? `SHA-256: ${ad.ad.archivoSha256}` : "",
    ad.ad.corpusKey ? `Clave de corpus: ${ad.ad.corpusKey}` : "",
    ad.ad.anunciante ? `Anunciante: ${ad.ad.anunciante}` : "",
    `Archivo: ${ad.ad.file || "sin archivo visual local"}`,
  ].filter(Boolean).join("\n");

function EvidenceSource({ ad }: { ad: LabAd }) {
  if (ad.ad.file) {
    return <a href={ad.ad.file} target="_blank" rel="noreferrer">{sourceLine(ad)}</a>;
  }
  if (ad.ad.fuenteUrl && /^https?:\/\//i.test(ad.ad.fuenteUrl)) {
    return <a href={ad.ad.fuenteUrl} target="_blank" rel="noreferrer">{sourceLine(ad)}</a>;
  }
  return <span title="La transcripción no tiene un archivo visual local asociado">{sourceLine(ad)} · sin archivo local</span>;
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
    "LABORATORIO DE ANUNCIOS · MATRIZ DE TEST",
    `Control elegido: ${sourceLine(baseline)}`,
    "Regla: cada fila es un test independiente; no cambiar más de una variable a la vez.",
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
}: AdsLaboratoryProps) {
  const [remoteData, setRemoteData] = useState<AnunciosRealesData | null>(null);
  const [remoteCoverage, setRemoteCoverage] = useState<AdCoverageData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [section, setSection] = useState<LabSection>(initialSection);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState(ALL);
  const [vertical, setVertical] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [angle, setAngle] = useState(ALL);
  const [promise, setPromise] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [cta, setCta] = useState(ALL);
  const [evidenceFilter, setEvidenceFilter] = useState(ALL);
  const [liveOnly, setLiveOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [visible, setVisible] = useState(DEFAULT_VISIBLE);
  const [patternDimension, setPatternDimension] = useState<PatternDimension>("angle");
  const [patternLimit, setPatternLimit] = useState(18);
  const [includeIneligiblePatterns, setIncludeIneligiblePatterns] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [baselineKey, setBaselineKey] = useState("");
  const [notice, setNotice] = useState("");

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
    return {
      platforms: unique(ads.map((ad) => ad.platform)),
      verticals: unique(ads.map((ad) => ad.ad.vertical || "Sin vertical")),
      companies: [...new Map(ads.map((ad) => [ad.ad.id, ad.ad.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")),
      angles: unique(ads.flatMap((ad) => ad.angles)),
      promises: unique([
        ...ads.flatMap((ad) => ad.promises.map((item) => item.label)),
        ...(ads.some((ad) => ad.promises.length === 0) ? [NO_PROMISE] : []),
      ]),
      formats: unique(ads.map((ad) => ad.format)),
      ctas: unique(ads.map((ad) => ad.ctaGroup)),
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
    const normalizedQuery = normalize(query);
    return ads.filter((ad) => {
      if (normalizedQuery && !ad.searchText.includes(normalizedQuery)) return false;
      if (platform !== ALL && ad.platform !== platform) return false;
      if (vertical !== ALL && (ad.ad.vertical || "Sin vertical") !== vertical) return false;
      if (company !== ALL && ad.ad.id !== company) return false;
      if (angle !== ALL && !ad.angles.includes(angle)) return false;
      if (promise !== ALL) {
        if (promise === NO_PROMISE && ad.promises.length > 0) return false;
        if (promise !== NO_PROMISE && !ad.promises.some((item) => item.label === promise)) return false;
      }
      if (format !== ALL && ad.format !== format) return false;
      if (cta !== ALL && ad.ctaGroup !== cta) return false;
      if (!matchesEvidenceFilter(ad, evidenceFilter)) return false;
      if (liveOnly && !ad.ad.capturaEnVivo) return false;
      if (selectedOnly && !selectedSet.has(ad.key)) return false;
      return true;
    });
  }, [ads, angle, company, cta, evidenceFilter, format, liveOnly, platform, promise, query, selectedOnly, selectedSet, vertical]);

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
  const excludedFromPatterns = filteredAds.length - filteredAds.filter((ad) => ad.patternEligible).length;
  const patternGroups = useMemo(
    () => groupRealAds(patternAds, patternDimension),
    [patternAds, patternDimension],
  );

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
      return next;
    });
    setNotice("Muestra añadida a la matriz.");
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
    setPlatform(ALL);
    setVertical(ALL);
    setCompany(ALL);
    setAngle(ALL);
    setPromise(ALL);
    setFormat(ALL);
    setCta(ALL);
    setEvidenceFilter(ALL);
    setLiveOnly(false);
    setSelectedOnly(false);
    setVisible(DEFAULT_VISIBLE);
  };

  const openPattern = (dimension: PatternDimension, label: string) => {
    if (dimension === "angle") setAngle(label);
    if (dimension === "promise") setPromise(label);
    if (dimension === "format") setFormat(label);
    if (dimension === "cta") setCta(label);
    setEvidenceFilter(includeIneligiblePatterns ? ALL : EVIDENCE_ELIGIBLE);
    setSection("explore");
    setVisible(DEFAULT_VISIBLE);
  };

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
      <header className="ads-lab-hero">
        <div>
          <p className="ads-lab-kicker">LABORATORIO DE ANUNCIOS · EVIDENCIA REAL</p>
          <h2 id="ads-lab-title">Encuentra patrones. Diseña el test. Demuestra el ganador.</h2>
          <p>
            Cada patrón abre sus capturas de origen. La frecuencia sirve para priorizar pruebas;
            nunca se presenta como rendimiento demostrado.
          </p>
        </div>
        <div className="ads-lab-selection" aria-live="polite">
          <span>SELECCIÓN</span>
          <strong>{selectedAds.length}/{MAX_SELECTION}</strong>
          <button type="button" onClick={() => setSection("matrix")} disabled={selectedAds.length < 2}>
            Crear matriz
          </button>
        </div>
      </header>

      <div className="ads-lab-kpis" aria-label="Cobertura de la base">
        <article><span>Piezas transcritas</span><strong>{ads.length}</strong><small>{ads.filter((ad) => ad.ad.capturaEnVivo).length} registros en vivo</small></article>
        <article><span>Empresas cubiertas</span><strong>{coverage.totalCompanies}</strong><small>{coverage.oneAd} con una sola pieza</small></article>
        <article className={coverage.withFive ? "is-good" : "is-warning"}><span>Con 5+ piezas</span><strong>{coverage.withFive}</strong><small>{coverage.withTen} ya alcanzan 10</small></article>
        <article><span>Con archivo visual</span><strong>{ads.filter((ad) => Boolean(ad.ad.file)).length}</strong><small>{ads.filter((ad) => !ad.ad.file).length} solo transcritas</small></article>
      </div>

      {coverage.withFive < coverage.totalCompanies && (
        <details className="ads-lab-coverage">
          <summary>
            <span>COBERTURA PENDIENTE</span>
            <strong>
              Faltan {coverage.missingToFive} piezas para llegar a 5 por empresa · {coverage.missingToTen} para llegar a 10
            </strong>
          </summary>
          <p>
            Ahora mismo {coverage.totalCompanies - coverage.withFive} de {coverage.totalCompanies} empresas no alcanzan cinco capturas.
            Los patrones del portal son observaciones de mercado, no “ganadores”, hasta incorporar datos de rendimiento.
          </p>
          <div className="ads-lab-coverage-list">
            {coverage.rows.slice(0, 24).map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => { resetFilters(); setCompany(row.id); setSection("explore"); }}
              >
                <span>{row.name}</span><b>{row.count}/5</b><i style={{ width: `${Math.min(100, row.count * 20)}%` }} />
              </button>
            ))}
          </div>
        </details>
      )}

      {globalCoverage && globalCoverageStats && (
        <details className="ads-lab-global-coverage">
          <summary>
            <span>COBERTURA GLOBAL · {globalCoverage.generatedAt}</span>
            <strong>{globalCoverage.totalCompanies} fichas revisadas · {globalCoverage.summary.companiesWithEvidence} con evidencia individualizable</strong>
          </summary>
          <div>
            <article><span>Fichas revisadas</span><b>{globalCoverage.totalCompanies}</b><small>universo completo</small></article>
            <article><span>Evidencia disponible</span><b>{globalCoverageStats.availableEvidence}</b><small>registros individualizables brutos</small></article>
            <article><span>Muestra de cobertura</span><b>{globalCoverageStats.sampledEvidence}</b><small>máximo 10 por ficha con evidencia</small></article>
            <article><span>Texto en el corpus</span><b>{ads.length}</b><small>{globalCoverageStats.corpusCompanies} empresas buscables</small></article>
            <article><span>Base de patrones</span><b>{globalCoverageStats.patternReady}</b><small>excluye evidencia no apta</small></article>
          </div>
          <p>
            El corpus aporta {globalCoverageStats.targetReached} de {globalCoverageStats.sampledEvidence} piezas al objetivo por empresa; faltan {globalCoverageStats.corpusTargetGap} para cubrir esa muestra. Las {globalCoverage.summary.transcribedCanonical} transcripciones canónicas del inventario previo se conservan como referencia enlazada, no como medida del corpus nuevo.
          </p>
          <p className="ads-lab-coverage-caution">
            {globalCoverageStats.pending} fichas “pendiente/no atribuible” no significan cero anuncios: todavía no permiten asignar evidencia con rigor. Solo {globalCoverageStats.noEvidence} están clasificadas como “sin evidencia”.
          </p>
          <p>{globalCoverage.note}</p>
        </details>
      )}

      <div className="ads-lab-tabs" role="tablist" aria-label="Secciones del laboratorio">
        {([
          ["explore", "Explorar piezas"],
          ["patterns", "Patrones trazables"],
          ["matrix", `Matriz de tests (${selectedAds.length})`],
        ] as Array<[LabSection, string]>).map(([id, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? "active" : ""}
            key={id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {(section === "explore" || section === "patterns") && (
        <div className="ads-lab-filters">
          <label className="ads-lab-search">
            <span>Buscar en todo el texto</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="garantía, WhatsApp, 10 €, exclusivo, nombre…"
            />
          </label>
          <label><span>Empresa</span><select value={company} onChange={(event) => setCompany(event.target.value)}><option value={ALL}>Todas</option>{options.companies.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
          <label><span>Plataforma</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value={ALL}>Todas</option>{options.platforms.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Vertical</span><select value={vertical} onChange={(event) => setVertical(event.target.value)}><option value={ALL}>Todas</option>{options.verticals.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Ángulo</span><select value={angle} onChange={(event) => setAngle(event.target.value)}><option value={ALL}>Todos</option>{options.angles.map((item) => <option value={item} key={item}>{sentenceCase(item)}</option>)}</select></label>
          <label><span>Promesa detectada</span><select value={promise} onChange={(event) => setPromise(event.target.value)}><option value={ALL}>Todas</option>{options.promises.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Formato</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value={ALL}>Todos</option>{options.formats.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>CTA</span><select value={cta} onChange={(event) => setCta(event.target.value)}><option value={ALL}>Todos</option>{options.ctas.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Calidad / evidencia</span><select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}>{options.evidence.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <div className="ads-lab-checks">
            <label><input type="checkbox" checked={liveOnly} onChange={(event) => setLiveOnly(event.target.checked)} /> Solo en vivo</label>
            <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} /> Solo selección</label>
          </div>
          <button type="button" className="ads-lab-reset" onClick={resetFilters}>Limpiar filtros</button>
        </div>
      )}

      {section === "explore" && (
        <div className="ads-lab-panel" role="tabpanel">
          <div className="ads-lab-result-head">
            <div>
              <strong>{filteredAds.length} piezas</strong>
              <span> · {new Set(filteredAds.map((ad) => ad.ad.id)).size} empresas · {filteredAds.filter((ad) => ad.patternEligible).length} aptas para patrones</span>
            </div>
            <div>
              <button type="button" onClick={() => addAdsToSelection(filteredAds.slice(0, 4))} disabled={!filteredAds.length}>Seleccionar muestra de 4</button>
              {selectedAds.length > 0 && <button type="button" className="quiet" onClick={() => setSelectedKeys([])}>Vaciar selección</button>}
            </div>
          </div>
          {filteredAds.length ? (
            <div className="ads-lab-grid">
              {filteredAds.slice(0, visible).map((item) => {
                const selected = selectedSet.has(item.key);
                const isBaseline = effectiveBaselineKey === item.key;
                return (
                  <article className={`ads-lab-card${selected ? " selected" : ""}${item.patternEligible ? "" : " ineligible"}`} key={item.key}>
                    {item.ad.file ? (
                      <a className="ads-lab-thumb" href={item.ad.file} target="_blank" rel="noreferrer" aria-label={`Abrir captura de ${item.ad.name}`}>
                        <span>ABRIR CAPTURA</span>
                        <img src={item.ad.file} alt={`Anuncio de ${item.ad.name}: ${item.ad.titular}`} loading="lazy" />
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
                        <span>{item.platform}</span>
                        {item.ad.fecha && <span>{item.ad.fecha}</span>}
                        {item.ad.capturaEnVivo && <i>EN VIVO</i>}
                      </div>
                      <div className="ads-lab-evidence-badges" aria-label="Calidad de la evidencia">
                        <span className={item.patternEligible ? "eligible" : "ineligible"}>
                          {item.patternEligible ? (item.ad.aptaPatrones === true ? "APTA PARA PATRONES" : "LEGADO · NO EXCLUIDA") : "FUERA DE PATRONES"}
                        </span>
                        {hasValue(item.ad.confianza) && <span>Confianza · {item.ad.confianza} · {confidenceLabel(item.ad.confianza)}</span>}
                        {item.ad.estadoEvidencia && <span>Estado · {item.ad.estadoEvidencia}</span>}
                        {item.ad.atribucion && <span>Atribución · {item.ad.atribucion}</span>}
                        {item.ad.externalId && <span>ID externo verificado</span>}
                        {item.ad.fuenteUrl && <span>Fuente enlazada</span>}
                        {item.ad.file && <span>Archivo visual</span>}
                        {!item.hasEvidenceMetadata && <span>Sin metadatos de evidencia</span>}
                      </div>
                      <h3>{item.ad.titular || "(sin titular visible)"}</h3>
                      <p>{item.ad.texto || "(sin cuerpo visible en la captura)"}</p>
                      {item.ad.precioVisible && <blockquote>{item.ad.precioVisible}</blockquote>}
                      <div className="ads-lab-tags">
                        {item.angles.map((tag) => <span key={tag}>Ángulo · {tag}</span>)}
                        {item.promises.map((tag) => <span className="promise" key={tag.label} title={tag.evidence}>Promesa · {tag.label}</span>)}
                        <span>Formato · {item.format}</span>
                        <span title={`Grupo normalizado: ${item.ctaGroup}`}>CTA · {compact(item.ad.cta || "Sin CTA visible", 58)}</span>
                      </div>
                      <details className="ads-lab-transcript">
                        <summary>Ver transcripción y campos exactos</summary>
                        <p>{item.ad.texto || "(sin cuerpo visible en la captura)"}</p>
                        <small><b>CTA:</b> {item.ad.cta || "no visible"}</small>
                        <small><b>Plataforma:</b> {item.ad.plataforma}</small>
                        {item.ad.externalId && <small><b>ID externo:</b> {item.ad.externalId}</small>}
                        {item.ad.origen && <small><b>Origen:</b> {item.ad.origen}</small>}
                        {item.ad.anunciante && <small><b>Anunciante:</b> {item.ad.anunciante}</small>}
                        {item.ad.corpusKey && <small><b>Clave de corpus:</b> {item.ad.corpusKey}</small>}
                        {item.ad.transcripcion && <small><b>Transcripción:</b> {item.ad.transcripcion}</small>}
                        {item.ad.fuenteUrl && /^https?:\/\//i.test(item.ad.fuenteUrl) && <a href={item.ad.fuenteUrl} target="_blank" rel="noreferrer">Abrir fuente verificable</a>}
                        {item.ad.archivoSha256 && <small title={item.ad.archivoSha256}><b>SHA-256:</b> {compact(item.ad.archivoSha256, 24)}</small>}
                        <button type="button" onClick={() => copyText(adAsText(item), "Transcripción copiada.")}>Copiar transcripción</button>
                      </details>
                      <footer>
                        <small>{item.ad.file ? basename(item.ad.file) : item.ad.externalId || "sin archivo visual"}</small>
                        <button type="button" className={selected ? "remove" : ""} aria-pressed={selected} onClick={() => toggleSelected(item.key)}>
                          {selected ? (isBaseline ? "Control · quitar" : "Seleccionado · quitar") : "+ Matriz"}
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
        <div className="ads-lab-panel" role="tabpanel">
          <div className="ads-lab-pattern-head">
            <div>
              <p className="ads-lab-kicker">AGRUPACIÓN DINÁMICA · {patternAds.length} PIEZAS EN LA BASE ANALÍTICA</p>
              <h3>Patrones por {DIMENSION_LABELS[patternDimension].toLocaleLowerCase("es")}</h3>
              <p>
                El ángulo usa la etiqueta editorial guardada y el CTA conserva el texto literal. Promesa y formato se calculan con reglas visibles en cada evidencia.
              </p>
            </div>
            <div role="tablist" aria-label="Dimensión del patrón">
              {(Object.keys(DIMENSION_LABELS) as PatternDimension[]).map((dimension) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={patternDimension === dimension}
                  className={patternDimension === dimension ? "active" : ""}
                  key={dimension}
                  onClick={() => { setPatternDimension(dimension); setPatternLimit(18); }}
                >
                  {DIMENSION_LABELS[dimension]}
                </button>
              ))}
            </div>
          </div>
          <div className="ads-lab-pattern-scope">
            <div>
              <strong>{patternAds.length} de {filteredAds.length} piezas filtradas entran en los recuentos</strong>
              <p>
                Por defecto se excluye toda pieza con <code>aptaPatrones=false</code>. Las piezas antiguas sin ese campo siguen incluidas para conservar compatibilidad, pero aparecen marcadas como legado.
              </p>
            </div>
            <label>
              <input type="checkbox" checked={includeIneligiblePatterns} onChange={(event) => setIncludeIneligiblePatterns(event.target.checked)} />
              Incluir {excludedFromPatterns} excluidas bajo mi criterio
            </label>
          </div>
          {patternGroups.length ? <div className="ads-lab-pattern-grid">
            {patternGroups.slice(0, patternLimit).map((group) => {
              const sample = group.ads[0];
              return (
                <article key={group.label} className={`ads-lab-pattern ${group.strength}`}>
                  <header><span>{group.label === NO_PROMISE || /no determinado|sin ángulo etiquetado/i.test(group.label) ? "SIN CLASIFICAR" : group.label === "Sin CTA visible" ? "AUSENCIA OBSERVADA" : group.strength === "amplio" ? "PATRÓN AMPLIO" : group.strength === "repetido" ? "PATRÓN REPETIDO" : "INDICIO"}</span><strong>{group.ads.length}</strong></header>
                  <h4>{sentenceCase(group.label)}</h4>
                  <dl><div><dt>Empresas</dt><dd>{group.companies}</dd></div><div><dt>Cuota</dt><dd>{group.share}%</dd></div><div><dt>Base apta</dt><dd>{patternAds.length}</dd></div></dl>
                  <div className="ads-lab-proof">
                    <q>{compact(patternEvidence(sample, patternDimension, group.label), 180)}</q>
                    <EvidenceSource ad={sample} />
                  </div>
                  <footer>
                    <button type="button" onClick={() => openPattern(patternDimension, group.label)}>Ver {group.ads.length} evidencias</button>
                    <button type="button" className="quiet" onClick={() => addAdsToSelection(group.ads.slice(0, 4))}>+ Muestra</button>
                  </footer>
                </article>
              );
            })}
          </div> : <div className="ads-lab-empty"><strong>No hay piezas aptas para patrones con estos filtros.</strong><p>Puedes cambiar la calidad de evidencia o incluir manualmente las piezas excluidas.</p></div>}
          {patternLimit < patternGroups.length && <button type="button" className="ads-lab-more" onClick={() => setPatternLimit(patternGroups.length)}>Mostrar los {patternGroups.length} patrones</button>}
        </div>
      )}

      {section === "matrix" && (
        <div className="ads-lab-panel" role="tabpanel">
          <div className="ads-lab-matrix-head">
            <div>
              <p className="ads-lab-kicker">TEST A/B/C · UNA VARIABLE CADA VEZ</p>
              <h3>Matriz construida con capturas seleccionadas</h3>
              <p>Los ingredientes proceden de piezas reales. La medición propuesta es metodología de test, no un dato observado.</p>
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
              <p>Elige piezas con ángulos, promesas, formatos o CTA distintos para crear retadores trazables.</p>
              <button type="button" onClick={() => setSection("explore")}>Ir a explorar</button>
            </div>
          ) : (
            <>
              {selectedAds.some((ad) => !ad.patternEligible) && (
                <p className="ads-lab-quality-warning">
                  Esta selección contiene {selectedAds.filter((ad) => !ad.patternEligible).length} pieza(s) marcadas como no aptas para patrones. Se mantienen porque las seleccionaste de forma explícita; revisa su atribución antes de ejecutar el test.
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
                      <header><div><span>TEST AISLADO</span><h4>{row.label}</h4><p>{row.instruction}</p></div><button type="button" onClick={() => copyText(matrixAsText(baseline, [row]), `Brief de ${row.label} copiado.`)}>Copiar brief</button></header>
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
              ) : <div className="ads-lab-empty"><strong>Las piezas seleccionadas no aportan variables distintas.</strong><button type="button" onClick={() => setSection("explore")}>Añadir otras piezas</button></div>}
              {matrix.length > 0 && (
                <div className="ads-lab-brief-bar">
                  <div><strong>{matrix.length} tests listos</strong><span>Cada alternativa conserva su fuente y evidencia textual.</span></div>
                  <button type="button" onClick={() => copyText(matrixAsText(baseline, matrix), "Matriz completa copiada.")}>Copiar matriz completa</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="ads-lab-method">
        <b>Método:</b> no se inventan CTR, CPL, ROAS ni conversiones. Los recuentos de Patrones excluyen por defecto <code>aptaPatrones=false</code>; “ganador” queda reservado al resultado de un test controlado.
      </p>
      <div className="ads-lab-toast" aria-live="polite">{notice}</div>
    </section>
  );
}

const LAB_CSS = String.raw`
.ads-lab{--lab-blue:var(--green,#0b57d0);--lab-blue2:var(--green2,#1a73e8);--lab-ink:var(--ink,#15161a);--lab-muted:var(--muted,#62656b);--lab-line:var(--line,#dbe2ec);--lab-pale:var(--pale,#f0f4fb);position:relative;border:1px solid var(--lab-line);border-radius:20px;overflow:hidden;background:#f7f9fc;color:var(--lab-ink);box-shadow:0 18px 55px rgba(29,35,48,.08)}
.ads-lab *{box-sizing:border-box}.ads-lab button,.ads-lab input,.ads-lab select{font:inherit}.ads-lab button:focus-visible,.ads-lab input:focus-visible,.ads-lab select:focus-visible,.ads-lab a:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px #0b57d0}.ads-lab button:disabled{cursor:not-allowed;opacity:.45}.ads-lab-loading{min-height:190px;display:grid;place-items:center;color:var(--lab-muted)}
.ads-lab-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px;align-items:center;padding:34px 38px;background:radial-gradient(circle at 82% 0,rgba(66,127,225,.28),transparent 35%),#17191e;color:#f5f8ff}.ads-lab-kicker{margin:0 0 10px;font-size:10px;letter-spacing:.15em;font-weight:900;color:#78a7ef}.ads-lab-hero h2{max-width:780px;margin:0;font-size:clamp(26px,3vw,42px);line-height:1.04;letter-spacing:-.045em}.ads-lab-hero>div>p:last-child{max-width:720px;margin:14px 0 0;font-size:13px;line-height:1.6;color:#bdc5d2}.ads-lab-selection{min-width:135px;padding:17px;border:1px solid #3d424c;border-radius:14px;background:rgba(255,255,255,.05);text-align:center}.ads-lab-selection span,.ads-lab-selection strong{display:block}.ads-lab-selection span{font-size:9px;letter-spacing:.14em;color:#9fa8b8;font-weight:850}.ads-lab-selection strong{margin:5px 0 9px;font-size:28px}.ads-lab-selection button{border:0;border-radius:8px;padding:9px 12px;background:#4b83df;color:#fff;font-size:11px;font-weight:850}
.ads-lab-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#fff;border-bottom:1px solid var(--lab-line)}.ads-lab-kpis article{padding:18px 22px;border-right:1px solid var(--lab-line)}.ads-lab-kpis article:last-child{border-right:0}.ads-lab-kpis span,.ads-lab-kpis strong,.ads-lab-kpis small{display:block}.ads-lab-kpis span{font-size:9px;letter-spacing:.08em;color:var(--lab-muted);font-weight:850}.ads-lab-kpis strong{margin:5px 0 2px;font-size:27px;letter-spacing:-.04em}.ads-lab-kpis small{font-size:10px;color:var(--lab-muted)}.ads-lab-kpis .is-warning strong{color:#b45309}.ads-lab-kpis .is-good strong{color:#167044}
.ads-lab-coverage{margin:18px 24px 0;border:1px solid #efd49d;border-radius:13px;background:#fff9eb}.ads-lab-coverage summary{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.ads-lab-coverage summary span{padding:4px 7px;border-radius:99px;background:#f7dfad;color:#775109;font-size:9px;font-weight:900;letter-spacing:.07em}.ads-lab-coverage summary strong{font-size:12px}.ads-lab-coverage>p{margin:0;padding:0 16px 12px;max-width:900px;font-size:11px;line-height:1.55;color:#685e4c}.ads-lab-coverage-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:0 16px 16px}.ads-lab-coverage-list button{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:8px;padding:9px 10px 12px;border:1px solid #eadbbd;border-radius:8px;background:#fff;text-align:left;font-size:10px}.ads-lab-coverage-list button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ads-lab-coverage-list button b{color:#8a5c0b}.ads-lab-coverage-list button i{position:absolute;inset:auto auto 0 0;height:3px;background:#e4a932}
.ads-lab-tabs{display:flex;gap:7px;padding:20px 24px 0}.ads-lab-tabs button,.ads-lab-pattern-head [role=tablist] button{border:1px solid var(--lab-line);border-radius:99px;padding:9px 14px;background:#fff;color:var(--lab-ink);font-size:11px;font-weight:800}.ads-lab-tabs button.active,.ads-lab-pattern-head [role=tablist] button.active{border-color:var(--lab-ink);background:var(--lab-ink);color:#fff}
.ads-lab-filters{display:grid;grid-template-columns:2fr repeat(3,minmax(135px,1fr));gap:9px;margin:16px 24px 0;padding:15px;border:1px solid var(--lab-line);border-radius:14px;background:#fff}.ads-lab-filters label>span,.ads-lab-matrix-head label>span{display:block;margin:0 0 6px;font-size:9px;letter-spacing:.07em;color:var(--lab-muted);font-weight:850}.ads-lab-filters input[type=search],.ads-lab-filters select,.ads-lab-matrix-head select{width:100%;min-width:0;height:38px;border:1px solid var(--lab-line);border-radius:8px;background:#fff;padding:8px 10px;color:var(--lab-ink);font-size:11px}.ads-lab-checks{display:flex;gap:12px;align-items:center;flex-wrap:wrap;grid-column:span 2}.ads-lab-checks label{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--lab-muted);font-weight:750}.ads-lab-reset{justify-self:end;align-self:end;border:0;border-radius:8px;padding:10px 13px;background:#edf1f7;color:var(--lab-ink);font-size:10px;font-weight:800}
.ads-lab-panel{padding:22px 24px 28px}.ads-lab-result-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;font-size:11px}.ads-lab-result-head span{color:var(--lab-muted)}.ads-lab-result-head>div:last-child{display:flex;gap:7px}.ads-lab-result-head button,.ads-lab-pattern footer button,.ads-lab-test header button,.ads-lab-selected-strip button{border:0;border-radius:8px;padding:8px 10px;background:var(--lab-blue);color:#fff;font-size:10px;font-weight:800}.ads-lab button.quiet,.ads-lab-pattern footer button.quiet{border:1px solid var(--lab-line);background:#fff;color:var(--lab-ink)}
.ads-lab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ads-lab-card{display:grid;grid-template-columns:145px minmax(0,1fr);min-width:0;min-height:290px;border:1px solid var(--lab-line);border-radius:14px;overflow:hidden;background:#fff;transition:border-color .16s,box-shadow .16s,transform .16s}.ads-lab-card:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(26,35,50,.09)}.ads-lab-card.selected{border-color:#2c69c8;box-shadow:0 0 0 2px rgba(44,105,200,.12)}.ads-lab-thumb{position:relative;display:grid;place-items:center;min-height:100%;overflow:hidden;background:repeating-linear-gradient(135deg,#edf1f6,#edf1f6 8px,#f7f9fb 8px,#f7f9fb 16px);color:#596273;text-decoration:none}.ads-lab-thumb>span{position:absolute;z-index:0;font-size:9px;font-weight:900;letter-spacing:.08em}.ads-lab-thumb img{position:relative;z-index:1;width:100%;height:100%;max-height:390px;object-fit:contain;background:#eef1f5}.ads-lab-thumb:hover img{opacity:.9}.ads-lab-card-body{display:flex;min-width:0;flex-direction:column;padding:14px}.ads-lab-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ads-lab-card-meta button,.ads-lab-card-meta b{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;padding:0;color:var(--lab-blue);font-size:10px;font-weight:900}.ads-lab-card-meta span,.ads-lab-card-meta i{padding:3px 6px;border-radius:99px;background:#edf1f7;color:#586170;font-size:8px;font-style:normal;font-weight:800}.ads-lab-card-meta i{background:#e6f4ea;color:#17683e}.ads-lab-card h3{margin:9px 0 6px;font-size:14px;line-height:1.35}.ads-lab-card-body>p{display:-webkit-box;margin:0 0 8px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:5;font-size:11px;line-height:1.55;color:#545963}.ads-lab-card blockquote{margin:0 0 8px;padding:7px 9px;border-left:3px solid #d49a29;background:#fff8e8;font-size:10px;line-height:1.45;color:#67552d}.ads-lab-tags{display:flex;gap:5px;flex-wrap:wrap}.ads-lab-tags span{padding:4px 6px;border-radius:6px;background:#eff3f8;color:#555f6e;font-size:8px;line-height:1.25}.ads-lab-tags span.promise{background:#eaf1fc;color:#174d9e}.ads-lab-card footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:11px}.ads-lab-card footer small{overflow:hidden;color:var(--lab-muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.ads-lab-card footer button{flex:none;border:0;border-radius:8px;padding:8px 10px;background:var(--lab-ink);color:#fff;font-size:9px;font-weight:850}.ads-lab-card footer button.remove{background:#e9f0fb;color:#164d9f}
.ads-lab-more{display:block;margin:20px auto 0;border:0;border-radius:9px;padding:11px 16px;background:var(--lab-blue);color:#fff;font-size:11px;font-weight:850}.ads-lab-empty{display:grid;place-items:center;gap:10px;min-height:210px;padding:30px;border:1px dashed #bdc6d4;border-radius:13px;background:#fff;text-align:center;color:var(--lab-muted)}.ads-lab-empty button{border:0;border-radius:8px;padding:9px 13px;background:var(--lab-blue);color:#fff;font-size:10px;font-weight:800}.ads-lab-empty p{max-width:570px;margin:0;font-size:11px;line-height:1.55}
.ads-lab-pattern-head,.ads-lab-matrix-head{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:16px}.ads-lab-pattern-head h3,.ads-lab-matrix-head h3{margin:0;font-size:23px;letter-spacing:-.03em}.ads-lab-pattern-head>div>p:last-child,.ads-lab-matrix-head>div>p:last-child{max-width:690px;margin:7px 0 0;font-size:11px;line-height:1.55;color:var(--lab-muted)}.ads-lab-pattern-head [role=tablist]{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.ads-lab-pattern-head [role=tablist] button{padding:7px 10px;font-size:10px}.ads-lab-pattern-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.ads-lab-pattern{display:flex;min-width:0;flex-direction:column;padding:15px;border:1px solid var(--lab-line);border-radius:13px;background:#fff}.ads-lab-pattern.repetido{border-top:3px solid #6d96d7}.ads-lab-pattern.amplio{border-top:3px solid #167044}.ads-lab-pattern header{display:flex;justify-content:space-between;align-items:center}.ads-lab-pattern header span{font-size:8px;letter-spacing:.1em;color:#7c838f;font-weight:900}.ads-lab-pattern header strong{font-size:24px;color:var(--lab-blue)}.ads-lab-pattern h4{min-height:36px;margin:5px 0 9px;font-size:14px;line-height:1.3}.ads-lab-pattern dl{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:0}.ads-lab-pattern dl div{padding:7px;border-radius:7px;background:#f2f5f9}.ads-lab-pattern dt{font-size:7px;color:var(--lab-muted);text-transform:uppercase}.ads-lab-pattern dd{margin:3px 0 0;font-size:12px;font-weight:850}.ads-lab-proof{display:flex;min-height:105px;flex-direction:column;margin:11px 0;padding:10px;border-left:3px solid #7b9ed5;background:#f3f6fb}.ads-lab-proof q{font-size:10px;line-height:1.5;color:#4e5560}.ads-lab-proof a{margin-top:auto;padding-top:7px;color:var(--lab-blue);font-size:8px;font-weight:800;text-decoration:none}.ads-lab-pattern footer{display:flex;gap:6px;margin-top:auto}
.ads-lab-matrix-head label{width:min(330px,42%)}.ads-lab-selected-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 13px}.ads-lab-selected-strip article{flex:0 0 235px;padding:11px;border:1px solid var(--lab-line);border-radius:10px;background:#fff}.ads-lab-selected-strip article.control{border-color:#2b65bf;background:#eff5ff}.ads-lab-selected-strip span,.ads-lab-selected-strip b,.ads-lab-selected-strip small{display:block}.ads-lab-selected-strip span{font-size:7px;letter-spacing:.09em;color:var(--lab-blue);font-weight:900}.ads-lab-selected-strip b{margin:5px 0;font-size:11px}.ads-lab-selected-strip small{min-height:29px;font-size:9px;line-height:1.4;color:var(--lab-muted)}.ads-lab-selected-strip div{display:flex;gap:5px;margin-top:8px}.ads-lab-selected-strip button{padding:6px 7px;background:#eef2f7;color:#4d5561;font-size:8px}.ads-lab-selected-strip article.control button:first-child{background:var(--lab-blue);color:#fff}.ads-lab-tests{display:grid;gap:12px}.ads-lab-test{overflow:hidden;border:1px solid var(--lab-line);border-radius:14px;background:#fff}.ads-lab-test>header{display:flex;justify-content:space-between;gap:16px;padding:15px 17px;border-bottom:1px solid var(--lab-line)}.ads-lab-test header span{font-size:8px;letter-spacing:.1em;color:var(--lab-blue);font-weight:900}.ads-lab-test h4{margin:4px 0;font-size:17px}.ads-lab-test header p{margin:0;font-size:10px;color:var(--lab-muted)}.ads-lab-test header button{align-self:center;white-space:nowrap;background:#eef3fb;color:#174f9f}.ads-lab-variants{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.ads-lab-variants section{min-width:0;padding:15px;border-right:1px solid var(--lab-line);background:#fff}.ads-lab-variants section:last-child{border-right:0}.ads-lab-variants section.control{background:#f0f5fd}.ads-lab-variants span{font-size:8px;letter-spacing:.1em;color:#5e6876;font-weight:900}.ads-lab-variants h5{margin:8px 0;font-size:13px;line-height:1.4}.ads-lab-variants p{min-height:48px;margin:0 0 9px;font-size:9px;line-height:1.5;color:var(--lab-muted)}.ads-lab-variants a{color:var(--lab-blue);font-size:8px;font-weight:800;text-decoration:none}.ads-lab-test>footer{display:flex;gap:10px;align-items:center;padding:10px 16px;background:#f6f8fb}.ads-lab-test>footer span{font-size:8px;letter-spacing:.1em;color:var(--lab-muted);font-weight:900}.ads-lab-test>footer p{margin:0;font-size:10px}.ads-lab-brief-bar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:14px;padding:16px;border-radius:12px;background:#17191e;color:#fff}.ads-lab-brief-bar strong,.ads-lab-brief-bar span{display:block}.ads-lab-brief-bar strong{font-size:14px}.ads-lab-brief-bar span{margin-top:4px;font-size:9px;color:#aeb7c6}.ads-lab-brief-bar button{border:0;border-radius:9px;padding:10px 14px;background:#4c83dc;color:#fff;font-size:10px;font-weight:850}
.ads-lab-global-coverage{margin:10px 24px 0;border:1px solid #cbd9ee;border-radius:13px;background:#f2f6fd}.ads-lab-global-coverage summary{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.ads-lab-global-coverage summary span{padding:4px 7px;border-radius:99px;background:#dce8fa;color:#174f9e;font-size:9px;font-weight:900;letter-spacing:.07em}.ads-lab-global-coverage summary strong{font-size:12px}.ads-lab-global-coverage>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:0 16px 10px}.ads-lab-global-coverage article{padding:10px;border:1px solid #d7e2f2;border-radius:9px;background:#fff}.ads-lab-global-coverage article span,.ads-lab-global-coverage article b,.ads-lab-global-coverage article small{display:block}.ads-lab-global-coverage article span{font-size:8px;color:var(--lab-muted);font-weight:850;text-transform:uppercase}.ads-lab-global-coverage article b{margin:4px 0;font-size:18px}.ads-lab-global-coverage article small{font-size:9px;color:var(--lab-muted)}.ads-lab-global-coverage>p{margin:0;padding:0 16px 10px;font-size:10px;line-height:1.5;color:#596477}.ads-lab-global-coverage>p:last-child{padding-bottom:13px}.ads-lab-global-coverage .ads-lab-coverage-caution{margin:0 16px 10px;padding:9px 10px;border:1px solid #e5c67a;border-radius:8px;background:#fff8df;color:#654d0a;font-weight:750}
.ads-lab-card.ineligible{border-style:dashed;border-color:#d9a768;background:#fffdf8}.ads-lab-evidence-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.ads-lab-evidence-badges span{padding:4px 6px;border-radius:5px;background:#f0f2f5;color:#5e6672;font-size:7px;line-height:1.25;font-weight:850}.ads-lab-evidence-badges span.eligible{background:#e6f4ea;color:#17663d}.ads-lab-evidence-badges span.ineligible{background:#fff0dc;color:#8b5208}.ads-lab-transcript a{display:block;margin:0 9px 8px;color:var(--lab-blue);font-size:9px;font-weight:800;overflow-wrap:anywhere}.ads-lab-pattern-scope{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:14px;padding:13px 15px;border:1px solid #d7e1ef;border-radius:11px;background:#f2f6fc}.ads-lab-pattern-scope strong{font-size:11px}.ads-lab-pattern-scope p{max-width:760px;margin:5px 0 0;font-size:10px;line-height:1.5;color:var(--lab-muted)}.ads-lab-pattern-scope code,.ads-lab-method code{padding:2px 4px;border-radius:4px;background:#e4ebf6;font-size:.95em}.ads-lab-pattern-scope label{display:flex;flex:none;align-items:center;gap:7px;font-size:10px;font-weight:800;color:#775109}.ads-lab-quality-warning{margin:0 0 12px;padding:11px 13px;border-left:3px solid #d68c25;border-radius:0 8px 8px 0;background:#fff5e5;color:#694e2b;font-size:10px;line-height:1.55}.ads-lab-selected-strip article.ineligible{border-style:dashed;border-color:#d5a05c;background:#fffaf1}.ads-lab-selected-strip article.ineligible>span{color:#965c0d}
.ads-lab-transcript{margin-top:9px;border:1px solid #dde4ee;border-radius:8px;background:#fafbfd}.ads-lab-transcript summary{padding:8px 9px;cursor:pointer;color:#315f9f;font-size:9px;font-weight:850}.ads-lab-transcript[open] summary{border-bottom:1px solid #e1e6ee}.ads-lab-transcript p{max-height:210px;overflow:auto;margin:0;padding:9px;font-size:10px;line-height:1.55;color:#4f5661;white-space:pre-wrap}.ads-lab-transcript small{display:block;padding:0 9px 7px;font-size:9px;line-height:1.45;color:#626b78}.ads-lab-transcript button{margin:2px 9px 9px;border:0;border-radius:7px;padding:7px 9px;background:#e8effa;color:#174e9b;font-size:9px;font-weight:850}.ads-lab-thumb.missing{display:flex;flex-direction:column;gap:8px}.ads-lab-thumb.missing>span{position:static}.ads-lab-thumb.missing>small{max-width:115px;text-align:center;font-size:9px;line-height:1.45;color:#747d8b}.ads-lab-proof>span{margin-top:auto;padding-top:7px;color:#687386;font-size:8px;font-weight:800}.ads-lab-variants section>span:last-child{color:#687386;font-size:8px;letter-spacing:0;font-weight:800}
.ads-lab-method{margin:0;padding:13px 24px;border-top:1px solid var(--lab-line);background:#fff;font-size:10px;line-height:1.55;color:var(--lab-muted)}.ads-lab-toast{position:sticky;z-index:4;bottom:12px;min-height:0;margin:0 auto;width:max-content;max-width:calc(100% - 28px);border-radius:99px;background:#17191e;color:#fff;font-size:10px;font-weight:800;box-shadow:0 8px 25px rgba(0,0,0,.2)}.ads-lab-toast:not(:empty){margin-bottom:12px;padding:9px 14px}
@media(max-width:1100px){.ads-lab-grid{grid-template-columns:1fr}.ads-lab-pattern-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.ads-lab-search{grid-column:span 2}.ads-lab-coverage-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.ads-lab-hero{grid-template-columns:1fr;padding:26px 22px}.ads-lab-selection{display:flex;align-items:center;gap:10px;text-align:left}.ads-lab-selection strong{margin:0}.ads-lab-selection button{margin-left:auto}.ads-lab-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-kpis article:nth-child(2){border-right:0}.ads-lab-kpis article:nth-child(-n+2){border-bottom:1px solid var(--lab-line)}.ads-lab-coverage-list,.ads-lab-global-coverage>div{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-tabs{overflow-x:auto}.ads-lab-tabs button{white-space:nowrap}.ads-lab-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.ads-lab-search{grid-column:1/-1}.ads-lab-pattern-head,.ads-lab-matrix-head{align-items:stretch;flex-direction:column}.ads-lab-pattern-head [role=tablist]{justify-content:flex-start}.ads-lab-pattern-scope{align-items:flex-start;flex-direction:column}.ads-lab-matrix-head label{width:100%}.ads-lab-variants{grid-template-columns:1fr}.ads-lab-variants section{border-right:0;border-bottom:1px solid var(--lab-line)}.ads-lab-variants section:last-child{border-bottom:0}}
@media(max-width:520px){.ads-lab-hero h2{font-size:27px}.ads-lab-kpis article{padding:14px}.ads-lab-coverage-list,.ads-lab-global-coverage>div{grid-template-columns:1fr}.ads-lab-tabs,.ads-lab-panel{padding-left:14px;padding-right:14px}.ads-lab-filters{grid-template-columns:1fr;margin-left:14px;margin-right:14px}.ads-lab-search,.ads-lab-checks{grid-column:auto}.ads-lab-card{grid-template-columns:1fr}.ads-lab-thumb{height:210px}.ads-lab-pattern-grid{grid-template-columns:1fr}.ads-lab-result-head{align-items:flex-start;flex-direction:column}.ads-lab-brief-bar{align-items:flex-start;flex-direction:column}}
@media(prefers-reduced-motion:reduce){.ads-lab *{scroll-behavior:auto!important;transition:none!important}}
`;
