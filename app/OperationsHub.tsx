"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdCoverageData,
  AdCoverageItem,
  AnuncioReal,
  AnunciosRealesData,
  Company,
} from "./data-types";
import ExperimentPanel from "./ExperimentPanel";
import OcrReviewPanel from "./OcrReviewPanel";
import OperationFactoryPanel from "./OperationFactoryPanel";
import {
  defaultOperationContext,
  evaluateExperiment,
  type Experiment,
  type OperationContext,
  type OperationsTab,
  type ReviewState,
} from "./operations-model";
import {
  loadOperationsWorkspace,
  saveOperationsWorkspace,
} from "./operations-storage";
import styles from "./OperationsHub.module.css";
import type { LandingBrief } from "./landings/model";

type OcrData = AnunciosRealesData & { sourceFiles?: number; companies?: number };

type WorkspaceData = {
  context: OperationContext;
  reviews: ReviewState;
  experiments: Experiment[];
};

type CoverageRow = AdCoverageItem & {
  searchableTextCount: number;
  validatedTextCount: number;
  targetGap: number;
  evidenceGapToFive: number;
  evidenceGapToTen: number;
  completeAgainstTarget: boolean;
};

type Opportunity = {
  id: string;
  label: string;
  explanation: string;
  rawPieces: number;
  families: number;
  companies: number;
  share: number;
  examples: AnuncioReal[];
};

export type OperationsHubProps = {
  companies: Company[];
  onOpenCompany: (companyId: string) => void;
  onOpenLab: () => void;
  onOpenLanding: (brief: LandingBrief) => void;
};

const OPERATIONS_TABS: OperationsTab[] = [
  "command",
  "factory",
  "coverage",
  "review",
  "experiments",
  "warroom",
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

const semanticKey = (item: AnuncioReal) =>
  normalize(`${item.titular} ${item.texto}`)
    .replace(/\d+(?:[.,]\d+)?/g, "#")
    .replace(/[^a-z0-9áéíóúñ# ]/gi, "")
    .slice(0, 210);

const reviewKey = (item: AnuncioReal, index: number) =>
  item.archivoSha256 || item.corpusKey || item.file || `${item.id}-${index}`;

const evidenceCandidates = (item: AnuncioReal) => {
  const platform = normalize(item.plataforma);
  const family =
    platform.includes("google") || platform.includes("display")
      ? "google"
      : "meta";
  return [
    item.externalId
      ? `${family}:${String(item.externalId).toUpperCase()}`
      : "",
    item.file ? `file:${item.file}` : "",
  ].filter(Boolean);
};

const opportunityRules: Array<{
  id: string;
  label: string;
  explanation: string;
  pattern: RegExp;
}> = [
  {
    id: "exclusive",
    label: "Exclusividad territorial",
    explanation:
      "Diferenciación defendible si la zona se bloquea de verdad y queda escrita.",
    pattern: /exclusiv|territori|una sola empresa|tu zona|tu ciudad/i,
  },
  {
    id: "guarantee",
    label: "Garantía con remedio",
    explanation:
      "Reduce riesgo solo cuando especifica qué ocurre si se incumple.",
    pattern: /garant|devolv|reembols|repon|no pagas|sin riesgo/i,
  },
  {
    id: "speed",
    label: "Velocidad / SLA",
    explanation:
      "Transforma una promesa comercial en un estándar medible de operación.",
    pattern: /\d+\s*(?:min|hora|día)|24\s*\/\s*7|tiempo real|inmediat/i,
  },
  {
    id: "proof",
    label: "Prueba y autoridad",
    explanation:
      "La evidencia enlazada puede sostener el mensaje; una cifra sin fuente no entra.",
    pattern: /testimoni|reseña|caso de éxito|líder|más de \d|\d+\+/i,
  },
  {
    id: "price",
    label: "Precio o ahorro visible",
    explanation:
      "La transparencia de precio abre un test distinto al de promesa o garantía.",
    pattern: /\d+[\d.,]*\s*(?:€|euros?)|desde\s+\d|gratis|gratuit|ahorr/i,
  },
];

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const buildBattlecard = (company: Company, context: OperationContext) => {
  const publicText = normalize(
    `${company.offer} ${company.guarantee} ${company.contract} ${company.body} ${company.review}`,
  );
  const signals = {
    speed: /\d+\s*(?:min|hora)|tiempo real|inmediat/.test(publicText),
    guarantee: /garant|devolv|reembols|repon|no pagas/.test(publicText),
    exclusivity: /exclusiv|territori|una sola empresa|tu zona/.test(publicText),
  };
  const price = company.price.eur != null
    ? `${company.priceLocal || company.price.label} · ≈ ${Math.round(company.price.eur)} €`
    : company.priceLocal || "No publicado";
  const vertical = context.vertical.trim() || "nicho por definir";
  const zone = context.zone.trim() || "zona por definir";
  const service = context.service.trim() || "servicio por definir";
  const configuredPrice = context.price.trim()
    ? `${context.price.trim()} €/mes`
    : "Por definir";
  const sla = context.slaMinutes.trim();
  const slaLabel = sla ? `${sla} minutos` : "Por definir";
  const objective = context.objective.trim() || "un objetivo de negocio acordado";
  const responsePosition = sla
    ? `medimos la respuesta en ${sla} minutos`
    : "acordamos y medimos un SLA de respuesta";
  const guarantee = ({
    none: "Sin garantía configurada",
    written: "Garantía escrita",
    measurable: "Garantía medible",
    remedy: "Garantía con remedio contractual",
  } as const)[context.guarantee];
  const exclusivity = ({
    none: "Sin exclusividad configurada",
    lead: "Un único cliente por contacto",
    territory: "Una empresa por nicho y zona",
  } as const)[context.exclusivity];
  return `BATTLECARD REDVITALIA VS. ${company.name.toUpperCase()}

Regla: “no observado” no significa “no existe”. Esta ficha sirve para preguntar y posicionar, no para atribuir hechos sin fuente.

1. LO PUBLICADO POR EL COMPETIDOR · OBSERVADO
- Mercado: ${company.primaryCountry}
- Modelo: ${company.agencyType}
- Oferta: ${company.offer || "No documentada"}
- Precio: ${price}
- Garantía: ${company.guarantee || "No publicada"}
- Contrato: ${company.contract || "No publicado"}
- Canales: ${company.channels.join(", ") || "No documentados"}
- Evidencia: ${company.evidence || "Sin clasificación"}

2. CONFIGURACIÓN REDVITALIA · PROPUESTA
- Nicho/zona: ${vertical} · ${zone}
- Servicio: ${service}
- Precio configurado: ${configuredPrice}
- SLA propuesto: ${slaLabel}
- Garantía configurada: ${guarantee}
- Exclusividad configurada: ${exclusivity}

3. HUECOS PARA VALIDAR EN LLAMADA · INFERIDOS
- ${signals.speed ? "Publica alguna señal de velocidad: pedir definición, medición y remedio." : "No se observa un SLA concreto: preguntar por tiempo real de primera respuesta."}
- ${signals.guarantee ? "Publica alguna garantía: pedir condiciones, exclusiones y remedio." : "No se observa un remedio explícito: preguntar qué ocurre si no cumple."}
- ${signals.exclusivity ? "Publica alguna exclusividad: comprobar si es por lead, nicho o territorio." : "No se observa protección territorial: preguntar si comparte demanda."}
- ${company.price.eur != null ? "El precio es comparable: llevar la conversación a coste por cita y CAC." : "El precio no es públicamente comparable: no afirmar que sea más caro o barato."}

4. PREGUNTAS DE DESCUBRIMIENTO
1. ¿Qué consideran una oportunidad o cita válida?
2. ¿En cuánto tiempo recibe el primer contacto cada lead?
3. ¿El mismo contacto se entrega a más de una empresa?
4. ¿Qué remedio contractual existe si no se alcanza lo pactado?
5. ¿Qué parte del embudo miden hasta venta?

5. POSICIONAMIENTO RECOMENDADO · EDITORIAL
“No queremos venderte más leads sin contexto. Acordamos qué cuenta como cita válida, ${responsePosition} y conectamos inversión, cita, asistencia y venta. La diferencia no es una promesa más: es qué queda escrito y qué se puede auditar.”

6. SIGUIENTE PASO
Comparar una sola variable durante un periodo cerrado y decidir por ${objective.toLocaleLowerCase("es")}.
`;
};

export default function OperationsHub({
  companies,
  onOpenCompany,
  onOpenLab,
  onOpenLanding,
}: OperationsHubProps) {
  const [tab, setTab] = useState<OperationsTab>(() => {
    if (typeof window === "undefined") return "command";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return OPERATIONS_TABS.includes(requested as OperationsTab)
      ? (requested as OperationsTab)
      : "command";
  });
  const [corpus, setCorpus] = useState<AnuncioReal[]>([]);
  const [coverage, setCoverage] = useState<AdCoverageData | null>(null);
  const [ocr, setOcr] = useState<AnuncioReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [context, setContext] = useState<OperationContext>(defaultOperationContext);
  const [reviews, setReviews] = useState<ReviewState>({});
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [coverageFilter, setCoverageFilter] = useState<
    "priority" | "under5" | "under10" | "discovery" | "all"
  >("priority");
  const [coverageQuery, setCoverageQuery] = useState("");
  const [reviewConfidence, setReviewConfidence] = useState<
    "all" | "90" | "75" | "low"
  >("all");
  const [warCompanyId, setWarCompanyId] = useState("");
  const [battleCopied, setBattleCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "loading" | "saving" | "saved" | "error"
  >("loading");
  const importInput = useRef<HTMLInputElement>(null);

  const applyWorkspace = useCallback((parsed: Partial<WorkspaceData>) => {
    if (parsed.context && typeof parsed.context === "object")
      setContext({ ...defaultOperationContext, ...parsed.context });
    if (parsed.reviews && typeof parsed.reviews === "object")
      setReviews(parsed.reviews);
    if (Array.isArray(parsed.experiments))
      setExperiments(
        parsed.experiments
          .filter(
            (experiment) =>
              experiment && Array.isArray(experiment.variants),
          )
          .map((experiment) => ({
            ...experiment,
            variants: experiment.variants.map((variant) => ({
              ...variant,
              qualifiedLeads: variant.qualifiedLeads || "",
              attendedAppointments: variant.attendedAppointments || "",
            })),
          })),
      );
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/data/ad-corpus.json").then((response) => {
        if (!response.ok) throw new Error("corpus");
        return response.json() as Promise<AnunciosRealesData>;
      }),
      fetch("/data/ad-coverage.json").then((response) => {
        if (!response.ok) throw new Error("coverage");
        return response.json() as Promise<AdCoverageData>;
      }),
      fetch("/data/ad-ocr-transcripts.json")
        .then((response) => {
          if (!response.ok) throw new Error("ocr");
          return response.json() as Promise<OcrData>;
        })
        .catch(() => ({ items: [], generatedAt: "", nota: "", total: 0 } as OcrData)),
    ])
      .then(([corpusData, coverageData, ocrData]) => {
        setCorpus(corpusData.items);
        setCoverage(coverageData);
        setOcr(ocrData.items);
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar el sistema operativo publicitario.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("vista", "operations");
    if (tab === "command") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  }, [tab]);

  useEffect(() => {
    let active = true;
    loadOperationsWorkspace<Partial<WorkspaceData>>()
      .then((parsed) => {
        if (!active || !parsed) return;
        applyWorkspace(parsed);
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
          setSaveStatus("saved");
        }
      });
    return () => {
      active = false;
    };
  }, [applyWorkspace]);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      void saveOperationsWorkspace({
        context,
        reviews,
        experiments,
      } satisfies WorkspaceData).then((saved) =>
        setSaveStatus(saved ? "saved" : "error"),
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [context, experiments, hydrated, reviews]);

  const canonical = useMemo(() => {
    if (!coverage)
      return {
        searchableCounts: new Map<string, number>(),
        validatedCounts: new Map<string, number>(),
        attributableValidatedCounts: new Map<string, number>(),
        orphans: 0,
      };
    const ids = new Set(coverage.items.map((item) => item.companyId));
    const aliases = new Map(
      coverage.aliasMap.map((item) => [item.alias, item.canonical]),
    );
    const searchableCounts = new Map<string, number>();
    const validatedCounts = new Map<string, number>();
    const validatedEvidence = new Map<string, Set<string>>();
    const evidenceByCompany = new Map(
      coverage.items.map((item) => [
        item.companyId,
        new Set(
          item.evidence.flatMap((evidence) => [
            evidence.externalId
              ? `${evidence.platform}:${String(evidence.externalId).toUpperCase()}`
              : "",
            evidence.file ? `file:${evidence.file}` : "",
            evidence.transcriptSignature
              ? `transcript:${evidence.transcriptSignature}`
              : "",
          ]).filter(Boolean),
        ),
      ]),
    );
    let orphans = 0;
    corpus.forEach((item, index) => {
      const resolved = ids.has(item.id) ? item.id : aliases.get(item.id);
      if (!resolved || !ids.has(resolved)) {
        orphans += 1;
        return;
      }
      searchableCounts.set(
        resolved,
        (searchableCounts.get(resolved) || 0) + 1,
      );
      const decision = reviews[reviewKey(item, index)];
      if (item.aptaPatrones !== false || decision?.status === "accepted") {
        validatedCounts.set(
          resolved,
          (validatedCounts.get(resolved) || 0) + 1,
        );
        const evidenceKeys = evidenceByCompany.get(resolved);
        const matched = evidenceCandidates(item).find((candidate) =>
          evidenceKeys?.has(candidate),
        );
        if (matched) {
          const current = validatedEvidence.get(resolved) || new Set<string>();
          current.add(matched);
          validatedEvidence.set(resolved, current);
        }
      }
    });
    return {
      searchableCounts,
      validatedCounts,
      attributableValidatedCounts: new Map(
        [...validatedEvidence].map(([id, keys]) => [id, keys.size]),
      ),
      orphans,
    };
  }, [corpus, coverage, reviews]);

  const coverageRows = useMemo<CoverageRow[]>(() => {
    if (!coverage) return [];
    return coverage.items
      .map((item) => {
        const searchableTextCount =
          canonical.searchableCounts.get(item.companyId) || 0;
        const validatedTextCount =
          canonical.attributableValidatedCounts.get(item.companyId) || 0;
        const targetGap = Math.max(0, item.targetCount - validatedTextCount);
        return {
          ...item,
          searchableTextCount,
          validatedTextCount,
          targetGap,
          evidenceGapToFive: Math.max(
            0,
            Math.min(5, item.availableEvidenceCount) - validatedTextCount,
          ),
          evidenceGapToTen: Math.max(
            0,
            Math.min(10, item.availableEvidenceCount) - validatedTextCount,
          ),
          completeAgainstTarget: item.targetCount > 0 && targetGap === 0,
        };
      })
      .sort(
        (a, b) =>
          b.evidenceGapToFive - a.evidenceGapToFive ||
          b.targetGap - a.targetGap ||
          b.availableEvidenceCount - a.availableEvidenceCount ||
          a.name.localeCompare(b.name, "es"),
      );
  }, [canonical.attributableValidatedCounts, canonical.searchableCounts, coverage]);

  const filteredCoverage = useMemo(() => {
    const query = normalize(coverageQuery);
    return coverageRows.filter((item) => {
      if (query && !normalize(`${item.name} ${item.country} ${item.domain}`).includes(query)) return false;
      if (coverageFilter === "priority") return item.targetGap > 0;
      if (coverageFilter === "under5") return item.evidenceGapToFive > 0;
      if (coverageFilter === "under10") return item.evidenceGapToTen > 0;
      if (coverageFilter === "discovery") return item.status === "pendiente/no atribuible";
      return true;
    });
  }, [coverageFilter, coverageQuery, coverageRows]);

  const patternReady = useMemo(
    () =>
      corpus.flatMap((item, index) => {
        const decision = reviews[reviewKey(item, index)];
        if (item.aptaPatrones === false && decision?.status !== "accepted")
          return [];
        const reviewedItem =
          decision?.status === "accepted" && decision.correctedText.trim()
            ? { ...item, titular: "", texto: decision.correctedText }
            : item;
        if (
          /^\s*0\s+anuncios?/i.test(
            `${reviewedItem.titular} ${reviewedItem.texto}`,
          ) ||
          `${reviewedItem.titular} ${reviewedItem.texto}`.trim().length < 20
        )
          return [];
        return [reviewedItem];
      }),
    [corpus, reviews],
  );

  const opportunities = useMemo<Opportunity[]>(() => {
    const indexedIds = new Set(companies.map((company) => company.id));
    const totalFamilies = new Set(patternReady.map(semanticKey)).size;
    return opportunityRules.map((rule) => {
      const matches = patternReady.filter((item) =>
        rule.pattern.test(
          `${item.titular} ${item.texto} ${item.precioVisible} ${item.angulo}`,
        ),
      );
      const families = new Map<string, AnuncioReal>();
      matches.forEach((item) => {
        const key = semanticKey(item);
        if (key && !families.has(key)) families.set(key, item);
      });
      const unique = [...families.values()];
      return {
        id: rule.id,
        label: rule.label,
        explanation: rule.explanation,
        rawPieces: matches.length,
        families: unique.length,
        companies: new Set(matches.map((item) => item.id)).size,
        share: totalFamilies
          ? Math.round((unique.length / totalFamilies) * 100)
          : 0,
        examples: unique.filter((item) => indexedIds.has(item.id)).slice(0, 3),
      };
    });
  }, [companies, patternReady]);

  const metrics = useMemo(() => {
    const targetGap = coverageRows.reduce((sum, item) => sum + item.targetGap, 0);
    const gapFive = coverageRows.reduce(
      (sum, item) => sum + item.evidenceGapToFive,
      0,
    );
    const priorityCompanies = coverageRows.filter((item) => item.targetGap > 0).length;
    const highConfidenceOcr = ocr.filter(
      (item, index) =>
        Number(item.confianza) >= 90 &&
        (reviews[reviewKey(item, index)]?.status || "pending") === "pending",
    ).length;
    const reviewed = ocr.filter(
      (item, index) =>
        (reviews[reviewKey(item, index)]?.status || "pending") !== "pending",
    ).length;
    const winners = experiments.filter(
      (experiment) => evaluateExperiment(experiment).winnerId,
    ).length;
    return {
      targetGap,
      gapFive,
      priorityCompanies,
      highConfidenceOcr,
      reviewed,
      winners,
      discovery:
        coverage?.summary.statusCounts["pendiente/no atribuible"] || 0,
    };
  }, [coverage, coverageRows, experiments, ocr, reviews]);

  const warCompany =
    companies.find((company) => company.id === warCompanyId) || null;
  const battlecard = warCompany ? buildBattlecard(warCompany, context) : "";

  const exportWorkspace = () =>
    downloadText(
      `operacion-redvitalia-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          schema: "redvitalia-operations-v1",
          context,
          reviews,
          experiments,
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );

  const importWorkspace = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WorkspaceData> & {
        schema?: string;
      };
      if (
        parsed.schema !== "redvitalia-operations-v1" ||
        (!parsed.context && !parsed.reviews && !parsed.experiments)
      )
        throw new Error("schema");
      applyWorkspace(parsed);
      setHydrated(true);
    } catch {
      setSaveStatus("error");
    }
  };

  if (loading) {
    return (
      <section className={styles.shell} aria-live="polite">
        <div className={styles.loading}>Preparando la sala de mando…</div>
      </section>
    );
  }

  if (error || !coverage) {
    return (
      <section className={styles.shell}>
        <div className={styles.emptyState}>
          <h2>{error || "No hay datos de operación"}</h2>
          <button className={styles.primaryButton} onClick={loadData}>Reintentar</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <p>CENTRO DE OPERACIONES · SISTEMA OPERATIVO REDVITALIA</p>
          <h1>De {coverage.totalCompanies} fichas a la siguiente decisión.</h1>
          <span>
            Evidencia → oportunidad → campaña → experimento → medición → aprendizaje.
          </span>
        </div>
        <div className={styles.heroActions}>
          <span className={styles.saveStatus} aria-live="polite">
            {saveStatus === "saving"
              ? "Guardando…"
              : saveStatus === "saved"
                ? "Espacio guardado"
                : saveStatus === "error"
                  ? "No se pudo guardar o importar"
                  : "Cargando espacio…"}
          </span>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importWorkspace(file);
              event.currentTarget.value = "";
            }}
          />
          <button onClick={() => importInput.current?.click()}>Importar</button>
          <button onClick={exportWorkspace}>Exportar espacio de trabajo</button>
          <button className={styles.heroPrimary} onClick={() => setTab("factory")}>Crear operación 360</button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Secciones del Centro de Operaciones">
        {([
          ["command", "Hoy", "3 prioridades"],
          ["factory", "Fábrica 360", "paquete completo"],
          ["coverage", "Cobertura", `${metrics.priorityCompanies} colas`],
          ["review", "Validación OCR", `${metrics.reviewed}/${ocr.length}`],
          ["experiments", "Experimentos", `${experiments.length} tests`],
          ["warroom", "War Room", "venta comparativa"],
        ] as Array<[OperationsTab, string, string]>).map(([id, label, detail]) => (
          <button key={id} className={tab === id ? styles.activeTab : ""} onClick={() => { if (id === "review") setReviewConfidence("all"); setTab(id); }} aria-current={tab === id ? "page" : undefined}>
            <b>{label}</b><span>{detail}</span>
          </button>
        ))}
      </nav>

      {tab === "command" && (
        <div className={styles.commandView}>
          <section className={styles.kpiGrid}>
            <article><span>UNIVERSO CANÓNICO</span><b>{coverage.totalCompanies}</b><small>fichas indexadas</small></article>
            <article><span>CORPUS BUSCABLE</span><b>{corpus.length}</b><small>{canonical.orphans} piezas fuera del universo canónico</small></article>
            <article><span>BASE ANALÍTICA</span><b>{patternReady.length}</b><small>piezas aptas antes de deduplicar familias</small></article>
            <article><span>OCR POR VALIDAR</span><b>{ocr.length - metrics.reviewed}</b><small>{metrics.highConfidenceOcr} con confianza ≥90</small></article>
            <article><span>TESTS REGISTRADOS</span><b>{experiments.length}</b><small>{metrics.winners} con ganador estadístico</small></article>
          </section>

          <section className={styles.truthStrip}>
            <div><span>EVIDENCIA ATRIBUIBLE</span><b>{coverage.summary.sampledEvidence ?? coverage.summary.targetTotal}</b></div><i>→</i>
            <div><span>TEXTO VALIDADO + ATRIBUIBLE</span><b>{[...canonical.attributableValidatedCounts.values()].reduce((sum, value) => sum + value, 0)}</b></div><i>→</i>
            <div><span>PATRÓN APTO</span><b>{patternReady.length}</b></div><i>→</i>
            <div><span>EXPERIMENTO</span><b>{experiments.length}</b></div><i>→</i>
            <div><span>GANADOR ESTADÍSTICO</span><b>{metrics.winners}</b></div>
          </section>
          <p className={styles.truthNote}>Las etapas tienen bases distintas y no forman un embudo de conversión. “Ganador” exige métricas propias, test cerrado, mínimos, diferencia estadística, lift y guardrail.</p>

          <section className={styles.prioritySection}>
            <div className={styles.sectionTitle}><div><p className={styles.kicker}>QUÉ HACEMOS HOY</p><h2>Tres colas que desbloquean valor real</h2></div><span>Ordenadas por trabajo inmediatamente ejecutable</span></div>
            <div className={styles.priorityGrid}>
              <article className={styles.priorityCard}>
                <span>01 · VALIDAR</span><b>{metrics.highConfidenceOcr}</b><h3>OCR pendiente con confianza ≥90</h3><p>Revisión rápida, no aceptación automática. El texto solo entra en patrones después de comprobar captura y atribución.</p><button onClick={() => { setReviewConfidence("90"); setTab("review"); }}>Abrir cola de validación →</button>
              </article>
              <article className={styles.priorityCard}>
                <span>02 · CERRAR COBERTURA</span><b>{metrics.targetGap}</b><h3>Evidencias sin texto validado y enlazado</h3><p>{metrics.priorityCompanies} empresas ya tienen evidencia individualizable. Solo descuenta una pieza cuando el texto validado coincide por ID o archivo; no incluye las fichas donde aún hay que descubrir anuncios.</p><button onClick={() => { setCoverageFilter("priority"); setTab("coverage"); }}>Abrir cola de transcripción →</button>
              </article>
              <article className={styles.priorityCard}>
                <span>03 · DESCUBRIR</span><b>{metrics.discovery}</b><h3>Fichas pendientes de atribución</h3><p>No significan cero anuncios. Requieren búsqueda y verificación antes de poder transcribir o comparar.</p><button onClick={() => { setCoverageFilter("discovery"); setTab("coverage"); }}>Abrir cola de descubrimiento →</button>
              </article>
            </div>
          </section>

          <section className={styles.opportunitySection}>
            <div className={styles.sectionTitle}><div><p className={styles.kicker}>RADAR DE CANDIDATOS</p><h2>Patrones deduplicados para diseñar tests</h2></div><button className={styles.secondaryButton} onClick={onOpenLab}>Abrir laboratorio completo</button></div>
            <div className={styles.opportunityGrid}>
              {opportunities.map((item) => (
                <article key={item.id}>
                  <header><span>{item.share}% de las familias normalizadas aptas</span><b>{item.families} familias</b></header>
                  <h3>{item.label}</h3><p>{item.explanation}</p>
                  <dl><div><dt>Piezas brutas</dt><dd>{item.rawPieces}</dd></div><div><dt>Empresas</dt><dd>{item.companies}</dd></div></dl>
                  <div className={styles.evidenceLinks}>{item.examples.map((example) => <button key={example.corpusKey || `${example.id}-${example.titular}`} onClick={() => onOpenCompany(example.id)}>{example.name}</button>)}</div>
                  <button className={styles.textButton} onClick={() => { const axis = item.id === "exclusive" ? "exclusivity" : item.id === "price" ? "proof" : item.id; setContext((current) => ({ ...current, strategicAxis: axis as OperationContext["strategicAxis"] })); setTab("factory"); }}>Crear operación con este eje →</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "factory" && (
        <OperationFactoryPanel companies={companies} corpus={patternReady} context={context} onContext={setContext} onOpenCompany={onOpenCompany} onOpenLanding={onOpenLanding} onAddExperiment={(experiment) => { setExperiments((current) => [...current, experiment]); setTab("experiments"); }} />
      )}

      {tab === "coverage" && (
        <section className={styles.panel} aria-labelledby="coverage-title">
          <div className={styles.panelHead}><div><p className={styles.kicker}>COBERTURA CANÓNICA · DOS GAPS, DOS TRABAJOS</p><h2 id="coverage-title">Transcribir evidencia o descubrirla primero</h2><p>El gap contra objetivo exige texto validado y unido por ID externo o archivo a la evidencia muestreada. Las pendientes permanecen separadas para no convertir “no atribuible” en “cero anuncios”.</p></div><div className={styles.reviewStats}><span><b>{metrics.targetGap}</b> gap validado</span><span><b>{metrics.gapFive}</b> hasta 5 con evidencia existente</span><span><b>{metrics.discovery}</b> por descubrir</span></div></div>
          <div className={styles.coverageToolbar}>
            <input type="search" value={coverageQuery} onChange={(event) => setCoverageQuery(event.target.value)} placeholder="Buscar empresa, país o dominio…" aria-label="Buscar en cobertura" />
            <div>{([ ["priority", "Prioridad"], ["under5", "Hasta 5"], ["under10", "Hasta 10"], ["discovery", "Descubrimiento"], ["all", "Todas"] ] as Array<[typeof coverageFilter, string]>).map(([id, label]) => <button key={id} className={coverageFilter === id ? styles.activeFilter : ""} onClick={() => setCoverageFilter(id)}>{label}</button>)}</div>
            <button className={styles.secondaryButton} onClick={() => { const header = ["empresa","pais","estado","texto_buscable","texto_validado","evidencia_disponible","objetivo","gap_objetivo","gap_hasta_5","gap_hasta_10","ids_exactos","archivos"]; const rows = filteredCoverage.map((item) => [item.name,item.country,item.status,item.searchableTextCount,item.validatedTextCount,item.availableEvidenceCount,item.targetCount,item.targetGap,item.evidenceGapToFive,item.evidenceGapToTen,item.exactCreativeIds.total,item.archivedFileCount]); downloadText(`cobertura-anuncios-${new Date().toISOString().slice(0,10)}.csv`, [header,...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8"); }}>Exportar CSV</button>
          </div>
          <div className={styles.coverageResult}><strong>{filteredCoverage.length} empresas</strong><span>Tabla: primeras {Math.min(250, filteredCoverage.length)} · el CSV incluye todas · orden: gap ejecutable → gap total → evidencia</span></div>
          <div className={styles.coverageTableWrap}><table className={styles.coverageTable}><thead><tr><th>Empresa</th><th>Estado</th><th>Texto / evidencia</th><th>Gap validado</th><th>Fuentes</th><th /></tr></thead><tbody>{filteredCoverage.slice(0, 250).map((item) => <tr key={item.companyId}><td><b>{item.name}</b><span>{item.country}</span></td><td><span className={`${styles.coverageStatus} ${item.status === "pendiente/no atribuible" ? styles.pendingCoverage : item.completeAgainstTarget ? styles.completeCoverage : ""}`}>{item.status}</span></td><td><b>{item.validatedTextCount} validadas · {item.searchableTextCount} buscables</b><span>{item.availableEvidenceCount} evidencias · {item.exactCreativeIds.total} IDs · {item.archivedFileCount} archivos</span></td><td><b>{item.targetGap}</b><span>hasta 5: {item.evidenceGapToFive} · hasta 10: {item.evidenceGapToTen}</span></td><td><div className={styles.sourceButtons}>{item.sourceLinks.slice(0,2).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">{index === 0 ? "Meta/Google" : "Fuente 2"} ↗</a>)}</div></td><td><button className={styles.textButton} onClick={() => onOpenCompany(item.companyId)}>Ficha →</button></td></tr>)}</tbody></table></div>
        </section>
      )}

      {tab === "review" && <OcrReviewPanel items={ocr} reviewState={reviews} onReviewState={setReviews} onOpenCompany={onOpenCompany} defaultConfidence={reviewConfidence} />}

      {tab === "experiments" && <ExperimentPanel experiments={experiments} onExperiments={setExperiments} context={context} />}

      {tab === "warroom" && (
        <section className={styles.panel} aria-labelledby="warroom-title">
          <div className={styles.panelHead}><div><p className={styles.kicker}>WAR ROOM COMERCIAL · POR PROSPECTO</p><h2 id="warroom-title">Entrar a la llamada con diferencias verificables</h2><p>La battlecard separa lo publicado, la propuesta RedVitalia y los huecos que solo pueden resolverse preguntando.</p></div></div>
          <div className={styles.warLayout}>
            <aside className={styles.warPicker}><label>Competidor<select value={warCompanyId} onChange={(event) => setWarCompanyId(event.target.value)}><option value="">Selecciona una empresa</option>{companies.slice().sort((a,b)=>a.name.localeCompare(b.name,"es")).map((company)=><option key={company.id} value={company.id}>{company.name} · {company.primaryCountry}</option>)}</select></label>{warCompany && <><article><span>SCORE EDITORIAL DERIVADO</span><b>{warCompany.score}/100</b><small>{warCompany.threat}</small></article><article><span>PRECIO</span><b>{warCompany.priceLocal || "No publicado"}</b><small>{warCompany.price.label}</small></article><article><span>DECISIÓN EDITORIAL</span><b>{warCompany.decision}</b><small>{warCompany.evidence}</small></article><button className={styles.textButton} onClick={() => onOpenCompany(warCompany.id)}>Abrir ficha completa →</button></>}</aside>
            <div className={styles.warOutput}>{warCompany ? <><div className={styles.outputHead}><div><p className={styles.kicker}>BATTLECARD GENERADA</p><h3>RedVitalia vs. {warCompany.name}</h3></div><div className={styles.headActions}><button onClick={async()=>{try{await navigator.clipboard.writeText(battlecard);setBattleCopied(true);window.setTimeout(()=>setBattleCopied(false),1500);}catch{setBattleCopied(false);}}}>{battleCopied ? "Copiada" : "Copiar"}</button><button onClick={()=>downloadText(`battlecard-${warCompany.id}.txt`,battlecard,"text/plain;charset=utf-8")}>Descargar</button></div></div><pre>{battlecard}</pre></> : <div className={styles.emptyState}>Selecciona un competidor para construir el argumentario.</div>}</div>
          </div>
        </section>
      )}
    </section>
  );
}
