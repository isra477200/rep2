"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element, jsx-a11y/label-has-associated-control */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./nichos.module.css";
import { CAPTURE_UNITS, PRICING, PRICING_SOURCE } from "../ejecucion/catalog";
import { buildOperationalPlaybooks } from "../ejecucion/playbooks";
import GrowthRoutes, { ROUTE_COUNT, type RouteSystem } from "./GrowthRoutes";
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  sanitizeWeights,
  STRATEGY,
  type DimensionKey,
  type NicheStrategy,
  weightedStrategyScore,
} from "./strategy";

type Competitor = {
  id: string;
  name: string;
  score: number;
  decision: string;
};

type Niche = {
  id: string;
  rank: number;
  name: string;
  subtitle: string;
  status: string;
  score: number;
  recommendation: string;
  reason: string;
  result: string;
  fee: string;
  media: string;
  offer: string;
  target: string;
  reject: string;
  qualification: string[];
  funnel: string[];
  campaigns: string[];
  copy: { b2b: string; b2c: string };
  opener: string;
  objections: string[];
  kpis: string[];
  plan: string[];
  competitors: Competitor[];
};

type Pricing = {
  name: string;
  net: number;
  vat: number;
  gross: number;
};

type IndexData = {
  generatedAt: string;
  source: string;
  disclaimer: string;
  pricing: Pricing[];
  patterns: Array<{ title: string; text: string }>;
  files: string[];
};

type LoadedData = IndexData & { niches: Niche[] };
type View = "overview" | "portfolio" | "compare" | "routes" | "competitors" | "methodology" | "detail";
type DetailTab = "strategy" | "routes" | "playbook" | "economics" | "funnel" | "competition" | "execution";
type PhaseFilter = "Todos" | NicheStrategy["phase"];

type CompetitorAggregate = {
  id: string;
  name: string;
  score: number;
  decisions: string[];
  niches: Array<{ id: string; name: string }>;
};

type Weights = Record<DimensionKey, number>;

type EconomicsState = {
  media: number;
  cpl: number;
  valuePerSale: number;
  grossMarginPct: number;
  qualificationPct: number;
  showPct: number;
  closePct: number;
};

const DEFAULT_WEIGHTS: Weights = {
  demand: 10,
  value: 10,
  margin: 8,
  qualification: 8,
  demonstrability: 7,
  competition: 6,
  defensibility: 8,
  experience: 8,
  speed: 7,
  legalRisk: 7,
  standardisation: 6,
  scalability: 6,
  mentalCost: 4,
  volume: 5,
};

const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  demand: "Intención observable y capacidad de generar volumen.",
  value: "Ticket y LTV que pueden financiar la captación.",
  margin: "Contribución disponible después de servir el trabajo.",
  qualification: "Claridad de los datos que separan una oportunidad útil.",
  demonstrability: "Facilidad para devolver un resultado verificable al sistema.",
  competition: "Espacio competitivo disponible; 100 implica menor presión relativa.",
  defensibility: "Especialización, activos y dificultad de copia.",
  experience: "Evidencia y aprendizaje previo ya disponible.",
  speed: "Tiempo necesario para obtener una señal fiable.",
  legalRisk: "Capacidad de operar con claims, datos y procesos conformes; 100 implica riesgo más controlable.",
  standardisation: "Capacidad de repetir oferta, cualificación y seguimiento.",
  scalability: "Posibilidad de crecer por zona, cliente o presupuesto.",
  mentalCost: "Carga operativa sostenible; 100 implica menor fricción interna.",
  volume: "Techo potencial de oportunidades económicamente útiles.",
};

const PHASES: PhaseFilter[] = ["Todos", "Ahora", "Siguiente", "Validar", "Después"];
const DECISIONS = ["Todas", "Copiar", "Adaptar", "Probar", "Vigilar", "Descartar", "Prospecto"];
const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "strategy", label: "Estrategia" },
  { id: "routes", label: "4 vías" },
  { id: "playbook", label: "Ficha A–S" },
  { id: "economics", label: "Economía" },
  { id: "funnel", label: "Funnel y medición" },
  { id: "competition", label: "Competencia" },
  { id: "execution", label: "Ejecución" },
];

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

const safeGet = (key: string) => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const safeSet = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // La aplicación sigue operativa aunque el navegador bloquee la persistencia.
  }
};

const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

const parseFee = (fee: string) => {
  const match = fee.match(/([\d.]+)\s*€/);
  return match ? Number(match[1].replace(/\./g, "")) : 0;
};

const phaseClass = (phase: NicheStrategy["phase"]) => {
  if (phase === "Ahora") return styles.phaseNow;
  if (phase === "Siguiente") return styles.phaseNext;
  if (phase === "Validar") return styles.phaseValidate;
  return styles.phaseLater;
};

const decisionClass = (decision: string) => {
  if (decision === "Copiar") return styles.decisionCopy;
  if (decision === "Adaptar") return styles.decisionAdapt;
  if (decision === "Probar") return styles.decisionTest;
  if (decision === "Descartar") return styles.decisionDiscard;
  if (decision === "Prospecto") return styles.decisionProspect;
  return styles.decisionWatch;
};

const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

function SectionTitle({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {text ? <span>{text}</span> : null}
      </div>
      {action}
    </div>
  );
}

function ScoreBar({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={compact ? styles.scoreBarCompact : styles.scoreBar}>
      <div>
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone?: "positive" | "negative" }) {
  return (
    <article className={`${styles.card} ${tone === "positive" ? styles.cardPositive : tone === "negative" ? styles.cardNegative : ""}`}>
      <h3>{title}</h3>
      <ul className={styles.cleanList}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

function EconomicsModel({ niche, strategy }: { niche: Niche; strategy: NicheStrategy }) {
  const [values, setValues] = useState<EconomicsState>(strategy.economics);

  const fee = parseFee(niche.fee);
  const leads = values.cpl > 0 ? values.media / values.cpl : 0;
  const qualified = leads * values.qualificationPct / 100;
  const attended = qualified * values.showPct / 100;
  const sales = attended * values.closePct / 100;
  const revenue = sales * values.valuePerSale;
  const grossProfit = revenue * values.grossMarginPct / 100;
  const acquisitionCost = values.media + fee;
  const contribution = grossProfit - acquisitionCost;
  const profitPerSale = values.valuePerSale * values.grossMarginPct / 100;
  const expectedGrossProfitPerLead = profitPerSale * values.qualificationPct / 100 * values.showPct / 100 * values.closePct / 100;
  const maxCpl = values.media > 0 ? expectedGrossProfitPerLead / (1 + fee / values.media) : 0;
  const cac = sales > 0 ? acquisitionCost / sales : 0;
  const breakEvenSales = profitPerSale > 0 ? acquisitionCost / profitPerSale : 0;

  const set = (key: keyof EconomicsState, value: string) => {
    const parsed = Number(value);
    setValues((current) => ({ ...current, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <div className={styles.economicsLayout}>
      <div className={styles.economicsPanel}>
        <div className={styles.modelHeader}>
          <div>
            <span>MODELO EDITABLE</span>
            <h3>Hipótesis de unidad económica</h3>
          </div>
          <button onClick={() => setValues(strategy.economics)}>Restablecer</button>
        </div>
        <div className={styles.fieldGrid}>
          <label>Medios/mes, neto (€)<input type="number" min="0" value={values.media} onChange={(event) => set("media", event.target.value)} /></label>
          <label>CPL estimado (€)<input type="number" min="0" value={values.cpl} onChange={(event) => set("cpl", event.target.value)} /></label>
          <label>Valor bruto por venta/caso (€)<input type="number" min="0" value={values.valuePerSale} onChange={(event) => set("valuePerSale", event.target.value)} /></label>
          <label>Margen bruto (%)<input type="number" min="0" max="100" value={values.grossMarginPct} onChange={(event) => set("grossMarginPct", event.target.value)} /></label>
          <label>Lead→válido (%)<input type="number" min="0" max="100" value={values.qualificationPct} onChange={(event) => set("qualificationPct", event.target.value)} /></label>
          <label>Show / avance real (%)<input type="number" min="0" max="100" value={values.showPct} onChange={(event) => set("showPct", event.target.value)} /></label>
          <label>Cierre desde asistida (%)<input type="number" min="0" max="100" value={values.closePct} onChange={(event) => set("closePct", event.target.value)} /></label>
          <label>Fee RedVitalia, neto (€)<input type="number" value={fee} readOnly /></label>
        </div>
        <p className={styles.hypothesisNote}>Los valores son hipótesis de modelización, no datos garantizados. Deben sustituirse por datos reales del cliente y de Google/Meta antes de aprobar presupuesto.</p>
      </div>

      <div className={styles.modelResults}>
        <article><span>LEADS ESTIMADOS</span><strong>{decimal.format(leads)}</strong><small>{euro.format(values.media)} / {euro.format(values.cpl)}</small></article>
        <article><span>OPORTUNIDADES VÁLIDAS</span><strong>{decimal.format(qualified)}</strong><small>{values.qualificationPct}% de los leads</small></article>
        <article><span>ASISTIDAS / AVANZADAS</span><strong>{decimal.format(attended)}</strong><small>{values.showPct}% de válidas</small></article>
        <article><span>VENTAS / CASOS</span><strong>{decimal.format(sales)}</strong><small>{values.closePct}% de asistidas</small></article>
        <article><span>INGRESO BRUTO ESTIMADO</span><strong>{euro.format(revenue)}</strong><small>Antes de costes y margen</small></article>
        <article><span>MARGEN BRUTO ESTIMADO</span><strong>{euro.format(grossProfit)}</strong><small>{values.grossMarginPct}% del ingreso</small></article>
        <article className={contribution >= 0 ? styles.resultPositive : styles.resultNegative}><span>CONTRIBUCIÓN TRAS MEDIOS + FEE</span><strong>{euro.format(contribution)}</strong><small>{euro.format(grossProfit)} − {euro.format(values.media)} − {euro.format(fee)}</small></article>
        <article><span>CAC COMPLETO ESTIMADO</span><strong>{sales > 0 ? euro.format(cac) : "—"}</strong><small>Medios + fee / ventas</small></article>
      </div>

      <div className={styles.formulaCard}>
        <div>
          <span>FÓRMULA VISIBLE</span>
          <p>({euro.format(values.media)} / {euro.format(values.cpl)}) × {values.qualificationPct}% × {values.showPct}% × {values.closePct}% × {euro.format(values.valuePerSale)} × {values.grossMarginPct}% − {euro.format(values.media)} − {euro.format(fee)}</p>
        </div>
        <div className={styles.formulaMetrics}>
          <article><span>CPL máximo de equilibrio</span><strong>{euro.format(maxCpl)}</strong></article>
          <article><span>Ventas mínimas de equilibrio</span><strong>{decimal.format(breakEvenSales)}</strong></article>
          <article><span>Margen bruto por venta</span><strong>{euro.format(profitPerSale)}</strong></article>
        </div>
      </div>
    </div>
  );
}

export default function NichosDashboard() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState("legal");
  const [detailTab, setDetailTab] = useState<DetailTab>("strategy");
  const [playbookUnitId, setPlaybookUnitId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("Todos");
  const [decisionFilter, setDecisionFilter] = useState("Todas");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [compareIds, setCompareIds] = useState<string[]>(["legal", "toldos", "coches"]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/data/nichos/index.json", { cache: "force-cache" });
        if (!response.ok) throw new Error(`Índice: HTTP ${response.status}`);
        const index = await response.json() as IndexData;
        const niches = await Promise.all(index.files.map(async (file) => {
          const item = await fetch(file, { cache: "force-cache" });
          if (!item.ok) throw new Error(`${file}: HTTP ${item.status}`);
          return item.json() as Promise<Niche>;
        }));
        if (active) setData({ ...index, niches: niches.sort((a, b) => a.rank - b.rank) });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el módulo.");
      }
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const savedWeights = safeGet("rv-nichos-v2-weights");
    const savedCompare = safeGet("rv-nichos-v2-compare");
    queueMicrotask(() => {
      try {
        if (savedWeights) setWeights(sanitizeWeights(JSON.parse(savedWeights), DEFAULT_WEIGHTS));
        if (savedCompare) setCompareIds((JSON.parse(savedCompare) as string[]).slice(0, 3));
      } catch {
        // Ignora preferencias corruptas.
      }
    });
  }, []);

  useEffect(() => safeSet("rv-nichos-v2-weights", JSON.stringify(weights)), [weights]);
  useEffect(() => safeSet("rv-nichos-v2-compare", JSON.stringify(compareIds)), [compareIds]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (!hash || hash === "overview") setView("overview");
      else if (hash === "portfolio") setView("portfolio");
      else if (hash === "compare") setView("compare");
      else if (hash === "routes") setView("routes");
      else if (hash === "competitors") setView("competitors");
      else if (hash === "methodology") setView("methodology");
      else if (hash.startsWith("niche/")) {
        setSelectedId(hash.split("/")[1] || "legal");
        setView("detail");
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const navigate = (nextView: View, id?: string) => {
    setView(nextView);
    if (id) setSelectedId(id);
    if (nextView === "detail") setDetailTab("strategy");
    const hash = nextView === "detail" ? `niche/${id || selectedId}` : nextView;
    window.history.pushState(null, "", `#/${hash}`);
    setMobileOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const niches = useMemo(() => data?.niches || [], [data?.niches]);
  const selected = niches.find((niche) => niche.id === selectedId) || niches[0];
  const selectedStrategy = selected ? STRATEGY[selected.id] : null;
  const selectedPlaybooks = useMemo(() => selected ? buildOperationalPlaybooks(selected.id, selected) : [], [selected]);
  const activePlaybook = selectedPlaybooks.find((item) => item.unitId === playbookUnitId) || selectedPlaybooks[0];
  const routeSystems = useMemo<RouteSystem[]>(() => niches.filter((niche) => STRATEGY[niche.id]).map((niche) => {
    const strategy = STRATEGY[niche.id];
    return {
      id: niche.id,
      name: niche.name,
      phase: strategy.phase,
      channel: strategy.channel,
      salesCycle: strategy.salesCycle,
      unitId: CAPTURE_UNITS.find((unit) => unit.systemId === niche.id)?.id || niche.id,
      dimensions: strategy.dimensions,
      competitorCount: niche.competitors.length,
      decisions: niche.competitors.map((competitor) => competitor.decision),
    };
  }), [niches]);

  const scoredNiches = useMemo(() => niches
    .filter((niche) => STRATEGY[niche.id])
    .map((niche) => ({ niche, strategy: STRATEGY[niche.id], weighted: weightedStrategyScore(STRATEGY[niche.id], weights) }))
    .sort((a, b) => b.weighted - a.weighted), [niches, weights]);

  const competitorAggregates = useMemo(() => {
    const map = new Map<string, { id: string; name: string; score: number; decisions: Set<string>; niches: Map<string, string> }>();
    niches.forEach((niche) => niche.competitors.forEach((competitor) => {
      const current = map.get(competitor.id) || {
        id: competitor.id,
        name: competitor.name,
        score: competitor.score,
        decisions: new Set<string>(),
        niches: new Map<string, string>(),
      };
      current.score = Math.max(current.score, competitor.score);
      current.decisions.add(competitor.decision);
      current.niches.set(niche.id, niche.name);
      map.set(competitor.id, current);
    }));
    return Array.from(map.values()).map<CompetitorAggregate>((item) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      decisions: Array.from(item.decisions),
      niches: Array.from(item.niches.entries()).map(([id, name]) => ({ id, name })),
    })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
  }, [niches]);

  const queryNormalised = normalise(query.trim());
  const searchResults = useMemo(() => {
    if (!queryNormalised) return { niches: [] as Niche[], competitors: [] as CompetitorAggregate[] };
    return {
      niches: niches.filter((niche) => normalise(`${niche.name} ${niche.subtitle} ${niche.offer}`).includes(queryNormalised)).slice(0, 4),
      competitors: competitorAggregates.filter((competitor) => normalise(`${competitor.name} ${competitor.decisions.join(" ")} ${competitor.niches.map((niche) => niche.name).join(" ")}`).includes(queryNormalised)).slice(0, 6),
    };
  }, [queryNormalised, niches, competitorAggregates]);

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return [...current.slice(1), id];
      return [...current, id];
    });
  };

  const exportDecisions = () => {
    if (!data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      source: data.source,
      weights,
      compareIds,
      niches: data.niches.map((niche) => ({
        id: niche.id,
        name: niche.name,
        phase: STRATEGY[niche.id]?.phase,
        weightedScore: STRATEGY[niche.id] ? weightedStrategyScore(STRATEGY[niche.id], weights) : null,
        notes: safeGet(`rv-nichos-v2-notes-${niche.id}`),
        launchGate: STRATEGY[niche.id]?.launchGate.map((item, index) => ({ item, done: safeGet(`rv-nichos-v2-gate-${niche.id}-${index}`) === "1" })),
        roadmap: niche.plan.map((item, index) => ({ item, done: safeGet(`rv-nichos-v2-plan-${niche.id}-${index}`) === "1" })),
      })),
    };
    download("redvitalia-nichos-decisiones-v2.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  };

  const toggleStored = (key: string) => {
    safeSet(key, safeGet(key) === "1" ? "0" : "1");
    setRevision((current) => current + 1);
  };
  void revision;

  if (error) {
    return <main className={styles.error}><h1>No se pudo abrir Nichos</h1><p>{error}</p><a href="/">Volver al mercado</a></main>;
  }

  if (!data) {
    return <main className={styles.loading}><div><span>RV</span><h1>Construyendo la sala de decisión</h1><p>Cargando los diez sistemas y sus cruces competitivos.</p></div></main>;
  }

  const topWeighted = scoredNiches[0];
  const crossCount = niches.reduce((sum, niche) => sum + niche.competitors.length, 0);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <a className={styles.brand} href="/?vista=home">
          <span>RV</span>
          <div><strong>RedVitalia</strong><small>INTELIGENCIA DE MERCADO</small></div>
        </a>
        <div className={`${styles.sideBlock} ${styles.executionLinks}`}>
          <small>EJECUCIÓN REDVITALIA</small>
          <a href="/entregables"><i>01</i><span>Centro de entregables</span></a>
          <a className={styles.activeExecution} href="/sistemas"><i>02</i><span>Sistemas de captación</span></a>
          <a href="/campanas"><i>03</i><span>Campañas</span></a>
          <a href="/creativos"><i>04</i><span>Fábrica creativa</span></a>
          <a href="/biblioteca-creativa"><i>05</i><span>Biblioteca creativa</span></a>
          <a href="/laboratorio"><i>06</i><span>Laboratorio económico</span></a>
          <a href="/experimentos"><i>07</i><span>Experimentos</span></a>
          <a href="/decisiones"><i>08</i><span>Decisiones</span></a>
          <a href="/aprendizajes"><i>09</i><span>Aprendizajes</span></a>
        </div>
        <div className={styles.sideBlock}>
          <small>DECISIÓN</small>
          <button className={view === "overview" ? styles.activeNav : ""} onClick={() => navigate("overview")}><i>01</i><span>Resumen ejecutivo</span></button>
          <button className={view === "portfolio" ? styles.activeNav : ""} onClick={() => navigate("portfolio")}><i>02</i><span>Cartera y ranking</span></button>
          <button className={view === "compare" ? styles.activeNav : ""} onClick={() => navigate("compare")}><i>03</i><span>Comparador</span></button>
          <button className={view === "routes" ? styles.activeNav : ""} onClick={() => navigate("routes")}><i>04</i><span>40 rutas de crecimiento</span></button>
          <button className={view === "competitors" ? styles.activeNav : ""} onClick={() => navigate("competitors")}><i>05</i><span>Competencia</span></button>
          <button className={view === "methodology" ? styles.activeNav : ""} onClick={() => navigate("methodology")}><i>06</i><span>Método y fuentes</span></button>
        </div>
        <div className={styles.sideBlock}>
          <small>VERTICALES</small>
          {niches.map((niche) => {
            const strategy = STRATEGY[niche.id];
            if (!strategy) return null;
            return (
              <button key={niche.id} className={view === "detail" && selectedId === niche.id ? styles.activeNav : ""} onClick={() => navigate("detail", niche.id)}>
                <i>{String(niche.rank).padStart(2, "0")}</i>
                <span>{niche.name}</span>
                <b className={phaseClass(strategy.phase)}>{strategy.phase}</b>
              </button>
            );
          })}
        </div>
        <div className={styles.sideFoot}>
          <span>DATOS DEL MERCADO</span>
          <strong>{data.generatedAt}</strong>
          <small>Hipótesis operativas diferenciadas de tarifas y evidencia.</small>
        </div>
      </aside>

      {mobileOpen ? <button className={styles.overlay} aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} /> : null}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Abrir navegación">Menú</button>
          <div className={styles.topContext}>
            <span>NICHOS</span>
            <strong>{view === "detail" && selected ? selected.name : view === "portfolio" ? "Cartera" : view === "compare" ? "Comparador" : view === "routes" ? "40 rutas" : view === "competitors" ? "Competencia" : view === "methodology" ? "Método" : "Resumen ejecutivo"}</strong>
          </div>
          <div className={styles.searchWrap}>
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && query.trim()) navigate("competitors");
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Buscar nicho, competidor, oferta o táctica"
              aria-label="Buscar"
            />
            {query ? <button onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Limpiar búsqueda">×</button> : null}
            {searchOpen && query.trim() ? (
              <div className={styles.searchPanel}>
                {searchResults.niches.length ? <small>NICHOS</small> : null}
                {searchResults.niches.map((niche) => <button key={niche.id} onClick={() => navigate("detail", niche.id)}><span>{niche.name}</span><b>{niche.subtitle}</b></button>)}
                {searchResults.competitors.length ? <small>COMPETIDORES</small> : null}
                {searchResults.competitors.map((competitor) => <a key={competitor.id} href={`/?empresa=${encodeURIComponent(competitor.id)}`}><span>{competitor.name}</span><b>{competitor.score}/100 · {competitor.niches.map((niche) => niche.name).join(" · ")}</b></a>)}
                {!searchResults.niches.length && !searchResults.competitors.length ? <p>Sin coincidencias.</p> : null}
              </div>
            ) : null}
          </div>
          <a className={styles.marketButton} href="/?vista=home">Volver al mercado</a>
          <button className={styles.exportButton} onClick={exportDecisions}>Exportar</button>
        </header>

        <main className={styles.content}>
          {view === "overview" ? (
            <>
              <section className={styles.hero}>
                <div>
                  <p>INTELIGENCIA COMPETITIVA APLICADA</p>
                  <h1>No es una lista de sectores. Es <em>qué vender, a quién y bajo qué números.</em></h1>
                  <span>Los diez verticales están conectados con la competencia del mercado y separados entre evidencia, datos canónicos e hipótesis que aún deben validarse.</span>
                  <div className={styles.heroActions}>
                    <button onClick={() => navigate("detail", "legal")}>Abrir prioridad legal</button>
                    <button onClick={() => navigate("routes")}>Ver 40 rutas</button>
                    <button onClick={() => navigate("portfolio")}>Recalcular ranking</button>
                  </div>
                </div>
                <aside className={styles.heroDecision}>
                  <small>DECISIÓN VIGENTE</small>
                  <strong>Construir primero el sistema jurídico.</strong>
                  <p>Infraestructura común. Tres funnels separados. Segunda Oportunidad abre aprendizaje; herencias y divorcios entran después.</p>
                  <div><span>FASE</span><b>Ahora</b></div>
                </aside>
              </section>

              <section className={styles.metricsRow}>
                <article><span>SISTEMAS</span><strong>{niches.length}</strong><small>Verticales operativos</small></article>
                <article><span>COMPETIDORES ÚNICOS</span><strong>{competitorAggregates.length}</strong><small>{crossCount} cruces por nicho</small></article>
                <article><span>LÍDER PONDERADO</span><strong>{topWeighted?.niche.name}</strong><small>{decimal.format(topWeighted?.weighted || 0)}/100 con pesos actuales</small></article>
                <article><span>RUTAS ACTIVABLES</span><strong>{ROUTE_COUNT}</strong><small>4 vías diferentes por sistema</small></article>
              </section>

              <section className={styles.section}>
                <SectionTitle eyebrow="SECUENCIA RECOMENDADA" title="Ahora, después y no todo a la vez" text="La fase combina encaje propio, velocidad de aprendizaje y capacidad de construir prueba. No sustituye la validación real de demanda por zona." />
                <div className={styles.sequenceGrid}>
                  {(["Ahora", "Siguiente", "Validar", "Después"] as NicheStrategy["phase"][]).map((phase) => (
                    <article key={phase}>
                      <div className={`${styles.phaseHeader} ${phaseClass(phase)}`}><span>{phase}</span><strong>{scoredNiches.filter((item) => item.strategy.phase === phase).length}</strong></div>
                      {scoredNiches.filter((item) => item.strategy.phase === phase).map(({ niche, weighted }) => (
                        <button key={niche.id} onClick={() => navigate("detail", niche.id)}><span>{niche.name}</span><b>{decimal.format(weighted)}</b><small>{niche.subtitle}</small></button>
                      ))}
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.darkSection}>
                <SectionTitle eyebrow="TOP PONDERADO" title="Dónde existe mejor combinación" text="El score cambia con los pesos del modelo. La prioridad de negocio sigue siendo una decisión explícita, no una fórmula automática." action={<button onClick={() => navigate("portfolio")}>Editar pesos</button>} />
                <div className={styles.topGrid}>
                  {scoredNiches.slice(0, 5).map(({ niche, strategy, weighted }, index) => (
                    <button key={niche.id} onClick={() => navigate("detail", niche.id)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><h3>{niche.name}</h3><p>{niche.recommendation}</p><small>{strategy.channel} · {strategy.salesCycle}</small></div>
                      <strong>{decimal.format(weighted)}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <SectionTitle eyebrow="REGLAS DEL PRODUCTO" title="Lo común a los diez sistemas" text="Estas reglas salen del estudio y protegen la economía del servicio. No son promesas publicitarias nuevas." />
                <div className={styles.patternGrid}>{data.patterns.map((pattern, index) => <article key={pattern.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{pattern.title}</h3><p>{pattern.text}</p></article>)}</div>
              </section>

              <section className={styles.section}>
                <SectionTitle eyebrow="TARIFAS CANÓNICAS" title="Honorarios, IVA y medios sin mezclar" text="La ampliación consume un único snapshot trazable; las fichas enlazan esta fuente y no conservan importes editables propios." />
                <div className={styles.pricingGrid}>{PRICING.filter((price) => price.id !== "setter").map((price) => <article key={price.name}><span>{price.name}</span><strong>{euro.format(price.net)} <small>netos/mes</small></strong><p>{euro.format(price.net)} × 21% = {euro.format(price.vat)} IVA · Total: {euro.format(price.total)}</p><small>La inversión publicitaria se paga aparte a la plataforma.</small></article>)}</div>
                <div className={styles.sourceStrip}><strong>Fuente:</strong> <a href={PRICING_SOURCE.url} target="_blank" rel="noreferrer">{PRICING_SOURCE.name}</a> · verificada {PRICING_SOURCE.verifiedAt}</div>
              </section>
            </>
          ) : null}

          {view === "portfolio" ? (
            <section className={styles.sectionPage}>
              <div className={styles.pageHero}>
                <p>CARTERA Y PRIORIZACIÓN</p>
                <h1>Un ranking que se puede discutir con números.</h1>
                <span>Ajusta las 14 dimensiones: demanda, economía, cualificación, competencia, riesgo, capacidad de repetir y coste operativo. El sistema recalcula el orden sin esconder el criterio.</span>
              </div>

              <div className={styles.weightPanel}>
                {DIMENSION_KEYS.map((key) => (
                  <label key={key}>
                    <span>{DIMENSION_LABELS[key]} <b>{weights[key]}%</b></span>
                    <input type="range" min="0" max="40" step="5" value={weights[key]} onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                  </label>
                ))}
                <button onClick={() => setWeights(DEFAULT_WEIGHTS)}>Restablecer pesos</button>
              </div>

              <div className={styles.filterRow}>
                {PHASES.map((phase) => <button key={phase} className={phaseFilter === phase ? styles.filterActive : ""} onClick={() => setPhaseFilter(phase)}>{phase}</button>)}
              </div>

              <div className={styles.portfolioTable}>
                <div className={styles.portfolioHead}><span>#</span><span>Vertical</span><span>Fase</span><span>Score</span><span>Canal</span><span>Ciclo</span><span>Modelo base</span><span></span></div>
                {scoredNiches.filter((item) => phaseFilter === "Todos" || item.strategy.phase === phaseFilter).map(({ niche, strategy, weighted }, index) => (
                  <article key={niche.id}>
                    <span className={styles.position}>{String(index + 1).padStart(2, "0")}</span>
                    <button className={styles.portfolioName} onClick={() => navigate("detail", niche.id)}><strong>{niche.name}</strong><small>{niche.subtitle}</small></button>
                    <span className={`${styles.phasePill} ${phaseClass(strategy.phase)}`}>{strategy.phase}</span>
                    <div className={styles.portfolioScore}><strong>{decimal.format(weighted)}</strong><i><b style={{ width: `${weighted}%` }} /></i><small>Base editorial: {niche.score} · {niche.rank === scoredNiches.findIndex((item) => item.niche.id === niche.id) + 1 ? "sin cambio" : niche.rank > scoredNiches.findIndex((item) => item.niche.id === niche.id) + 1 ? `sube ${niche.rank - (scoredNiches.findIndex((item) => item.niche.id === niche.id) + 1)}` : `baja ${(scoredNiches.findIndex((item) => item.niche.id === niche.id) + 1) - niche.rank}`}</small></div>
                    <span>{strategy.channel}</span>
                    <span>{strategy.salesCycle}</span>
                    <span>{euro.format(strategy.economics.media)} medios · {euro.format(strategy.economics.cpl)} CPL</span>
                    <div className={styles.rowActions}><button onClick={() => toggleCompare(niche.id)}>{compareIds.includes(niche.id) ? "Quitar" : "Comparar"}</button><button onClick={() => navigate("detail", niche.id)}>Abrir</button></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {view === "compare" ? (
            <section className={styles.sectionPage}>
              <div className={styles.pageHero}>
                <p>COMPARADOR DE VERTICALES</p>
                <h1>Hasta tres sistemas, lado a lado.</h1>
                <span>Compara atractivo, complejidad, economía, funnel y competencia. Las cifras económicas siguen siendo hipótesis editables.</span>
              </div>

              <div className={styles.comparePicker}>
                {niches.map((niche) => <button key={niche.id} className={compareIds.includes(niche.id) ? styles.compareSelected : ""} onClick={() => toggleCompare(niche.id)}><span>{niche.rank}</span>{niche.name}</button>)}
              </div>

              <div className={styles.compareGrid}>
                {compareIds.map((id) => {
                  const niche = niches.find((item) => item.id === id);
                  const strategy = STRATEGY[id];
                  if (!niche || !strategy) return null;
                  const score = weightedStrategyScore(strategy, weights);
                  return (
                    <article key={id} className={styles.compareCard}>
                      <div className={styles.compareHeader}><span className={`${styles.phasePill} ${phaseClass(strategy.phase)}`}>{strategy.phase}</span><strong>{decimal.format(score)}</strong></div>
                      <h2>{niche.name}</h2><p>{niche.subtitle}</p>
                      <div className={styles.compareMeta}><span><b>Resultado</b>{niche.result}</span><span><b>Canal</b>{strategy.channel}</span><span><b>Ciclo</b>{strategy.salesCycle}</span><span><b>Fee</b>{niche.fee}</span></div>
                      <div className={styles.dimensionList}>{(Object.keys(strategy.dimensions) as DimensionKey[]).map((key) => <ScoreBar key={key} compact label={DIMENSION_LABELS[key]} value={strategy.dimensions[key]} />)}</div>
                      <div className={styles.compareEconomy}><span><b>{euro.format(strategy.economics.media)}</b> medios</span><span><b>{euro.format(strategy.economics.cpl)}</b> CPL</span><span><b>{strategy.economics.qualificationPct}%</b> válidos</span><span><b>{strategy.economics.closePct}%</b> cierre</span></div>
                      <p className={styles.compareRecommendation}>{niche.recommendation}</p>
                      <button onClick={() => navigate("detail", niche.id)}>Abrir sistema completo</button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view === "routes" ? (
            <section className={styles.sectionPage}>
              <div className={styles.pageHero}>
                <p>MAPA OPERATIVO · 10 SISTEMAS × 4 VÍAS</p>
                <h1>No hay una sola forma de crecer.</h1>
                <span>Cada vertical separa cuatro trabajos distintos: conseguir la cuenta para RedVitalia, capturar la intención del cliente, crear demanda y expandir lo que ya funciona. Puedes verlo como rutas, embudos, matriz comparativa o sprint de 30 días.</span>
              </div>
              <GrowthRoutes systems={routeSystems} />
            </section>
          ) : null}

          {view === "competitors" ? (() => {
            const filtered = competitorAggregates.filter((competitor) => {
              const matchesQuery = !queryNormalised || normalise(`${competitor.name} ${competitor.decisions.join(" ")} ${competitor.niches.map((niche) => niche.name).join(" ")}`).includes(queryNormalised);
              const matchesDecision = decisionFilter === "Todas" || competitor.decisions.includes(decisionFilter);
              return matchesQuery && matchesDecision;
            });
            const distribution = DECISIONS.slice(1).map((decision) => ({ decision, count: competitorAggregates.filter((competitor) => competitor.decisions.includes(decision)).length }));
            return (
              <section className={styles.sectionPage}>
                <div className={styles.pageHero}>
                  <p>COMPETENCIA VINCULADA</p>
                  <h1>{filtered.length} empresas relevantes para construir producto.</h1>
                  <span>No se muestran como una galería decorativa: cada ficha está asociada a una decisión de copiar, adaptar, probar, vigilar o descartar.</span>
                </div>
                <div className={styles.competitorStats}>{distribution.filter((item) => item.count).map((item) => <article key={item.decision}><span>{item.decision}</span><strong>{item.count}</strong></article>)}</div>
                <div className={styles.filterRow}>{DECISIONS.map((decision) => <button key={decision} className={decisionFilter === decision ? styles.filterActive : ""} onClick={() => setDecisionFilter(decision)}>{decision}</button>)}</div>
                <div className={styles.competitorGrid}>
                  {filtered.map((competitor) => (
                    <a key={competitor.id} href={`/?empresa=${encodeURIComponent(competitor.id)}`}>
                      <div className={styles.competitorScore}>{competitor.score}</div>
                      <div><h3>{competitor.name}</h3><div className={styles.decisionRow}>{competitor.decisions.map((decision) => <span key={decision} className={decisionClass(decision)}>{decision}</span>)}</div><p>{competitor.niches.map((niche) => niche.name).join(" · ")}</p></div>
                      <b>Abrir ficha</b>
                    </a>
                  ))}
                </div>
              </section>
            );
          })() : null}

          {view === "methodology" ? (
            <section className={styles.sectionPage}>
              <div className={styles.pageHero}>
                <p>MÉTODO Y TRAZABILIDAD</p>
                <h1>Qué es dato, qué es síntesis y qué sigue siendo una hipótesis.</h1>
                <span>La aplicación evita el error más peligroso: presentar una estimación interna como si fuera una cifra demostrada por el mercado.</span>
              </div>
              <div className={styles.truthGrid}>
                <article><span className={styles.truthCanonical}>CANÓNICO</span><h3>Tarifas RedVitalia</h3><p>Honorarios oficiales y su IVA. Se modifican únicamente en la fuente canónica, no dentro de una ficha de nicho.</p></article>
                <article><span className={styles.truthEvidence}>EVIDENCIA</span><h3>Competencia y mercado</h3><p>Empresas, scores y cruces vinculados a fichas reales del portal. Cada competidor puede abrirse para revisar el expediente completo.</p></article>
                <article><span className={styles.truthSynthesis}>SÍNTESIS</span><h3>Recomendación y diseño</h3><p>Lectura estratégica de RedVitalia: orden de ataque, propuesta, filtro, funnel, campañas, métricas y riesgos.</p></article>
                <article><span className={styles.truthHypothesis}>HIPÓTESIS</span><h3>Economía del piloto</h3><p>CPL, margen, cierre, show y presupuesto de medios. Son valores editables que deben sustituirse por datos reales antes de decidir.</p></article>
              </div>
              <section className={styles.methodBlock}>
                <SectionTitle eyebrow="MODELO DE SCORE" title="Catorce dimensiones visibles" text="Los pesos son editables y el cálculo es transparente. Competencia, riesgo y coste mental se puntúan en sentido favorable: 100 equivale a una situación más defendible." />
                <div className={styles.methodDimensions}>{DIMENSION_KEYS.map((key) => <article key={key}><span>{weights[key]}%</span><h3>{DIMENSION_LABELS[key]}</h3><p>{DIMENSION_DESCRIPTIONS[key]}</p></article>)}</div>
              </section>
              <section className={styles.methodBlock}>
                <SectionTitle eyebrow="REGLA DE DECISIÓN" title="Ventas primero, perfección después" />
                <div className={styles.principles}><article><strong>1</strong><p>Elegir un vertical y un subsegmento.</p></article><article><strong>2</strong><p>Definir oportunidad válida y dato económico final.</p></article><article><strong>3</strong><p>Lanzar piloto con kill criteria escritos.</p></article><article><strong>4</strong><p>Corregir funnel antes de culpar al canal.</p></article><article><strong>5</strong><p>Escalar solo con contribución positiva y capacidad.</p></article></div>
              </section>
              <div className={styles.sourceStrip}><strong>Corte del mercado:</strong> {data.generatedAt} · <strong>Fuente:</strong> {data.source}</div>
            </section>
          ) : null}

          {view === "detail" && selected && selectedStrategy ? (
            <section className={styles.detailPage}>
              <div className={styles.detailHero}>
                <div>
                  <div className={styles.detailBadges}><span className={phaseClass(selectedStrategy.phase)}>{selectedStrategy.phase}</span><span>PRIORIDAD {selected.rank}</span><span>SCORE EDITORIAL {selected.score}/100</span></div>
                  <h1>{selected.name}</h1>
                  <p>{selected.subtitle}</p>
                  <div className={styles.detailActions}><button onClick={() => setDetailTab("routes")}>Ver 4 vías</button><button onClick={() => setDetailTab("economics")}>Probar economía</button><button onClick={() => toggleCompare(selected.id)}>{compareIds.includes(selected.id) ? "Quitar del comparador" : "Añadir al comparador"}</button><a href="#competition" onClick={(event) => { event.preventDefault(); setDetailTab("competition"); }}>Ver competencia</a></div>
                </div>
                <aside>
                  <span>SCORE PONDERADO</span><strong>{decimal.format(weightedStrategyScore(selectedStrategy, weights))}</strong><small>Con los pesos actuales</small>
                  <div>{(Object.keys(selectedStrategy.dimensions) as DimensionKey[]).map((key) => <ScoreBar key={key} compact label={DIMENSION_LABELS[key]} value={selectedStrategy.dimensions[key]} />)}</div>
                </aside>
              </div>

              <nav className={styles.detailTabs}>{DETAIL_TABS.map((tab) => <button key={tab.id} className={detailTab === tab.id ? styles.detailTabActive : ""} onClick={() => setDetailTab(tab.id)}>{tab.label}</button>)}</nav>

              {detailTab === "strategy" ? (
                <>
                  <section className={styles.detailSection}>
                    <div className={styles.decisionPair}><article><span>MI RECOMENDACIÓN</span><p>{selected.recommendation}</p></article><article><span>MOTIVO</span><p>{selected.reason}</p></article></div>
                    <div className={styles.metaGrid}><article><span>RESULTADO VENDIBLE</span><strong>{selected.result}</strong></article><article><span>CANAL PRINCIPAL</span><strong>{selectedStrategy.channel}</strong></article><article><span>CICLO DE VENTA</span><strong>{selectedStrategy.salesCycle}</strong></article><article><span>FEE CANÓNICO</span><strong>{selected.fee}</strong></article></div>
                  </section>
                  {selected.id === "legal" ? (
                    <section className={styles.detailSection}>
                      <SectionTitle eyebrow="TRES UNIDADES SEPARADAS" title="Infraestructura común, campañas y economía independientes" text="Segunda Oportunidad, Herencias y Divorcios no comparten landing, keywords, preguntas, creatividad, conversión principal ni modelo económico." />
                      <div className={styles.legalUnitGrid}>{CAPTURE_UNITS.filter((unit) => unit.systemId === "legal").map((unit) => <article key={unit.id}><img src={unit.image} alt={`Consulta profesional para ${unit.name}`} /><div><span>{unit.phase}</span><h3>{unit.name}</h3><p>{unit.problem}</p><dl><div><dt>Resultado</dt><dd>{unit.result}</dd></div><div><dt>Conversión</dt><dd><code>{unit.primaryConversion}</code></dd></div><div><dt>Landing</dt><dd>{unit.landing}</dd></div></dl><h4>Preguntas propias</h4><ul>{unit.qualification.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul><p className={styles.legalCompliance}>{unit.compliance}</p><div className={styles.legalActions}><a href={`/campanas?unidad=${unit.id}`}>Abrir campañas</a><a href={`/biblioteca-creativa?unidad=${unit.id}`}>Ver creatividades</a></div></div></article>)}</div>
                    </section>
                  ) : null}
                  <section className={styles.detailSection}>
                    <SectionTitle eyebrow="ENTRADA AL MERCADO" title="Subnichos y orden interno" text="No se abre un vertical completo. Se entra por el problema que ofrece mejor intención, margen y aprendizaje." />
                    <div className={styles.segmentTable}><div><span>Prioridad</span><span>Subsegmento</span><span>Por qué</span><span>Datos de entrada</span></div>{selectedStrategy.subsegments.map((segment) => <article key={segment.name}><b>{segment.priority}</b><strong>{segment.name}</strong><p>{segment.why}</p><span>{segment.entry}</span></article>)}</div>
                  </section>
                  <section className={styles.detailSection}>
                    <SectionTitle eyebrow="PRODUCTO" title="Qué se vende y con qué filtro" />
                    <div className={styles.twoColumn}><article className={styles.card}><h3>Oferta</h3><p>{selected.offer}</p></article><article className={styles.card}><h3>Cliente ideal</h3><p>{selected.target}</p></article><article className={`${styles.card} ${styles.cardNegative}`}><h3>Cliente que se rechaza</h3><p>{selected.reject}</p></article><ListCard title="Preguntas de cualificación" items={selected.qualification} /></div>
                  </section>
                </>
              ) : null}

              {detailTab === "routes" ? (
                <section className={styles.detailSection}>
                  <GrowthRoutes systems={routeSystems.filter((item) => item.id === selected.id)} initialSystemId={selected.id} />
                </section>
              ) : null}

              {detailTab === "playbook" ? (
                <section className={styles.detailSection}>
                  <SectionTitle
                    eyebrow="FICHA OPERATIVA COMPLETA"
                    title={`${selectedPlaybooks.length} ${selectedPlaybooks.length === 1 ? "unidad" : "unidades"} · 19 apartados A–S`}
                    text="Cada afirmación indica si es dato, señal de mercado, hipótesis o información pendiente. Legal conserva tres playbooks independientes."
                    action={<button onClick={() => download(`playbook-${selected.id}.json`, JSON.stringify(selectedPlaybooks, null, 2), "application/json")}>Exportar A–S</button>}
                  />
                  <div className={styles.playbookSummary}>
                    <article><span>COBERTURA</span><strong>{selectedPlaybooks.reduce((sum, item) => sum + item.sections.length, 0)}</strong><p>apartados operativos</p></article>
                    <article><span>TRAZABILIDAD</span><strong>{selectedPlaybooks.reduce((sum, item) => sum + item.sections.flatMap((section) => section.items).length, 0)}</strong><p>campos con evidencia y fuente</p></article>
                    <article><span>CONTROL</span><strong>Humano</strong><p>sin publicación automática</p></article>
                  </div>
                  {selectedPlaybooks.length > 1 ? <nav className={styles.playbookPicker} aria-label="Elegir unidad operativa">{selectedPlaybooks.map((playbook) => <button key={playbook.unitId} className={activePlaybook?.unitId === playbook.unitId ? styles.playbookPickerActive : ""} onClick={() => setPlaybookUnitId(playbook.unitId)}>{playbook.name}</button>)}</nav> : null}
                  <div className={styles.playbookUnits}>
                    {activePlaybook ? [activePlaybook].map((playbook) => (
                      <article className={styles.playbookUnit} key={playbook.unitId}>
                        <header><div><span>{playbook.unitId} · v{playbook.version}</span><h2>{playbook.name}</h2></div><small>{playbook.generatedAt}</small></header>
                        <div className={styles.playbookSections}>
                          {playbook.sections.map((playbookSection, sectionIndex) => (
                            <details key={playbookSection.code} open={sectionIndex === 0}>
                              <summary><b>{playbookSection.code}</b><span><strong>{playbookSection.title}</strong><small>{playbookSection.purpose}</small></span><em>{playbookSection.items.length}</em></summary>
                              <div className={styles.playbookItems}>
                                {playbookSection.items.map((item, itemIndex) => (
                                  <article key={`${item.label}-${itemIndex}`}>
                                    <div><strong>{item.label}</strong><span className={styles.playbookEvidence} data-evidence={item.evidence}>{item.evidence}</span></div>
                                    <p>{item.value}</p>
                                    <small>Fuente: {item.source}</small>
                                  </article>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      </article>
                    )) : null}
                  </div>
                </section>
              ) : null}

              {detailTab === "economics" ? <section className={styles.detailSection}><SectionTitle eyebrow="ECONOMÍA DEL PILOTO" title="El CPL no decide; decide la contribución" text="Modelo editable. Honorarios netos, inversión en medios y valor bruto se muestran por separado." /><EconomicsModel key={selected.id} niche={selected} strategy={selectedStrategy} /></section> : null}

              {detailTab === "funnel" ? (
                <>
                  <section className={styles.detailSection}><SectionTitle eyebrow="RECORRIDO" title="De la demanda al resultado económico" /><div className={styles.funnelFlow}>{selected.funnel.map((step, index) => <article key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></article>)}</div></section>
                  <section className={styles.detailSection}><div className={styles.twoColumn}><ListCard title="Oportunidad válida" items={selectedStrategy.validLead} tone="positive" /><ListCard title="No válida" items={selectedStrategy.invalidLead} tone="negative" /><ListCard title="Arquitectura de campañas" items={selected.campaigns} /><ListCard title="Métricas que deciden" items={selected.kpis} /></div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="MEDICIÓN" title="Eventos que deben llegar al CRM y a Ads" /><div className={styles.eventFlow}>{selectedStrategy.tracking.map((event, index) => <article key={event}><span>{index + 1}</span><code>{event}</code></article>)}</div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="SLA" title="La velocidad forma parte del producto" /><div className={styles.slaGrid}>{selectedStrategy.sla.map((item) => <article key={item.stage}><span>{item.stage}</span><strong>{item.target}</strong></article>)}</div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="MENSAJE" title="Copys y apertura comercial" /><div className={styles.copyGrid}><article><span>B2B</span><p>{selected.copy.b2b}</p></article><article><span>B2C</span><p>{selected.copy.b2c}</p></article><article><span>APERTURA</span><p>«{selected.opener}»</p></article></div><div className={styles.twoColumn}><ListCard title="Objeciones y respuesta" items={selected.objections} /><ListCard title="Preguntas del formulario" items={selected.qualification} /></div></section>
                </>
              ) : null}

              {detailTab === "competition" ? (() => {
                const groups = ["Copiar", "Adaptar", "Probar", "Vigilar", "Descartar", "Prospecto"].map((decision) => ({ decision, items: selected.competitors.filter((competitor) => competitor.decision === decision) })).filter((group) => group.items.length);
                return (
                  <section className={styles.detailSection} id="competition">
                    <SectionTitle eyebrow="COMPETENCIA REAL" title={`${selected.competitors.length} fichas que sostienen la decisión`} text="Cada tarjeta abre el expediente completo dentro de la aplicación del mercado. La etiqueta indica qué hacer con el aprendizaje, no quién es mejor en abstracto." />
                    <div className={styles.competitionSummary}>{groups.map((group) => <article key={group.decision}><span className={decisionClass(group.decision)}>{group.decision}</span><strong>{group.items.length}</strong><p>{group.decision === "Copiar" ? "Patrón suficientemente claro para trasladar con control." : group.decision === "Adaptar" ? "Idea valiosa que necesita encaje español y operativo." : group.decision === "Probar" ? "Hipótesis que merece experimento limitado." : group.decision === "Descartar" ? "No encaja con el modelo objetivo." : group.decision === "Prospecto" ? "Puede ser cliente o socio, no referencia principal." : "Mantener monitorizado sin imitar todavía."}</p></article>)}</div>
                    <div className={styles.detailCompetitors}>{[...selected.competitors].sort((a, b) => b.score - a.score).map((competitor) => <a key={competitor.id} href={`/?empresa=${encodeURIComponent(competitor.id)}`}><span className={styles.competitorScore}>{competitor.score}</span><div><h3>{competitor.name}</h3><span className={decisionClass(competitor.decision)}>{competitor.decision}</span></div><b>Abrir expediente completo</b></a>)}</div>
                  </section>
                );
              })() : null}

              {detailTab === "execution" ? (
                <>
                  <section className={styles.detailSection}><SectionTitle eyebrow="PUERTA DE LANZAMIENTO" title="Nada sale sin estos mínimos" text="El checklist se guarda solo en este navegador y no implica aprobación ni publicación." /><div className={styles.checkGrid}>{selectedStrategy.launchGate.map((item, index) => { const key = `rv-nichos-v2-gate-${selected.id}-${index}`; const checked = safeGet(key) === "1"; return <label key={item} className={checked ? styles.checked : ""}><input type="checkbox" checked={checked} onChange={() => toggleStored(key)} /><span>{item}</span></label>; })}</div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="EXPERIMENTOS" title="Hipótesis, aprobación y descarte" /><div className={styles.experimentGrid}>{selectedStrategy.experiments.map((experiment) => <article key={experiment.title}><h3>{experiment.title}</h3><p><b>Hipótesis:</b> {experiment.hypothesis}</p><p className={styles.pass}><b>Pasa si:</b> {experiment.pass}</p><p className={styles.fail}><b>Falla si:</b> {experiment.fail}</p></article>)}</div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="RIESGOS" title="Qué puede romper el vertical" /><div className={styles.riskGrid}>{selectedStrategy.risks.map((item) => <article key={item.risk}><span>RIESGO</span><h3>{item.risk}</h3><p>{item.response}</p></article>)}</div></section>
                  <section className={styles.detailSection}><SectionTitle eyebrow="90 DÍAS" title="Hoja de ruta y control" /><div className={styles.executionGrid}><div className={styles.roadmap}>{selected.plan.map((item, index) => { const key = `rv-nichos-v2-plan-${selected.id}-${index}`; const checked = safeGet(key) === "1"; return <label key={item} className={checked ? styles.checked : ""}><input type="checkbox" checked={checked} onChange={() => toggleStored(key)} /><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></label>; })}</div><div className={styles.notesCard}><label>NOTAS Y DECISIONES</label><textarea key={selected.id} defaultValue={safeGet(`rv-nichos-v2-notes-${selected.id}`)} onChange={(event) => safeSet(`rv-nichos-v2-notes-${selected.id}`, event.target.value)} placeholder="Pruebas, decisiones, responsables y pendientes de validar…" /></div></div></section>
                  <section className={styles.decisionRules}><article><span>REGLA PARA ESCALAR</span><p>{selectedStrategy.decisionRule}</p></article><article><span>CRITERIOS PARA MATAR O PAUSAR</span><ul>{selectedStrategy.killCriteria.map((item) => <li key={item}>{item}</li>)}</ul></article></section>
                </>
              ) : null}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
