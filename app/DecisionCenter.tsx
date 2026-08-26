"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdLandingAuditPanel from "./AdLandingAuditPanel";
import styles from "./DecisionCenter.module.css";

type DecisionSection =
  | "overview"
  | "dna"
  | "gaps"
  | "playbooks"
  | "offers"
  | "patterns"
  | "hypotheses"
  | "audit";

type UnknownRecord = Record<string, unknown>;

type CompetitiveIntelligenceData = {
  schemaVersion?: string | number;
  generatedAt?: string;
  scope?: unknown;
  methodology?: unknown;
  summary?: unknown;
  companyDna?: unknown;
  marketGaps?: unknown;
  playbooks?: unknown;
  offerMatrix?: unknown;
  patternLibrary?: unknown;
  hypothesisRanking?: unknown;
};

type CompanyReference = {
  id: string;
  label: string;
  detail: string;
};

export type DecisionCenterProps = {
  onOpenCompany?: (id: string) => void;
};

const TABS: Array<{
  id: DecisionSection;
  label: string;
  short: string;
}> = [
  { id: "overview", label: "Resumen", short: "Qué merece atención" },
  { id: "dna", label: "ADN competitivo", short: "Cómo vende cada actor" },
  { id: "gaps", label: "Huecos", short: "Espacios menos ocupados" },
  { id: "playbooks", label: "Playbooks", short: "Planes por nicho" },
  { id: "offers", label: "Ofertas", short: "Modelos y condiciones" },
  { id: "patterns", label: "Patrones", short: "Biblioteca reutilizable" },
  { id: "hypotheses", label: "Hipótesis", short: "Qué probar primero" },
  { id: "audit", label: "Anuncio → landing", short: "Continuidad y fugas" },
];

const SECTION_META: Record<
  DecisionSection,
  { kicker: string; title: string; description: string }
> = {
  overview: {
    kicker: "SALA DE DECISIÓN",
    title: "Del archivo de competencia a una decisión defendible",
    description:
      "Prioriza oportunidades, abre su evidencia y transforma una lectura de mercado en un test concreto.",
  },
  dna: {
    kicker: "ADN COMPETITIVO",
    title: "La forma de vender de cada competidor, separada por piezas",
    description:
      "Público, dolor, promesa, mecanismo, oferta, garantía, llamada a la acción y formatos observados.",
  },
  gaps: {
    kicker: "MAPA DE HUECOS",
    title: "Oportunidades donde el mercado deja aire",
    description:
      "Una baja presencia es una pista para investigar, no una prueba automática de demanda o rentabilidad.",
  },
  playbooks: {
    kicker: "PLAYBOOKS POR NICHO",
    title: "De la señal competitiva a un plan ejecutable",
    description:
      "Cada playbook reúne audiencia, oferta, mensajes, prueba, landing y el siguiente experimento sugerido.",
  },
  offers: {
    kicker: "INGENIERÍA INVERSA",
    title: "Qué se vende, cómo se cobra y qué riesgo asume el cliente",
    description:
      "Compara modelos comerciales, precio público, permanencia, garantía y condiciones observables.",
  },
  patterns: {
    kicker: "BIBLIOTECA DE PATRONES",
    title: "Patrones reutilizables con contexto y límites",
    description:
      "Consulta cuándo puede tener sentido cada patrón, qué saturación presenta y qué riesgos conviene vigilar.",
  },
  hypotheses: {
    kicker: "RANKING DE HIPÓTESIS",
    title: "Candidatos priorizados para experimentar",
    description:
      "El ranking ordena señales competitivas. Solo las métricas reales de campaña pueden convertirlas en ganadoras.",
  },
  audit: {
    kicker: "AUDITORÍA ANUNCIO → LANDING",
    title: "Comprueba si la promesa sobrevive al clic",
    description:
      "Contrasta mensaje, público, oferta, mecanismo y acción para localizar pérdidas de continuidad con evidencia trazable.",
  },
};

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const firstValue = (record: UnknownRecord | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const compactText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const record = asRecord(value);
  if (record) {
    const selected = firstValue(record, [
      "label",
      "name",
      "title",
      "value",
      "text",
      "excerpt",
      "description",
      "summary",
    ]);
    if (selected !== undefined && selected !== value)
      return compactText(selected);
  }
  return "";
};

const firstText = (
  record: UnknownRecord | null,
  keys: string[],
  fallback = "",
) => {
  const value = firstValue(record, keys);
  const text = compactText(value);
  return text || fallback;
};

const firstNumber = (record: UnknownRecord | null, keys: string[]) => {
  const value = firstValue(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const textList = (record: UnknownRecord | null, keys: string[]) => {
  const value = firstValue(record, keys);
  if (Array.isArray(value)) {
    return value.map(compactText).filter(Boolean);
  }
  const text = compactText(value);
  if (!text) return [];
  return text
    .split(/\s*[|•;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const sectionItems = (value: unknown, preferredKeys: string[] = []) => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of [
    ...preferredKeys,
    "items",
    "rows",
    "entries",
    "results",
    "companies",
    "patterns",
    "hypotheses",
  ]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const marketGapItems = (value: unknown) => {
  const root = asRecord(value);
  const verticals = sectionItems(root?.verticals, ["verticals"]);
  return verticals.flatMap((vertical) => {
    const verticalRecord = asRecord(vertical);
    const label = firstText(verticalRecord, ["label", "verticalLabel", "name"]);
    const verticalId = firstText(verticalRecord, ["verticalId", "id", "slug"]);
    const denominator = asRecord(verticalRecord?.denominator);
    return asArray(verticalRecord?.gaps).map((gap) => ({
      ...(asRecord(gap) ?? {}),
      vertical: label,
      verticalId,
      verticalDenominatorCompanies: firstNumber(denominator, ["companies"]),
    }));
  });
};

const nestedRecord = (record: UnknownRecord | null, key: string) =>
  asRecord(record?.[key]);

const signalValues = (record: UnknownRecord | null, key: string) => {
  const signals = nestedRecord(record, "signals");
  const signal = asRecord(signals?.[key]);
  return asArray(signal?.values).map(compactText).filter(Boolean);
};

const playbookModule = (record: UnknownRecord | null, key: string) => {
  const modules = nestedRecord(record, "observedModules");
  return asRecord(modules?.[key]);
};

const searchable = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).toLocaleLowerCase("es");
  }
  if (Array.isArray(value)) return value.map(searchable).join(" ");
  const record = asRecord(value);
  return record ? Object.values(record).map(searchable).join(" ") : "";
};

const contextValues = (record: UnknownRecord | null, keys: string[]) => {
  if (!record) return [];
  return keys.flatMap((key) => {
    const value = record[key];
    if (Array.isArray(value)) return value.map(compactText).filter(Boolean);
    const label = compactText(value);
    return label ? [label] : [];
  });
};

const uniqueOptions = (items: unknown[], keys: string[]) =>
  Array.from(
    new Set(
      items
        .flatMap((item) => contextValues(asRecord(item), keys))
        .filter((value) => value && value !== "Sin clasificar"),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

const referencesFrom = (record: UnknownRecord | null): CompanyReference[] => {
  if (!record) return [];
  const candidates = firstValue(record, [
    "evidenceCompanies",
    "exampleCompanies",
    "companies",
    "companyExamples",
    "evidence",
    "examples",
    "sources",
    "companyIds",
  ]);
  let raw = Array.isArray(candidates)
    ? candidates
    : candidates === undefined
      ? []
      : [candidates];
  if (!raw.length) {
    const nestedEvidence: unknown[] = [];
    for (const containerKey of ["signals", "observedModules"]) {
      const container = asRecord(record[containerKey]);
      if (!container) continue;
      for (const value of Object.values(container)) {
        const nested = asRecord(value);
        nestedEvidence.push(...asArray(nested?.evidence));
        for (const signalValue of asArray(nested?.values)) {
          nestedEvidence.push(...asArray(asRecord(signalValue)?.evidence));
        }
      }
    }
    raw = nestedEvidence;
  }
  const references = raw
    .map((candidate): CompanyReference | null => {
      if (typeof candidate === "string") {
        return { id: candidate, label: candidate, detail: "" };
      }
      const item = asRecord(candidate);
      if (!item) return null;
      const id = firstText(item, [
        "companyId",
        "companySlug",
        "slug",
        "id",
        "empresaId",
      ]);
      const label = firstText(
        item,
        ["companyName", "name", "label", "title"],
        id,
      );
      const detail = firstText(item, [
        "evidence",
        "example",
        "text",
        "detail",
        "reason",
      ]);
      if (!id && !label) return null;
      return { id: id || label, label: label || id, detail };
    })
    .filter((item): item is CompanyReference => Boolean(item?.id));
  return Array.from(
    new Map(references.map((item) => [item.id, item])).values(),
  );
};

const directCompanyReference = (record: UnknownRecord | null) => {
  if (!record) return null;
  const id = firstText(record, [
    "companyId",
    "companySlug",
    "slug",
    "id",
    "empresaId",
  ]);
  const label = firstText(record, ["companyName", "name", "label", "title"]);
  return id && label ? { id, label, detail: "" } : null;
};

const evidenceKind = (record: UnknownRecord | null) => {
  if (!record) return "synthesis";
  const raw = [
    "evidenceType",
    "evidenceLevel",
    "sourceType",
    "status",
    "basis",
    "observationStatus",
    "measurementStatus",
    "opportunityStatus",
    "claimStatus",
  ]
    .map((key) => compactText(record[key]))
    .concat(
      [
        "offer",
        "pricing",
        "guarantee",
        "contract",
        "coherence",
        "whenToUse",
      ].map((key) => firstText(asRecord(record[key]), ["status"])),
    )
    .join(" ")
    .toLocaleLowerCase("es");
  const observed =
    record.observed === true || /observ|verific|direct|public/.test(raw);
  const inferred =
    record.inferred === true ||
    /infer|estim|heur|deriv|hypothesis|hip[oó]tes/.test(raw);
  if (!raw && record.signals && record.landing) return "mixed";
  if (record.observedModules && record.landingBlueprint) return "mixed";
  if (observed && inferred) return "mixed";
  if (observed) return "observed";
  if (inferred) return "inferred";
  return "synthesis";
};

const evidenceLabel = (kind: string) => {
  if (kind === "observed") return "Observado";
  if (kind === "inferred") return "Inferido";
  if (kind === "mixed") return "Mixto";
  return "Síntesis";
};

const formatNumber = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("es-ES").format(value);

const formatShare = (value: number | null) => {
  if (value === null) return "—";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(normalized)}%`;
};

const formatGeneratedAt = (value?: string) => {
  if (!value) return "Corte sin fecha declarada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

function EvidenceBadge({ record }: { record: UnknownRecord | null }) {
  const kind = evidenceKind(record);
  return (
    <span className={`${styles.evidenceBadge} ${styles[kind]}`}>
      <i aria-hidden="true" />
      {evidenceLabel(kind)}
    </span>
  );
}

function CompanyLink({
  reference,
  onOpenCompany,
  className,
}: {
  reference: CompanyReference;
  onOpenCompany?: (id: string) => void;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={`?vista=companies&empresa=${encodeURIComponent(reference.id)}`}
      title={reference.detail || `Abrir ficha de ${reference.label}`}
      onClick={(event) => {
        if (!onOpenCompany) return;
        event.preventDefault();
        onOpenCompany(reference.id);
      }}
    >
      {reference.label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function CompanyEvidence({
  record,
  onOpenCompany,
  limit = 6,
}: {
  record: UnknownRecord | null;
  onOpenCompany?: (id: string) => void;
  limit?: number;
}) {
  const references = referencesFrom(record).slice(0, limit);
  if (!references.length) return null;
  return (
    <div className={styles.companyEvidence} aria-label="Empresas de evidencia">
      {references.map((reference) => (
        <CompanyLink
          key={reference.id}
          reference={reference}
          onOpenCompany={onOpenCompany}
        />
      ))}
    </div>
  );
}

function EmptySection({
  title = "No hay resultados para esta vista",
  detail = "Prueba otra búsqueda o filtro. Si el origen está vacío, la sección se completará en la próxima actualización de datos.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className={styles.emptyState} role="status">
      <span aria-hidden="true">○</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function InsightField({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className={styles.insightField}>
      <dt>{label}</dt>
      <dd>
        {values.slice(0, 4).map((value) => (
          <span key={value}>{value}</span>
        ))}
      </dd>
    </div>
  );
}

function Score({ record }: { record: UnknownRecord | null }) {
  const score = firstNumber(record, [
    "score",
    "priorityScore",
    "opportunityScore",
    "evidenceScore",
    "confidenceScore",
  ]);
  if (score === null) return null;
  const normalized = score <= 1 ? score * 100 : score;
  return (
    <div
      className={styles.score}
      aria-label={`Puntuación ${Math.round(normalized)} de 100`}
    >
      <span>{Math.round(normalized)}</span>
      <i>
        <b style={{ width: `${Math.max(0, Math.min(100, normalized))}%` }} />
      </i>
    </div>
  );
}

export default function DecisionCenter({ onOpenCompany }: DecisionCenterProps) {
  const [data, setData] = useState<CompetitiveIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [section, setSection] = useState<DecisionSection>("overview");
  const [query, setQuery] = useState("");
  const [contextFilter, setContextFilter] = useState("__all__");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/competitive-intelligence.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as CompetitiveIntelligenceData;
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          reason instanceof Error ? reason.message : "Error desconocido";
        setError(message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const dna = useMemo(
    () => sectionItems(data?.companyDna, ["profiles", "companyProfiles"]),
    [data],
  );
  const gaps = useMemo(() => marketGapItems(data?.marketGaps), [data]);
  const playbooks = useMemo(
    () => sectionItems(data?.playbooks, ["verticals", "playbooks"]),
    [data],
  );
  const offers = useMemo(
    () => sectionItems(data?.offerMatrix, ["offers", "matrix", "models"]),
    [data],
  );
  const patterns = useMemo(
    () => sectionItems(data?.patternLibrary, ["patterns", "library"]),
    [data],
  );
  const hypotheses = useMemo(
    () => sectionItems(data?.hypothesisRanking, ["hypotheses", "ranking"]),
    [data],
  );

  const currentItems = useMemo(() => {
    if (section === "dna") return dna;
    if (section === "gaps") return gaps;
    if (section === "playbooks") return playbooks;
    if (section === "offers") return offers;
    if (section === "patterns") return patterns;
    if (section === "hypotheses") return hypotheses;
    return [];
  }, [dna, gaps, hypotheses, offers, patterns, playbooks, section]);

  const contextKeys = useMemo(() => {
    if (section === "dna") return ["vertical", "segment", "market", "country"];
    if (section === "playbooks")
      return ["label", "vertical", "verticalId", "niche", "segment"];
    if (section === "offers")
      return ["models", "model", "billingModel", "offerModel", "type"];
    if (section === "patterns")
      return ["category", "dimension", "family", "type"];
    if (section === "hypotheses")
      return ["category", "vertical", "dimension", "type"];
    if (section === "gaps")
      return ["category", "vertical", "dimension", "type"];
    return [];
  }, [section]);

  const contextOptions = useMemo(
    () => uniqueOptions(currentItems, contextKeys),
    [contextKeys, currentItems],
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return currentItems.filter((item) => {
      const record = asRecord(item);
      const matchesQuery = !needle || searchable(item).includes(needle);
      const matchesContext =
        contextFilter === "__all__" ||
        contextValues(record, contextKeys).includes(contextFilter);
      return matchesQuery && matchesContext;
    });
  }, [contextFilter, contextKeys, currentItems, query]);

  const chooseSection = useCallback((next: DecisionSection) => {
    setSection(next);
    setQuery("");
    setContextFilter("__all__");
  }, []);

  if (loading) {
    return (
      <section className={styles.shell} aria-busy="true">
        <div className={styles.loadingHero}>
          <span />
          <b />
          <i />
        </div>
        <div className={styles.loadingGrid} role="status" aria-live="polite">
          <span className={styles.srOnly}>
            Preparando inteligencia competitiva…
          </span>
          {Array.from({ length: 6 }, (_, index) => (
            <article key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.shell}>
        <div className={styles.loadError} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <h2>No se pudo abrir el centro de decisión</h2>
            <p>
              La fuente de inteligencia no está disponible ahora mismo
              {error ? ` (${error})` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  const meta = SECTION_META[section];
  const summary = asRecord(data.summary);
  const scope = asRecord(data.scope);
  const companiesCount =
    firstNumber(summary, [
      "eligibleCompanies",
      "companies",
      "companyCount",
      "companiesAnalyzed",
    ]) ??
    firstNumber(scope, ["companies", "companyCount", "companiesAnalyzed"]) ??
    dna.length;
  const adsCount =
    firstNumber(summary, [
      "rawCorpusRows",
      "uniqueIdentities",
      "ads",
      "adCount",
      "uniqueAds",
      "adsAnalyzed",
    ]) ?? firstNumber(scope, ["ads", "adCount", "uniqueAds", "adsAnalyzed"]);
  const landingCount = firstNumber(summary, [
    "capturedLandingCompanies",
    "landingCompanies",
    "companiesWithCapturedLanding",
  ]);
  const trustedIdentities = firstNumber(summary, [
    "trustedSemanticIdentities",
    "semanticIdentities",
    "trustedCopies",
  ]);

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>CENTRO DE INTELIGENCIA COMPETITIVA</p>
          <h1>Decisiones con evidencia, no con intuiciones sueltas.</h1>
          <span>
            Separa observaciones, inferencias y síntesis para saber qué copiar,
            qué evitar y qué merece un experimento.
          </span>
        </div>
        <div className={styles.heroMeta}>
          <strong>Lectura de mercado</strong>
          <span>{formatGeneratedAt(data.generatedAt)}</span>
          <small>Esquema {data.schemaVersion ?? "actual"}</small>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Áreas del centro de decisión">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={section === tab.id ? styles.activeTab : ""}
            aria-current={section === tab.id ? "page" : undefined}
            onClick={() => chooseSection(tab.id)}
          >
            <b>{tab.label}</b>
            <span>{tab.short}</span>
          </button>
        ))}
      </nav>

      <main className={styles.workspace}>
        <header className={styles.sectionHeader}>
          <div>
            <p>{meta.kicker}</p>
            <h2>{meta.title}</h2>
            <span>{meta.description}</span>
          </div>
          <div className={styles.legend} aria-label="Leyenda de evidencia">
            <span>
              <i className={styles.observedDot} /> Observado
            </span>
            <span>
              <i className={styles.inferredDot} /> Inferido
            </span>
            <span>
              <i className={styles.synthesisDot} /> Síntesis
            </span>
          </div>
        </header>

        {section !== "overview" && section !== "audit" && (
          <div className={styles.toolbar}>
            <label>
              <span className={styles.srOnly}>
                Buscar en {TABS.find((tab) => tab.id === section)?.label}
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar empresa, nicho, promesa o patrón…"
              />
            </label>
            {contextOptions.length > 0 && (
              <label>
                <span className={styles.srOnly}>Filtrar categoría</span>
                <select
                  value={contextFilter}
                  onChange={(event) => setContextFilter(event.target.value)}
                >
                  <option value="__all__">Todas las categorías</option>
                  {contextOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className={styles.resultCount} aria-live="polite">
              <b>{formatNumber(filteredItems.length)}</b> resultados
            </span>
          </div>
        )}

        {section === "overview" && (
          <Overview
            summary={summary}
            scope={scope}
            methodology={data.methodology}
            companiesCount={companiesCount}
            adsCount={adsCount}
            landingCount={landingCount}
            trustedIdentities={trustedIdentities}
            dnaCount={dna.length}
            gaps={gaps}
            playbooks={playbooks}
            hypotheses={hypotheses}
            onOpenCompany={onOpenCompany}
            onNavigate={chooseSection}
          />
        )}
        {section === "dna" && (
          <DnaView items={filteredItems} onOpenCompany={onOpenCompany} />
        )}
        {section === "gaps" && (
          <GapView items={filteredItems} onOpenCompany={onOpenCompany} />
        )}
        {section === "playbooks" && (
          <PlaybookView items={filteredItems} onOpenCompany={onOpenCompany} />
        )}
        {section === "offers" && (
          <OfferView
            items={filteredItems}
            matrix={data.offerMatrix}
            onOpenCompany={onOpenCompany}
          />
        )}
        {section === "patterns" && (
          <PatternView items={filteredItems} onOpenCompany={onOpenCompany} />
        )}
        {section === "hypotheses" && (
          <HypothesisView
            items={filteredItems}
            ranking={data.hypothesisRanking}
            onOpenCompany={onOpenCompany}
          />
        )}
        {section === "audit" && (
          <div className={styles.auditPanel}>
            <AdLandingAuditPanel onOpenCompany={onOpenCompany} />
          </div>
        )}
      </main>
    </section>
  );
}

function Overview({
  summary,
  scope,
  methodology,
  companiesCount,
  adsCount,
  landingCount,
  trustedIdentities,
  dnaCount,
  gaps,
  playbooks,
  hypotheses,
  onOpenCompany,
  onNavigate,
}: {
  summary: UnknownRecord | null;
  scope: UnknownRecord | null;
  methodology: unknown;
  companiesCount: number | null;
  adsCount: number | null;
  landingCount: number | null;
  trustedIdentities: number | null;
  dnaCount: number;
  gaps: unknown[];
  playbooks: unknown[];
  hypotheses: unknown[];
  onOpenCompany?: (id: string) => void;
  onNavigate: (section: DecisionSection) => void;
}) {
  const primaryHypotheses = hypotheses.slice(0, 3);
  const primaryGaps = gaps.slice(0, 3);
  const methodologyRecord = asRecord(methodology);
  const methodologyItems = Array.isArray(methodology)
    ? methodology.map(compactText).filter(Boolean)
    : [
        firstText(methodologyRecord, ["note"]),
        firstText(methodologyRecord, ["deduplication"]),
        firstText(methodologyRecord, ["weighting"]),
        firstText(methodologyRecord, ["semanticPolicy"]),
      ].filter(Boolean);
  const scopeText = firstText(scope, [
    "market",
    "description",
    "label",
    "cohort",
    "inclusionRule",
  ]);
  const summaryText = firstText(summary, [
    "description",
    "executiveSummary",
    "headline",
  ]);

  return (
    <div className={styles.overview}>
      <section className={styles.kpis} aria-label="Cobertura de análisis">
        <article>
          <span>EMPRESAS ANALIZADAS</span>
          <b>{formatNumber(companiesCount)}</b>
          <small>
            {dnaCount
              ? `${formatNumber(dnaCount)} perfiles de ADN disponibles`
              : "Perfiles en actualización"}
          </small>
        </article>
        <article>
          <span>FILAS DEL CORPUS</span>
          <b>{formatNumber(adsCount)}</b>
          <small>
            {trustedIdentities !== null
              ? `${formatNumber(trustedIdentities)} copies semánticos fiables`
              : "Señales creativas y comerciales observables"}
          </small>
        </article>
        <article>
          <span>LANDINGS CAPTURADAS</span>
          <b>{formatNumber(landingCount)}</b>
          <small>{scopeText || "Empresas con página capturada"}</small>
        </article>
        <article>
          <span>HUECOS DETECTADOS</span>
          <b>{formatNumber(gaps.length)}</b>
          <small>Candidatos que aún requieren validación</small>
        </article>
      </section>

      {summaryText && <p className={styles.executiveSummary}>{summaryText}</p>}

      <section className={styles.focusGrid}>
        <div className={styles.focusPanel}>
          <header>
            <div>
              <p>PRIORIDAD DE PRUEBA</p>
              <h3>Hipótesis mejor posicionadas</h3>
            </div>
            <button type="button" onClick={() => onNavigate("hypotheses")}>
              Ver ranking completo
            </button>
          </header>
          {primaryHypotheses.length ? (
            <div className={styles.priorityList}>
              {primaryHypotheses.map((item, index) => {
                const record = asRecord(item);
                const title = firstText(
                  record,
                  ["title", "label", "name", "hypothesis"],
                  `Hipótesis ${index + 1}`,
                );
                const reason = firstText(record, [
                  "summary",
                  "reason",
                  "rationale",
                  "description",
                  "why",
                ]);
                return (
                  <article key={`${title}-${index}`}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <div>
                      <EvidenceBadge record={record} />
                      <h4>{title}</h4>
                      <p>
                        {reason ||
                          "Abre el ranking para revisar la evidencia y el experimento propuesto."}
                      </p>
                      <CompanyEvidence
                        record={record}
                        onOpenCompany={onOpenCompany}
                        limit={3}
                      />
                    </div>
                    <Score record={record} />
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptySection title="Todavía no hay hipótesis priorizadas" />
          )}
        </div>

        <aside className={styles.actionPanel}>
          <p>DE LA LECTURA A LA PÁGINA</p>
          <h3>Convierte una oportunidad en una landing medible</h3>
          <span>
            Usa los huecos y los {formatNumber(playbooks.length)} playbooks como
            punto de partida; conserva la evidencia y somete cada promesa a un
            test real.
          </span>
          <a href="?vista=landings">
            Abrir generador de landings <b aria-hidden="true">→</b>
          </a>
          <small>
            La selección se plantea como hipótesis, nunca como ganador
            demostrado.
          </small>
        </aside>
      </section>

      <section className={styles.gapPreview}>
        <header>
          <div>
            <p>ESPACIOS DE MERCADO</p>
            <h3>Huecos que merecen una segunda mirada</h3>
          </div>
          <button type="button" onClick={() => onNavigate("gaps")}>
            Explorar todos
          </button>
        </header>
        {primaryGaps.length ? (
          <div>
            {primaryGaps.map((item, index) => {
              const record = asRecord(item);
              const title = firstText(
                record,
                ["title", "label", "name", "gap"],
                `Oportunidad ${index + 1}`,
              );
              const vertical = firstText(record, ["vertical", "verticalLabel"]);
              const description =
                firstText(record, [
                  "summary",
                  "description",
                  "opportunity",
                  "whyItMatters",
                  "rationale",
                ]) ||
                `${vertical || "Este vertical"}: señal poco visible que conviene contrastar con un control.`;
              const share = firstNumber(record, [
                "adoptionPct",
                "share",
                "prevalence",
                "marketShare",
                "adShare",
              ]);
              return (
                <article key={`${title}-${index}`}>
                  <header>
                    <EvidenceBadge record={record} />
                    {share !== null && (
                      <span>{formatShare(share)} presencia</span>
                    )}
                  </header>
                  <h4>{title}</h4>
                  <p>
                    {description || "Señal pendiente de desarrollo editorial."}
                  </p>
                  <CompanyEvidence
                    record={record}
                    onOpenCompany={onOpenCompany}
                    limit={4}
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <EmptySection title="No hay huecos publicados" />
        )}
      </section>

      <section className={styles.methodology}>
        <div>
          <p>METODOLOGÍA Y LÍMITES</p>
          <h3>Qué permite afirmar este centro</h3>
          <span>
            La actividad, longevidad, repetición y adopción empresarial son
            señales competitivas. Sin gasto, conversiones, citas y ventas no
            prueban rendimiento.
          </span>
        </div>
        <ul>
          {(methodologyItems.length
            ? methodologyItems.slice(0, 6)
            : [
                "Las observaciones proceden de anuncios, páginas y ofertas públicas.",
                "Las inferencias se etiquetan y no se presentan como hechos.",
                "Las hipótesis se validan con experimentos y métricas propias.",
              ]
          ).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details>
          <summary>Ver criterio de lectura</summary>
          <p>
            “Poco utilizado” no equivale a “oportunidad rentable”; “activo
            durante más tiempo” tampoco equivale a “ganador”. El sistema ordena
            dónde mirar y qué probar, manteniendo visibles el origen y el nivel
            de certeza.
          </p>
        </details>
      </section>
    </div>
  );
}

function DnaView({
  items,
  onOpenCompany,
}: {
  items: unknown[];
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  return (
    <div className={styles.dnaGrid}>
      {items.map((item, index) => {
        const record = asRecord(item);
        const company = directCompanyReference(record) ?? {
          id: firstText(record, ["slug", "id"], `company-${index}`),
          label: firstText(
            record,
            ["companyName", "name", "label", "title"],
            `Empresa ${index + 1}`,
          ),
          detail: "",
        };
        const country = firstText(record, [
          "country",
          "market",
          "primaryCountry",
        ]);
        const vertical = firstText(record, ["vertical", "segment", "niche"]);
        const metrics = nestedRecord(record, "metrics");
        const landing = nestedRecord(record, "landing");
        const coherence = nestedRecord(landing, "coherence");
        const ads = firstNumber(metrics, [
          "uniqueIdentities",
          "trustedSemanticIdentities",
          "rawCorpusRows",
        ]);
        const summary =
          firstText(record, [
            "summary",
            "positioning",
            "description",
            "essence",
          ]) || firstText(landing, ["offer", "headline"]);
        const coherenceScore = firstNumber(coherence, ["score"]);
        return (
          <article className={styles.dnaCard} key={`${company.id}-${index}`}>
            <header>
              <div>
                <EvidenceBadge record={record} />
                <h3>{company.label}</h3>
                <p>
                  {[vertical, country].filter(Boolean).join(" · ") ||
                    "Segmento no declarado"}
                </p>
              </div>
              {ads !== null && (
                <span className={styles.sampleBadge}>
                  {formatNumber(ads)} anuncios
                </span>
              )}
            </header>
            {summary && <p className={styles.cardLead}>{summary}</p>}
            <dl className={styles.dnaFields}>
              <InsightField
                label="Público"
                values={signalValues(record, "audience")}
              />
              <InsightField
                label="Dolor"
                values={signalValues(record, "pain")}
              />
              <InsightField
                label="Promesa"
                values={signalValues(record, "promise")}
              />
              <InsightField
                label="Mecanismo"
                values={signalValues(record, "mechanism")}
              />
            </dl>
            <details className={styles.progressiveDetails}>
              <summary>Ver oferta y ejecución</summary>
              <dl className={styles.dnaFields}>
                <InsightField
                  label="Oferta en landing"
                  values={textList(landing, ["offer"])}
                />
                <InsightField
                  label="Garantía"
                  values={signalValues(record, "guarantee")}
                />
                <InsightField
                  label="CTA"
                  values={signalValues(record, "cta")}
                />
                <InsightField
                  label="Formatos"
                  values={signalValues(record, "format")}
                />
              </dl>
              {coherenceScore !== null && (
                <p className={styles.coherenceNote}>
                  <b>{formatShare(coherenceScore)}</b> de continuidad semántica
                  anuncio→landing · lectura heurística, no conversión.
                </p>
              )}
            </details>
            <CompanyLink
              reference={company}
              onOpenCompany={onOpenCompany}
              className={styles.openCompany}
            />
          </article>
        );
      })}
    </div>
  );
}

function GapView({
  items,
  onOpenCompany,
}: {
  items: unknown[];
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  return (
    <div className={styles.cardList}>
      {items.map((item, index) => {
        const record = asRecord(item);
        const title = firstText(
          record,
          ["title", "label", "name", "gap"],
          `Hueco ${index + 1}`,
        );
        const vertical = firstText(record, [
          "vertical",
          "verticalLabel",
          "category",
        ]);
        const observedCompanies = firstNumber(record, [
          "observedCompanies",
          "companiesUsing",
        ]);
        const denominatorCompanies = firstNumber(record, [
          "denominatorCompanies",
          "verticalDenominatorCompanies",
        ]);
        const adoption = firstNumber(record, [
          "adoptionPct",
          "share",
          "prevalence",
          "marketShare",
          "adShare",
        ]);
        const gap = firstNumber(record, ["gapPct"]);
        const description =
          firstText(record, [
            "description",
            "summary",
            "opportunity",
            "finding",
          ]) ||
          (observedCompanies !== null && denominatorCompanies !== null
            ? `${formatNumber(observedCompanies)} de ${formatNumber(denominatorCompanies)} empresas del vertical hacen visible esta señal.`
            : "Frecuencia baja en la evidencia recuperada para este vertical.");
        const why = firstText(record, [
          "whyItMatters",
          "rationale",
          "why",
          "reason",
        ]);
        const limitation = firstText(record, ["limitation"]);
        const action =
          firstText(record, [
            "recommendation",
            "recommendedAction",
            "nextStep",
            "test",
            "move",
          ]) ||
          `Probar una variante que haga explícito “${title}” frente a un control equivalente.`;
        return (
          <article className={styles.wideCard} key={`${title}-${index}`}>
            <div className={styles.cardRank}>
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className={styles.wideCardBody}>
              <header>
                <div>
                  <EvidenceBadge record={record} />
                  {vertical && (
                    <span className={styles.contextLabel}>{vertical}</span>
                  )}
                  <h3>{title}</h3>
                </div>
                <Score record={record} />
              </header>
              {description && <p className={styles.cardLead}>{description}</p>}
              <div className={styles.metricStrip}>
                {adoption !== null && (
                  <span>
                    <small>Presencia observada</small>
                    <b>{formatShare(adoption)}</b>
                  </span>
                )}
                {gap !== null && (
                  <span>
                    <small>Espacio no observado</small>
                    <b>{formatShare(gap)}</b>
                  </span>
                )}
                {observedCompanies !== null && (
                  <span>
                    <small>Empresas asociadas</small>
                    <b>{formatNumber(observedCompanies)}</b>
                  </span>
                )}
                <span>
                  <small>Lectura</small>
                  <b>Hipótesis</b>
                </span>
              </div>
              {(why || action || limitation) && (
                <details className={styles.progressiveDetails}>
                  <summary>Por qué importa y cómo probarlo</summary>
                  <div className={styles.detailColumns}>
                    {(why || limitation) && (
                      <div>
                        <b>Interpretación y límite</b>
                        <p>{why || limitation}</p>
                      </div>
                    )}
                    {action && (
                      <div>
                        <b>Siguiente experimento</b>
                        <p>{action}</p>
                      </div>
                    )}
                  </div>
                </details>
              )}
              <CompanyEvidence record={record} onOpenCompany={onOpenCompany} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PlaybookView({
  items,
  onOpenCompany,
}: {
  items: unknown[];
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  return (
    <div className={styles.playbookGrid}>
      {items.map((item, index) => {
        const record = asRecord(item);
        const vertical = firstText(
          record,
          ["label", "vertical", "niche", "segment", "category"],
          "Playbook transversal",
        );
        const title = firstText(
          record,
          ["title", "name"],
          `Sistema recomendado · ${vertical}`,
        );
        const summary = firstText(record, [
          "summary",
          "description",
          "positioning",
          "thesis",
        ]);
        const observedAudience = playbookModule(record, "audience");
        const observedPain = playbookModule(record, "pain");
        const observedPromise = playbookModule(record, "promise");
        const observedGuarantee = playbookModule(record, "guarantee");
        const observedCta = playbookModule(record, "cta");
        const observedFormat = playbookModule(record, "format");
        const landingBlueprint = nestedRecord(record, "landingBlueprint");
        const landing = asArray(landingBlueprint?.modules)
          .map((module) => firstText(asRecord(module), ["label", "purpose"]))
          .filter(Boolean);
        const tests = asArray(record?.opportunityTests)
          .map((test) => firstText(asRecord(test), ["test"]))
          .filter(Boolean);
        const moduleRows: Array<[string, string, string]> = [
          ["01", "Público", firstText(observedAudience, ["label"])],
          ["02", "Dolor", firstText(observedPain, ["label"])],
          ["03", "Promesa", firstText(observedPromise, ["label"])],
          ["04", "Garantía", firstText(observedGuarantee, ["label"])],
          ["05", "CTA", firstText(observedCta, ["label"])],
          ["06", "Formato", firstText(observedFormat, ["label"])],
        ].filter((entry) => Boolean(entry[2])) as Array<
          [string, string, string]
        >;
        return (
          <article className={styles.playbookCard} key={`${title}-${index}`}>
            <header>
              <span>{vertical}</span>
              <EvidenceBadge record={record} />
            </header>
            <h3>{title}</h3>
            <p className={styles.cardLead}>
              {summary ||
                "Plan sintetizado a partir de frecuencia empresarial observada y estructura de landing; necesita validación propia."}
            </p>
            <div className={styles.playbookSequence}>
              {moduleRows.map(([number, label, value]) => (
                <div key={label}>
                  <b>{number}</b>
                  <span>
                    <small>{label}</small>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {(landing.length > 0 || tests.length > 0) && (
              <details className={styles.progressiveDetails}>
                <summary>Ver blueprint y test</summary>
                <div className={styles.detailColumns}>
                  {landing.length > 0 && (
                    <div>
                      <b>Secuencia de landing</b>
                      <p>{landing.join(" → ")}</p>
                    </div>
                  )}
                  {tests.length > 0 && (
                    <div>
                      <b>Primeros experimentos</b>
                      <p>{tests.slice(0, 3).join(" · ")}</p>
                    </div>
                  )}
                </div>
              </details>
            )}
            <CompanyEvidence
              record={record}
              onOpenCompany={onOpenCompany}
              limit={5}
            />
            <a className={styles.landingCta} href="?vista=landings">
              Crear landing desde este playbook{" "}
              <span aria-hidden="true">→</span>
            </a>
          </article>
        );
      })}
    </div>
  );
}

function OfferView({
  items,
  matrix,
  onOpenCompany,
}: {
  items: unknown[];
  matrix: unknown;
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  const matrixRecord = asRecord(matrix);
  const summary = nestedRecord(matrixRecord, "summary");
  const denominator = firstNumber(matrixRecord, ["denominatorCompanies"]);
  const publicPriceShare = firstNumber(summary, ["publicPriceSharePct"]);
  const guaranteeShare = firstNumber(summary, ["guaranteeSharePct"]);
  const offerModels = asArray(summary?.offerModels);
  return (
    <div className={styles.offerView}>
      <section className={styles.offerSummary} aria-label="Resumen de ofertas">
        <article>
          <small>UNIVERSO</small>
          <b>{formatNumber(denominator)}</b>
          <span>empresas comparadas</span>
        </article>
        <article>
          <small>PRECIO VISIBLE</small>
          <b>{formatShare(publicPriceShare)}</b>
          <span>publican alguna referencia</span>
        </article>
        <article>
          <small>GARANTÍA OBSERVADA</small>
          <b>{formatShare(guaranteeShare)}</b>
          <span>declaran reversión de riesgo</span>
        </article>
        <article>
          <small>MODELO MÁS VISIBLE</small>
          <b>
            {firstText(asRecord(offerModels[0]), ["label"], "No clasificado")}
          </b>
          <span>
            {formatShare(firstNumber(asRecord(offerModels[0]), ["sharePct"]))}{" "}
            del universo
          </span>
        </article>
      </section>
      <div className={styles.offerTableWrap}>
        <table className={styles.offerTable}>
          <caption className={styles.srOnly}>
            Comparativa de ofertas competidoras
          </caption>
          <thead>
            <tr>
              <th>Empresa / oferta</th>
              <th>Modelo</th>
              <th>Precio público</th>
              <th>Garantía</th>
              <th>Permanencia</th>
              <th>Evidencia</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const record = asRecord(item);
              const company = directCompanyReference(record);
              const title =
                company?.label ||
                firstText(
                  record,
                  ["title", "label", "name", "offer"],
                  `Oferta ${index + 1}`,
                );
              const offer = firstText(record, [
                "offer",
                "description",
                "summary",
                "product",
              ]);
              const model =
                textList(record, [
                  "models",
                  "model",
                  "billingModel",
                  "offerModel",
                  "type",
                ]).join(" · ") || "No observable";
              const price = firstText(
                record,
                ["pricing", "price", "priceLabel", "publicPrice"],
                "No publicado",
              );
              const guarantee = firstText(
                record,
                ["guarantee", "riskReversal"],
                "No observable",
              );
              const contract = firstText(
                record,
                ["contract", "permanence", "commitment", "duration"],
                "No observable",
              );
              return (
                <tr key={`${title}-${index}`}>
                  <td data-label="Empresa / oferta">
                    <b>
                      {company ? (
                        <CompanyLink
                          reference={company}
                          onOpenCompany={onOpenCompany}
                        />
                      ) : (
                        title
                      )}
                    </b>
                    {offer && offer !== title && <span>{offer}</span>}
                  </td>
                  <td data-label="Modelo">{model}</td>
                  <td data-label="Precio público">{price}</td>
                  <td data-label="Garantía">{guarantee}</td>
                  <td data-label="Permanencia">{contract}</td>
                  <td data-label="Evidencia">
                    <EvidenceBadge record={record} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatternView({
  items,
  onOpenCompany,
}: {
  items: unknown[];
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  return (
    <div className={styles.patternGrid}>
      {items.map((item, index) => {
        const record = asRecord(item);
        const metrics = nestedRecord(record, "metrics");
        const category = firstText(
          record,
          ["categoryLabel", "category", "dimension", "family", "type"],
          "Patrón",
        );
        const title = firstText(
          record,
          ["title", "label", "name", "pattern"],
          `Patrón ${index + 1}`,
        );
        const saturation = firstText(record, ["saturation"]);
        const saturationMeaning = firstText(record, ["saturationMeaning"]);
        const description =
          firstText(record, [
            "description",
            "summary",
            "definition",
            "finding",
          ]) ||
          (saturation
            ? `Saturación ${saturation}. ${saturationMeaning}`
            : "Frecuencia empresarial observada en la cohorte semántica.");
        const when = firstText(record, [
          "whenToUse",
          "useCase",
          "recommendation",
          "bestFor",
        ]);
        const risk = textList(record, [
          "risks",
          "risk",
          "warning",
          "limitations",
        ]).join(" · ");
        const share = firstNumber(metrics, [
          "adoptionPct",
          "share",
          "prevalence",
          "adShare",
          "frequency",
        ]);
        const companies = firstNumber(metrics, [
          "companies",
          "companyCount",
          "companiesUsing",
        ]);
        return (
          <article className={styles.patternCard} key={`${title}-${index}`}>
            <header>
              <span>{category}</span>
              <EvidenceBadge record={record} />
            </header>
            <h3>{title}</h3>
            {description && <p className={styles.cardLead}>{description}</p>}
            <div className={styles.patternMetrics}>
              {share !== null && (
                <span>
                  <b>{formatShare(share)}</b>
                  <small>presencia</small>
                </span>
              )}
              {companies !== null && (
                <span>
                  <b>{formatNumber(companies)}</b>
                  <small>empresas</small>
                </span>
              )}
            </div>
            {(when || risk) && (
              <details className={styles.progressiveDetails}>
                <summary>Cuándo usarlo y qué vigilar</summary>
                {when && (
                  <div className={styles.guidance}>
                    <b>Puede encajar cuando</b>
                    <p>{when}</p>
                  </div>
                )}
                {risk && (
                  <div className={`${styles.guidance} ${styles.warning}`}>
                    <b>Riesgo</b>
                    <p>{risk}</p>
                  </div>
                )}
              </details>
            )}
            <CompanyEvidence record={record} onOpenCompany={onOpenCompany} />
          </article>
        );
      })}
    </div>
  );
}

function HypothesisView({
  items,
  ranking,
  onOpenCompany,
}: {
  items: unknown[];
  ranking: unknown;
  onOpenCompany?: (id: string) => void;
}) {
  if (!items.length) return <EmptySection />;
  const rankingRecord = asRecord(ranking);
  const disclaimer = firstText(rankingRecord, ["disclaimer"]);
  const formula = firstText(rankingRecord, ["formula"]);
  return (
    <div>
      <aside className={styles.hypothesisNotice}>
        <b>
          Ranking para decidir qué probar, no una clasificación de ganadores.
        </b>
        <span>
          {disclaimer ||
            "La puntuación combina señales de mercado y calidad de evidencia; no sustituye CPL, citas, ventas ni margen."}
        </span>
      </aside>
      {formula && (
        <p className={styles.formulaNote}>
          <b>Cómo se ordena:</b> {formula}
        </p>
      )}
      <ol className={styles.hypothesisList}>
        {items.map((item, index) => {
          const record = asRecord(item);
          const title = firstText(
            record,
            ["title", "label", "name", "hypothesis"],
            `Hipótesis ${index + 1}`,
          );
          const rationale = firstText(record, [
            "interpretation",
            "rationale",
            "reason",
            "why",
            "description",
            "summary",
          ]);
          const test = firstText(record, [
            "claim",
            "recommendedTest",
            "test",
            "experiment",
            "nextStep",
          ]);
          const success = firstText(record, [
            "successMetric",
            "metric",
            "measurement",
            "decisionRule",
          ]);
          const confidence = firstText(record, [
            "confidence",
            "confidenceLabel",
            "evidenceStrength",
          ]);
          const components = asRecord(record?.components);
          const componentRows = [
            ["Adopción", firstNumber(components, ["adoption"])],
            ["Actividad", firstNumber(components, ["activity"])],
            ["Longevidad", firstNumber(components, ["longevity"])],
            ["Variantes", firstNumber(components, ["variants"])],
            ["Formato", firstNumber(components, ["format"])],
            ["Continuidad", firstNumber(components, ["landingCoherence"])],
          ].filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          );
          return (
            <li key={`${title}-${index}`}>
              <div className={styles.hypothesisRank}>
                <small>RANGO</small>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </div>
              <article>
                <header>
                  <div>
                    <EvidenceBadge record={record} />
                    {confidence && (
                      <span className={styles.confidence}>{confidence}</span>
                    )}
                  </div>
                  <Score record={record} />
                </header>
                <h3>{title}</h3>
                {rationale && <p className={styles.cardLead}>{rationale}</p>}
                {(test || success) && (
                  <div className={styles.testPlan}>
                    {test && (
                      <div>
                        <small>TEST RECOMENDADO</small>
                        <p>{test}</p>
                      </div>
                    )}
                    {success && (
                      <div>
                        <small>REGLA DE LECTURA</small>
                        <p>{success}</p>
                      </div>
                    )}
                  </div>
                )}
                {componentRows.length > 0 && (
                  <details className={styles.progressiveDetails}>
                    <summary>Ver componentes de la puntuación</summary>
                    <div className={styles.componentGrid}>
                      {componentRows.map(([label, value]) => (
                        <span key={label}>
                          <small>{label}</small>
                          <b>{formatShare(value)}</b>
                        </span>
                      ))}
                    </div>
                  </details>
                )}
                <CompanyEvidence
                  record={record}
                  onOpenCompany={onOpenCompany}
                />
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
