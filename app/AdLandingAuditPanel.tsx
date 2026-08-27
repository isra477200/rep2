"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import styles from "./AdLandingAuditPanel.module.css";

type AuditStatus = "aligned" | "partial" | "leak" | "not_observed";
type AuditState =
  | "coherent_sample"
  | "needs_review"
  | "critical_leaks"
  | "insufficient_evidence";
type Confidence = "high" | "medium" | "low";

export type AdLandingAuditDimension = {
  id: string;
  label: string;
  weight: number;
  status: AuditStatus;
  score: number | null;
  rationale: string;
  signals: Record<string, unknown>;
};

export type AdLandingAuditItem = {
  id: string;
  companyId: string;
  companyName: string;
  country: string;
  vertical: string;
  verticalLabel: string;
  landing: {
    url: string | null;
    destinationCount: number;
    observedDestinations: string[];
    captureStatus: string;
    capture: {
      url: string | null;
      requestedUrl: string | null;
      finalUrl: string | null;
      captureFile: string | null;
      thumbnailFile: string | null;
      captureStatus: string;
      capturedAt: string | null;
      headline: string | null;
      excerpt: string | null;
    };
    read: {
      headline: string | null;
      promise: string | null;
      audience: string | null;
      offer: string | null;
      mechanism: string[];
      primaryCta: string | null;
      proof: string | null;
      price: string | null;
      guarantee: string | null;
    };
  };
  ads: {
    total: number;
    usableForAudit: number;
    excludedFromSemantics: number;
    uniqueCopies: number;
    active: number;
    evidence: Array<{
      id: string;
      corpusKey: string;
      title: string;
      copy: string;
      cta: string;
      sourceUrl: string | null;
      landingUrl: string | null;
    }>;
  };
  qualityScore: number | null;
  scoreMeaning: string;
  confidence: {
    score: number;
    label: Confidence;
    evaluatedShare: number;
    captureShare: number;
    note: string;
  };
  state: AuditState;
  dimensions: AdLandingAuditDimension[];
  leaks: Array<{
    dimension: string;
    label: string;
    severity: "high" | "medium" | "low";
    finding: string;
    action: string;
    priority: number;
  }>;
  actions: Array<{
    priority: number;
    dimension: string;
    label: string;
    action: string;
  }>;
  limitation: string;
};

export type AdLandingAuditData = {
  schemaVersion: string;
  generatedAt: string;
  methodology: {
    name: string;
    qualityScore: string;
    coverage: string;
    warning: string;
    statusSemantics: Record<AuditStatus, string>;
  };
  summary: {
    companies: number;
    evaluable: number;
    insufficientEvidence: number;
    averageQualityScore: number | null;
    medianQualityScore: number | null;
    averageConfidence: number | null;
    totalAds: number;
    uniqueCopies: number;
    withCapturedLanding: number;
    stateCounts: Record<string, number>;
    confidenceCounts: Record<string, number>;
    verticalCounts: Record<string, number>;
  };
  items: AdLandingAuditItem[];
};

export type AdLandingAuditPanelProps = {
  data?: AdLandingAuditData;
  initialCompanyId?: string;
  onOpenCompany?: (companyId: string) => void;
  className?: string;
};

const STATE_LABELS: Record<AuditState, string> = {
  coherent_sample: "Continuidad sólida en la muestra",
  needs_review: "Revisión recomendada",
  critical_leaks: "Fugas prioritarias",
  insufficient_evidence: "Evidencia insuficiente",
};

const STATUS_LABELS: Record<AuditStatus, string> = {
  aligned: "Alineado",
  partial: "Parcial",
  leak: "Fuga",
  not_observed: "No observado",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const scoreLabel = (score: number | null) =>
  score === null ? "—" : String(score);

const shortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const hostLabel = (value?: string | null) => {
  if (!value) return "Destino no observado";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

function ScoreRing({
  score,
  coverage,
}: {
  score: number | null;
  coverage: number;
}) {
  const value = score ?? 0;
  return (
    <div
      className={styles.scoreRing}
      style={{ "--audit-score": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={
        score === null
          ? "Índice no calculado"
          : `Índice de continuidad ${score} sobre 100`
      }
    >
      <div>
        <strong>{scoreLabel(score)}</strong>
        <span>{score === null ? "sin nota" : "/ 100"}</span>
        <small>{coverage}% evaluado</small>
      </div>
    </div>
  );
}

function MethodologyNote({ data }: { data: AdLandingAuditData }) {
  return (
    <details className={styles.methodology}>
      <summary>Cómo leer esta auditoría</summary>
      <div>
        <p>{data.methodology.qualityScore}</p>
        <p>{data.methodology.coverage}</p>
        <strong>{data.methodology.warning}</strong>
      </div>
    </details>
  );
}

function AdLandingAuditContent({
  data,
  initialCompanyId,
  onOpenCompany,
  className = "",
}: AdLandingAuditPanelProps & { data: AdLandingAuditData }) {
  const [vertical, setVertical] = useState("all");
  const [state, setState] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    data.items.find((item) => item.companyId === initialCompanyId)?.id ||
      data.items[0]?.id ||
      "",
  );

  const verticals = useMemo(
    () =>
      [
        ...new Map(
          data.items.map((item) => [item.vertical, item.verticalLabel]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "es")),
    [data.items],
  );

  const filtered = useMemo(() => {
    const needle = clean(query).toLocaleLowerCase("es");
    return data.items.filter((item) => {
      if (vertical !== "all" && item.vertical !== vertical) return false;
      if (state !== "all" && item.state !== state) return false;
      if (confidence !== "all" && item.confidence.label !== confidence)
        return false;
      if (
        needle &&
        !`${item.companyName} ${item.country} ${item.verticalLabel}`
          .toLocaleLowerCase("es")
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [confidence, data.items, query, state, vertical]);

  const selected =
    filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const selectedCapture =
    selected?.landing.capture.thumbnailFile ||
    selected?.landing.capture.captureFile;

  return (
    <section
      className={`${styles.panel} ${className}`.trim()}
      aria-labelledby="ad-landing-audit-title"
    >
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            INTELIGENCIA DE RECORRIDO · ANUNCIO → LANDING
          </p>
          <h2 id="ad-landing-audit-title">
            ¿La landing cumple lo que prepara el anuncio?
          </h2>
          <p>
            Compara promesa, público, oferta, CTA y confianza con evidencia
            concreta. Una ausencia de datos queda como{" "}
            <strong>no observada</strong>; nunca se convierte automáticamente en
            una mala nota.
          </p>
        </div>
        <div className={styles.updateStamp}>
          <span>Último procesamiento</span>
          <strong>{shortDate(data.generatedAt)}</strong>
          <small>{data.schemaVersion}</small>
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <article>
          <span>Empresas contrastadas</span>
          <strong>{data.summary.companies.toLocaleString("es-ES")}</strong>
          <small>
            {data.summary.totalAds.toLocaleString("es-ES")} anuncios enlazados
          </small>
        </article>
        <article>
          <span>Con índice calculable</span>
          <strong>{data.summary.evaluable.toLocaleString("es-ES")}</strong>
          <small>{data.summary.insufficientEvidence} quedan sin nota</small>
        </article>
        <article>
          <span>Landing capturada</span>
          <strong>
            {data.summary.withCapturedLanding.toLocaleString("es-ES")}
          </strong>
          <small>Evidencia visual o textual recuperada</small>
        </article>
        <article>
          <span>Continuidad media</span>
          <strong>{scoreLabel(data.summary.averageQualityScore)}</strong>
          <small>Índice descriptivo, no rendimiento</small>
        </article>
      </div>

      <MethodologyNote data={data} />

      <div className={styles.filters} aria-label="Filtros de auditoría">
        <label className={styles.searchField}>
          <span>Buscar empresa</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, país o vertical…"
          />
        </label>
        <label>
          <span>Vertical</span>
          <select
            value={vertical}
            onChange={(event) => setVertical(event.target.value)}
          >
            <option value="all">Todas</option>
            {verticals.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="all">Todos</option>
            {Object.entries(STATE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Confianza</span>
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="all">Todas</option>
            {Object.entries(CONFIDENCE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.resultCount} aria-live="polite">
          <strong>{filtered.length}</strong>
          <span>resultados</span>
        </div>
      </div>

      {selected ? (
        <div className={styles.workspace}>
          <aside
            className={styles.ranking}
            aria-label="Ranking descriptivo de continuidad"
          >
            <div className={styles.rankingHeader}>
              <div>
                <span>Comparativa</span>
                <strong>Continuidad observada</strong>
              </div>
              <small>Ordenado por índice</small>
            </div>
            <div className={styles.rankingList}>
              {filtered.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.rankingItem}
                  data-selected={item.id === selected.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.companyLabel}>
                    <strong>{item.companyName}</strong>
                    <small>
                      {item.verticalLabel} · {item.ads.uniqueCopies}{" "}
                      {item.ads.uniqueCopies === 1 ? "copy" : "copies"}
                    </small>
                  </span>
                  <span
                    className={styles.miniScore}
                    data-empty={item.qualityScore === null}
                  >
                    {scoreLabel(item.qualityScore)}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <article className={styles.detail}>
            <header className={styles.detailHeader}>
              <ScoreRing
                score={selected.qualityScore}
                coverage={selected.confidence.evaluatedShare}
              />
              <div className={styles.detailIdentity}>
                <div className={styles.badges}>
                  <span data-tone={selected.state}>
                    {STATE_LABELS[selected.state]}
                  </span>
                  <span data-confidence={selected.confidence.label}>
                    {CONFIDENCE_LABELS[selected.confidence.label]}
                  </span>
                </div>
                <h3>{selected.companyName}</h3>
                <p>
                  {selected.verticalLabel} · {selected.country} ·{" "}
                  {selected.ads.usableForAudit} piezas aptas /{" "}
                  {selected.ads.total} recuperadas
                </p>
                <a
                  href={selected.landing.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hostLabel(selected.landing.url)}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
              {onOpenCompany ? (
                <button
                  className={styles.openCompany}
                  type="button"
                  onClick={() => onOpenCompany(selected.companyId)}
                >
                  Abrir ficha
                </button>
              ) : null}
            </header>

            <div className={styles.confidenceBar}>
              <div>
                <span>Confianza de lectura</span>
                <strong>{selected.confidence.score}/100</strong>
              </div>
              <div className={styles.track}>
                <i style={{ width: `${selected.confidence.score}%` }} />
              </div>
              <p>{selected.confidence.note}</p>
            </div>

            <section className={styles.detailSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>Desglose explicable</span>
                  <h4>Qué continúa y dónde se pierde</h4>
                </div>
                <p>“No observado” no interviene en el índice.</p>
              </div>
              <div className={styles.dimensionGrid}>
                {selected.dimensions.map((dimension) => (
                  <article
                    key={dimension.id}
                    className={styles.dimension}
                    data-status={dimension.status}
                  >
                    <header>
                      <span>{dimension.label}</span>
                      <strong>
                        {dimension.score === null
                          ? "—"
                          : `${dimension.score}/100`}
                      </strong>
                    </header>
                    <div className={styles.dimensionTrack}>
                      <i style={{ width: `${dimension.score || 0}%` }} />
                    </div>
                    <b>{STATUS_LABELS[dimension.status]}</b>
                    <p>{dimension.rationale}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.detailSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>Traza verificable</span>
                  <h4>Evidencia utilizada</h4>
                </div>
              </div>
              <div className={styles.evidenceGrid}>
                <div className={styles.adEvidence}>
                  <header>
                    <span>Anuncios</span>
                    <strong>
                      {selected.ads.evidence.length} piezas representativas
                    </strong>
                  </header>
                  {selected.ads.evidence.slice(0, 3).map((ad) => (
                    <article key={ad.corpusKey || ad.id}>
                      <div>
                        <span>ID {ad.id || ad.corpusKey}</span>
                        {ad.sourceUrl ? (
                          <a
                            href={ad.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fuente ↗
                          </a>
                        ) : null}
                      </div>
                      {ad.title ? <strong>{ad.title}</strong> : null}
                      <p>{ad.copy}</p>
                      {ad.cta ? <small>CTA observado · {ad.cta}</small> : null}
                    </article>
                  ))}
                </div>
                <div className={styles.landingEvidence}>
                  <header>
                    <span>Landing</span>
                    <strong>
                      {selected.landing.capture.captureFile
                        ? "Captura completa disponible"
                        : "Cobertura limitada"}
                    </strong>
                  </header>
                  {selectedCapture ? (
                    <a
                      className={styles.capturePreview}
                      href={
                        selected.landing.capture.captureFile || selectedCapture
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={selectedCapture}
                        alt={`Captura de la landing de ${selected.companyName}`}
                      />
                      <span>Ampliar captura ↗</span>
                    </a>
                  ) : (
                    <div className={styles.noCapture}>
                      <strong>Captura no disponible</strong>
                      <p>
                        Se conserva como ausencia de evidencia y no como fallo
                        de la landing.
                      </p>
                    </div>
                  )}
                  {selected.landing.capture.headline ? (
                    <h5>{selected.landing.capture.headline}</h5>
                  ) : null}
                  {selected.landing.capture.excerpt ? (
                    <p>{selected.landing.capture.excerpt}</p>
                  ) : null}
                  {selected.landing.capture.url ? (
                    <a
                      href={selected.landing.capture.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir URL observada ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </section>

            <section className={styles.detailSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>Plan de corrección</span>
                  <h4>Acciones priorizadas por pérdida ponderada</h4>
                </div>
                <p>
                  El motivo de cada acción queda en el desglose superior; aquí
                  solo aparece el cambio concreto.
                </p>
              </div>
              {selected.actions.length ? (
                <ol className={styles.actions}>
                  {selected.actions.map((action) => (
                    <li key={`${action.priority}-${action.dimension}`}>
                      <span>{String(action.priority).padStart(2, "0")}</span>
                      <div>
                        <strong>{action.label}</strong>
                        <p>{action.action}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className={styles.noActions}>
                  {selected.state === "insufficient_evidence"
                    ? "No generamos acciones con evidencia insuficiente. Primero hay que recuperar una landing y piezas comparables."
                    : "No se detectaron pérdidas con peso suficiente para prescribir un cambio. Conviene validar con métricas reales antes de decidir."}
                </div>
              )}
            </section>

            <footer className={styles.disclaimer}>{selected.limitation}</footer>
          </article>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>No hay resultados con estos filtros.</strong>
          <p>Prueba otra empresa, vertical o nivel de confianza.</p>
        </div>
      )}
    </section>
  );
}

export default function AdLandingAuditPanel(props: AdLandingAuditPanelProps) {
  const [remoteData, setRemoteData] = useState<AdLandingAuditData | null>(null);
  const [loadError, setLoadError] = useState("");
  const data = props.data || remoteData;

  useEffect(() => {
    if (props.data) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/data/ad-landing-audit.json", {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as AdLandingAuditData;
        if (
          payload.schemaVersion !== "rv-ad-landing-audit-v1" ||
          !Array.isArray(payload.items)
        ) {
          throw new Error("Esquema de auditoría no reconocido");
        }
        setRemoteData(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la auditoría",
        );
      }
    };
    void load();
    return () => controller.abort();
  }, [props.data]);

  if (!data) {
    return (
      <section
        className={`${styles.panel} ${props.className || ""}`.trim()}
        aria-live="polite"
      >
        <div className={styles.loadingState} data-error={Boolean(loadError)}>
          <strong>
            {loadError
              ? "No se pudo abrir la auditoría"
              : "Preparando auditoría anuncio → landing…"}
          </strong>
          <p>
            {loadError
              ? `El archivo de resultados no está disponible (${loadError}).`
              : "Cargando el análisis solo para esta vista, sin añadirlo al paquete principal de la aplicación."}
          </p>
        </div>
      </section>
    );
  }

  return <AdLandingAuditContent {...props} data={data} />;
}
