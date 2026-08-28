"use client";
/* eslint-disable @next/next/no-img-element */

import {
  lazy,
  Suspense,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CompanyLogo from "./CompanyLogo";
import { deriveGalleryMetrics } from "./gallery-metrics";
import {
  classifyMediaResolution,
  dimensionsFromMedia,
  imagePresentationStyle,
  measureImage,
  MediaResolutionNotice,
  type MediaDimensions,
} from "./MediaResolution";
import type {
  AdsKitData,
  Analytics,
  AngulosData,
  DataManifest,
  AnuncioReal,
  AnunciosRealesData,
  ArsenalData,
  Company,
  Country,
  CrucesData,
  DeepIndex,
  DeepIndexItem,
  DossiersData,
  Editorial,
  ExecutionBacklog,
  ExpansionData,
  HomesTimelineData,
  MysteryData,
  FunnelV3Index,
  FunnelV3IndexItem,
  FunnelV3Review,
  Insights,
  LogoManifest,
  Media,
  PatternsData,
  RecursosData,
  Summary,
  Takeaway,
  TakeawaysData,
  VerticalesData,
  VigilanciaData,
} from "./data-types";
import { BUILD_DATE, BUILD_DATE_LONG } from "./build-date";
import { galleryMediaPosition, resolveGalleryMediaIndex } from "./media-deep-link";
import type { LandingBrief } from "./landings/model";

const OperationsHub = lazy(() => import("./OperationsHub"));
const AdsLaboratory = lazy(() => import("./AdsLaboratory"));
const DecisionCenter = lazy(() => import("./DecisionCenter"));
const PositioningSimulator = lazy(() => import("./PositioningSimulator"));
const RecordDetail = lazy(() => import("./RecordDetail"));
const EditorialText = lazy(() => import("./EditorialText"));
const LandingStudio = lazy(() => import("./LandingStudio"));
const BusinessDossier = lazy(() => import("./BusinessDossier"));
const GalleryExplorer = lazy(() => import("./GalleryExplorer"));

type View =
  | "home"
  | "negocio"
  | "operations"
  | "exec"
  | "resources"
  | "tools"
  | "adlab"
  | "decisions"
  | "arsenal"
  | "landings"
  | "verticals"
  | "watch"
  | "companies"
  | "funnels"
  | "countries"
  | "ads"
  | "compare"
  | "insights"
  | "playbooks"
  | "analysis"
  | "cruces"
  | "informe"
  | "expansion"
  | "mystery"
  | "blueprint"
  | "audit";

type OptionalResourceKey =
  | "editorial"
  | "deepIndex"
  | "v3Index"
  | "insights"
  | "analytics"
  | "expansion"
  | "mystery"
  | "takeaways"
  | "patterns"
  | "execution"
  | "dossiers"
  | "recursos"
  | "verticales"
  | "arsenal"
  | "adsKit"
  | "vigilancia"
  | "homesTimeline"
  | "cruces"
  | "anunciosReales"
  | "angulos"
  | "manifest";

type ResourceLoadState = "loading" | "ready" | "error";

const requiredResourcesByView: Partial<
  Record<View, OptionalResourceKey[]>
> = {
  exec: ["execution"],
  resources: ["recursos"],
  tools: ["verticales"],
  arsenal: ["arsenal"],
  landings: ["verticales", "deepIndex"],
  verticals: ["verticales"],
  watch: ["vigilancia"],
  insights: ["insights"],
  playbooks: ["insights"],
  analysis: ["analytics"],
  cruces: ["cruces"],
  informe: ["vigilancia", "cruces", "patterns", "angulos", "execution"],
  expansion: ["expansion"],
  mystery: ["mystery"],
  blueprint: ["editorial"],
};

const nav: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Resumen", icon: "⌂" },
  { id: "negocio", label: "Dossier de negocio", icon: "€" },
  { id: "operations", label: "Campañas", icon: "◆" },
  { id: "exec", label: "Ejecutar", icon: "▸" },
  { id: "resources", label: "Recursos", icon: "⤓" },
  { id: "tools", label: "Herramientas", icon: "◳" },
  { id: "adlab", label: "Lab anuncios", icon: "⌗" },
  { id: "decisions", label: "Growth Lab", icon: "✣" },
  { id: "arsenal", label: "Arsenal", icon: "⚑" },
  { id: "landings", label: "Landings", icon: "▭" },
  { id: "companies", label: "Empresas", icon: "◎" },
  { id: "funnels", label: "Funnels de venta", icon: "⌁" },
  { id: "countries", label: "Países", icon: "◈" },
  { id: "ads", label: "Galerías", icon: "▣" },
  { id: "compare", label: "Comparador", icon: "⇄" },
  { id: "verticals", label: "Nichos", icon: "▤" },
  { id: "insights", label: "Conclusiones", icon: "∴" },
  { id: "playbooks", label: "Métodos", icon: "⚙" },
  { id: "analysis", label: "Análisis", icon: "∑" },
  { id: "cruces", label: "Cruces", icon: "⤫" },
  { id: "informe", label: "Informe", icon: "≡" },
  { id: "watch", label: "Vigilancia", icon: "◔" },
  { id: "expansion", label: "Expansión", icon: "❖" },
  { id: "mystery", label: "Mystery", icon: "◍" },
  { id: "blueprint", label: "Blueprint", icon: "✦" },
  { id: "audit", label: "Auditoría", icon: "✓" },
];

const navGroups: Array<{ label: string | null; ids: View[] }> = [
  { label: null, ids: ["home"] },
  { label: "Acción", ids: ["negocio", "operations", "exec", "resources", "tools", "adlab", "decisions", "arsenal", "landings"] },
  { label: "Base", ids: ["companies", "funnels", "countries", "ads", "compare"] },
  { label: "Análisis", ids: ["verticals", "insights", "playbooks", "analysis", "cruces", "informe", "watch", "expansion", "mystery"] },
  { label: "Sistema", ids: ["blueprint", "audit"] },
];
const scopeShort: Record<string, string> = {
  "Núcleo — agencia/leadgen": "Agencia / leadgen",
  "Vertical — broker/marketplace": "Broker / marketplace",
  "Adyacente — BPO/infraestructura": "BPO / infraestructura",
  "Excluir — fuente/no negocio": "Fuera del núcleo",
};
const readinessLabel: Record<DeepIndexItem["researchReadiness"], string> = {
  usable: "Cobertura utilizable",
  partial: "Cobertura parcial",
  manual_only: "Revisión manual · web 0%",
  no_observable: "Sin funnel público observable",
  not_applicable: "No aplica al funnel competitivo",
};
const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
const short = (s: string, n = 170) =>
  s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;
const funnelScreenshotMedia = (review: FunnelV3Review): Media[] =>
  (review.evidenceScreenshots || []).map((item, index) => {
    const screenshot = item as typeof item & { title?: string };
    return {
      file: screenshot.file,
      type: screenshot.type,
      bytes: screenshot.bytes,
      order: index + 1,
      label: screenshot.label,
      title: screenshot.title || screenshot.label,
    };
  });

const editorialTabs: Array<{ id: keyof Editorial; label: string }> = [
  { id: "blueprint", label: "Blueprint" },
  { id: "execution", label: "Sistema operativo" },
  { id: "report", label: "Informe estratégico" },
];

function CompanyCard({
  c,
  logos,
  onOpen,
  onCompare,
  selected,
  takeaway,
}: {
  c: Company;
  logos: LogoManifest;
  onOpen: () => void;
  onCompare: () => void;
  selected: boolean;
  takeaway?: Takeaway;
}) {
  const scoreClass = c.score >= 85 ? "high" : c.score >= 60 ? "mid" : "low";
  return (
    <article className="company-card">
      <div className="card-top">
        <CompanyLogo company={c} logos={logos} />
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {c.addedAt === "2026-08-23" && <span className="badge-nueva">ALTA 23/08</span>}
          <span className={"score score-" + scoreClass}>{c.score}/100</span>
        </span>
      </div>
      <p className="country-label">{c.primaryCountry}</p>
      <h3>{c.name}</h3>
      <span className="pill">{scopeShort[c.scope] || c.scope}</span>
      <p className="offer">
        {short(c.offer || c.relation || "Oferta no documentada.")}
      </p>
      {takeaway && (
        <div className={`card-takeaway copiable-${takeaway.copiable}`}>
          <small>
            QUÉ ME LLEVO · <b>{takeaway.copiable}</b>
          </small>
          <p>{short(takeaway.t, 180)}</p>
        </div>
      )}
      <div className="price-box">
        <small>PRECIO LOCAL</small>
        <strong>{short(c.priceLocal || "No publicado", 75)}</strong>
        <span>
          {c.price.eur != null ? "≈ " + c.price.label : c.price.label}
        </span>
      </div>
      <div className="card-meta">
        <span>{c.media.length ? "▣ " + c.media.length : "Sin galería"}</span>
        <span>{c.evidence}</span>
      </div>
      <div className="card-buttons">
        <button onClick={onOpen}>Abrir ficha completa</button>
        <button
          className={selected ? "compare-on" : ""}
          onClick={onCompare}
          aria-pressed={selected}
          aria-label={
            selected ? "Quitar del comparador" : "Añadir al comparador"
          }
        >
          {selected ? "✓" : "⇄"}
        </button>
      </div>
    </article>
  );
}

export default function Portal() {
  const [companies, setCompanies] = useState<Company[]>([]),
    [countries, setCountries] = useState<Country[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null),
    [editorial, setEditorial] = useState<Editorial | null>(null),
    [logos, setLogos] = useState<LogoManifest>({}),
    [deepIndex, setDeepIndex] = useState<DeepIndex | null>(null),
    [v3Index, setV3Index] = useState<FunnelV3Index | null>(null),
    [insights, setInsights] = useState<Insights | null>(null),
    [analytics, setAnalytics] = useState<Analytics | null>(null),
    [expansion, setExpansion] = useState<ExpansionData | null>(null),
    [mystery, setMystery] = useState<MysteryData | null>(null),
    [takeaways, setTakeaways] = useState<TakeawaysData | null>(null),
    [patterns, setPatterns] = useState<PatternsData | null>(null),
    [execution, setExecution] = useState<ExecutionBacklog | null>(null),
    [dossiers, setDossiers] = useState<DossiersData | null>(null),
    [recursos, setRecursos] = useState<RecursosData | null>(null),
    [verticales, setVerticales] = useState<VerticalesData | null>(null),
    [arsenal, setArsenal] = useState<ArsenalData | null>(null),
    [adsKit, setAdsKit] = useState<AdsKitData | null>(null),
    [vigilancia, setVigilancia] = useState<VigilanciaData | null>(null),
    [homesTimeline, setHomesTimeline] = useState<HomesTimelineData | null>(null),
    [cruces, setCruces] = useState<CrucesData | null>(null),
    [anunciosReales, setAnunciosReales] = useState<AnunciosRealesData | null>(null),
    [angulos, setAngulos] = useState<AngulosData | null>(null),
    [manifest, setManifest] = useState<DataManifest | null>(null),
    [resourceLoadState, setResourceLoadState] = useState<
      Partial<Record<OptionalResourceKey, ResourceLoadState>>
    >({});
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [propVertical, setPropVertical] = useState("clinicas-salud"),
    [propZona, setPropZona] = useState(""),
    [propServicio, setPropServicio] = useState(""),
    [propPrecio, setPropPrecio] = useState(""),
    [titularQuery, setTitularQuery] = useState(""),
    [titularFormula, setTitularFormula] = useState("Todas"),
    [garantiaKind, setGarantiaKind] = useState("Todas"),
    [semQuery, setSemQuery] = useState(""),
    [semSort, setSemSort] = useState<"score" | "ads" | "nombre">("score"),
    [companiesNewOnly, setCompaniesNewOnly] = useState(false),
    [mrrClientes, setMrrClientes] = useState("12"),
    [mrrCuota, setMrrCuota] = useState("600"),
    [mrrAltas, setMrrAltas] = useState("2"),
    [mrrChurn, setMrrChurn] = useState("5");
  const [actionStates, setActionStates] = useState<Record<string, { estado: string; nota: string }>>({});
  useEffect(() => {
    let storedNav = false;
    let storedActions: Record<string, { estado: string; nota: string }> | null = null;
    try {
      storedNav = window.localStorage.getItem("rv-nav-collapsed") === "1";
      const rawActions = window.localStorage.getItem("rv-backlog-estado");
      if (rawActions) storedActions = JSON.parse(rawActions);
    } catch {
      return undefined;
    }
    const hydrationFrame = window.requestAnimationFrame(() => {
      if (storedNav) setNavCollapsed(true);
      if (storedActions) setActionStates(storedActions);
    });
    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);
  const toggleNav = () => {
    setNavCollapsed((current) => {
      try { window.localStorage.setItem("rv-nav-collapsed", current ? "0" : "1"); } catch {
        /* El estado visual sigue funcionando aunque el navegador bloquee storage. */
      }
      return !current;
    });
  };
  const setActionState = (title: string, estado: string) => {
    setActionStates((current) => {
      const next = { ...current, [title]: { estado, nota: current[title]?.nota || "" } };
      try { window.localStorage.setItem("rv-backlog-estado", JSON.stringify(next)); } catch {
        /* La edición actual no depende de que la persistencia esté disponible. */
      }
      return next;
    });
  };
  const [view, setViewState] = useState<View>("home");
  const setView = (next: View) => {
    try { window.localStorage.setItem("rv-last-view", next); } catch {
      /* La navegación no se bloquea si el navegador rechaza la persistencia. */
    }
    setViewState(next);
  };
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState("Todos"),
    [country, setCountry] = useState("Todos");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(-1);
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [globalAds, setGlobalAds] = useState<AnuncioReal[] | null>(null);
  const [adLabInitialQuery, setAdLabInitialQuery] = useState("");
  const [priceOnly, setPriceOnly] = useState(false),
    [channel, setChannel] = useState("Todos"),
    [visible, setVisible] = useState(24);
  const [funnelCapture, setFunnelCapture] = useState("Todos"),
    [funnelStatus, setFunnelStatus] = useState("Todos"),
    [funnelVisible, setFunnelVisible] = useState(30);
  const [active, setActive] = useState<Company | null>(null),
    [lightbox, setLightbox] = useState<{
      media: Media;
      company: Company;
      collection: Media[];
      source: "gallery" | "funnel";
    } | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  const [compare, setCompare] = useState<string[]>([]),
    [editorialTab, setEditorialTab] = useState<keyof Editorial>("blueprint");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [failedLightboxFile, setFailedLightboxFile] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const editorialTabRefs = useRef<
    Partial<Record<keyof Editorial, HTMLButtonElement | null>>
  >({});
  const [measuredImageDimensions, setMeasuredImageDimensions] = useState<
    Record<string, MediaDimensions>
  >({});
  const currentViewRef = useRef(view);

  useEffect(() => {
    currentViewRef.current = view;
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    let optionalStartTimer: number | null = null;
    const requiredJson = async <T,>(path: string) => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json() as Promise<T>;
    };
    const optionalJson = requiredJson;
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("vista");
    let initialView: View = "home";
    if (requestedView === "map") {
      initialView = "countries";
      const legacyUrl = new URL(window.location.href);
      legacyUrl.searchParams.set("vista", "countries");
      window.history.replaceState({ vista: "countries" }, "", legacyUrl);
    } else if (nav.some((item) => item.id === requestedView)) {
      initialView = requestedView as View;
    } else {
      try {
        const lastView = window.localStorage.getItem("rv-last-view");
        if (lastView === "map") initialView = "countries";
        else if (lastView && nav.some((item) => item.id === lastView))
          initialView = lastView as View;
      } catch {
        /* Sin una vista guardada válida se conserva la portada. */
      }
    }

    type OptionalTask = {
      key: OptionalResourceKey;
      views: View[];
      load: () => Promise<void>;
    };
    const optionalTasks: OptionalTask[] = [
      {
        key: "editorial",
        views: ["blueprint"],
        load: async () => {
          const data = await optionalJson<Editorial>("/data/editorial.json");
          if (!controller.signal.aborted) setEditorial(data);
        },
      },
      {
        key: "deepIndex",
        views: ["landings", "funnels", "audit"],
        load: async () => {
          const data = await optionalJson<DeepIndex>("/data/deep/index.json");
          if (!controller.signal.aborted) setDeepIndex(data);
        },
      },
      {
        key: "v3Index",
        views: ["home", "funnels", "audit"],
        load: async () => {
          const data = await optionalJson<FunnelV3Index>("/data/funnel-v3/index.json");
          if (!controller.signal.aborted) setV3Index(data);
        },
      },
      {
        key: "insights",
        views: ["insights", "playbooks"],
        load: async () => {
          const data = await optionalJson<Insights>("/data/insights.json");
          if (!controller.signal.aborted) setInsights(data);
        },
      },
      {
        key: "analytics",
        views: ["analysis"],
        load: async () => {
          const data = await optionalJson<Analytics>("/data/analytics.json");
          if (!controller.signal.aborted) setAnalytics(data);
        },
      },
      {
        key: "expansion",
        views: ["expansion"],
        load: async () => {
          const data = await optionalJson<ExpansionData>("/data/expansion.json");
          if (!controller.signal.aborted) setExpansion(data);
        },
      },
      {
        key: "mystery",
        views: ["mystery"],
        load: async () => {
          const data = await optionalJson<MysteryData>("/data/mystery.json");
          if (!controller.signal.aborted) setMystery(data);
        },
      },
      {
        key: "takeaways",
        views: ["home", "companies"],
        load: async () => {
          const data = await optionalJson<TakeawaysData>("/data/takeaways.json");
          if (!controller.signal.aborted) setTakeaways(data);
        },
      },
      {
        key: "patterns",
        views: ["operations", "tools", "informe"],
        load: async () => {
          const data = await optionalJson<PatternsData>("/data/patterns.json");
          if (!controller.signal.aborted) setPatterns(data);
        },
      },
      {
        key: "execution",
        views: ["home", "operations", "exec", "informe"],
        load: async () => {
          const data = await optionalJson<ExecutionBacklog>("/data/execution.json");
          if (!controller.signal.aborted) setExecution(data);
        },
      },
      {
        key: "dossiers",
        views: ["operations", "companies"],
        load: async () => {
          const data = await optionalJson<DossiersData>("/data/dossiers.json");
          if (!controller.signal.aborted) setDossiers(data);
        },
      },
      {
        key: "recursos",
        views: ["operations", "resources"],
        load: async () => {
          const data = await optionalJson<RecursosData>("/data/recursos.json");
          if (!controller.signal.aborted) setRecursos(data);
        },
      },
      {
        key: "verticales",
        views: ["tools", "landings", "verticals"],
        load: async () => {
          const data = await optionalJson<VerticalesData>("/data/verticales.json");
          if (!controller.signal.aborted) setVerticales(data);
        },
      },
      {
        key: "arsenal",
        views: ["arsenal"],
        load: async () => {
          const data = await optionalJson<ArsenalData>("/data/arsenal.json");
          if (!controller.signal.aborted) setArsenal(data);
        },
      },
      {
        key: "adsKit",
        views: ["arsenal"],
        load: async () => {
          const data = await optionalJson<AdsKitData>("/data/ads-kit.json");
          if (!controller.signal.aborted) setAdsKit(data);
        },
      },
      {
        key: "vigilancia",
        views: ["home", "watch", "informe"],
        load: async () => {
          const data = await optionalJson<VigilanciaData>("/data/vigilancia.json");
          if (!controller.signal.aborted) setVigilancia(data);
        },
      },
      {
        key: "homesTimeline",
        views: ["watch"],
        load: async () => {
          const data = await optionalJson<HomesTimelineData>("/data/homes-timeline.json");
          if (!controller.signal.aborted) setHomesTimeline(data);
        },
      },
      {
        key: "cruces",
        views: ["home", "watch", "cruces", "informe"],
        load: async () => {
          const data = await optionalJson<CrucesData>("/data/cruces.json");
          if (!controller.signal.aborted) setCruces(data);
        },
      },
      {
        key: "anunciosReales",
        views: ["home", "arsenal"],
        load: async () => {
          const data = await optionalJson<AnunciosRealesData>("/data/anuncios-reales.json");
          if (!controller.signal.aborted) setAnunciosReales(data);
        },
      },
      {
        key: "manifest",
        views: ["home", "arsenal", "adlab", "audit", "informe"],
        load: async () => {
          const data = await optionalJson<DataManifest>("/data/data-manifest.json");
          if (!controller.signal.aborted) setManifest(data);
        },
      },
      {
        key: "angulos",
        views: ["arsenal", "informe"],
        load: async () => {
          const data = await optionalJson<AngulosData>("/data/angulos-anuncios.json");
          if (!controller.signal.aborted) setAngulos(data);
        },
      },
    ];

    Promise.all([
      requiredJson<Company[]>("/data/companies-index.json"),
      requiredJson<Country[]>("/data/countries.json"),
      requiredJson<Summary>("/data/summary.json"),
      fetch("/data/logos.json", { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<LogoManifest>) : {}))
        .catch(() => ({} as LogoManifest)),
    ])
      .then(([c, co, s, l]) => {
        if (controller.signal.aborted) return;
        setCompanies(c);
        setCountries(co);
        setSummary(s);
        setLogos(l);
        setCompare([]);
        currentViewRef.current = initialView;
        setView(initialView);
        const requested = params.get("empresa");
        const requestedCompany = requested
          ? c.find((x: Company) => x.id === requested)
          : null;
        if (requestedCompany) {
          setActive(requestedCompany);
          const mediaIndex = resolveGalleryMediaIndex(
            requestedCompany.media,
            params.get("media"),
            params.get("archivo"),
          );
          const evidenceIndex = Number(params.get("evidence")) - 1;
          if (
            Number.isInteger(mediaIndex) &&
            requestedCompany.media[mediaIndex]
          )
            setLightbox({
              company: requestedCompany,
              media: requestedCompany.media[mediaIndex],
              collection: requestedCompany.media,
              source: "gallery",
            });
          else if (Number.isInteger(evidenceIndex) && evidenceIndex >= 0)
            fetch(`/data/funnel-v3/records/${requestedCompany.id}.json`)
              .then((response) =>
                response.ok
                  ? (response.json() as Promise<FunnelV3Review>)
                  : null,
              )
              .then((review: FunnelV3Review | null) => {
                if (!review) return;
                const collection = funnelScreenshotMedia(review);
                if (collection[evidenceIndex])
                  setLightbox({
                    company: requestedCompany,
                    media: collection[evidenceIndex],
                    collection,
                    source: "funnel",
                  });
              })
              .catch(() => undefined);
        }
        setLoading(false);
        const pendingTasks = [...optionalTasks];
        const takeNextTask = () => {
          if (!pendingTasks.length) return null;
          const activeView = currentViewRef.current;
          const score = (task: OptionalTask) =>
            (task.views.includes(activeView) ? 100 : 0) +
            (task.views.includes("home") ? 10 : 0);
          let bestIndex = 0;
          for (let index = 1; index < pendingTasks.length; index += 1) {
            if (score(pendingTasks[index]) > score(pendingTasks[bestIndex]))
              bestIndex = index;
          }
          return pendingTasks.splice(bestIndex, 1)[0];
        };
        const runWorker = async () => {
          while (!controller.signal.aborted) {
            const task = takeNextTask();
            if (!task) return;
            setResourceLoadState((current) => ({
              ...current,
              [task.key]: "loading",
            }));
            try {
              await task.load();
              if (controller.signal.aborted) return;
              setResourceLoadState((current) => ({
                ...current,
                [task.key]: "ready",
              }));
            } catch (resourceError: unknown) {
              if (
                controller.signal.aborted ||
                (resourceError instanceof DOMException &&
                  resourceError.name === "AbortError")
              ) return;
              setResourceLoadState((current) => ({
                ...current,
                [task.key]: "error",
              }));
            }
          }
        };
        const startOptionalLoads = () => {
          void Promise.all([runWorker(), runWorker(), runWorker()]);
        };
        if (optionalTasks.some((task) => task.views.includes(initialView)))
          startOptionalLoads();
        else
          optionalStartTimer = window.setTimeout(startOptionalLoads, 650);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError("No se pudo cargar la instantánea de inteligencia competitiva.");
        setLoading(false);
      });
    return () => {
      controller.abort();
      if (optionalStartTimer !== null)
        window.clearTimeout(optionalStartTimer);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2 || globalAds !== null) return;
    const controller = new AbortController();
    fetch("/data/ad-corpus.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AnunciosRealesData>;
      })
      .then((data) => setGlobalAds(data.items))
      .catch((searchError: unknown) => {
        if (searchError instanceof DOMException && searchError.name === "AbortError")
          return;
        setGlobalAds([]);
      });
    return () => controller.abort();
  }, [globalAds, query]);

  const scopes = useMemo(
    () => ["Todos", ...new Set(companies.map((x) => x.scope))],
    [companies],
  );
  const channels = useMemo(
    () => [
      "Todos",
      ...[...new Set(companies.flatMap((x) => x.channels))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    ],
    [companies],
  );
  const countryOptions = useMemo(() => {
    const canonical = countries.map((x) => ({ name: x.name, count: x.count }));
    const special = [
      ...new Set(
        companies
          .filter((x) => !x.countries.length)
          .map((x) => x.primaryCountry),
      ),
    ]
      .map((name) => ({
        name,
        count: companies.filter(
          (x) => !x.countries.length && x.primaryCountry === name,
        ).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return [...canonical, ...special];
  }, [companies, countries]);
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );
  const globalCompanyResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    if (value.length < 2) return [];
    return companies
      .filter((company) =>
        [
          company.name,
          company.primaryCountry,
          company.scope,
          company.agencyType,
          company.offer,
          company.priceLocal,
          company.channels.join(" "),
        ]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(value),
      )
      .slice(0, 5);
  }, [companies, query]);
  const globalAdResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    if (value.length < 2 || !globalAds) return [];
    return globalAds
      .filter((item) =>
        `${item.name} ${item.titular} ${item.texto} ${item.angulo} ${item.externalId || ""}`
          .toLocaleLowerCase("es")
          .includes(value),
      )
      .slice(0, 5);
  }, [globalAds, query]);
  const globalSearchOptionCount =
    globalCompanyResults.length + globalAdResults.length;
  const globalSearchIsOpen =
    globalSearchOpen && query.trim().length >= 2;
  const globalSearchActiveId = globalSearchActiveIndex >= 0
    ? `global-search-option-${globalSearchActiveIndex}`
    : undefined;
  const mrrProj = useMemo(() => {
    const clientes = Number(mrrClientes.replace(",", "."));
    const cuota = Number(mrrCuota.replace(",", "."));
    const altas = Number(mrrAltas.replace(",", "."));
    const churn = Number(mrrChurn.replace(",", ".")) / 100;
    if (![clientes, cuota, altas].every((v) => Number.isFinite(v) && v >= 0) || !Number.isFinite(churn) || churn < 0 || churn > 1) return null;
    const rows: Array<{ mes: number; clientes: number; mrr: number }> = [];
    let c = clientes;
    for (let mes = 1; mes <= 12; mes++) {
      c = c * (1 - churn) + altas;
      rows.push({ mes, clientes: Math.round(c * 10) / 10, mrr: Math.round(c * cuota) });
    }
    const mrr0 = Math.round(clientes * cuota);
    const final = rows[rows.length - 1];
    const techo = churn > 0 ? Math.round((altas / churn) * cuota) : null;
    const anual = rows.reduce((sum, r) => sum + r.mrr, 0);
    return { rows, mrr0, final, techo, anual, cuota };
  }, [mrrClientes, mrrCuota, mrrAltas, mrrChurn]);
  const informeText = useMemo(() => {
    if (!companies.length) return "";
    const spain = companies.filter((c) => c.primaryCountry === "España");
    const nuevas = companies.filter((c) => c.addedAt === "2026-08-23");
    const rojos = (vigilancia?.semaforo || []).filter((s) => s.nivel === "rojo");
    const topRojos = rojos.sort((a, b) => b.score - a.score).slice(0, 5).map((s) => `${s.name} (${s.score})`).join(", ");
    const topAcciones = (execution?.actions || []).slice().sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort)).slice(0, 5);
    const lines: string[] = [];
    lines.push(`INFORME EJECUTIVO · INTELIGENCIA DE CAPTACIÓN REDVITALIA`);
    lines.push(`Corte: ${BUILD_DATE_LONG} · generado desde la base viva del portal`);
    lines.push("");
    lines.push(`1. BASE`);
    lines.push(`${fmt(companies.length)} fichas de competidores en ${new Set(companies.map((c) => c.primaryCountry)).size} mercados primarios; ${fmt(spain.length)} operan en España.${nuevas.length ? ` El corte del 23/08/2026 incorporó ${nuevas.length} fichas desde la revisión de anuncios (Meta, Google, Instagram).` : ""}`);
    lines.push("");
    lines.push(`2. HALLAZGOS DE LOS CRUCES`);
    (cruces?.findings || []).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push("");
    lines.push(`3. PATRONES DE LOS REFERENTES CON SCORE 80+`);
    (patterns?.findings || []).slice(0, 4).forEach((f) => lines.push(`· ${f.title} (${f.stat}): ${f.detail}`));
    lines.push("");
    lines.push(`4. LO QUE DICEN ${fmt(angulos?.total || 0)} ANUNCIOS CURADOS${manifest ? ` (corpus buscable: ${fmt(manifest.advertising.searchablePieces)} piezas de ${fmt(manifest.advertising.representedAdvertisers)} anunciantes)` : ""}`);
    (angulos?.findings || []).forEach((f) => lines.push(`· ${f}`));
    lines.push("");
    lines.push(`5. AMENAZAS EN ESPAÑA`);
    lines.push(`${rojos.length} competidores en nivel rojo de ${vigilancia?.semaforo.length || 0} vigilados. Los cinco más peligrosos: ${topRojos || "—"}.`);
    if (cruces?.contradicciones.length) lines.push(`${cruces.contradicciones.length} vigiladas prometen algo en la home que su letra pequeña desmiente: material directo para venta comparativa.`);
    lines.push("");
    lines.push(`6. PRÓXIMAS 5 ACCIONES (mayor impacto por esfuerzo)`);
    topAcciones.forEach((a, i) => lines.push(`${i + 1}. ${a.title} — impacto ${a.impact}/5, esfuerzo ${a.effort}/5 (${a.categoria})`));
    lines.push("");
    lines.push(`Fuente: portal Inteligencia Mundial de Captación · RedVitalia. Cada dato es trazable a su ficha.`);
    return lines.join("\n");
  }, [companies, vigilancia, cruces, patterns, angulos, execution, manifest]);
  /* Generador heredado conservado temporalmente como referencia histórica.
     La vista activa usa LandingStudio y el corpus site-captures. */
  /*
  const landingStudy = useMemo(() => {
    const vertical = verticales?.verticales.find((item) => item.id === landVertical);
    if (!vertical) return null;
    const deepById = new Map((deepIndex?.records || []).map((item) => [item.id, item]));
    const references = vertical.referentes
      .map((reference) => ({ reference, funnel: deepById.get(reference.id) }))
      .filter((item) => item.funnel?.researchReadiness === "usable");
    const fieldCounts = references
      .map((item) => item.funnel?.minFormFields)
      .filter((value): value is number => Number.isFinite(value));
    return {
      references: references.slice(0, 4),
      medianFields: fieldCounts.length
        ? Math.round(fieldCounts.reduce((sum, value) => sum + value, 0) / fieldCounts.length)
        : null,
      ctas: [...new Set(references.map((item) => item.funnel?.primaryCta).filter(Boolean))].slice(0, 4),
    };
  }, [deepIndex, landVertical, verticales]);
  const landingHtml = useMemo(() => {
    const v = verticales?.verticales.find((x) => x.id === landVertical);
    if (!v) return "";
    const zona = landZona.trim() || "tu zona";
    const NICE: Record<string, { cliente: string; unidad: string; servicio: string; dolor: string; resultado: string; filtro: string }> = {
      "clinicas-salud": { cliente: "tu clínica", unidad: "pacientes", servicio: "captación de pacientes", dolor: "huecos de agenda, consultas sin intención y no-shows", resultado: "pacientes cualificados y confirmados en agenda", filtro: "tratamiento, zona, disponibilidad e intención" },
      "reformas-hogar": { cliente: "tu empresa de reformas", unidad: "obras", servicio: "captación de obras", dolor: "leads compartidos y visitas sin intención real", resultado: "visitas de presupuesto con propietarios cualificados", filtro: "tipo de obra, zona, plazo, propiedad y presupuesto" },
      "solar-energia": { cliente: "tu instaladora", unidad: "instalaciones", servicio: "captación de instalaciones", dolor: "visitas a viviendas inviables y contactos compartidos", resultado: "visitas viables con propietarios decisores", filtro: "vivienda, consumo, titularidad, zona y plazo" },
      "inmobiliario": { cliente: "tu inmobiliaria", unidad: "propietarios", servicio: "captación de propietarios", dolor: "compradores curiosos y propietarios sin intención de vender", resultado: "citas de valoración con propietarios vendedores", filtro: "propiedad, zona, motivo, plazo y decisión" },
      "legal": { cliente: "tu despacho", unidad: "casos", servicio: "captación de casos", dolor: "consultas fuera de especialidad y llamadas que consumen horas", resultado: "consultas filtradas y agendadas por especialidad", filtro: "materia, jurisdicción, urgencia, zona y encaje" },
      "coches-motor": { cliente: "tu concesionario o taller", unidad: "clientes", servicio: "captación de clientes", dolor: "solicitudes sin vehículo, presupuesto o intención", resultado: "oportunidades cualificadas listas para atender", filtro: "vehículo, servicio, zona, presupuesto y plazo" },
      "b2b-sdr": { cliente: "tu negocio B2B", unidad: "reuniones", servicio: "generación de reuniones", dolor: "listas frías, reuniones sin decisor y seguimiento irregular", resultado: "reuniones con cuentas y decisores que encajan", filtro: "empresa, cargo, necesidad, tamaño y momento" },
      "belleza-bienestar": { cliente: "tu centro", unidad: "clientas", servicio: "captación de clientas", dolor: "huecos de agenda y consultas que no reservan", resultado: "reservas cualificadas para tus tratamientos", filtro: "tratamiento, zona, disponibilidad e intención" },
      "hosteleria-turismo": { cliente: "tu negocio", unidad: "reservas", servicio: "captación de reservas", dolor: "dependencia de intermediarios y demanda poco previsible", resultado: "reservas directas con datos propios", filtro: "fechas, grupo, zona, disponibilidad y presupuesto" },
      "directorios-marketplaces": { cliente: "tu negocio", unidad: "clientes", servicio: "captación de clientes", dolor: "visibilidad sin demanda verificable y contactos compartidos", resultado: "solicitudes trazables con intención concreta", filtro: "servicio, zona, plazo, presupuesto y contacto" },
      "generalista": { cliente: "tu negocio", unidad: "clientes", servicio: "captación de clientes", dolor: "contactos sin contexto y seguimiento inconsistente", resultado: "oportunidades cualificadas listas para atender", filtro: "servicio, zona, necesidad, plazo y presupuesto" },
    };
    const nice = NICE[v.id] || NICE.generalista;
    const servicio = landServicio.trim() || nice.servicio;
    const tel = landTelefono.replace(/\D/g, "") || "34613431439";
    const wa = (txt: string) => `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const Z = esc(zona), S = esc(servicio);
    const U = nice.unidad;
    const deepById = new Map((deepIndex?.records || []).map((item) => [item.id, item]));
    const studiedReferences = v.referentes
      .map((reference) => ({ reference, funnel: deepById.get(reference.id) }))
      .filter((item) => item.funnel?.researchReadiness === "usable");
    const formFieldCounts = studiedReferences
      .map((item) => item.funnel?.minFormFields)
      .filter((value): value is number => Number.isFinite(value));
    const observedFormFields = formFieldCounts.length
      ? Math.round(formFieldCounts.reduce((sum, value) => sum + value, 0) / formFieldCounts.length)
      : null;
    const observedCtas = [...new Set(studiedReferences.map((item) => item.funnel?.primaryCta).filter(Boolean))].slice(0, 3);
    const sourceNames = v.referentes.slice(0, 3).map((item) => item.name).join(", ");
    const TEMPLATES = {
      garantia: {
        pill: `${S.charAt(0).toUpperCase() + S.slice(1)} · hipótesis de reducción de riesgo`,
        h1: `${nice.resultado.charAt(0).toUpperCase() + nice.resultado.slice(1)} en ${Z}, con criterios claros antes de empezar`,
        sub: `Reduce ${nice.dolor}. Diseñamos el test, el filtro y el seguimiento; el volumen, el SLA y el remedio se fijan por escrito antes de lanzar.`,
        gTitle: "Garantía por configurar",
        gText: `Define una métrica, un periodo, sus exclusiones y un único remedio operativo. Si no quedan cerrados en el contrato, elimina este bloque.`,
      },
      anticuota: {
        pill: `Hipótesis · precio por resultado`,
        h1: `Evalúa pagar por cada ${U.replace(/s$/, "")} válida, no por una promesa genérica`,
        sub: `Una propuesta para ${nice.cliente} basada en ${nice.filtro}. Precio, atribución, duplicados, reposición y límite de compra se acuerdan antes del test.`,
        gTitle: "Regla de reposición por configurar",
        gText: `Describe qué invalida una pieza, cómo se prueba y qué remedio se aplica. Sin esos campos firmados, no publiques una promesa de reposición.`,
      },
      velocidad: {
        pill: `SLA firmado · 10 minutos`,
        h1: `Convierte cada solicitud en una conversación antes de que se enfríe`,
        sub: `Proponemos un primer contacto en menos de 10 minutos y un filtro de ${nice.filtro} para cada solicitud de ${S} en ${Z}. Horario, cobertura y remedio se configuran antes de publicar.`,
        gTitle: "SLA por contrato",
        gText: `Configura horario, método de medición, excepciones y remedio para el SLA. El descuento u otra compensación solo se mostrará si está aceptado en el contrato.`,
      },
    } as const;
    const T = TEMPLATES[landTemplate];
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RedVitalia · ${S} en ${Z}</title>
<style>
:root{--azul:#0b57d0;--azul2:#1a73e8;--ink:#1c2430;--muted:#5b6675;--paper:#f7f9fc;--ok:#0b6b2f}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.6}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header{padding:18px 0;border-bottom:1px solid #e6ebf2}header .wrap{display:flex;justify-content:space-between;align-items:center}
.logo{font-weight:800;font-size:19px;color:var(--azul)}.logo span{color:var(--ink)}
.pill{display:inline-block;background:#e8f0fe;color:var(--azul);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600}
.hero{padding:70px 0 54px;background:radial-gradient(circle at 86% 12%,#e8f0fe 0,transparent 34%),linear-gradient(180deg,#fff,var(--paper))}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.72fr);gap:50px;align-items:center}
h1{font-size:clamp(30px,4.6vw,46px);line-height:1.15;letter-spacing:-.02em;margin:16px 0 14px;max-width:21ch}
.sub{font-size:18px;color:var(--muted);max-width:56ch}
.cta{display:inline-block;margin-top:26px;background:var(--azul);color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:15px 30px;border-radius:12px;box-shadow:0 6px 18px rgba(11,87,208,.25)}
.cta.sec{background:#fff;color:var(--azul);border:1.5px solid var(--azul);box-shadow:none;margin-left:10px}
.hero-card{background:rgba(255,255,255,.92);border:1px solid #dce4f0;border-radius:20px;padding:24px;box-shadow:0 22px 56px rgba(33,54,84,.13)}
.hero-card>span{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--azul)}.hero-card h2{font-size:22px;line-height:1.2;margin:10px 0 16px}
.hero-card ul{list-style:none;display:grid;gap:12px}.hero-card li{position:relative;padding-left:26px;color:var(--muted);font-size:14px}.hero-card li:before{content:'✓';position:absolute;left:0;top:0;color:var(--ok);font-weight:900}
.research{border-bottom:1px solid #e6ebf2;background:#fff}.research .wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.research div{padding:19px 22px;border-right:1px solid #e6ebf2}.research div:last-child{border-right:0}.research b{display:block;font-size:20px;color:var(--ink)}.research span{font-size:12px;color:var(--muted)}
.bullets{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;padding:38px 0}
.b{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:18px}
.b b{display:block;font-size:15px;margin-bottom:6px}.b p{font-size:13.5px;color:var(--muted)}
.faixa{background:var(--azul);color:#fff;padding:34px 0}.faixa .wrap{display:flex;gap:28px;flex-wrap:wrap;justify-content:space-between;align-items:center}
.faixa h2{font-size:22px;max-width:34ch}.faixa a{background:#fff;color:var(--azul);text-decoration:none;font-weight:700;padding:13px 24px;border-radius:11px}
.pasos{padding:46px 0}.pasos h2,.datos h2,.form h2{font-size:26px;margin-bottom:20px}
.paso{display:flex;gap:16px;margin-bottom:18px}.paso i{flex:0 0 38px;height:38px;border-radius:50%;background:#e8f0fe;color:var(--azul);font-style:normal;font-weight:800;display:flex;align-items:center;justify-content:center}
.fit{padding:58px 0}.fit-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.fit article{padding:24px;border:1px solid #e2e8f1;border-radius:16px;background:#fff}.fit article:first-child{background:#f8fbff}.fit h2{font-size:28px;margin-bottom:8px}.fit h3{font-size:18px;margin-bottom:9px}.fit p{color:var(--muted)}
.datos{background:var(--paper);padding:46px 0}.datos .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.dato{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:18px;text-align:center}
.dato b{display:block;font-size:28px;color:var(--azul)}.dato span{font-size:13px;color:var(--muted)}
.garantia{margin:46px 0;border:2px solid var(--ok);background:#f2faf4;border-radius:16px;padding:24px}
.garantia h3{color:var(--ok);font-size:20px;margin-bottom:8px}
.faq{padding:54px 0;background:#fff}.faq h2{font-size:28px;margin-bottom:18px}.faq details{border-top:1px solid #e1e7ef;padding:16px 0}.faq details:last-child{border-bottom:1px solid #e1e7ef}.faq summary{font-weight:750;cursor:pointer}.faq details p{padding-top:9px;color:var(--muted);max-width:75ch}
.form{padding:54px 0 70px;background:#0f1f37;color:#fff}.form .form-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:48px;align-items:start}.form .intro p{color:#bcc9da}.form .caja{background:#fff;color:var(--ink);border:1px solid #e6ebf2;border-radius:18px;padding:26px;max-width:640px;box-shadow:0 24px 60px rgba(0,0,0,.2)}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.fields label.wide{grid-column:1/-1}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 5px}
input,select{width:100%;padding:12px;border:1px solid #cfd8e3;border-radius:10px;font-size:15px}
button{margin-top:18px;width:100%;background:#25d366;color:#fff;border:0;border-radius:12px;padding:15px;font-size:16.5px;font-weight:700;cursor:pointer}
footer{border-top:1px solid #e6ebf2;padding:26px 0;font-size:12.5px;color:var(--muted)}
@media(max-width:760px){.hero{padding-top:48px}.hero-grid,.fit-grid,.form .form-grid{grid-template-columns:1fr}.hero-grid{gap:28px}.research .wrap{grid-template-columns:1fr}.research div{border-right:0;border-bottom:1px solid #e6ebf2}.cta.sec{margin-left:0;margin-top:12px}.fields{grid-template-columns:1fr}.fields label.wide{grid-column:auto}}
</style></head><body>
<!-- Base de diseño RedVitalia: ${studiedReferences.length} funnels utilizables; referencias internas: ${esc(sourceNames || "sin referentes estructurados")}; CTAs observados: ${esc(observedCtas.join(" · ") || "sin CTA comparable")}. La redacción es una síntesis, no una copia literal ni una afirmación de rendimiento. -->
<header><div class="wrap"><div class="logo">Red<span>Vitalia</span></div><span class="pill">BORRADOR · disponibilidad por comprobar</span></div></header>
<section class="hero"><div class="wrap hero-grid"><div>
<span class="pill">BORRADOR EDITORIAL · ${T.pill}</span>
<h1>${T.h1}</h1>
<p class="sub">${T.sub}</p>
<a class="cta" href="${wa(`Hola, soy de ${zona}. Quiero evaluar ${servicio} con RedVitalia.`)}">Comprobar encaje en ${Z}</a>
<a class="cta sec" href="#como">Ver el proceso</a>
</div><aside class="hero-card">
<span>DIAGNÓSTICO DE ENCAJE</span>
<h2>Qué se define antes de invertir</h2>
<ul>
<li>Zona, capacidad y servicio prioritario de ${nice.cliente}.</li>
<li>Filtro de entrada: ${nice.filtro}.</li>
<li>Criterio de oportunidad válida, duplicados y exclusiones.</li>
<li>SLA, seguimiento y remedio operativo por escrito.</li>
</ul>
</aside></div></section>
<section class="research"><div class="wrap">
<div><b>${fmt(v.n)}</b><span>empresas del vertical analizadas</span></div>
<div><b>${studiedReferences.length || "—"}</b><span>funnels de referentes estructurados y utilizables</span></div>
<div><b>${observedFormFields ?? "—"}</b><span>campos mínimos medios observados en esos funnels</span></div>
</div></section>
<div class="wrap"><div class="bullets">
<div class="b"><b>⚡ SLA configurable</b><p>Objetivo propuesto de primer contacto en menos de 10 minutos. Debe validarse contra la capacidad operativa y quedar por escrito.</p></div>
<div class="b"><b>🔒 Exclusividad configurable</b><p>La zona y la regla de no compartir contactos solo deben publicarse cuando estén comprobadas y aceptadas en el contrato.</p></div>
<div class="b"><b>📄 Condiciones transparentes</b><p>Duración, renovación y cancelación se muestran en la propuesta final; esta plantilla no las presupone.</p></div>
<div class="b"><b>✅ Criterios de cualificación</b><p>Zona, servicio e intención se definen antes del test para poder medir qué contactos cumplen lo pactado.</p></div>
</div></div>
<section class="fit"><div class="wrap"><h2>Una página construida para el problema real</h2><div class="fit-grid">
<article><h3>Lo que queremos dejar atrás</h3><p>${nice.dolor.charAt(0).toUpperCase() + nice.dolor.slice(1)}. Por eso la página no vende clics: explica el filtro, la respuesta y la trazabilidad.</p></article>
<article><h3>El resultado operativo que se evalúa</h3><p>${nice.resultado.charAt(0).toUpperCase() + nice.resultado.slice(1)}, con criterios verificables de ${nice.filtro}.</p></article>
</div></div></section>
<section class="faixa"><div class="wrap"><h2>Hemos analizado ${fmt(v.n)} empresas de captación de este sector. Es evidencia de mercado para formular un test, no prueba de rendimiento.</h2><a href="${wa(`Hola, quiero la auditoría de captación para ${servicio} en ${zona}.`)}">Pedir auditoría</a></div></section>
<section class="pasos" id="como"><div class="wrap"><h2>Cómo funciona</h2>
<div class="paso"><i>1</i><div><b>Diagnóstico por configurar.</b> Acordamos plazo, alcance, zona y capacidad real de atender ${nice.unidad} nuevos.</div></div>
<div class="paso"><i>2</i><div><b>Test controlado.</b> Se aprueban campaña, criterios y una sola variable antes de invertir.</div></div>
<div class="paso"><i>3</i><div><b>Revisión semanal.</b> Se registran inversión, lead, cita, asistencia y venta sin prometer un volumen no medido.</div></div>
</div></section>
<section class="datos"><div class="wrap"><h2>Datos, no promesas</h2><div class="grid">
<div class="dato"><b>${fmt(v.n)}</b><span>competidores analizados en tu sector</span></div>
<div class="dato"><b>10 min</b><span>objetivo de SLA propuesto; confirmar cobertura y remedio antes de publicar</span></div>
<div class="dato"><b>${v.medianEur ? fmt(v.medianEur) + " €" : "—"}</b><span>mediana de las tarifas públicas comparables documentadas en este vertical</span></div>
<div class="dato"><b>A definir</b><span>duración y cancelación deben configurarse en la propuesta final</span></div>
</div>
<div class="garantia"><h3>${T.gTitle}</h3><p>${T.gText}</p></div>
</div></section>
<section class="faq"><div class="wrap"><h2>Preguntas antes de empezar</h2>
<details><summary>¿Trabajáis con más de una empresa en la misma zona?</summary><p>La exclusividad no se presupone. Primero comprobamos zona, servicio, capacidad y duración; solo se comunica si queda aceptada por escrito.</p></details>
<details><summary>¿Qué cuenta como oportunidad válida?</summary><p>Se define antes del test con ${nice.filtro}. También se documentan duplicados, datos falsos, fuera de zona y el remedio aplicable.</p></details>
<details><summary>¿Se garantiza un resultado comercial?</summary><p>No se promete una venta que no controlamos. Sí pueden pactarse entregables operativos, medición, SLA y un remedio proporcionado.</p></details>
<details><summary>¿Qué veremos en el diagnóstico?</summary><p>Capacidad, zona, oferta prioritaria, economía por ${U.replace(/s$/, "")}, seguimiento actual y una hipótesis de test con una sola variable.</p></details>
</div></section>
<section class="form"><div class="wrap form-grid"><div class="intro"><span class="pill">SIGUIENTE PASO</span><h2>Evaluar encaje en ${Z}</h2><p>Cuéntanos lo mínimo necesario. Abriremos WhatsApp con el contexto ordenado para que la primera conversación sea útil.</p></div><form class="caja" id="lead-form" data-service="${S}">
<div class="fields"><label>Tu nombre<input id="n" name="nombre" required placeholder="Nombre y apellido"></label>
<label>Teléfono<input id="p" name="telefono" inputmode="tel" placeholder="Tu teléfono"></label>
<label>Tu negocio<input id="e" name="empresa" required placeholder="Nombre del negocio"></label>
<label>Zona<input id="z" name="zona" required value="${Z}"></label>
<label class="wide">¿Qué quieres captar?<input id="s" name="objetivo" value="${S}"></label>
<label class="wide">Capacidad aproximada al mes<select id="c" name="capacidad"><option>Por definir</option><option>1–5</option><option>6–15</option><option>16–30</option><option>Más de 30</option></select></label></div>
<button type="submit">Solicitar diagnóstico por WhatsApp →</button>
<p style="font-size:12px;color:var(--muted);margin-top:10px">El envío no confirma disponibilidad, exclusividad, precio ni SLA.</p>
</form></div></section>
<footer><div class="wrap">RedVitalia · Inteligencia y captación de clientes · ${Z} · ${new Date().getFullYear()}</div></footer>
<script>(function(){var form=document.getElementById('lead-form');if(!form)return;form.addEventListener('submit',function(event){event.preventDefault();var value=function(id){var node=document.getElementById(id);return node&&'value' in node?String(node.value).trim():'';};var message=['Hola, soy '+value('n')+' de '+value('e')+'.','Zona: '+value('z')+'.','Objetivo: '+(value('s')||form.dataset.service)+'.','Capacidad mensual: '+value('c')+'.',value('p')?'Mi teléfono: '+value('p')+'.':'','Quiero evaluar el encaje con RedVitalia.'].filter(Boolean).join('\\n');location.href='https://wa.me/${tel}?text='+encodeURIComponent(message);});})();</script>
</body></html>`;
  }, [deepIndex, verticales, landVertical, landZona, landServicio, landTelefono, landTemplate]);
  */
  const proposalText = useMemo(() => {
    const vertical = verticales?.verticales.find((v) => v.id === propVertical);
    if (!vertical) return "";
    const zona = propZona || "[ZONA]";
    const servicio = propServicio || vertical.label.toLowerCase();
    const precio = propPrecio || "[PRECIO]";
    const refs = vertical.referentes.slice(0, 3).map((r) => `${r.name} (${r.country})`).join(", ");
    return `PROPUESTA DE CAPTACIÓN — ${zona.toUpperCase()} · ${vertical.label.toUpperCase()}

Preparada por RedVitalia · ${new Date().toLocaleDateString("es-ES")}

1. TU MERCADO, EN DATOS
La muestra contiene ${vertical.n} empresas de captación del vertical «${vertical.label}» (${vertical.spainN} en España). ${vertical.medianEur ? `La mediana de las tarifas públicas comparables documentadas es ${vertical.medianEur} €.` : "No hay una mediana pública comparable suficiente."} El ${vertical.adsActivePct}% tiene anuncios activos documentados en el corte. Referencias con score editorial alto: ${refs}.

2. QUÉ TE PROPONEMOS
Propuesta editorial: captar, cualificar y agendar oportunidades de ${zona} interesadas en ${servicio}. El volumen, la definición de cita válida y las responsabilidades se fijan antes del test; no son resultados históricos.

3. CONDICIONES PROPUESTAS A CONFIGURAR
· Protección territorial: comprobar disponibilidad, alcance y duración antes de ofrecerla.
· Cita válida: definir duplicado, falsedad, zona, intención, prueba y remedio antes de empezar.
· Volumen: fijar objetivo, periodo, exclusiones y un remedio operativo concreto; si falta alguno, no presentarlo como garantía.

4. CÓMO ARRANCAMOS (Semana 0)
Diagnóstico → responsable operativo → guion aprobado → criterios de cita válida firmados → test. Facturación y fecha de inicio se detallan en la versión contractual.

5. INVERSIÓN
${precio} €/mes. Duración, renovación y cancelación se detallan expresamente. La comparación económica se hará contra el coste total documentado del canal actual del cliente.

6. TU PLAZA
La disponibilidad territorial no se presupone. Antes de usar exclusividad, comprobar y registrar si ${zona} está disponible para ${servicio}; si no puede demostrarse, retirar este argumento.

[Firma / contacto RedVitalia]`;
  }, [propVertical, propZona, propServicio, propPrecio, verticales]);
  const locationSummary = useMemo(() => {
    const withPoint = companies.filter(
      (company) =>
        company.location &&
        Number.isFinite(company.location.latitude) &&
        Number.isFinite(company.location.longitude),
    ).length;
    return { withPoint, withoutPoint: companies.length - withPoint };
  }, [companies]);
  const filtered = useMemo(
    () =>
      companies.filter((c) => {
        const q = query.toLocaleLowerCase("es");
        return (
          (!q ||
            [
              c.name,
              c.primaryCountry,
              ...c.countries,
              c.market,
              c.agencyType,
              c.offer,
              c.priceLocal,
              c.niche,
              ...c.channels,
            ]
              .join(" ")
              .toLocaleLowerCase("es")
              .includes(q)) &&
          (scope === "Todos" || c.scope === scope) &&
          (country === "Todos" ||
            c.countries.includes(country) ||
            (!c.countries.length && c.primaryCountry === country)) &&
          (!priceOnly || c.price.eur != null) &&
          (!companiesNewOnly || c.addedAt === "2026-08-23") &&
          (channel === "Todos" || c.channels.includes(channel))
        );
      }),
    [companies, query, scope, country, priceOnly, channel, companiesNewOnly],
  );
  const galleryMetrics = useMemo(
    () => deriveGalleryMetrics(companies, summary),
    [companies, summary],
  );
  const compared = compare
    .map((id) => companies.find((x) => x.id === id))
    .filter(Boolean) as Company[];
  const deepRows = useMemo(() => {
    const q = query.toLocaleLowerCase("es");
    return (deepIndex?.records || [])
      .map((intel: DeepIndexItem) => ({ intel, company: companyById.get(intel.id) }))
      .filter(
        (row): row is { intel: DeepIndexItem; company: Company } =>
          Boolean(row.company),
      )
      .filter(({ intel, company }) =>
        (!q ||
          [
            company.name,
            company.primaryCountry,
            company.offer,
            company.niche,
            intel.hero,
            intel.primaryCta || "",
            intel.captureType,
            ...intel.technologies,
          ]
            .join(" ")
            .toLocaleLowerCase("es")
            .includes(q)) &&
        (scope === "Todos" || company.scope === scope) &&
        (country === "Todos" || company.countries.includes(country) || company.primaryCountry === country) &&
        (funnelCapture === "Todos" || intel.captureType === funnelCapture) &&
        (funnelStatus === "Todos" || intel.status === funnelStatus),
      )
      .sort(
        (a, b) =>
          b.intel.coveragePercent - a.intel.coveragePercent ||
          b.company.score - a.company.score,
      );
  }, [companyById, country, deepIndex, funnelCapture, funnelStatus, query, scope]);
  const v3Rows = useMemo(() => {
    const q = query.toLocaleLowerCase("es");
    return (v3Index?.records || [])
      .map((intel: FunnelV3IndexItem) => ({
        intel,
        company: companyById.get(intel.id),
      }))
      .filter(
        (row): row is { intel: FunnelV3IndexItem; company: Company } =>
          Boolean(row.company),
      )
      .filter(({ intel, company }) => {
        const conversionMatch =
          funnelCapture === "Todos" ||
          (funnelCapture === "Con formulario" && intel.forms > 0) ||
          (funnelCapture === "Sin formulario" && intel.forms === 0) ||
          (funnelCapture === "Con CTA observable" && Boolean(intel.primaryCta)) ||
          (funnelCapture === "Sin CTA observable" && !intel.primaryCta);
        const coverageMatch =
          funnelStatus === "Todos" ||
          (funnelStatus === "Evidencia manual" && intel.manualEvidence) ||
          (funnelStatus === "Verificación estructural" && !intel.manualEvidence) ||
          (funnelStatus === "Cobertura 75–100%" && intel.coveragePercent >= 75) ||
          (funnelStatus === "Cobertura 50–74%" && intel.coveragePercent >= 50 && intel.coveragePercent < 75) ||
          (funnelStatus === "Cobertura menor del 50%" && intel.coveragePercent < 50);
        return (
          (!q ||
            [
              company.name,
              company.primaryCountry,
              company.offer,
              company.niche,
              intel.headline,
              intel.primaryCta || "",
              intel.status,
            ]
              .join(" ")
              .toLocaleLowerCase("es")
              .includes(q)) &&
          (scope === "Todos" || company.scope === scope) &&
          (country === "Todos" ||
            company.countries.includes(country) ||
            company.primaryCountry === country) &&
          conversionMatch &&
          coverageMatch
        );
      })
      .sort(
        (a, b) =>
          b.intel.coveragePercent - a.intel.coveragePercent ||
          b.intel.evidence - a.intel.evidence ||
          b.company.score - a.company.score,
      );
  }, [companyById, country, funnelCapture, funnelStatus, query, scope, v3Index]);
  const top = companies.slice(0, 4);
  const go = (v: View, options?: { adQuery?: string; tab?: string; area?: string }) => {
    setAdLabInitialQuery(v === "adlab" ? options?.adQuery || "" : "");
    setView(v);
    const url = new URL(window.location.href);
    if (v === "home") url.searchParams.delete("vista");
    else url.searchParams.set("vista", v);
    if (v === "operations" && options?.tab) url.searchParams.set("tab", options.tab);
    else url.searchParams.delete("tab");
    if (v === "decisions" && options?.area) url.searchParams.set("area", options.area);
    else url.searchParams.delete("area");
    window.history.pushState({ vista: v }, "", url);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  const openLandingBrief = (brief: LandingBrief) => {
    window.localStorage.setItem("rv-landing-studio-v3", JSON.stringify(brief));
    go("landings");
  };
  const chooseCountry = (name: string) => {
    setCountry(name);
    setView("companies");
    setVisible(24);
    const url = new URL(window.location.href);
    url.searchParams.set("vista", "companies");
    window.history.pushState({ vista: "companies" }, "", url);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  const toggleCompare = (id: string) => {
    if (compare.includes(id)) {
      setCompare((current) => current.filter((candidate) => candidate !== id));
      return;
    }
    if (compare.length >= 4) {
      setToast("El comparador admite un máximo de cuatro empresas");
      return;
    }
    setCompare((current) => [...current, id]);
  };
  const openCompany = useCallback((company: Company) => {
    setActive(company);
    setLightbox(null);
    const url = new URL(window.location.href);
    url.searchParams.set("empresa", company.id);
    url.searchParams.delete("media");
    url.searchParams.delete("archivo");
    url.searchParams.delete("evidence");
    url.hash = "";
    window.history.pushState(
      { ...window.history.state, rvModal: "company", empresa: company.id },
      "",
      url,
    );
  }, []);
  const closeCompany = useCallback(() => {
    setActive(null);
    setLightbox(null);
    if (window.history.state?.rvModal === "company") {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("empresa");
    url.searchParams.delete("media");
    url.searchParams.delete("archivo");
    url.searchParams.delete("evidence");
    url.hash = "";
    window.history.replaceState(
      { vista: url.searchParams.get("vista") || "home" },
      "",
      url,
    );
  }, []);
  const closeGlobalSearch = () => {
    setGlobalSearchOpen(false);
    setGlobalSearchActiveIndex(-1);
  };
  const selectGlobalSearchResult = (index: number) => {
    if (index < 0 || index >= globalSearchOptionCount) return;
    if (index < globalCompanyResults.length) {
      openCompany(globalCompanyResults[index]);
    } else {
      const item = globalAdResults[index - globalCompanyResults.length];
      if (!item) return;
      go("adlab", {
        adQuery: item.corpusKey || item.externalId || item.titular || item.name,
      });
    }
    setQuery("");
    closeGlobalSearch();
  };
  const shareCompany = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Enlace de la ficha copiado");
    } catch {
      setToast("Copia la dirección del navegador para compartir esta ficha");
    }
  }, []);
  const openMedia = useCallback((
    media: Media,
    company: Company,
    suppliedCollection?: Media[],
    source: "gallery" | "funnel" = "gallery",
  ) => {
    const collection = suppliedCollection?.length ? suppliedCollection : company.media;
    const index = collection.findIndex((item) => item.file === media.file);
    if (index < 0) return;
    const linkPosition = source === "gallery"
      ? galleryMediaPosition(company.media, media.file)
      : index + 1;
    if (linkPosition < 1) return;
    setLightbox({ media, company, collection, source });
    const url = new URL(window.location.href);
    url.searchParams.set("empresa", company.id);
    url.searchParams.delete("media");
    url.searchParams.delete("archivo");
    url.searchParams.delete("evidence");
    url.searchParams.set(source === "funnel" ? "evidence" : "media", String(linkPosition));
    if (source === "gallery") url.searchParams.set("archivo", media.file);
    window.history.pushState(
      {
        ...window.history.state,
        rvModal: "media",
        empresa: company.id,
        media: media.file,
        source,
      },
      "",
      url,
    );
  }, []);
  const closeMedia = useCallback(() => {
    setLightbox(null);
    if (window.history.state?.rvModal === "media") {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("media");
    url.searchParams.delete("archivo");
    url.searchParams.delete("evidence");
    if (!active) url.searchParams.delete("empresa");
    window.history.replaceState(
      active
        ? {
            vista: url.searchParams.get("vista") || "home",
            empresa: active.id,
          }
        : { vista: url.searchParams.get("vista") || "home" },
      "",
      url,
    );
  }, [active]);

  const clearCompanyFilters = () => {
    setScope("Todos");
    setCountry("Todos");
    setChannel("Todos");
    setPriceOnly(false);
    setCompaniesNewOnly(false);
    setQuery("");
    setVisible(24);
  };

  const handleEditorialTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: keyof Editorial,
  ) => {
    const currentIndex = editorialTabs.findIndex((tab) => tab.id === currentTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % editorialTabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + editorialTabs.length) % editorialTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = editorialTabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = editorialTabs[nextIndex].id;
    setEditorialTab(nextTab);
    window.requestAnimationFrame(() => editorialTabRefs.current[nextTab]?.focus());
  };
  const stepLightbox = useCallback(
    (direction: number) =>
      setLightbox((current) => {
        if (!current || current.collection.length < 2) return current;
        const index = current.collection.findIndex(
          (item) => item.file === current.media.file,
        );
        const next =
          (index + direction + current.collection.length) %
          current.collection.length;
        const nextMedia = current.collection[next];
        const url = new URL(window.location.href);
        url.searchParams.set("empresa", current.company.id);
        url.searchParams.delete("media");
        url.searchParams.delete("archivo");
        url.searchParams.delete("evidence");
        const linkPosition = current.source === "gallery"
          ? galleryMediaPosition(current.company.media, nextMedia.file)
          : next + 1;
        url.searchParams.set(current.source === "funnel" ? "evidence" : "media", String(linkPosition));
        if (current.source === "gallery") url.searchParams.set("archivo", nextMedia.file);
        window.history.replaceState(
          {
            ...window.history.state,
            empresa: current.company.id,
            media: nextMedia.file,
            source: current.source,
          },
          "",
          url,
        );
        return { ...current, media: nextMedia };
      }),
    [],
  );
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) closeMedia();
        else if (active) closeCompany();
      } else if (lightbox && e.key === "ArrowLeft") stepLightbox(-1);
      else if (lightbox && e.key === "ArrowRight") stepLightbox(1);
      else if (lightbox && e.key === "Tab") {
        const focusable = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
          ) || [],
        ).filter((element) => !element.hasAttribute("hidden"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [active, closeCompany, closeMedia, lightbox, stepLightbox]);
  const lightboxOpen = Boolean(lightbox);
  useEffect(() => {
    if (!lightboxOpen) return;
    const priorFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (priorFocus && document.contains(priorFocus)) priorFocus.focus();
    };
  }, [lightboxOpen]);
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("vista");
      const nextView = requestedView === "map"
        ? "countries"
        : nav.some((item) => item.id === requestedView)
          ? requestedView as View
          : "home";
      setView(nextView);
      if (requestedView === "map") {
        const legacyUrl = new URL(window.location.href);
        legacyUrl.searchParams.set("vista", "countries");
        window.history.replaceState({ ...window.history.state, vista: "countries" }, "", legacyUrl);
      }
      const requested = params.get("empresa");
      const company = requested
        ? companies.find((item) => item.id === requested) || null
        : null;
      setActive(company);
      const mediaIndex = company
        ? resolveGalleryMediaIndex(
            company.media,
            params.get("media"),
            params.get("archivo"),
          )
        : -1;
      const evidenceIndex = Number(params.get("evidence")) - 1;
      if (company && Number.isInteger(mediaIndex) && company.media[mediaIndex]) {
        setLightbox({
          company,
          media: company.media[mediaIndex],
          collection: company.media,
          source: "gallery",
        });
      } else if (company && Number.isInteger(evidenceIndex) && evidenceIndex >= 0) {
        fetch(`/data/funnel-v3/records/${company.id}.json`)
          .then((response) =>
            response.ok
              ? (response.json() as Promise<FunnelV3Review>)
              : null,
          )
          .then((review: FunnelV3Review | null) => {
            if (!review) return setLightbox(null);
            const collection = funnelScreenshotMedia(review);
            setLightbox(
              collection[evidenceIndex]
                ? {
                    company,
                    media: collection[evidenceIndex],
                    collection,
                    source: "funnel",
                  }
                : null,
            );
          })
          .catch(() => setLightbox(null));
      } else setLightbox(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [companies]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const lightboxResolution = classifyMediaResolution(
    lightbox
      ? dimensionsFromMedia(lightbox.media) ||
          measuredImageDimensions[lightbox.media.file] ||
          null
      : null,
  );
  const lightboxMediaCaption = lightbox
    ? Array.from(
        new Set(
          [lightbox.media.title, lightbox.media.label]
            .filter(
              (value): value is string => Boolean(value && value.trim()),
            )
            .map((value) => value.trim()),
        ),
      ).join(" · ")
    : "";
  const requiredViewResources = requiredResourcesByView[view] || [];
  const funnelResourceReady =
    resourceLoadState.v3Index === "ready" ||
    resourceLoadState.deepIndex === "ready";
  const funnelResourceError =
    resourceLoadState.v3Index === "error" &&
    resourceLoadState.deepIndex === "error";
  const viewResourceError = view === "funnels"
    ? funnelResourceError
    : requiredViewResources.some(
        (resource) => resourceLoadState[resource] === "error",
      );
  const viewResourcePending = view === "funnels"
    ? !funnelResourceReady && !funnelResourceError
    : requiredViewResources.some(
        (resource) => resourceLoadState[resource] !== "ready",
      ) && !viewResourceError;
  const viewResourcesReady = !viewResourcePending && !viewResourceError;

  if (loading)
    return (
      <main className="loading-screen">
        <div className="brandmark">RV</div>
        <h1>Preparando la inteligencia mundial</h1>
        <p>Cargando fichas, países, precios y galerías…</p>
      </main>
    );
  if (error || !summary)
    return (
      <main className="loading-screen">
        <h1>No se pudo abrir el portal</h1>
        <p>{error}</p>
      </main>
    );

  const auditedPriceRecords = v3Index?.insights?.commercialSignals.recordsWithNumericPublicPrice
    ?? summary.priceCoverage?.commercialAuditV3.records
    ?? summary.publicPrices;
  const auditedPricePercent = summary.priceCoverage?.commercialAuditV3.percent
    ?? Number(((auditedPriceRecords / summary.companies) * 100).toFixed(1));

  return (
    <main className={`app-shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <aside className={`sidebar${navCollapsed ? " collapsed" : ""}`}>
        <div className="side-top">
          <button className="brand" onClick={() => go("home")}>
            <span className="brandmark">RV</span>
            {!navCollapsed && (
              <span>
                <strong>RedVitalia</strong>
                <small>Inteligencia mundial de captación</small>
              </span>
            )}
          </button>
          <button
            className="nav-toggle"
            onClick={toggleNav}
            aria-label={navCollapsed ? "Expandir menú" : "Plegar menú"}
            title={navCollapsed ? "Expandir menú" : "Plegar menú"}
          >
            {navCollapsed ? "»" : "«"}
          </button>
        </div>
        <div className="mobile-nav-picker">
          <label htmlFor="mobile-primary-navigation">Ir a sección</label>
          <select
            id="mobile-primary-navigation"
            value={view}
            onChange={(event) => go(event.target.value as View)}
          >
            {navGroups.map((group) => {
              const options = group.ids.map((id) => {
                const item = nav.find((candidate) => candidate.id === id)!;
                return <option key={item.id} value={item.id}>{item.label}</option>;
              });
              return group.label ? (
                <optgroup key={group.label} label={group.label}>{options}</optgroup>
              ) : options;
            })}
          </select>
        </div>
        <nav aria-label="Navegación principal">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label || "top"}>
              {group.label && !navCollapsed && <p className="nav-group-label">{group.label}</p>}
              {group.label && navCollapsed && <hr className="nav-group-rule" />}
              {group.ids.map((id) => {
                const item = nav.find((n) => n.id === id)!;
                return (
                  <button
                    key={item.id}
                    className={view === item.id ? "active" : ""}
                    onClick={() => go(item.id)}
                    aria-current={view === item.id ? "page" : undefined}
                    title={navCollapsed ? item.label : undefined}
                  >
                    <i>{item.icon}</i>
                    {!navCollapsed && <span>{item.label}</span>}
                    {!navCollapsed && item.id === "companies" && <b>{fmt(companies.length)}</b>}
                    {!navCollapsed && item.id === "countries" && <b>195</b>}
                    {!navCollapsed && item.id === "ads" && <b>{fmt(galleryMetrics.media)}</b>}
                    {!navCollapsed && item.id === "arsenal" && (manifest || anunciosReales) && <b>{fmt(manifest?.advertising.searchablePieces ?? anunciosReales!.total)}</b>}
                    {!navCollapsed && item.id === "watch" && vigilancia && <b>{vigilancia.semaforo.filter((s) => s.nivel === "rojo").length}</b>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        {!navCollapsed && (
          <div className="side-status">
            <span className="dot" />
            <div>
              <strong>Instantánea verificada</strong>
              <small>{BUILD_DATE_LONG}</small>
            </div>
          </div>
        )}
      </aside>
      <section className="main">
        <header className="topbar">
          <div
            className="global-search"
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.contains(nextTarget)) return;
              closeGlobalSearch();
            }}
          >
            <span>⌕</span>
            <input
              ref={globalSearchInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setGlobalSearchOpen(e.target.value.trim().length >= 2);
                setGlobalSearchActiveIndex(-1);
              }}
              onFocus={() => setGlobalSearchOpen(query.trim().length >= 2)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeGlobalSearch();
                  return;
                }
                if (!globalSearchOptionCount) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setGlobalSearchOpen(true);
                  setGlobalSearchActiveIndex((current) => {
                    if (current < 0)
                      return event.key === "ArrowDown"
                        ? 0
                        : globalSearchOptionCount - 1;
                    const delta = event.key === "ArrowDown" ? 1 : -1;
                    return (current + delta + globalSearchOptionCount) % globalSearchOptionCount;
                  });
                  return;
                }
                if (event.key === "Enter") {
                  if (!globalSearchIsOpen) return;
                  event.preventDefault();
                  selectGlobalSearchResult(
                    globalSearchActiveIndex >= 0 ? globalSearchActiveIndex : 0,
                  );
                }
              }}
              placeholder="Busca empresa, mercado, anuncio, titular o ID…"
              aria-label="Buscar en toda la investigación"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-controls="global-search-results"
              aria-expanded={globalSearchIsOpen}
              aria-activedescendant={globalSearchActiveId}
            />
            {query && (
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  closeGlobalSearch();
                  globalSearchInputRef.current?.focus();
                }}
                aria-label="Borrar búsqueda"
              >
                ×
              </button>
            )}
            {globalSearchIsOpen && (
              <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Resultados de búsqueda global">
                <section role="group" aria-labelledby="global-search-companies-label">
                  <header id="global-search-companies-label"><b>EMPRESAS</b><span>{globalCompanyResults.length} primeras coincidencias</span></header>
                  {globalCompanyResults.map((company, index) => (
                    <button
                      id={`global-search-option-${index}`}
                      key={company.id}
                      role="option"
                      aria-selected={globalSearchActiveIndex === index}
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setGlobalSearchActiveIndex(index)}
                      onClick={() => selectGlobalSearchResult(index)}
                    >
                      <b>{company.name}</b><span>{company.primaryCountry} · {company.agencyType}</span>
                    </button>
                  ))}
                  {!globalCompanyResults.length && <p>Sin coincidencias en fichas.</p>}
                </section>
                <section role="group" aria-labelledby="global-search-ads-label">
                  <header id="global-search-ads-label"><b>ANUNCIOS</b><span>{globalAds === null ? "Cargando corpus…" : `${globalAdResults.length} primeras coincidencias`}</span></header>
                  {globalAdResults.map((item, itemIndex) => {
                    const index = globalCompanyResults.length + itemIndex;
                    return (
                    <button
                      id={`global-search-option-${index}`}
                      key={item.corpusKey || `${item.id}-${item.titular}`}
                      role="option"
                      aria-selected={globalSearchActiveIndex === index}
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setGlobalSearchActiveIndex(index)}
                      onClick={() => selectGlobalSearchResult(index)}
                    >
                      <b>{item.titular || item.name}</b><span>{item.name} · {item.plataforma}</span>
                    </button>
                    );
                  })}
                  {globalAds !== null && !globalAdResults.length && <p>Sin coincidencias en el corpus.</p>}
                </section>
              </div>
            )}
          </div>
          <div className="data-date">CORTE · {BUILD_DATE}</div>
          <span className="avatar">RV</span>
        </header>

        {viewResourcePending && (
          <div className="view">
            <div className="deep-loading" role="status" aria-live="polite">
              Preparando {nav.find((item) => item.id === view)?.label.toLocaleLowerCase("es") || "la sección"}…
            </div>
          </div>
        )}
        {viewResourceError && (
          <div className="view">
            <div className="empty-state" role="alert">
              No se pudo cargar esta sección. Recarga la página para volver a intentarlo.
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="view">
            <section className="hero">
              <div>
                <p className="eyebrow">INTELIGENCIA COMPETITIVA · REDVITALIA</p>
                <h1>
                  Todo el mercado de captación,
                  <br />
                  <em>por fin legible.</em>
                </h1>
                <p>
                  Empresas, ofertas, precios, anuncios y patrones mundiales en
                  una única sala de mando diseñada para decidir y ejecutar.
                </p>
                <div className="hero-buttons">
                  <button onClick={() => go("operations")}>
                    Abrir Centro de Operaciones
                  </button>
                  <button className="secondary" onClick={() => go("companies")}>
                    Explorar {fmt(companies.length)} empresas
                  </button>
                </div>
              </div>
              <div className="hero-orbit">
                <span>{new Set(companies.map((company) => company.primaryCountry)).size}</span>
                <strong>mercados representados</strong>
                <small>963 fichas · atlas territorial de {summary.countries} Estados</small>
              </div>
            </section>
            <section className="stat-grid">
              <article>
                <span>EMPRESAS CANÓNICAS</span>
                <strong>{fmt(companies.length)}</strong>
                <small>Fichas indexadas; profundidad declarada por separado</small>
              </article>
              <article>
                <span>MATERIALES LOCALES</span>
                <strong>{fmt(companies.reduce((sum, company) => sum + company.media.length, 0))}</strong>
                <small>Imágenes, vídeo y documentos enlazados en el índice</small>
              </article>
              <article>
                <span>URLS PÚBLICAS ÚNICAS</span>
                <strong>
                  {fmt(v3Index?.stats.uniqueEvidenceUrlsGlobal ?? summary.sources)}
                </strong>
                <small>
                  {v3Index ? fmt(v3Index.stats.evidenceReferences) : "…"} referencias
                  analíticas · {v3Index ? fmt(v3Index.stats.usableEvidenceReferences) : "…"} enlazables · {v3Index ? fmt(v3Index.stats.unavailableEvidenceReferences) : "…"} no disponible ·{" "}
                  {v3Index ? fmt(v3Index.stats.uniqueEvidenceUrlsWithinRecords) : "…"}
                  {" "}únicas por ficha
                </small>
              </article>
              <article>
                <span>PRECIOS PROFUNDOS · SNAPSHOT BASE</span>
                <strong>{fmt(auditedPriceRecords)}</strong>
                <small>{auditedPricePercent}% del snapshot profundo de {summary.companies} fichas</small>
              </article>
            </section>

            {cruces && cruces.findings.length > 0 && (
              <section className="home-finding">
                <span className="home-finding-badge">HALLAZGO DEL CORTE</span>
                <p>{cruces.findings[0]}</p>
                <button className="ref-chip" onClick={() => go("cruces")}>Ver todos los cruces →</button>
              </section>
            )}

            <section className="quick-grid">
              {([
                ["operations", "◆", "Centro de Operaciones", "Prioridad, campaña 360, OCR, tests, métricas y battlecards"],
                ["informe", "≡", "Informe ejecutivo", "El mercado en una página, listo para copiar o imprimir"],
                ["cruces", "⤫", "Cruces", `${cruces ? cruces.findings.length : resourceLoadState.cruces === "error" ? "n/d" : "…"} hallazgos · 12 análisis cruzados`],
                ["landings", "▭", "Landings", "Estudio real → blueprint → landing completa y medible"],
                ["adlab", "⌗", "Laboratorio de anuncios", "Busca copy, cruza patrones y crea matrices de test trazables"],
                ["arsenal", "⚑", `Arsenal · ${manifest ? fmt(manifest.advertising.searchablePieces) : anunciosReales ? fmt(anunciosReales.total) : resourceLoadState.anunciosReales === "error" ? "n/d" : "…"} anuncios`, "Garantías, titulares y el corpus publicitario completo"],
                ["watch", "◔", `Vigilancia · ${vigilancia ? vigilancia.semaforo.filter((s) => s.nivel === "rojo").length : resourceLoadState.vigilancia === "error" ? "n/d" : "…"} en rojo`, "Semáforo España con fragilidad y contradicciones"],
                ["exec", "▸", "Ejecutar", `${execution ? execution.actions.length : resourceLoadState.execution === "error" ? "n/d" : "…"} acciones priorizadas con estado`],
              ] as Array<[View, string, string, string]>).map(([id, icon, title, sub]) => (
                <button key={id} className="quick-card" onClick={() => go(id)}>
                  <i>{icon}</i>
                  <b>{title}</b>
                  <small>{sub}</small>
                </button>
              ))}
            </section>

            {vigilancia && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">RADAR ROJO · ESPAÑA</p>
                    <h2>Los 10 competidores con mayor amenaza editorial en el corte</h2>
                  </div>
                </div>
                <div className="median-list">
                  {vigilancia.semaforo.filter((s) => s.nivel === "rojo").sort((a, b) => b.score - a.score).slice(0, 10).map((s) => {
                    const c = companyById.get(s.id);
                    return (
                      <button key={s.id} onClick={() => c && openCompany(c)}>
                        <span><i className="sem-dot sem-rojo" style={{ marginRight: 8 }} />{s.name}</span>
                        <small>{s.threat}</small>
                        <b>score {s.score} · M{s.metaAds}/G{s.googleAds}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <section className="brand-coverage">
              <div className="brand-coverage-mark">✓</div>
              <div>
                <p className="eyebrow">IDENTIDAD VISUAL · CATÁLOGO COMPLETO DE {Object.keys(logos).length}</p>
                <h2>
                  {fmt(summary.logos.authentic)} marcas auténticas guardadas
                  localmente
                </h2>
                <p>
                  {fmt(summary.logos.official)} logos o wordmarks,{" "}
                  {fmt(summary.logos.favicon)} iconos oficiales y{" "}
                  {fmt(summary.logos.platform)} perfiles de plataforma
                  verificados y almacenados localmente. Las {fmt(summary.logos.fallback)}
                  fichas restantes tienen un monograma profesional claramente
                  señalado como provisional, nunca una marca inventada.
                </p>
              </div>
              <strong>
                {summary.logos.coveragePercent}%
                <small>cobertura visual verificable</small>
              </strong>
            </section>
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">REFERENTES PRIORITARIOS</p>
                  <h2>Los modelos con mayor valor estratégico</h2>
                </div>
                <button className="link-button" onClick={() => go("companies")}>
                  Ver todos →
                </button>
              </div>
              <div className="company-grid home-grid">
                {top.map((c) => (
                  <CompanyCard
                    key={c.id}
                    c={c}
                    logos={logos}
                    onOpen={() => openCompany(c)}
                    onCompare={() => toggleCompare(c.id)}
                    selected={compare.includes(c.id)}
                    takeaway={takeaways?.items[c.id]}
                  />
                ))}
              </div>
            </section>
            <section className="decision-strip">
              <div>
                <p className="eyebrow">DE LA INVESTIGACIÓN A LA ACCIÓN</p>
                <h2>Tres formas de utilizar el portal</h2>
              </div>
              <button onClick={() => go("companies")}>
                <b>01</b>
                <span>
                  <strong>Explorar empresas</strong>
                  <small>Fichas, ofertas y evidencias verificadas</small>
                </span>
                →
              </button>
              <button onClick={() => go("compare")}>
                <b>02</b>
                <span>
                  <strong>Comparar modelos</strong>
                  <small>Oferta, precio, contrato y garantía</small>
                </span>
                →
              </button>
              <button onClick={() => go("decisions")}>
                <b>03</b>
                <span>
                  <strong>Construir una campaña</strong>
                  <small>Oportunidades, patrones, benchmark y playbooks</small>
                </span>
                →
              </button>
            </section>
          </div>
        )}

        {view === "operations" && (
          <div className="view">
            <Suspense fallback={<div className="deep-loading">Preparando la sala de mando…</div>}>
              <OperationsHub
                companies={companies}
                onOpenCompany={(id) => {
                  const company = companyById.get(id);
                  if (company) openCompany(company);
                }}
                onOpenLab={() => go("adlab")}
                onOpenLanding={openLandingBrief}
              />
            </Suspense>
          </div>
        )}

        {viewResourcesReady && view === "exec" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">EJECUTAR · DESTILADO ACCIONABLE</p>
              <h1>Del dato a la decisión</h1>
              <p>
                Las {fmt(companies.length)} fichas, reducidas a lo que se puede
                copiar ya: un backlog priorizado, los patrones observados en las
                fichas de alta prioridad estratégica y los dossiers profundos del top 30. Cada
                táctica cita la ficha de la que sale.
              </p>
            </section>

            {execution && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">BACKLOG PRIORIZADO</p>
                    <h2>{execution.actions.length} acciones, ordenadas por impacto/esfuerzo</h2>
                  </div>
                </div>
                <p className="insights-note">{execution.note}</p>
                <div className="exec-grid">
                  {execution.actions.map((action, index) => (
                    <article key={action.title} className="exec-card">
                      <div className="exec-head">
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <span className="exec-cat">{action.categoria}</span>
                        <span
                          className="exec-meter"
                          title={`Impacto ${action.impact}/5 · Esfuerzo ${action.effort}/5`}
                        >
                          impacto {action.impact} · esfuerzo {action.effort}
                        </span>
                      </div>
                      <h3>{action.title}</h3>
                      <p>{action.detail}</p>
                      <div className="chip-row">
                        {action.sources.map((id) => {
                          const c = companyById.get(id);
                          return c ? (
                            <button key={id} className="ref-chip" onClick={() => openCompany(c)}>
                              {c.name}
                            </button>
                          ) : null;
                        })}
                      </div>
                      <div className="exec-state" role="group" aria-label="Estado de la acción">
                        {(["pendiente", "en curso", "hecha", "descartada"] as const).map((estado) => (
                          <button
                            key={estado}
                            className={(actionStates[action.title]?.estado || "pendiente") === estado ? `on estado-${estado.replace(" ", "-")}` : ""}
                            onClick={() => setActionState(action.title, estado)}
                          >
                            {estado}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                <p className="exec-state-summary">
                  {(["hecha", "en curso", "pendiente", "descartada"] as const)
                    .map((estado) => `${execution.actions.filter((a) => (actionStates[a.title]?.estado || "pendiente") === estado).length} ${estado}`)
                    .join(" · ")}{" "}
                  — el estado se guarda en este navegador.
                </p>
              </section>
            )}

            {patterns && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">DETECTOR DE PATRONES · {fmt(patterns.universe)} FICHAS CRUZADAS</p>
                    <h2>Qué se repite en las {patterns.winnersN} fichas con prioridad estratégica 80+</h2>
                  </div>
                </div>
                <div className="pattern-compare">
                  {[
                    { label: "Garantía escrita", w: patterns.winnersProfile.guaranteePct, r: patterns.restProfile.guaranteePct },
                    { label: "Anuncios activos verificados", w: patterns.winnersProfile.adsActivePct, r: patterns.restProfile.adsActivePct },
                    { label: "Precio público", w: patterns.winnersProfile.pricePublicPct, r: patterns.restProfile.pricePublicPct },
                    { label: "Más de un mercado", w: patterns.winnersProfile.multiMarketPct, r: patterns.restProfile.multiMarketPct },
                  ].map((row) => (
                    <article key={row.label}>
                      <span>{row.label}</span>
                      <div className="pattern-bars">
                        <div>
                          <small>Score 80+</small>
                          <i><b style={{ width: `${row.w}%` }} /></i>
                          <strong>{row.w}%</strong>
                        </div>
                        <div>
                          <small>Resto</small>
                          <i><b className="rest" style={{ width: `${row.r}%` }} /></i>
                          <strong>{row.r}%</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="gap-grid">
                  {patterns.findings.map((finding) => (
                    <article key={finding.title} className="gap-card">
                      <strong>{finding.stat}</strong>
                      <h3>{finding.title}</h3>
                      <p>{finding.detail}</p>
                    </article>
                  ))}
                </div>
                <h3 className="analysis-title">Modelos de cobro, comparados sobre la base entera</h3>
                <div className="matrix-wrap">
                  <table className="matrix-table">
                    <thead>
                      <tr><th>Modelo de cobro (señal pública)</th><th>Fichas</th><th>Mediana €</th><th>% ads activos</th><th>% garantía</th><th>Score medio</th><th>Referentes</th></tr>
                    </thead>
                    <tbody>
                      {patterns.modelStats.map((model) => (
                        <tr key={model.id}>
                          <td><b>{model.label}</b></td>
                          <td>{model.n}</td>
                          <td>{model.medianEur != null ? `${fmt(model.medianEur)} €` : "—"}</td>
                          <td>{model.adsActivePct}%</td>
                          <td>{model.guaranteePct}%</td>
                          <td>{model.avgScore}</td>
                          <td>
                            {model.examples.slice(0, 2).map((example) => {
                              const c = companyById.get(example.id);
                              return c ? (
                                <button key={example.id} className="ref-chip" onClick={() => openCompany(c)}>{example.name}</button>
                              ) : null;
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="analysis-title">Doble señal editorial: puntuación 80+ y anuncios activos documentados en el corte</h3>
                <div className="threat-list">
                  {patterns.doubleValidated.map((entry) => {
                    const c = companyById.get(entry.id);
                    return (
                      <button key={entry.id} onClick={() => c && openCompany(c)}>
                        <span><strong>{entry.name}</strong><small>{entry.country} · {entry.agencyType} · Meta {entry.metaAds} · Google {entry.googleAds}</small></span>
                        <b>{entry.score}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {dossiers && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">DOSSIERS PROFUNDOS · INVESTIGACIÓN WEB {dossiers.generatedAt}</p>
                    <h2>El top {Object.keys(dossiers.items).length}, por dentro</h2>
                  </div>
                </div>
                <p className="insights-note">
                  Equipo, hitos, stack visible y economía unitaria estimada con el
                  cálculo a la vista. Cada dossier vive dentro de su ficha; aquí
                  está la puerta.
                </p>
                <div className="dossier-grid">
                  {Object.values(dossiers.items)
                    .map((dossier) => ({ dossier, company: companyById.get(dossier.id) }))
                    .filter((row): row is { dossier: typeof row.dossier; company: Company } => Boolean(row.company))
                    .sort((a, b) => b.company.score - a.company.score)
                    .map(({ dossier, company }) => (
                      <article key={dossier.id} className="dossier-card">
                        <div className="dossier-head">
                          <CompanyLogo company={company} logos={logos} size="small" />
                          <div>
                            <h3>{company.name}</h3>
                            <small>{company.primaryCountry} · {company.score}/100 · confianza {dossier.confianza}</small>
                          </div>
                        </div>
                        <p>{short(dossier.resumen, 220)}</p>
                        <button className="link-button" onClick={() => openCompany(company)}>
                          Abrir dossier completo →
                        </button>
                      </article>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}

        {viewResourcesReady && view === "resources" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">RECURSOS · LISTOS PARA USAR</p>
              <h1>Trabajo hecho, no ideas</h1>
              <p>
                Guiones, cláusulas, protocolos, plantillas y datos generados
                desde las tácticas verificadas de la base. Copia o descarga y
                a producción; personaliza los campos entre [corchetes].
              </p>
            </section>
            {recursos?.formacion && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">FORMACIÓN · PARA NIDIA</p>
                    <h2>{recursos.formacion.titulo}</h2>
                  </div>
                </div>
                <p className="insights-note">{recursos.formacion.nota}</p>
                <div className="formacion-list">
                  {recursos.formacion.pasos.map((paso, index) => {
                    const c = companyById.get(paso.id);
                    return (
                      <article key={paso.id} className="formacion-card">
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <div>
                          <h3>{c?.name || paso.id}</h3>
                          <p>{paso.leccion}</p>
                          <p className="formacion-pregunta">❓ {paso.pregunta}</p>
                        </div>
                        <button className="link-button" onClick={() => c && openCompany(c)}>Abrir ficha →</button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recursos ? (
              <section className="content-section">
                <p className="insights-note">{recursos.note}</p>
                <div className="resource-grid">
                  {recursos.items.map((recurso) => (
                    <article key={recurso.id} className="resource-card">
                      <div className="resource-head">
                        <span className="resource-cat">{recurso.categoria}</span>
                        <span className="resource-for">Para {recurso.para}</span>
                      </div>
                      <h3>{recurso.titulo}</h3>
                      <p>{recurso.descripcion}</p>
                      <div className="resource-preview">
                        {recurso.contenido.slice(0, 600)}
                      </div>
                      <div className="resource-actions">
                        <button
                          className="res-copy"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(recurso.contenido);
                              setToast(`«${recurso.titulo}» copiado al portapapeles`);
                            } catch {
                              setToast("No se pudo copiar; usa Descargar");
                            }
                          }}
                        >
                          Copiar
                        </button>
                        <button
                          className="res-download"
                          onClick={() => {
                            const type = recurso.filename.endsWith(".csv")
                              ? "text/csv;charset=utf-8"
                              : "text/plain;charset=utf-8";
                            const blob = new Blob(["﻿" + recurso.contenido], { type });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = recurso.filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          Descargar {recurso.filename.endsWith(".csv") ? "CSV" : "TXT"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <div className="empty-state">Los recursos aún no están publicados.</div>
            )}
          </div>
        )}

        {viewResourcesReady && view === "tools" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">HERRAMIENTAS</p>
              <h1>Genera, no redactes</h1>
              <p>
                Propuestas comerciales montadas con los datos de la base y un
                simulador para posicionar tu precio contra el mercado mundial.
              </p>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">GENERADOR DE PROPUESTAS</p>
                  <h2>Elige nicho y zona; la propuesta sale hecha</h2>
                </div>
              </div>
              <div className="tool-card">
                <div className="tool-controls">
                  <label>
                    Vertical
                    <select value={propVertical} onChange={(e) => setPropVertical(e.target.value)}>
                      {(verticales?.verticales || []).map((v) => (
                        <option key={v.id} value={v.id}>{v.label} · {v.n} fichas</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Zona
                    <input value={propZona} placeholder="p. ej. Zaragoza" onChange={(e) => setPropZona(e.target.value)} />
                  </label>
                  <label>
                    Servicio del cliente
                    <input value={propServicio} placeholder="p. ej. implantes dentales" onChange={(e) => setPropServicio(e.target.value)} />
                  </label>
                  <label>
                    Precio mensual (€)
                    <input value={propPrecio} placeholder="p. ej. 890" onChange={(e) => setPropPrecio(e.target.value)} />
                  </label>
                </div>
                <div className="resource-preview tool-preview">{proposalText || "Cargando verticales…"}</div>
                <div className="resource-actions">
                  <button
                    className="res-copy"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(proposalText); setToast("Propuesta copiada"); } catch { setToast("No se pudo copiar"); }
                    }}
                  >
                    Copiar propuesta
                  </button>
                  <button
                    className="res-download"
                    onClick={() => {
                      const blob = new Blob([proposalText], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `propuesta-${propZona || "zona"}.txt`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Descargar TXT
                  </button>
                </div>
              </div>
            </section>

            {patterns && (
              <Suspense fallback={<div className="deep-loading">Preparando el simulador…</div>}>
                <PositioningSimulator
                  companies={companies}
                  patterns={patterns}
                  onOpenCompany={openCompany}
                />
              </Suspense>
            )}

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">SIMULADOR DE CARTERA · MRR A 12 MESES</p>
                  <h2>Cuánto vale tu cartera si mantienes el ritmo</h2>
                </div>
              </div>
              <div className="tool-card">
                <div className="tool-controls">
                  <label>
                    Clientes actuales
                    <input value={mrrClientes} onChange={(e) => setMrrClientes(e.target.value)} />
                  </label>
                  <label>
                    Cuota media (€/mes)
                    <input value={mrrCuota} onChange={(e) => setMrrCuota(e.target.value)} />
                  </label>
                  <label>
                    Altas nuevas al mes
                    <input value={mrrAltas} onChange={(e) => setMrrAltas(e.target.value)} />
                  </label>
                  <label>
                    Bajas mensuales (%)
                    <input value={mrrChurn} onChange={(e) => setMrrChurn(e.target.value)} />
                  </label>
                </div>
                {mrrProj ? (
                  <div className="sim-result">
                    <p>
                      Hoy: <b>{fmt(mrrProj.mrr0)} €/mes</b>. En 12 meses:{" "}
                      <b>{fmt(mrrProj.final.mrr)} €/mes</b> con ~{mrrProj.final.clientes} clientes.
                      Facturación acumulada del año: <b>{fmt(mrrProj.anual)} €</b> (bruto).{" "}
                      {mrrProj.techo !== null
                        ? `Con este ritmo de altas y bajas, tu cartera se estanca en ${fmt(mrrProj.techo)} €/mes: a partir de ahí solo crece subiendo cuota, bajando churn o sumando más altas.`
                        : "Sin bajas, la cartera crece de forma lineal e indefinida: cada alta se queda."}
                    </p>
                    <div className="mrr-bars" aria-hidden>
                      {mrrProj.rows.map((r) => {
                        const max = Math.max(mrrProj.mrr0, ...mrrProj.rows.map((x) => x.mrr)) || 1;
                        return (
                          <div key={r.mes} className="mrr-bar" title={`Mes ${r.mes}: ${fmt(r.mrr)} €`}>
                            <i style={{ height: `${Math.max(6, Math.round((r.mrr / max) * 100))}%` }} />
                            <span>{r.mes}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="record-empty">Rellena los cuatro campos con números para proyectar la cartera.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {view === "adlab" && (
          <div className="view adlab-view">
            <section className="adlab-shell">
              <Suspense fallback={<div className="deep-loading">Abriendo el corpus publicitario…</div>}>
                <AdsLaboratory
                  key={adLabInitialQuery || "default"}
                  initialQuery={adLabInitialQuery}
                  onOpenCompany={(id) => {
                    const company = companyById.get(id);
                    if (company) openCompany(company);
                  }}
                />
              </Suspense>
            </section>
          </div>
        )}

        {view === "decisions" && (
          <div className="view decision-center-view">
            <Suspense fallback={<div className="deep-loading">Convirtiendo evidencia en decisiones…</div>}>
              <DecisionCenter
                onOpenCompany={(id) => {
                  const company = companyById.get(id);
                  if (company) openCompany(company);
                }}
                onOpenFactory={() => go("operations", { tab: "factory" })}
                onOpenAdLab={(adQuery) => go("adlab", { adQuery })}
                onOpenLandings={() => go("landings")}
              />
            </Suspense>
          </div>
        )}

        {viewResourcesReady && view === "arsenal" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">ARSENAL COMERCIAL</p>
              <h1>Munición extraída de {arsenal ? fmt(arsenal.garantias.total + arsenal.titulares.total) : "…"} piezas reales</h1>
              <p>
                Garantías, titulares y anuncios: todo clasificado, buscable y con
                botón de copiar. Cada pieza cita la ficha de la que sale.
              </p>
            </section>

            {adsKit && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">ANUNCIOS LISTOS · {adsKit.items.length} ÁNGULOS</p>
                    <h2>Para Paula: Meta y Google por ángulo de venta</h2>
                  </div>
                </div>
                <div className="ads-grid">
                  {adsKit.items.map((item) => (
                    <article key={item.angulo} className="ads-card">
                      <h3>{item.angulo}</h3>
                      <div className="ads-block">
                        <span>META · TEXTO PRINCIPAL</span>
                        <p>{item.meta.primaries[0]}</p>
                        <div className="chip-row">
                          {item.meta.headlines.slice(0, 3).map((h) => (
                            <span key={h} className="ref-chip">{h}</span>
                          ))}
                        </div>
                      </div>
                      <div className="ads-block">
                        <span>GOOGLE · TITULARES</span>
                        <div className="chip-row">
                          {item.google.titulares.slice(0, 4).map((t) => (
                            <span key={t} className="ref-chip">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="resource-actions">
                        <button
                          className="res-copy"
                          onClick={async () => {
                            const text = `ÁNGULO: ${item.angulo}\n\nMETA — TEXTOS PRINCIPALES\n${item.meta.primaries.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nMETA — TITULARES\n${item.meta.headlines.join("\n")}\n\nGOOGLE — TITULARES (≤30)\n${item.google.titulares.join("\n")}\n\nGOOGLE — DESCRIPCIONES (≤90)\n${item.google.descripciones.join("\n")}`;
                            try { await navigator.clipboard.writeText(text); setToast(`Ángulo «${item.angulo}» copiado`); } catch { setToast("No se pudo copiar"); }
                          }}
                        >
                          Copiar bloque completo
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {arsenal && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">BANCO DE GARANTÍAS · {fmt(arsenal.garantias.total)} REALES</p>
                    <h2>Elige la promesa: fuerza contra coste de cumplirla</h2>
                  </div>
                </div>
                <div className="compare-picker">
                  {["Todas", ...new Set(arsenal.garantias.items.flatMap((g) => g.kinds))].map((kind) => {
                    const n = kind === "Todas" ? arsenal.garantias.items.length : arsenal.garantias.items.filter((g) => g.kinds.includes(kind)).length;
                    return (
                      <button key={kind} className={garantiaKind === kind ? "selected" : ""} onClick={() => setGarantiaKind(kind)}>
                        {kind} · {n}
                      </button>
                    );
                  })}
                </div>
                <div className="garantia-list">
                  {arsenal.garantias.items
                    .filter((g) => garantiaKind === "Todas" || g.kinds.includes(garantiaKind))
                    .slice(0, 30)
                    .map((g) => {
                      const c = companyById.get(g.id);
                      return (
                        <article key={g.id} className="garantia-card">
                          <div className="garantia-meta">
                            <button className="ref-chip" onClick={() => c && openCompany(c)}>{g.name} · {g.country}</button>
                            <span className="garantia-score" title="Fuerza comercial">F {g.fuerza}/5</span>
                            <span className="garantia-cost" title="Coste de cumplirla">C {g.coste}/5</span>
                          </div>
                          <p>{g.text}</p>
                          <button
                            className="res-copy mini"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(g.text); setToast("Garantía copiada"); } catch { setToast("No se pudo copiar"); }
                            }}
                          >
                            Copiar
                          </button>
                        </article>
                      );
                    })}
                </div>
              </section>
            )}

            {arsenal && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">TITULARES REALES · {fmt(arsenal.titulares.total)} HEROS</p>
                    <h2>Buscador por fórmula persuasiva</h2>
                  </div>
                </div>
                <div className="compare-picker">
                  {["Todas", ...Object.keys(arsenal.titulares.formulaCounts).sort((a, b) => arsenal.titulares.formulaCounts[b] - arsenal.titulares.formulaCounts[a])].map((f) => (
                    <button key={f} className={titularFormula === f ? "selected" : ""} onClick={() => setTitularFormula(f)}>
                      {f}{f !== "Todas" ? ` · ${arsenal.titulares.formulaCounts[f]}` : ""}
                    </button>
                  ))}
                </div>
                <div className="filterbar">
                  <label style={{ flex: 1 }}>
                    Buscar en los titulares
                    <input value={titularQuery} placeholder="garantía, citas, zona…" onChange={(e) => setTitularQuery(e.target.value)} style={{ display: "block", width: "100%", marginTop: 7, padding: 9, border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                  </label>
                </div>
                <div className="titular-list">
                  {arsenal.titulares.items
                    .filter((t) => (titularFormula === "Todas" || t.formulas.includes(titularFormula)) && (!titularQuery || t.headline.toLocaleLowerCase("es").includes(titularQuery.toLocaleLowerCase("es"))))
                    .slice(0, 40)
                    .map((t) => {
                      const c = companyById.get(t.id);
                      return (
                        <button key={t.id} className="titular-row" onClick={() => c && openCompany(c)}>
                          <blockquote>“{t.headline}”</blockquote>
                          <small>{t.name} · {t.country} · {t.formulas.join(" · ") || "sin fórmula clara"}</small>
                        </button>
                      );
                    })}
                </div>
              </section>
            )}

            {arsenal && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">FORMULARIOS · {fmt(arsenal.formularios.n)} FICHAS MEDIDAS</p>
                    <h2>El formulario óptimo, con datos</h2>
                  </div>
                </div>
                <p className="insights-note">{arsenal.formularios.recommendation.reading}</p>
                <div className="median-list">
                  {arsenal.formularios.byCountry.map((row) => (
                    <button key={row.country} onClick={() => chooseCountry(row.country)}>
                      <span>{row.country}</span>
                      <small>{row.n} fichas</small>
                      <b>{row.medianFields} campos · {row.medianRequired} oblig.</b>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {anunciosReales && (
              <section className="content-section arsenal-ad-handoff">
                <div>
                  <p className="eyebrow">ANUNCIOS · UNA ÚNICA FUENTE DE VERDAD</p>
                  <h2>El explorador completo vive ahora en el Laboratorio</h2>
                  <p className="insights-note">
                    {manifest
                      ? `${fmt(manifest.advertising.searchablePieces)} piezas buscables de ${fmt(manifest.advertising.representedAdvertisers)} anunciantes (${fmt(manifest.advertising.verifiedTranscriptions)} transcripciones verificadas), con OCR, idioma original, traducción, país, plataforma, evidencia y patrones en un solo sistema de filtros.`
                      : "La nueva vista reúne OCR exhaustivo, idioma original, traducción al español, país, plataforma, evidencia y patrones en un solo sistema de filtros."}
                  </p>
                </div>
                <button className="res-copy" onClick={() => setView("adlab")}>Abrir Laboratorio de anuncios</button>
              </section>
            )}

            {angulos && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">QUÉ DOMINA EN LOS {fmt(angulos.total)} ANUNCIOS · ANÁLISIS AGREGADO</p>
                    <h2>Los ángulos y señales que usa el mercado</h2>
                  </div>
                </div>
                <p className="insights-note">{angulos.nota}</p>
                <div className="findings-list">
                  {angulos.findings.map((f, i) => (
                    <article key={i} className="finding-card">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <p>{f}</p>
                    </article>
                  ))}
                </div>
                <h3 className="analysis-title">Señales en el copy</h3>
                <div className="rasgo-list">
                  {angulos.senales.map((s) => (
                    <div key={s.label} className="rasgo-row">
                      <span>{s.label}</span>
                      <div className="rasgo-bars">
                        <div className="rasgo-bar top" style={{ width: `${s.pct}%` }} title={`${s.pct}%`} />
                      </div>
                      <b>{s.pct}% <em>({s.n})</em></b>
                    </div>
                  ))}
                </div>
                <h3 className="analysis-title">Ángulos más repetidos</h3>
                <div className="chip-row">
                  {angulos.topAngulos.map((a) => (
                    <span key={a.label} className="ref-chip static">{a.label} · {a.n}</span>
                  ))}
                </div>
                <h3 className="analysis-title">CTAs dominantes</h3>
                <div className="chip-row">
                  {angulos.topCtas.map((cta) => (
                    <span key={cta.label} className="ref-chip static">{cta.label} · {cta.n}</span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {viewResourcesReady && view === "landings" && (
          <Suspense fallback={<div className="loading">Preparando el estudio de landings…</div>}>
            <LandingStudio verticales={verticales} logos={logos} />
          </Suspense>
        )}

        {viewResourcesReady && view === "negocio" && (
          <Suspense fallback={<div className="loading">Montando el dossier de negocio…</div>}>
            <BusinessDossier />
          </Suspense>
        )}

        {viewResourcesReady && view === "verticals" && verticales && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">PLAYBOOKS POR NICHO</p>
              <h1>Cada vertical, con su libro de jugadas</h1>
              <p>{verticales.nota}</p>
            </section>
            <section className="content-section">
              <div className="vertical-grid">
                {verticales.verticales.map((v) => (
                  <article key={v.id} className="vertical-card">
                    <div className="vertical-head">
                      <h3>{v.label}</h3>
                      <div className="vertical-stats">
                        <span><b>{v.n}</b> fichas</span>
                        <span><b>{v.spainN}</b> España</span>
                        <span><b>{v.medianEur ? `${fmt(v.medianEur)} €` : "s/d"}</b> mediana</span>
                        <span><b>{v.adsActivePct}%</b> con ads</span>
                      </div>
                    </div>
                    {v.guionApertura && (
                      <div className="vertical-guion">
                        <span>APERTURA DEL SETTER</span>
                        <p>«{v.guionApertura}»</p>
                        <button
                          className="res-copy mini"
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(v.guionApertura); setToast("Apertura copiada"); } catch { setToast("No se pudo copiar"); }
                          }}
                        >
                          Copiar
                        </button>
                      </div>
                    )}
                    {v.tacticas.length > 0 && (
                      <div className="vertical-block">
                        <span>TÁCTICAS DEL VERTICAL</span>
                        <ul>
                          {v.tacticas.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {v.clienteIdeal && (
                      <div className="vertical-block">
                        <span>CLIENTE IDEAL</span>
                        <p>{v.clienteIdeal}</p>
                      </div>
                    )}
                    {v.estacionalidad && (
                      <div className="vertical-block">
                        <span>ESTACIONALIDAD</span>
                        <p>{v.estacionalidad}</p>
                      </div>
                    )}
                    <div className="chip-row">
                      {v.referentes.map((r) => {
                        const c = companyById.get(r.id);
                        return c ? (
                          <button key={r.id} className="ref-chip" onClick={() => openCompany(c)}>
                            {r.name} · {r.score}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {viewResourcesReady && view === "watch" && vigilancia && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">VIGILANCIA · ESPAÑA</p>
              <h1>{vigilancia.semaforo.filter((s) => s.nivel === "rojo").length} competidores en rojo</h1>
              <p>{vigilancia.nota}</p>
            </section>
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">SEMÁFORO DE AMENAZAS · {vigilancia.semaforo.length} VIGILADAS</p>
                  <h2>Quién está vivo de verdad</h2>
                </div>
              </div>
              <div className="filterbar">
                <label style={{ flex: 1 }}>
                  Buscar vigilada
                  <input value={semQuery} placeholder="nombre o tipo de amenaza…" onChange={(e) => setSemQuery(e.target.value)} style={{ display: "block", width: "100%", marginTop: 7, padding: 9, border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                </label>
              </div>
              <div className="compare-picker">
                {([["score", "Ordenar por score"], ["ads", "Ordenar por ads activos"], ["nombre", "Ordenar por nombre"]] as const).map(([key, label]) => (
                  <button key={key} className={semSort === key ? "selected" : ""} onClick={() => setSemSort(key)}>{label}</button>
                ))}
                <button
                  onClick={() => {
                    const rows = [["empresa", "nivel", "amenaza", "score", "meta_ads", "google_ads", "precio_publico", "garantia", "fragilidad_pts"]];
                    const fragil = new Map((cruces?.fragilidad || []).map((f) => [f.id, f.puntos]));
                    for (const s of vigilancia.semaforo)
                      rows.push([s.name, s.nivel, s.threat, String(s.score), String(s.metaAds), String(s.googleAds), s.pricePublic ? "si" : "no", s.hasGuarantee ? "si" : "no", String(fragil.get(s.id) ?? "")]);
                    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
                    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "semaforo-vigilancia-espana.csv";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  ⤓ Exportar CSV
                </button>
              </div>
              <div className="matrix-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr><th></th><th>Empresa</th><th>Amenaza</th><th>Score</th><th>Ads activos</th><th>Precio público</th><th>Garantía</th><th>Fragilidad</th></tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const fragil = new Map((cruces?.fragilidad || []).map((f) => [f.id, f.puntos]));
                      const q = semQuery.toLocaleLowerCase("es");
                      const filtered = vigilancia.semaforo.filter((s) => !q || `${s.name} ${s.threat} ${s.agencyType}`.toLocaleLowerCase("es").includes(q));
                      const sorted = [...filtered].sort((a, b) =>
                        semSort === "nombre" ? a.name.localeCompare(b.name, "es") :
                        semSort === "ads" ? (b.metaAds + b.googleAds) - (a.metaAds + a.googleAds) :
                        b.score - a.score
                      );
                      return sorted.slice(0, 80).map((s) => {
                        const c = companyById.get(s.id);
                        const pts = fragil.get(s.id);
                        return (
                          <tr key={s.id}>
                            <td><span className={`sem-dot sem-${s.nivel}`} title={s.nivel} /></td>
                            <td><button className="ref-chip" onClick={() => c && openCompany(c)}>{s.name}</button></td>
                            <td>{s.threat}</td>
                            <td>{s.score}</td>
                            <td>{s.adsActive ? `Sí · M${s.metaAds}/G${s.googleAds}` : "No"}</td>
                            <td>{s.pricePublic ? "Sí" : "No"}</td>
                            <td>{s.hasGuarantee ? "Sí" : "No"}</td>
                            <td>{pts != null ? <span className="fragil-puntos">{pts} pts</span> : "—"}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </section>

            {homesTimeline && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">ARCHIVO DE HOMES · TOP 30</p>
                    <h2>Qué promete cada uno hoy (y qué cambiará mañana)</h2>
                  </div>
                </div>
                <p className="insights-note">{homesTimeline.nota}</p>
                {Object.entries(homesTimeline.snapshots).sort((a, b) => b[0].localeCompare(a[0])).map(([date, snaps]) => (
                  <div key={date}>
                    <h3 className="analysis-title">Instantánea del {date}</h3>
                    <div className="homes-grid">
                      {snaps.map((snap) => {
                        const c = companyById.get(snap.id);
                        return (
                          <button key={snap.id} className="home-snap" onClick={() => c && openCompany(c)}>
                            <b>{c?.name || snap.domain}</b>
                            <p>{snap.status === "ok" ? `“${snap.hero}”` : "No accesible en esta pasada"}</p>
                            <small>{snap.priceVisible ? "💶 precio visible" : "sin precio visible"} · {snap.domain}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">REDES MULTI-MARCA · {vigilancia.grupos.length} GRUPOS</p>
                  <h2>Quién opera con varias caras</h2>
                </div>
              </div>
              <div className="grupo-grid">
                {vigilancia.grupos.map((g) => (
                  <article key={g.grupo} className="grupo-card">
                    <h3>{g.grupo}</h3>
                    <small>{g.etiqueta} · {g.evidencia}</small>
                    <div className="chip-row">
                      {g.marcas.map((m) => {
                        const c = companyById.get(m.id);
                        return c ? (
                          <button key={m.id} className="ref-chip" onClick={() => openCompany(c)}>{m.name} · {m.country}</button>
                        ) : null;
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {cruces && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">ÍNDICE DE FRAGILIDAD · {cruces.fragilidad.length} SEÑALADAS</p>
                    <h2>Competidores con score alto pero cimientos débiles</h2>
                  </div>
                </div>
                <p className="insights-note">
                  Puntos de fragilidad: cada señal (sin anuncios activos, precio oculto, sin creatividades,
                  letra pequeña con fricción…) suma. A más puntos, más fachada y menos músculo verificable.
                </p>
                <div className="fragil-list">
                  {cruces.fragilidad.slice(0, 15).map((f) => {
                    const c = companyById.get(f.id);
                    return (
                      <article key={f.id} className="fragil-card">
                        <div className="fragil-head">
                          {c ? (
                            <button className="ref-chip" onClick={() => openCompany(c)}>{f.name}</button>
                          ) : (
                            <span className="ref-chip static">{f.name}</span>
                          )}
                          <span className="fragil-score">Score {f.score}</span>
                          <b className="fragil-puntos">{f.puntos} pts fragilidad</b>
                        </div>
                        <small>{f.agencyType}</small>
                        <p>{f.razones.join(" · ")}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {cruces && cruces.contradicciones.length > 0 && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">CONTRADICCIONES DETECTADAS · {cruces.contradicciones.length}</p>
                    <h2>Lo que prometen arriba y desmienten en la letra pequeña</h2>
                  </div>
                </div>
                <div className="fragil-list">
                  {cruces.contradicciones.slice(0, 15).map((k) => {
                    const c = companyById.get(k.id);
                    return (
                      <article key={k.id} className="fragil-card contradiccion">
                        <div className="fragil-head">
                          {c ? (
                            <button className="ref-chip" onClick={() => openCompany(c)}>{k.name}</button>
                          ) : (
                            <span className="ref-chip static">{k.name}</span>
                          )}
                          <small>{k.country} · score {k.score}</small>
                        </div>
                        {k.flags.map((flag, i) => (
                          <p key={i}>⚠ {flag}</p>
                        ))}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {viewResourcesReady && view === "cruces" && cruces && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">CRUCES DE DATOS</p>
              <h1>Lo que solo se ve cruzando las {fmt(companies.length)} fichas</h1>
              <p>{cruces.nota}</p>
            </section>

            <div className="compare-picker seccion-nav">
              {[["cx-hallazgos", "Hallazgos"], ["cx-garantia", "Garantía×precio"], ["cx-curva", "Curva España"], ["cx-madurez", "Madurez"], ["cx-promesa", "Promesa×remedio"], ["cx-adn", "ADN top"], ["cx-10x", "El 10x"], ["cx-pais", "Por país"], ["cx-titular", "Titulares"], ["cx-lexico", "Léxico"], ["cx-sla", "SLAs"]].map(([id, label]) => (
                <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  {label}
                </button>
              ))}
            </div>

            <section className="content-section" id="cx-hallazgos">
              <div className="section-head">
                <div>
                  <p className="eyebrow">HALLAZGOS PRINCIPALES</p>
                  <h2>Tres conclusiones accionables</h2>
                </div>
                <button
                  className="res-copy"
                  onClick={async () => {
                    const text = `HALLAZGOS · CRUCES REDVITALIA · ${cruces.generatedAt}\n\n${cruces.findings.map((f, i) => `${i + 1}. ${f}`).join("\n\n")}`;
                    try { await navigator.clipboard.writeText(text); setToast("Hallazgos copiados"); } catch { setToast("No se pudo copiar"); }
                  }}
                >
                  Copiar hallazgos
                </button>
              </div>
              <div className="findings-list">
                {cruces.findings.map((f, i) => (
                  <article key={i} className="finding-card">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{f}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-garantia">
              <div className="section-head">
                <div>
                  <p className="eyebrow">GARANTÍA × PRECIO (SOLO CUOTAS MENSUALES)</p>
                  <h2>¿Cobra más quien más promete?</h2>
                </div>
              </div>
              <div className="median-list">
                {cruces.elasticidadGarantia.map((row) => (
                  <button key={row.label} style={{ cursor: "default" }}>
                    <span>{row.label}</span>
                    <small>{row.n} fichas</small>
                    <b>{row.medianEur != null ? `${fmt(row.medianEur)} €/mes` : "s/d"}</b>
                  </button>
                ))}
              </div>
              <p className="insights-note">
                Lectura honesta en ambos sentidos: la garantía media acompaña a precios más altos,
                pero la garantía fuerte aparece sobre todo en modelos por lead barato (pago por resultado),
                no en cuotas premium. Prometer fuerte no sube la cuota: cambia el modelo de cobro.
              </p>
            </section>

            <section className="content-section" id="cx-curva">
              <div className="section-head">
                <div>
                  <p className="eyebrow">CURVA DE PRECIOS · ESPAÑA · {cruces.curvaEspana.total} CUOTAS</p>
                  <h2>El hueco de mercado está en {cruces.curvaEspana.hueco?.rango || "—"}</h2>
                </div>
              </div>
              <div className="curva-wrap">
                {cruces.curvaEspana.buckets.map((b) => {
                  const max = Math.max(...cruces.curvaEspana.buckets.map((x) => x.n)) || 1;
                  const esHueco = cruces.curvaEspana.hueco?.rango === b.rango;
                  return (
                    <div key={b.rango} className={`curva-col${esHueco ? " hueco" : ""}`} title={`${b.rango}: ${b.n} ofertas`}>
                      <b>{b.n}</b>
                      <i style={{ height: `${Math.max(5, Math.round((b.n / max) * 100))}%` }} />
                      <span>{b.rango}</span>
                    </div>
                  );
                })}
              </div>
              {cruces.curvaEspana.hueco && (
                <p className="insights-note">
                  En {cruces.curvaEspana.hueco.rango} solo compiten {cruces.curvaEspana.hueco.n} ofertas en España:
                  es la franja con menos competencia directa para posicionar un plan premium.
                </p>
              )}
            </section>

            <section className="content-section" id="cx-madurez">
              <div className="section-head">
                <div>
                  <p className="eyebrow">MADUREZ POR PAÍS · {cruces.madurez.length} MERCADOS</p>
                  <h2>Transparencia y agresividad comercial por mercado</h2>
                </div>
              </div>
              <div className="matrix-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr><th>País</th><th>Fichas</th><th>% precio público</th><th>% con garantía</th><th>% con ads activos</th><th>Índice de madurez</th></tr>
                  </thead>
                  <tbody>
                    {cruces.madurez.map((m) => (
                      <tr key={m.pais}>
                        <td><button className="ref-chip" onClick={() => chooseCountry(m.pais)}>{m.pais}</button></td>
                        <td>{m.n}</td>
                        <td>{m.precioPublico}%</td>
                        <td>{m.garantia}%</td>
                        <td>{m.adsActivos}%</td>
                        <td><b>{m.indice}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="content-section" id="cx-promesa">
              <div className="section-head">
                <div>
                  <p className="eyebrow">PROMESA × REMEDIO</p>
                  <h2>Qué se promete y cómo se respalda{cruces.promesaRemedio.huecosEspana.length > 0 ? " (y los huecos de España)" : ""}</h2>
                </div>
              </div>
              <div className="median-list">
                {cruces.promesaRemedio.celdas.slice(0, 12).map((cell, i) => (
                  <button key={i} style={{ cursor: "default" }}>
                    <span>{cell.promesa} × {cell.remedio}</span>
                    <small>{cell.espana} en España</small>
                    <b>{cell.n} fichas</b>
                  </button>
                ))}
              </div>
              {cruces.promesaRemedio.huecosEspana.length > 0 && (
                <p className="insights-note">
                  Combinaciones no observadas en la muestra española:{" "}
                  {cruces.promesaRemedio.huecosEspana.map((h) => `${h.promesa} respaldada con ${h.remedio.toLowerCase()} (${h.n} en el mundo, ${h.espana} aquí)`).join(" · ")}.
                </p>
              )}
            </section>

            <section className="content-section" id="cx-adn">
              <div className="section-head">
                <div>
                  <p className="eyebrow">ADN DEL TOP {cruces.adn.nTop} MUNDIAL</p>
                  <h2>Qué publican las fichas con mayor score editorial</h2>
                </div>
              </div>
              <div className="rasgo-list">
                {cruces.adn.rasgos.map((r) => (
                  <div key={r.rasgo} className="rasgo-row">
                    <span>{r.rasgo}</span>
                    <div className="rasgo-bars">
                      <div className="rasgo-bar top" style={{ width: `${r.pctTop}%` }} title={`Top: ${r.pctTop}%`} />
                      <div className="rasgo-bar base" style={{ width: `${r.pctBase}%` }} title={`Base: ${r.pctBase}%`} />
                    </div>
                    <b>{r.pctTop}% <em>vs {r.pctBase}%</em></b>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-10x">
              <div className="section-head">
                <div>
                  <p className="eyebrow">QUÉ INCLUYE EL 10X · {cruces.delta10x.nBaratos} BARATAS VS {cruces.delta10x.nCaros} CARAS</p>
                  <h2>Qué añade una oferta cara frente a una barata</h2>
                </div>
              </div>
              <div className="rasgo-list">
                {cruces.delta10x.rasgos.map((r) => (
                  <div key={r.rasgo} className="rasgo-row">
                    <span>{r.rasgo}</span>
                    <div className="rasgo-bars">
                      <div className="rasgo-bar top" style={{ width: `${r.caros}%` }} title={`Caras: ${r.caros}%`} />
                      <div className="rasgo-bar base" style={{ width: `${r.baratos}%` }} title={`Baratas: ${r.baratos}%`} />
                    </div>
                    <b>{r.delta > 0 ? "+" : ""}{r.delta} pts</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-pais">
              <div className="section-head">
                <div>
                  <p className="eyebrow">PROMESA DOMINANTE POR PAÍS</p>
                  <h2>Con qué garantía se compite en cada mercado</h2>
                </div>
              </div>
              <div className="median-list">
                {cruces.promesasPais.map((p) => (
                  <button key={p.pais} onClick={() => chooseCountry(p.pais)}>
                    <span>{p.pais}</span>
                    <small>{p.nDominante} de {p.n} garantías</small>
                    <b>{p.dominante}</b>
                  </button>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-titular">
              <div className="section-head">
                <div>
                  <p className="eyebrow">TITULAR FRECUENTE POR VERTICAL</p>
                  <h2>La fórmula que más repiten los referentes de cada nicho</h2>
                </div>
              </div>
              <div className="median-list">
                {cruces.titularPorVertical.map((t) => (
                  <button key={t.vertical} style={{ cursor: "default" }}>
                    <span>{t.vertical}</span>
                    <small>{t.winners} referentes analizados</small>
                    <b>{t.top.map((x) => `${x.formula} (${x.n})`).join(" · ") || "sin patrón claro"}</b>
                  </button>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-lexico">
              <div className="section-head">
                <div>
                  <p className="eyebrow">LÉXICO QUE CONVIERTE</p>
                  <h2>Bigramas más repetidos por los referentes</h2>
                </div>
              </div>
              <div className="lexico-grid">
                {cruces.lexico.map((l) => (
                  <article key={l.vertical} className="lexico-card">
                    <h3>{l.vertical}</h3>
                    <small>{l.n} piezas analizadas</small>
                    <div className="chip-row">
                      {l.bigramas.map((b) => (
                        <span key={b.b} className="ref-chip static">{b.b} · {b.n}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-section" id="cx-sla">
              <div className="section-head">
                <div>
                  <p className="eyebrow">CARRERA DEL SLA · {cruces.slas.total} PROMESAS DE VELOCIDAD</p>
                  <h2>Quién promete responder más rápido</h2>
                </div>
              </div>
              <div className="median-list">
                {cruces.slas.top.slice(0, 12).map((s) => {
                  const c = companyById.get(s.id);
                  return (
                    <button key={s.id} onClick={() => c && openCompany(c)}>
                      <span>{s.name}</span>
                      <small>{s.country} · score {s.score}</small>
                      <b>{s.sla}</b>
                    </button>
                  );
                })}
              </div>
              <p className="insights-note">
                El estándar de los agresivos es responder en minutos, no en horas: cualquier promesa de
                velocidad de RedVitalia debe medirse contra este benchmark, no contra la media del sector.
              </p>
            </section>
          </div>
        )}

        {viewResourcesReady && view === "informe" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">INFORME EJECUTIVO</p>
              <h1>El estado del mercado, en una página</h1>
              <p>
                Generado en vivo desde la base: hallazgos de los cruces, patrones de las fichas con prioridad estratégica alta,
                lectura de los anuncios reales, amenazas en España y próximas acciones. Cópialo o imprímelo a PDF.
              </p>
            </section>
            <section className="content-section">
              <div className="resource-actions">
                <button
                  className="res-copy"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(informeText); setToast("Informe copiado"); } catch { setToast("No se pudo copiar"); }
                  }}
                >
                  Copiar informe
                </button>
                <button className="res-download" onClick={() => window.print()}>
                  Imprimir / guardar PDF
                </button>
                <button
                  className="res-copy"
                  onClick={() => {
                    const blob = new Blob([informeText], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `informe-redvitalia-${new Date().toISOString().slice(0, 10)}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Descargar TXT
                </button>
              </div>
              <pre className="informe-pre" id="informe-imprimible">{informeText || "Cargando datos…"}</pre>
            </section>
          </div>
        )}

        {view === "companies" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">BASE EMPRESARIAL</p>
              <h1>{fmt(companies.length)} fichas, sin ruido</h1>
              <p>
                Cada tarjeta abre todos los campos canónicos, la trazabilidad de
                marca, las fuentes públicas y la galería local de la empresa.
              </p>
            </section>
            <section className="filterbar">
              <label>
                Modelo
                <select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value);
                    setVisible(24);
                  }}
                >
                  {scopes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                País / mercado
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setVisible(24);
                  }}
                >
                  <option>Todos</option>
                  {countryOptions.map((x) => (
                    <option key={x.name} value={x.name}>
                      {x.name} · {x.count}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Canal
                <select
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value);
                    setVisible(24);
                  }}
                >
                  {channels.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={priceOnly}
                  onChange={(e) => setPriceOnly(e.target.checked)}
                />{" "}
                Solo precio convertible
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={companiesNewOnly}
                  onChange={(e) => { setCompaniesNewOnly(e.target.checked); setVisible(24); }}
                />{" "}
                Añadidas en el corte 23/08/2026
              </label>
              <button onClick={clearCompanyFilters}>
                Limpiar
              </button>
            </section>
            <div className="result-line">
              <strong>Mostrando {fmt(Math.min(visible, filtered.length))} de {fmt(filtered.length)} resultados</strong>
              <span>Ordenados por puntuación estratégica{companiesNewOnly ? " · solo la remesa de la caza de anuncios de hoy" : ""}</span>
            </div>
            <section className="company-grid">
              {filtered.slice(0, visible).map((c) => (
                <CompanyCard
                  key={c.id}
                  c={c}
                  logos={logos}
                  onOpen={() => openCompany(c)}
                  onCompare={() => toggleCompare(c.id)}
                  selected={compare.includes(c.id)}
                  takeaway={takeaways?.items[c.id]}
                />
              ))}
            </section>
            {visible < filtered.length && (
              <button
                className="load-more"
                onClick={() => setVisible((x) => x + 24)}
              >
                Mostrar 24 más
              </button>
            )}
          </div>
        )}

        {viewResourcesReady && view === "funnels" && (
          <div className="view funnel-intel-view">
            <section className="page-head funnel-page-head">
              <p className="eyebrow">INTELIGENCIA COMERCIAL FORENSE</p>
              <h1>Cómo habla y cómo vende cada competidor</h1>
              <p>
                El inventario se convierte aquí en una herramienta de decisión:
                mensaje, CTA, formularios, fricción, agenda, WhatsApp, tecnología,
                prueba, objeciones y recorrido completo con cada etapa marcada como
                observada, inferida o no observable.
              </p>
            </section>

            {v3Index || deepIndex ? (
              <>
                <section className="funnel-stat-grid">
                  {v3Index ? (
                    <>
                      <article>
                        <span>FICHAS PROFUNDAS VERIFICADAS</span>
                        <strong>{fmt(v3Index.stats.verified)}</strong>
                        <small>de {fmt(v3Index.stats.total)} competidores publicados</small>
                      </article>
                      <article>
                        <span>EVIDENCIA MANUAL</span>
                        <strong>{fmt(v3Index.stats.manualEvidence)}</strong>
                        <small>expedientes reforzados con revisión humana</small>
                      </article>
                      <article>
                        <span>COBERTURA MEDIA</span>
                        <strong>{v3Index.stats.averageCoverage}%</strong>
                        <small>del recorrido comercial públicamente observable</small>
                      </article>
                      <article>
                        <span>URLS PÚBLICAS ÚNICAS</span>
                        <strong>{fmt(v3Index.stats.uniqueEvidenceUrlsGlobal)}</strong>
                        <small>
                          {fmt(v3Index.stats.evidenceReferences)} referencias · {fmt(v3Index.stats.usableEvidenceReferences)} enlazables · {fmt(v3Index.stats.unavailableEvidenceReferences)} no disponible · {fmt(v3Index.stats.uniqueEvidenceUrlsWithinRecords)} URLs únicas por ficha
                        </small>
                      </article>
                      <article>
                        <span>FORMULARIOS</span>
                        <strong>{fmt(v3Index.stats.forms)}</strong>
                        <small>en {fmt(v3Index.stats.withForms)} competidores</small>
                      </article>
                      <article>
                        <span>CAMPOS VISIBLES</span>
                        <strong>{fmt(v3Index.stats.visibleFields)}</strong>
                        <small>estructura, obligatoriedad y fricción inventariadas</small>
                      </article>
                    </>
                  ) : deepIndex ? (
                    <>
                      <article>
                        <span>FICHAS ESTRUCTURADAS</span>
                        <strong>{fmt(deepIndex.stats.schemaValid)}</strong>
                        <small>control técnico superado; trazabilidad previa conservada</small>
                      </article>
                      <article>
                        <span>REVISIÓN MANUAL</span>
                        <strong>{fmt(deepIndex.stats.manualVerified)}</strong>
                        <small>{fmt(deepIndex.stats.structuralVerified)} verificaciones estructurales</small>
                      </article>
                      <article>
                        <span>COBERTURA MEDIA</span>
                        <strong>{deepIndex.stats.averageObservableCoverage}%</strong>
                        <small>porcentaje de funnel públicamente observable</small>
                      </article>
                      <article>
                        <span>COBERTURA WEB 0%</span>
                        <strong>{fmt(deepIndex.stats.zeroObservableCoverage)}</strong>
                        <small>{fmt(deepIndex.stats.limitedConfidence)} con confianza limitada</small>
                      </article>
                      <article>
                        <span>LIMITADAS</span>
                        <strong>{fmt(deepIndex.stats.limited)}</strong>
                        <small>acceso o evidencia insuficiente, con causa documentada</small>
                      </article>
                      <article>
                        <span>FORMULARIOS</span>
                        <strong>{fmt(deepIndex.stats.withForms)}</strong>
                        <small>con campos y fricción inventariados</small>
                      </article>
                    </>
                  ) : null}
                </section>

                {v3Index?.insights ? (
                  <section className="market-insight-grid" aria-label="Patrones globales de conversión">
                    <article>
                      <p className="eyebrow">DISTRIBUCIÓN DE COBERTURA</p>
                      <h2>Qué parte del recorrido deja ver el mercado</h2>
                      <div className="insight-bars">
                        {v3Index.insights.coverageBands.map((band) => (
                          <div key={band.label}>
                            <span>{band.label}</span>
                            <i>
                              <b
                                style={{
                                  width: `${Math.max(2, (band.count / v3Index.stats.total) * 100)}%`,
                                }}
                              />
                            </i>
                            <strong>{fmt(band.count)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="stage-observability">
                      <p className="eyebrow">RADIOGRAFÍA DEL FUNNEL</p>
                      <h2>Visibilidad pública de las 12 etapas</h2>
                      <div>
                        {v3Index.insights.funnelStages.map((stage, index) => (
                          <div key={stage.stage}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <p>{stage.stage}</p>
                            <i>
                              <b style={{ width: `${stage.observedPercent}%` }} />
                            </i>
                            <strong>{stage.observedPercent}%</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article>
                      <p className="eyebrow">SEÑALES COMERCIALES</p>
                      <h2>Qué puede medirse sin inventar</h2>
                      <dl className="signal-ledger">
                        <div>
                          <dt>CTA principal observable</dt>
                          <dd>{fmt(v3Index.insights.commercialSignals.primaryCtaObserved)}</dd>
                        </div>
                        <div>
                          <dt>Captura con formulario</dt>
                          <dd>{fmt(v3Index.insights.commercialSignals.withForms)}</dd>
                        </div>
                        <div>
                          <dt>Precio numérico público</dt>
                          <dd>{fmt(v3Index.insights.commercialSignals.recordsWithNumericPublicPrice)}</dd>
                        </div>
                        <div>
                          <dt>Expedientes con evidencia manual</dt>
                          <dd>{fmt(v3Index.insights.commercialSignals.manualEvidence)}</dd>
                        </div>
                        <div>
                          <dt>Límites expresamente documentados</dt>
                          <dd>{fmt(v3Index.insights.commercialSignals.explicitLimitations)}</dd>
                        </div>
                      </dl>
                      <p className="insight-note">
                        “No observable” no significa que la empresa no lo haga: significa
                        que no existe una prueba pública suficiente para afirmarlo.
                      </p>
                    </article>
                  </section>
                ) : null}

                <section className="filterbar funnel-filterbar">
                  <label>
                    Modelo
                    <select
                      value={scope}
                      onChange={(event) => {
                        setScope(event.target.value);
                        setFunnelVisible(30);
                      }}
                    >
                      {scopes.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    País / mercado
                    <select
                      value={country}
                      onChange={(event) => {
                        setCountry(event.target.value);
                        setFunnelVisible(30);
                      }}
                    >
                      <option>Todos</option>
                      {countryOptions.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name} · {item.count}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {v3Index ? "Conversión visible" : "Captura"}
                    <select
                      value={funnelCapture}
                      onChange={(event) => {
                        setFunnelCapture(event.target.value);
                        setFunnelVisible(30);
                      }}
                    >
                      <option>Todos</option>
                      {v3Index ? (
                        <>
                          <option>Con formulario</option>
                          <option>Sin formulario</option>
                          <option>Con CTA observable</option>
                          <option>Sin CTA observable</option>
                        </>
                      ) : (
                        [...new Set((deepIndex?.records || []).map((item) => item.captureType))]
                          .sort((a, b) => a.localeCompare(b, "es"))
                          .map((item) => <option key={item}>{item}</option>)
                      )}
                    </select>
                  </label>
                  <label>
                    {v3Index ? "Cobertura / revisión" : "Estado"}
                    <select
                      value={funnelStatus}
                      onChange={(event) => {
                        setFunnelStatus(event.target.value);
                        setFunnelVisible(30);
                      }}
                    >
                      <option>Todos</option>
                      {v3Index ? (
                        <>
                          <option>Evidencia manual</option>
                          <option>Verificación estructural</option>
                          <option>Cobertura 75–100%</option>
                          <option>Cobertura 50–74%</option>
                          <option>Cobertura menor del 50%</option>
                        </>
                      ) : (
                        <>
                          <option>Borrador automático</option>
                          <option>Verificada manual</option>
                          <option>Verificada estructural</option>
                          <option>Limitada</option>
                          <option>No aplica verificado</option>
                        </>
                      )}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      setScope("Todos");
                      setCountry("Todos");
                      setFunnelCapture("Todos");
                      setFunnelStatus("Todos");
                      setQuery("");
                      setFunnelVisible(30);
                    }}
                  >
                    Limpiar
                  </button>
                </section>

                <div className="result-line">
                  <strong>
                    {fmt(v3Index ? v3Rows.length : deepRows.length)} funnels analizados
                  </strong>
                  <span>
                    {v3Index
                      ? "Ordenados por cobertura, evidencia y valor estratégico"
                      : "Trazabilidad previa: ordenados por cobertura observable"}
                  </span>
                </div>
                <section className="funnel-card-grid">
                  {v3Index
                    ? v3Rows.slice(0, funnelVisible).map(({ intel, company }) => (
                        <article className="funnel-card" key={intel.id}>
                          <div className="funnel-card-head">
                            <CompanyLogo company={company} logos={logos} />
                            <div>
                              <span>{company.primaryCountry}</span>
                              <h3>{company.name}</h3>
                            </div>
                            <b>{intel.coveragePercent}%</b>
                          </div>
                          <div
                            className="coverage-bar"
                            aria-label={`Cobertura ${intel.coveragePercent}%`}
                          >
                            <i style={{ width: `${intel.coveragePercent}%` }} />
                          </div>
                          <div className="funnel-card-status">
                            <span>Auditoría verificada</span>
                            <span>{intel.status}</span>
                            {intel.manualEvidence ? (
                              <span className="manual-badge">Evidencia manual</span>
                            ) : (
                              <span>Verificación estructural</span>
                            )}
                            <span>{intel.forms} formularios</span>
                            <span>{intel.fields} campos</span>
                          </div>
                          <blockquote>
                            {intel.headline || "Mensaje principal no observable públicamente"}
                          </blockquote>
                          <dl>
                            <div>
                              <dt>CTA principal</dt>
                              <dd>{intel.primaryCta || "No observable"}</dd>
                            </div>
                            <div>
                              <dt>Captura exacta</dt>
                              <dd>
                                {intel.forms
                                  ? `${intel.forms} formularios · ${intel.fields} campos · ${intel.requiredFields} obligatorios`
                                  : "Sin formulario comercial medible"}
                              </dd>
                            </div>
                            <div>
                              <dt>Trazabilidad</dt>
                              <dd>
                                {intel.uniqueEvidenceUrls} URLs únicas · {intel.evidence} referencias · {intel.screenshots} capturas · {intel.limitations} límites
                              </dd>
                            </div>
                          </dl>
                          <div className="funnel-card-foot">
                            <span>12 etapas y 12 dimensiones en la ficha</span>
                            <button onClick={() => openCompany(company)}>
                              Abrir auditoría completa →
                            </button>
                          </div>
                        </article>
                      ))
                    : deepRows.slice(0, funnelVisible).map(({ intel, company }) => (
                    <article className="funnel-card" key={intel.id}>
                      <div className="funnel-card-head">
                        <CompanyLogo company={company} logos={logos} />
                        <div>
                          <span>{company.primaryCountry}</span>
                          <h3>{company.name}</h3>
                        </div>
                        <b>{intel.coveragePercent}%</b>
                      </div>
                      <div className="coverage-bar" aria-label={`Cobertura ${intel.coveragePercent}%`}>
                        <i style={{ width: `${intel.coveragePercent}%` }} />
                      </div>
                      <div className="funnel-card-status">
                        <span>{intel.schemaValid ? "Esquema válido" : "Esquema pendiente"}</span>
                        <span>{readinessLabel[intel.researchReadiness]}</span>
                        <span>{intel.status}</span>
                        {intel.manualReviewed ? <span className="manual-badge">🧠 Revisión manual</span> : null}
                        <span>Confianza {intel.confidence.toLowerCase()}</span>
                        <span>{intel.captureType}</span>
                      </div>
                      <blockquote>{intel.hero}</blockquote>
                      <dl>
                        <div>
                          <dt>CTA principal</dt>
                          <dd>{intel.primaryCta || "No observable"}</dd>
                        </div>
                        <div>
                          <dt>Formulario</dt>
                          <dd>
                            {intel.maxFormFields
                              ? `${intel.minFormFields}–${intel.maxFormFields} campos`
                              : "Sin campos medibles"}
                          </dd>
                        </div>
                        <div>
                          <dt>Stack visible</dt>
                          <dd>
                            {intel.technologies.slice(0, 5).join(" · ") || "No detectado"}
                            {intel.technologies.length > 5
                              ? ` · +${intel.technologies.length - 5} más en la ficha`
                              : ""}
                          </dd>
                        </div>
                      </dl>
                      <div className="funnel-card-foot">
                        <span>{intel.evidenceCount} fuentes del análisis</span>
                        <span>{intel.limitationCount} límites explicados</span>
                        <button onClick={() => openCompany(company)}>
                          Abrir deep dive →
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
                {funnelVisible < (v3Index ? v3Rows.length : deepRows.length) && (
                  <button
                    className="load-more"
                    onClick={() => setFunnelVisible((current) => current + 30)}
                  >
                    Mostrar 30 funnels más
                  </button>
                )}
              </>
            ) : (
              <div className="empty-state">
                La auditoría comercial profunda está en proceso de publicación. Las fichas
                aparecen aquí únicamente después de superar trazabilidad, privacidad
                y control de calidad.
              </div>
            )}
          </div>
        )}

        {view === "countries" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">MATRIZ MUNDIAL</p>
              <h1>195 países, con presencia y huecos</h1>
              <p>
                Los países sin empresa comparable también aparecen: un cero es
                una conclusión de cobertura, no un olvido.
              </p>
            </section>
            <div className="country-summary">
              <article>
                <strong>{countries.filter((x) => x.count).length}</strong>
                <span>con actores vinculados</span>
              </article>
              <article>
                <strong>{countries.filter((x) => !x.count).length}</strong>
                <span>sin actor vinculable</span>
              </article>
              <article>
                <strong>195</strong>
                <span>Estados auditados</span>
              </article>
            </div>
            <section className="country-grid">
              {countries.map((c) => (
                <button
                  key={c.name}
                  className={c.count ? "has-data" : "empty"}
                  onClick={() => c.count && chooseCountry(c.name)}
                  disabled={!c.count}
                >
                  <span>{c.name}</span>
                  <strong>{c.count}</strong>
                  <small>
                    {c.count
                      ? c.withPublicPrice +
                        " con precio · " +
                        c.withMedia +
                        " con galería"
                      : "Sin actor empresarial vinculado"}
                  </small>
                </button>
              ))}
            </section>
            <p className="source-note">
              Marco territorial: 193 Estados miembros de Naciones Unidas más la
              Santa Sede y el Estado de Palestina. Una empresa puede operar en
              varios mercados; los recuentos territoriales no deben sumarse como
              empresas únicas.
            </p>
          </div>
        )}

        {view === "ads" && (
          <Suspense fallback={<div className="deep-loading">Abriendo el explorador visual…</div>}>
            <GalleryExplorer
              companies={companies}
              metrics={galleryMetrics}
              logos={logos}
              summary={summary}
              onOpenMedia={openMedia}
              onOpenCompany={openCompany}
            />
          </Suspense>
        )}

        {view === "compare" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">COMPARADOR</p>
              <h1>Decide con las diferencias a la vista</h1>
              <p>
                Selecciona hasta cuatro empresas desde sus tarjetas. Ya hemos
                cargado tres referentes para empezar.
              </p>
            </section>
            <section className="filterbar" aria-label="Filtros del comparador">
              <label>
                Modelo
                <select value={scope} onChange={(event) => setScope(event.target.value)}>
                  {scopes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                País / mercado
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  <option>Todos</option>
                  {countryOptions.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} · {item.count}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Canal
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                >
                  {channels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={priceOnly}
                  onChange={(event) => setPriceOnly(event.target.checked)}
                />{" "}
                Solo precio convertible
              </label>
              <button onClick={clearCompanyFilters}>Limpiar filtros</button>
            </section>
            {(query ||
              scope !== "Todos" ||
              country !== "Todos" ||
              channel !== "Todos" ||
              priceOnly) && (
              <div
                className="compare-picker"
                role="group"
                aria-label="Filtros activos; pulsa uno para quitarlo"
              >
                {query && (
                  <button onClick={() => setQuery("")} aria-label={`Quitar búsqueda ${query}`}>
                    Búsqueda: “{query}” ×
                  </button>
                )}
                {scope !== "Todos" && (
                  <button onClick={() => setScope("Todos")} aria-label="Quitar filtro de modelo">
                    Modelo: {scopeShort[scope] || scope} ×
                  </button>
                )}
                {country !== "Todos" && (
                  <button onClick={() => setCountry("Todos")} aria-label="Quitar filtro de país">
                    País: {country} ×
                  </button>
                )}
                {channel !== "Todos" && (
                  <button onClick={() => setChannel("Todos")} aria-label="Quitar filtro de canal">
                    Canal: {channel} ×
                  </button>
                )}
                {priceOnly && (
                  <button onClick={() => setPriceOnly(false)} aria-label="Quitar filtro de precio">
                    Precio convertible ×
                  </button>
                )}
              </div>
            )}
            <div className="result-line" aria-live="polite">
              <strong>{fmt(filtered.length)} empresas disponibles</strong>
              <span>{compare.length} de 4 seleccionadas</span>
            </div>
            <div className="compare-picker" aria-label="Empresas disponibles para comparar">
              {filtered.slice(0, 80).map((c) => (
                <button
                  key={c.id}
                  className={compare.includes(c.id) ? "selected" : ""}
                  onClick={() => toggleCompare(c.id)}
                  aria-pressed={compare.includes(c.id)}
                >
                  {compare.includes(c.id) ? "✓ " : ""}
                  {c.name}
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p className="record-empty">
                No hay empresas que coincidan con la búsqueda y los filtros actuales.
              </p>
            )}
            {compared.length ? (
              <div className="compare-table">
                <table aria-label="Comparación de empresas">
                  <thead>
                    <tr className="compare-row header">
                      <th scope="col">Dimensión</th>
                      {compared.map((c) => (
                        <th key={c.id} scope="col">
                          {c.name}
                          <button
                            onClick={() => toggleCompare(c.id)}
                            aria-label={`Quitar ${c.name} del comparador`}
                          >
                            ×
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        "País",
                        (c: Company) => c.countries.join(", ") || c.primaryCountry,
                      ],
                      ["Modelo", (c: Company) => c.agencyType],
                      ["Puntuación", (c: Company) => c.score + "/100"],
                      ["Oferta", (c: Company) => c.offer || "No documentada"],
                      [
                        "Precio local",
                        (c: Company) => c.priceLocal || "No publicado",
                      ],
                      [
                        "Equivalencia EUR",
                        (c: Company) =>
                          c.price.eur != null
                            ? "≈ " + c.price.label
                            : c.price.label,
                      ],
                      ["Contrato", (c: Company) => c.contract || "No publicado"],
                      ["Garantía", (c: Company) => c.guarantee || "No publicada"],
                      [
                        "Canales",
                        (c: Company) => c.channels.join(", ") || "No documentados",
                      ],
                      ["Decisión RV", (c: Company) => c.decision],
                      ["Evidencia", (c: Company) => c.evidence],
                    ].map((item) => (
                      <tr className="compare-row" key={item[0] as string}>
                        <th scope="row">{item[0] as string}</th>
                        {compared.map((c) => (
                          <td key={c.id}>
                            {(item[1] as (c: Company) => string)(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                Añade empresas al comparador desde la base.
              </div>
            )}
          </div>
        )}

        {viewResourcesReady && view === "insights" && insights && (
          <div className="view">
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">CONCLUSIONES · CALCULADAS SOBRE LA BASE CANÓNICA</p>
                  <h2>Lo que dicen las {fmt(insights.universe)} fichas cuando se cuentan</h2>
                </div>
              </div>
              <p className="insights-note">
                Cada cifra de esta página se recalcula automáticamente desde las fichas publicadas.
                Nada está estimado a mano. Corte: {insights.generatedAt}.
              </p>
              <section className="stat-grid">
                <article>
                  <span>FICHAS CON PRECIO VERIFICABLE</span>
                  <strong>{fmt(insights.pricedCount)}</strong>
                  <small>{Math.round((insights.pricedCount / insights.universe) * 100)}% del universo publica precio</small>
                </article>
                <article>
                  <span>PRECIO MEDIANO MUNDIAL</span>
                  <strong>{fmt(insights.worldMedianEur)} €</strong>
                  <small>Mediana de los precios normalizados a EUR</small>
                </article>
                <article>
                  <span>AMENAZAS ALTAS EN ESPAÑA</span>
                  <strong>{fmt(insights.threatsSpainTotal)}</strong>
                  <small>De {fmt(insights.spainCount)} fichas españolas</small>
                </article>
                <article>
                  <span>PARA COPIAR O PROBAR YA</span>
                  <strong>{insights.copyNow.length}</strong>
                  <small>Decisión Copiar/Probar con puntuación ≥ 60</small>
                </article>
              </section>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">ESTRUCTURA DEL MERCADO</p>
                  <h2>Cómo se organiza la competencia mundial</h2>
                </div>
              </div>
              <div className="bar-list">
                {insights.models.map((m) => (
                  <div key={m.type} className="bar-row">
                    <span className="bar-label">{m.type}</span>
                    <div className="bar-track">
                      <i style={{ width: `${Math.max(3, (m.count / insights.models[0].count) * 100)}%` }} />
                    </div>
                    <b>{m.count} · {m.pct}%</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">PRECIOS</p>
                  <h2>Dónde se concentra el dinero</h2>
                </div>
              </div>
              <div className="insights-cols">
                <div>
                  <h3 className="insights-subtitle">Distribución de los {fmt(insights.pricedCount)} precios públicos (EUR)</h3>
                  <div className="bar-list">
                    {insights.priceBuckets.map((b) => (
                      <div key={b.label} className="bar-row">
                        <span className="bar-label">{b.label}</span>
                        <div className="bar-track">
                          <i style={{ width: `${Math.max(3, (b.count / Math.max(...insights.priceBuckets.map((x) => x.count))) * 100)}%` }} />
                        </div>
                        <b>{b.count}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="insights-subtitle">Precio mediano por país (mín. 4 precios)</h3>
                  <div className="median-list">
                    {insights.countryMedians.map((c) => (
                      <button key={c.country} onClick={() => chooseCountry(c.country)}>
                        <span>{c.country}</span>
                        <small>{c.n} precios</small>
                        <b>{fmt(c.medianEur)} €</b>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">GARANTÍAS</p>
                  <h2>Las promesas con las que el mercado vende</h2>
                </div>
              </div>
              <div className="guarantee-grid">
                {insights.guarantees.map((g) => (
                  <article key={g.kind} className="guarantee-card">
                    <strong>{g.count}</strong>
                    <h3>{g.kind}</h3>
                    <small>{g.spain} en España</small>
                    <div className="chip-row">
                      {g.examples.map((e) => {
                        const c = companyById.get(e.id);
                        return (
                          <button key={e.id} className="ref-chip" onClick={() => c && openCompany(c)}>
                            {e.name}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">HUECOS DETECTADOS</p>
                  <h2>Lo que casi nadie hace en España (con la cifra que lo demuestra)</h2>
                </div>
              </div>
              <div className="gap-grid">
                {insights.gaps.map((g) => (
                  <article key={g.title} className="gap-card">
                    <strong>{g.stat}</strong>
                    <h3>{g.title}</h3>
                    <p>{g.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">AMENAZA ALTA · ESPAÑA</p>
                  <h2>A quién vigilar de cerca</h2>
                </div>
                <button className="link-button" onClick={() => chooseCountry("España")}>
                  Ver todas las fichas españolas →
                </button>
              </div>
              <div className="threat-list">
                {insights.threatsSpain.map((t) => {
                  const c = companyById.get(t.id);
                  return (
                    <button key={t.id} onClick={() => c && openCompany(c)}>
                      <span><strong>{t.name}</strong><small>{t.agencyType} · {t.relation}</small></span>
                      <b>{t.score}</b>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
        {viewResourcesReady && view === "playbooks" && insights && (
          <div className="view">
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">MÉTODOS · DESTILADOS DE LA EVIDENCIA</p>
                  <h2>{insights.methods.length} formas de captar que ya funcionan en el mundo</h2>
                </div>
              </div>
              <p className="insights-note">
                Cada método sale de fichas del catálogo único (madre o en verificación).
                Los enlaces abren la evidencia. La aplicación propuesta es una recomendación editorial, no un dato.
              </p>
              <div className="method-list">
                {insights.methods.map((m, index) => (
                  <article key={m.id} className="method-card">
                    <div className="method-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className="method-body">
                      <h3>{m.title}</h3>
                      <p>{m.what}</p>
                      <div className="chip-row">
                        {m.who.map((w) => {
                          const c = w.id ? companyById.get(w.id) : undefined;
                          return (
                            <button key={w.id || w.name} className="ref-chip" onClick={() => c && openCompany(c)}>
                              {w.name} · {w.country}
                            </button>
                          );
                        })}
                      </div>
                      <div className="method-apply">
                        <span>CÓMO SE APLICA AQUÍ</span>
                        <p>{m.apply}</p>
                      </div>
                      <div className="method-risk">
                        <span>RIESGO</span>
                        <p>{m.risk}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
        {viewResourcesReady && view === "analysis" && analytics && (
          <div className="view">
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">ANÁLISIS AVANZADO · {fmt(analytics.universe)} FICHAS</p>
                  <h2>Los datos, cruzados hasta el fondo</h2>
                </div>
              </div>
              <p className="insights-note">Todo calculado sobre el catálogo y sobre investigación con fuente. Lo que no se puede calcular todavía está marcado como pendiente al final.</p>

              <h3 className="analysis-title">Matriz nicho × país: dónde compite cada uno</h3>
              <div className="matrix-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr><th>Nicho</th><th>Total</th>{analytics.matrix.countries.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {analytics.matrix.rows.map((row) => (
                      <tr key={row.niche}>
                        <td>{row.niche}</td>
                        <td><b>{row.total}</b></td>
                        {row.cells.map((cell) => (
                          <td key={cell.country} className={cell.count === 0 ? "cell-zero" : cell.count >= 10 ? "cell-hot" : cell.count >= 4 ? "cell-warm" : "cell-low"}>
                            {cell.count || "·"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="matrix-hint">Celdas con punto = combinación no observada en la muestra. Verde intenso = mayor presencia en el catálogo.</p>
            </section>

            <section className="content-section">
              <div className="insights-cols">
                <div>
                  <h3 className="analysis-title">La garantía, ¿abarata o encarece?</h3>
                  <div className="gap-card guarantee-price-card">
                    <strong>{analytics.priceGuarantee.withGuarantee.medianEur ? `${fmt(analytics.priceGuarantee.withGuarantee.medianEur)} €` : "—"} vs {analytics.priceGuarantee.withoutGuarantee.medianEur ? `${fmt(analytics.priceGuarantee.withoutGuarantee.medianEur)} €` : "—"}</strong>
                    <h3>Precio mediano con garantía fuerte ({analytics.priceGuarantee.withGuarantee.n}) vs sin ella ({analytics.priceGuarantee.withoutGuarantee.n})</h3>
                    {analytics.priceGuarantee.reading && <p>{analytics.priceGuarantee.reading}</p>}
                  </div>
                  <h3 className="analysis-title">Rango de precios por país (p25 · mediana · p75)</h3>
                  <div className="median-list">
                    {analytics.elasticity.map((e) => (
                      <button key={e.country} onClick={() => chooseCountry(e.country)}>
                        <span>{e.country}</span>
                        <small>{e.n} precios</small>
                        <b>{fmt(e.p25)} · {fmt(e.p50)} · {fmt(e.p75)} €</b>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="analysis-title">Saturación en España por nicho</h3>
                  <div className="bar-list">
                    {analytics.saturation.slice(0, 10).map((s) => (
                      <div key={s.niche} className="bar-row">
                        <span className="bar-label">{s.niche}</span>
                        <div className="bar-track"><i style={{ width: `${Math.max(4, (s.count / analytics.saturation[0].count) * 100)}%` }} /></div>
                        <b>{s.count}</b>
                      </div>
                    ))}
                  </div>
                  <h3 className="analysis-title">Las palabras de las fichas con prioridad estratégica alta ({analytics.copyAnalysis.winnersN}) frente al resto</h3>
                  <div className="chip-row">
                    {analytics.copyAnalysis.winnerWords.slice(0, 14).map((w) => (
                      <span key={w.word} className="ref-chip word-win">{w.word} · {w.count}</span>
                    ))}
                  </div>
                  <div className="chip-row">
                    {analytics.copyAnalysis.laggardWords.slice(0, 10).map((w) => (
                      <span key={w.word} className="ref-chip word-lag">{w.word} · {w.count}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">PUNTUACIÓN V2 · CRITERIO DE NEGOCIO</p>
                  <h2>Quién importa de verdad</h2>
                </div>
              </div>
              <p className="insights-note">{analytics.scoringV2.formula}</p>
              <div className="insights-cols">
                <div>
                  <h3 className="analysis-title">España · top 25</h3>
                  <div className="threat-list">
                    {analytics.scoringV2.spain.map((t) => {
                      const c = companyById.get(t.id);
                      return (
                        <button key={t.id} onClick={() => c && openCompany(c)}>
                          <span><strong>{t.name}</strong><small>{t.agencyType}</small></span>
                          <b>{t.v2}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="analysis-title">Resto del mundo · top 20</h3>
                  <div className="threat-list">
                    {analytics.scoringV2.global.map((t) => {
                      const c = companyById.get(t.id);
                      return (
                        <button key={t.id} onClick={() => c && openCompany(c)}>
                          <span><strong>{t.name}</strong><small>{t.country}</small></span>
                          <b>{t.v2}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {analytics.mortality && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">EL CEMENTERIO</p>
                    <h2>{analytics.mortality.cases.length} agencias muertas y sus lecciones</h2>
                  </div>
                </div>
                <div className="gap-grid">
                  {analytics.mortality.cases.map((m) => (
                    <article key={m.name} className="mortality-card">
                      <h3>{m.name}</h3>
                      <small>{m.country || "España"} · {m.closed_when || "s/f"}</small>
                      <p>{m.cause || "Causa no documentada."}</p>
                      {m.lesson && <p className="mortality-lesson">Lección: {m.lesson}</p>}
                    </article>
                  ))}
                </div>
                <h3 className="analysis-title">Patrones de mortalidad documentados</h3>
                <ul className="pattern-list">
                  {analytics.mortality.patterns.map((p) => <li key={p.slice(0, 40)}>{p}</li>)}
                </ul>
              </section>
            )}

            {analytics.leadEconomy && (
              <section className="content-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">LA ECONOMÍA DEL LEAD · ESPAÑA</p>
                    <h2>Qué paga el que compra</h2>
                  </div>
                </div>
                <div className="matrix-wrap">
                  <table className="matrix-table lead-economy">
                    <thead><tr><th>Vertical</th><th>CPL típico</th><th>Cita/reunión</th><th>Quién compra</th><th>Dónde compra</th></tr></thead>
                    <tbody>
                      {analytics.leadEconomy.verticals.map((v) => (
                        <tr key={v.vertical}>
                          <td><b>{v.vertical}</b></td>
                          <td>{v.typical_cpl_range || "—"}</td>
                          <td>{v.typical_appointment_price || "—"}</td>
                          <td>{v.who_buys || "—"}</td>
                          <td>{v.where_they_buy || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="pattern-list">
                  {analytics.leadEconomy.notes.map((n) => <li key={n.slice(0, 40)}>{n}</li>)}
                </ul>
              </section>
            )}

            <section className="content-section">
              <h3 className="analysis-title">Pendiente (sin inventar)</h3>
              <ul className="pattern-list pending">
                {analytics.pending.map((p) => <li key={p.slice(0, 40)}>{p}</li>)}
              </ul>
            </section>
          </div>
        )}
        {viewResourcesReady && view === "expansion" && expansion && (
          <div className="view">
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">EXPANSIÓN INTERNACIONAL · REDVITALIA</p>
                  <h2>Dónde ir, en qué orden y con qué reglas</h2>
                </div>
              </div>
              <p className="insights-note">{expansion.note}</p>
              <div className="playbook-strip">
                {expansion.playbook.map((p) => <div key={p.slice(0, 30)} className="playbook-item">{p}</div>)}
              </div>
            </section>
            <section className="content-section">
              <div className="expansion-grid">
                {expansion.dossiers.map((d) => (
                  <article key={d.country} className={`expansion-card risk-${(d.regulation?.risk || "").toLowerCase().startsWith("alto") ? "high" : (d.regulation?.risk || "").toLowerCase().startsWith("medio") ? "mid" : "low"}`}>
                    <div className="expansion-head">
                      <span className="expansion-priority">{d.priority}</span>
                      <h3>{d.country}</h3>
                      <button className="link-button" onClick={() => chooseCountry(d.country)}>{d.fichas} fichas →</button>
                    </div>
                    <div className="expansion-stats">
                      <span><b>{d.medianEur ? `${fmt(d.medianEur)} €` : "s/d"}</b><small>mediana ({d.pricedN} precios)</small></span>
                      <span><b>{d.highThreats}</b><small>amenazas altas</small></span>
                      <span><b>{d.inVerification}</b><small>en verificación</small></span>
                    </div>
                    {d.referents.length > 0 && (
                      <div className="chip-row">
                        {d.referents.map((r) => {
                          const c = companyById.get(r.id);
                          return <button key={r.id} className="ref-chip" onClick={() => c && openCompany(c)}>{r.name} · {r.decision}</button>;
                        })}
                      </div>
                    )}
                    {d.regulation && (
                      <div className="expansion-reg">
                        <span className="reg-tag">{d.regulation.b2b}</span>
                        <span className="reg-risk">Riesgo: {d.regulation.risk}</span>
                        <p>{d.regulation.requirements}</p>
                        {d.regulation.recentChanges && <small>{d.regulation.recentChanges}</small>}
                      </div>
                    )}
                    <p className="expansion-strategy">{d.strategy}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">REGULACIÓN DE LLAMADAS EN FRÍO · 14 PAÍSES</p>
                  <h2>El mapa legal antes de descolgar</h2>
                </div>
              </div>
              <div className="matrix-wrap">
                <table className="matrix-table reg-table">
                  <thead><tr><th>País</th><th>B2B en frío</th><th>Requisitos</th><th>Cambios recientes</th><th>Riesgo</th></tr></thead>
                  <tbody>
                    {expansion.regulationAll.map((r) => (
                      <tr key={r.country}>
                        <td><b>{r.country}</b></td>
                        <td>{r.b2b}</td>
                        <td>{r.requirements}</td>
                        <td>{r.recentChanges}</td>
                        <td className={`reg-${r.risk.toLowerCase().startsWith("alto") ? "high" : r.risk.toLowerCase().startsWith("medio") ? "mid" : "low"}`}>{r.risk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {viewResourcesReady && view === "mystery" && mystery && (
          <div className="view">
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">MYSTERY SHOPPING · OPERADO POR NIDIA</p>
                  <h2>Conocer a la competencia por dentro</h2>
                </div>
              </div>
              <p className="insights-note">{mystery.intro}</p>
              <div className="insights-cols">
                <div className="mystery-callout legal">
                  <h3>Reglas fijas</h3>
                  <ul>{mystery.legal.map((l) => <li key={l.slice(0, 30)}>{l}</li>)}</ul>
                </div>
                <div className="mystery-callout setup">
                  <h3>Preparación (una sola vez)</h3>
                  <ul>{mystery.setup.map((s) => <li key={s.slice(0, 30)}>{s}</li>)}</ul>
                </div>
              </div>
            </section>
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">IDENTIDADES DE COBERTURA</p>
                  <h2>{mystery.identities.length} personajes, uno por tipo de objetivo</h2>
                </div>
              </div>
              <div className="identity-grid">
                {mystery.identities.map((iden) => (
                  <article key={iden.id} className="identity-card">
                    <h3>{iden.label}</h3>
                    <p>{iden.story}</p>
                    <div className="identity-data"><span>DATOS QUE DAS</span><p>{iden.dataToGive}</p></div>
                    <small>{iden.goodFor}</small>
                  </article>
                ))}
              </div>
            </section>
            <section className="content-section">
              <div className="insights-cols">
                <div>
                  <h3 className="analysis-title">Las 8 preguntas de toda llamada</h3>
                  <ol className="mystery-list">{mystery.baseQuestions.map((q) => <li key={q.slice(0, 30)}>{q}</li>)}</ol>
                  <h3 className="analysis-title">El flujo, paso a paso</h3>
                  <ol className="mystery-list flow">{mystery.flow.map((f) => <li key={f.slice(0, 30)}>{f.replace(/^\d+\.\s*/, "")}</li>)}</ol>
                </div>
                <div>
                  <h3 className="analysis-title">Qué capturar de cada objetivo</h3>
                  <ul className="mystery-list check">{mystery.captureChecklist.map((c) => <li key={c.slice(0, 30)}>{c}</li>)}</ul>
                  <h3 className="analysis-title">Registro por contacto (una línea por empresa)</h3>
                  <ul className="mystery-list check">{mystery.registryTemplate.map((r) => <li key={r.slice(0, 30)}>{r}</li>)}</ul>
                </div>
              </div>
            </section>
            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">OBJETIVOS · EN ORDEN</p>
                  <h2>{mystery.targets.length} empresas a conocer por dentro</h2>
                </div>
              </div>
              <div className="target-list">
                {mystery.targets.map((t) => {
                  const c = companyById.get(t.id);
                  const iden = mystery.identities.find((x) => x.id === t.identity);
                  return (
                    <article key={t.id} className="target-card">
                      <div className="target-head">
                        <span className="target-order">{t.order}</span>
                        <div>
                          <h3>{t.name}</h3>
                          <small>{t.agencyType} · Amenaza {t.threat} · Identidad: {iden ? iden.label : t.identity}</small>
                        </div>
                        <button className="link-button" onClick={() => c && openCompany(c)}>Ficha →</button>
                      </div>
                      <p>{t.focus}</p>
                      <small>{t.priceRef}</small>
                      {t.hipotesis && t.hipotesis.length > 0 && (
                        <div className="target-hipotesis">
                          <span>QUÉ DEBE RESPONDER ESTA LLAMADA</span>
                          <ul>
                            {t.hipotesis.map((h, i) => (
                              <li key={i}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
        {viewResourcesReady && view === "blueprint" && editorial && (
          <div className="view editorial-view">
            <section className="page-head">
              <p className="eyebrow">CONCLUSIONES Y EJECUCIÓN</p>
              <h1>De la investigación al negocio definitivo</h1>
              <p>
                La síntesis estratégica completa, separada de la base para que
                el equipo pueda decidir sin atravesar miles de registros.
              </p>
            </section>
            <div className="editorial-tabs" role="tablist" aria-label="Documentos estratégicos">
              {editorialTabs.map((tab) => (
                <button
                  key={tab.id}
                  ref={(element) => {
                    editorialTabRefs.current[tab.id] = element;
                  }}
                  id={`editorial-tab-${tab.id}`}
                  role="tab"
                  aria-controls={`editorial-panel-${tab.id}`}
                  aria-selected={editorialTab === tab.id}
                  tabIndex={editorialTab === tab.id ? 0 : -1}
                  className={editorialTab === tab.id ? "active" : ""}
                  onClick={() => setEditorialTab(tab.id)}
                  onKeyDown={(event) => handleEditorialTabKeyDown(event, tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {editorialTabs.map((tab) => (
              <article
                key={tab.id}
                id={`editorial-panel-${tab.id}`}
                className="editorial-paper"
                role="tabpanel"
                aria-labelledby={`editorial-tab-${tab.id}`}
                tabIndex={0}
                hidden={editorialTab !== tab.id}
              >
                <div className="paper-title">
                  <span>REDVITALIA · 22/08/2026</span>
                  <h2>{editorial[tab.id].title}</h2>
                </div>
                <Suspense fallback={<p className="editorial-loading">Preparando el informe…</p>}>
                  <EditorialText
                    text={editorial[tab.id].body}
                    companyById={companyById}
                    onOpen={openCompany}
                  />
                </Suspense>
              </article>
            ))}
          </div>
        )}

        {view === "audit" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">METODOLOGÍA Y CONTROL</p>
              <h1>Qué contiene, qué demuestra y qué limita</h1>
              <p>
                Una auditoría útil distingue ausencia de evidencia, precio
                oculto, estimación, declaración propia y dato confirmado.
              </p>
            </section>
            <section className="audit-grid">
              <article>
                <span>COBERTURA</span>
                <strong>{fmt(companies.length)} / {fmt(summary.countries)}</strong>
                <p>Fichas canónicas actuales y Estados incluidos en el universo territorial.</p>
              </article>
              <article>
                <span>MEDIOS SERVIDOS / SNAPSHOT PROFUNDO</span>
                <strong>
                  {fmt(manifest?.universe.media ?? summary.media)} /{" "}
                  {fmt(manifest?.deepSnapshot.media ?? summary.media)}
                </strong>
                <p>
                  Archivos de galería servidos hoy frente a los verificados en el
                  snapshot profundo de {fmt(manifest?.deepSnapshot.companies ?? summary.companies)} fichas.
                </p>
              </article>
              <article>
                <span>PRECIOS AUDITADOS</span>
                <strong>{auditedPriceRecords}</strong>
                <p>
                  Moneda local + EUR en V3; el índice rápido contiene {summary.publicPrices}.
                </p>
              </article>
              <article>
                <span>URLS ÚNICAS DE FUNNEL</span>
                <strong>
                  {fmt(v3Index?.stats.uniqueEvidenceUrlsGlobal ?? summary.sources)}
                </strong>
                <p>
                  {fmt(v3Index?.stats.evidenceReferences ?? 0)} referencias
                  analíticas, {fmt(v3Index?.stats.usableEvidenceReferences ?? 0)} enlazables, {fmt(v3Index?.stats.unavailableEvidenceReferences ?? 0)} no disponible y{" "}
                  {fmt(v3Index?.stats.uniqueEvidenceUrlsWithinRecords ?? 0)} URLs
                  únicas al deduplicar cada ficha. El índice empresarial conserva
                  por separado {fmt(summary.sources)} fuentes canónicas.
                </p>
              </article>
              <article>
                <span>MARCAS VERIFICADAS</span>
                <strong>{summary.logos.authentic} / {fmt(Object.keys(logos).length)}</strong>
                <p>
                  El manifiesto ya cubre todas las fichas visibles; cada identidad
                  real conserva su origen y cada respaldo explica su limitación.
                </p>
              </article>
              <article>
                <span>FICHAS VISIBLES INDEXADAS</span>
                <strong>{fmt(companies.length)} / {fmt(companies.length)}</strong>
                <p>
                  Esquema canónico íntegro; la cobertura observable se declara
                  por separado.
                </p>
              </article>
              <article>
                <span>MAPA TERRITORIAL</span>
                <strong>
                  {locationSummary.withPoint} + {locationSummary.withoutPoint}
                </strong>
                <p>
                  {locationSummary.withPoint} vinculables a territorio y {locationSummary.withoutPoint}{" "}
                  sin punto inventado.
                </p>
              </article>
            </section>
            <section className="method-columns">
              <article>
                <h2>Reglas de evidencia</h2>
                <ul>
                  <li>
                    <b>Confirmado:</b> fuente oficial o registro contrastable.
                  </li>
                  <li>
                    <b>Probable:</b> varias señales, pero falta una prueba
                    primaria.
                  </li>
                  <li>
                    <b>Estimado:</b> inferencia señalada; nunca se presenta como
                    tarifa.
                  </li>
                  <li>
                    <b>No publicado:</b> no se inventa una cifra.
                  </li>
                  <li>
                    <b>No recuperable:</b> el origen dejó de servir el archivo.
                  </li>
                  <li>
                    <b>Rastro técnico:</b> archivo sin creatividad verificable,
                    excluido de las galerías.
                  </li>
                </ul>
              </article>
              <article>
                <h2>Precios y monedas</h2>
                <ul>
                  <li>Se conserva el texto local original.</li>
                  <li>
                    Solo se convierte cuando moneda e importe son inequívocos.
                  </li>
                  <li>Instantánea FX: {summary.fx.date}.</li>
                  <li>Las tasas son orientativas, no contractuales.</li>
                  <li>
                    Fee e inversión publicitaria se separan cuando es posible.
                  </li>
                </ul>
              </article>
              <article>
                <h2>Privacidad y estructura</h2>
                <ul>
                  <li>Una única base conceptual: empresas y evidencias.</li>
                  <li>Un único portal compartible para todo el equipo.</li>
                  <li>No se publican enlaces internos ni privados.</li>
                  <li>Los medios viven en la ficha correspondiente.</li>
                  <li>Las fuentes externas se abren desde la ficha.</li>
                </ul>
              </article>
            </section>
            <div className="audit-banner">
              <strong>Limitaciones y reparaciones documentadas</strong>
              <p>
                Instantánea a 22/08/2026. Se corrigieron{" "}
                {fmt(summary.mediaFileTypeCorrections)} archivos con extensión
                incorrecta y se excluyeron {summary.technicalArtifactsExcluded}{" "}
                rastros técnicos sin creatividad válida. Cinco archivos públicos
                no pudieron recuperarse porque el servidor de origen los rechaza
                o ya no existen. Los precios, campañas, equipos y condiciones
                pueden cambiar.
              </p>
            </div>
          </div>
        )}
        {view === "audit" && (
          <section className="completion-panel">
            <div className="completion-mark">{summary.completion.status === "TERMINADO" ? "✓" : "↻"}</div>
            <div>
              <p className="eyebrow">CRITERIOS DE CIERRE · SNAPSHOT BASE DE {summary.companies}</p>
              <h2>{summary.completion.status} · 22/08/2026</h2>
              <p>{summary.completion.status === "TERMINADO"
                ? "El snapshot base cerró sus criterios internos. La ampliación hasta 963 fichas y las colas publicitarias se controlan por separado en Centro de Operaciones."
                : "La base anterior está preservada, pero la ampliación forense de funnels todavía tiene registros pendientes de revisar, sincronizar o publicar."}
              </p>
            </div>
            <div className="completion-kpis">
              <span>
                <b>{summary.completion.recordsInProgress}</b> En curso
              </span>
              <span>
                <b>{summary.completion.residualPending}</b> pendientes
              </span>
              <span>
                <b>{summary.completion.motherlessRecords}</b> sin madre
              </span>
              <span>
                <b>{summary.completion.criticalEmptyUnexplained}</b> críticos
                vacíos
              </span>
              <span>
                <b>{summary.completion.orphanMedia}</b> medios huérfanos
              </span>
              <span>
                <b>{summary.completion.recordsWithoutPublicSource}</b> sin
                fuente pública
              </span>
              <span>
                <b>{fmt(summary.completion.availableEvidencePlaced)}</b> piezas
                de galería verificadas
              </span>
              <span>
                <b>{v3Index ? fmt(v3Index.stats.uniqueEvidenceUrlsGlobal) : resourceLoadState.v3Index === "error" ? "n/d" : "…"}</b> URLs públicas
                únicas de funnel
              </span>
              <span>
                <b>{v3Index ? fmt(v3Index.stats.screenshots) : resourceLoadState.v3Index === "error" ? "n/d" : "…"}</b> capturas de funnel
              </span>
              <span>
                <b>{v3Index ? fmt(v3Index.stats.verified) : resourceLoadState.v3Index === "error" ? "n/d" : "…"}</b> fichas comerciales
                verificadas
              </span>
            </div>
            <div className="audit-banner">
              <strong>Limitaciones explícitas, nunca datos inventados</strong>
              <p>
                {fmt(summary.completion.unavailableEvidenceDocumented)} archivos de
                origen no recuperables están documentados; {fmt(summary.logos.fallback)}
                {" "}marcas sin activo público verificable usan iniciales neutras; y
                {" "}{fmt(summary.completion.specialMarketRecords)} fichas de mercado
                especial conservan su alcance territorial explicado. La investigación
                pública no envía formularios ni contacta a las empresas.
              </p>
              <a href="/data/final-audit.json" target="_blank" rel="noopener noreferrer">
                Abrir auditoría final exacta ↗
              </a>
            </div>
          </section>
        )}
      </section>

      {active && (
        <Suspense fallback={<div className="modal-backdrop"><div className="detail-modal"><div className="deep-loading">Abriendo ficha completa…</div></div></div>}>
          <RecordDetail
            key={active.id}
            company={active}
            logos={logos}
            takeaway={takeaways?.items[active.id]}
            dossier={dossiers?.items[active.id]}
            compared={compare.includes(active.id)}
            lightboxOpen={lightboxOpen}
            onClose={closeCompany}
            onMediaOpen={openMedia}
            onShare={shareCompany}
            onCompare={() => toggleCompare(active.id)}
          />
        </Suspense>
      )}
      {toast && (
        <div className="portal-toast" role="status">
          {toast}
        </div>
      )}
      <button
        className={`back-top${showBackTop ? " visible" : ""}`}
        title="Volver arriba"
        aria-label="Volver arriba"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑
      </button>
      {lightbox && (
        <div
          ref={lightboxRef}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={"Visor de materiales de " + lightbox.company.name}
          aria-describedby="lightbox-caption"
        >
          <button
            ref={lightboxCloseRef}
            className="lightbox-close"
            aria-label="Cerrar"
            onClick={closeMedia}
          >
            ×
          </button>
          {lightbox.collection.length > 1 && (
            <>
              <button
                className="lightbox-nav prev"
                aria-label="Material anterior"
                onClick={() => stepLightbox(-1)}
              >
                ←
              </button>
              <button
                className="lightbox-nav next"
                aria-label="Material siguiente"
                onClick={() => stepLightbox(1)}
              >
                →
              </button>
            </>
          )}
          <div>
            {failedLightboxFile === lightbox.media.file ? (
              <div className="lightbox-error">
                <b>No se pudo mostrar este archivo</b>
                <span>
                  La incidencia ha quedado identificada para revisión.
                </span>
              </div>
            ) : lightbox.media.type.includes("video") ||
              /\.(mp4|webm|mov)$/i.test(lightbox.media.file) ? (
              <video
                src={lightbox.media.file}
                controls
                autoPlay
                onError={() => setFailedLightboxFile(lightbox.media.file)}
              >
                <track
                  kind="captions"
                  src="/empty.vtt"
                  srcLang="es"
                  label="Sin subtítulos disponibles"
                />
              </video>
            ) : (
              <img
                src={lightbox.media.file}
                alt={
                  lightboxResolution.isLowResolution
                    ? `Original de baja resolución de ${lightbox.company.name}`
                    : "Material ampliado de " + lightbox.company.name
                }
                data-media-resolution={lightboxResolution.kind}
                data-upscaled={
                  lightboxResolution.isLowResolution ? "false" : undefined
                }
                style={imagePresentationStyle(lightboxResolution, "viewer")}
                onLoad={(event) => {
                  const measured = measureImage(event.currentTarget);
                  if (!measured) return;
                  setMeasuredImageDimensions((current) => {
                    const previous = current[lightbox.media.file];
                    if (
                      previous?.width === measured.width &&
                      previous.height === measured.height
                    )
                      return current;
                    return {
                      ...current,
                      [lightbox.media.file]: measured,
                    };
                  });
                }}
                onError={() => setFailedLightboxFile(lightbox.media.file)}
              />
            )}
            <MediaResolutionNotice
              resolution={lightboxResolution}
              file={lightbox.media.file}
            />
            <p id="lightbox-caption">
              {lightbox.company.name} ·{" "}
              {lightboxMediaCaption || "Material verificado"} ·{" "}
              {lightbox.collection.findIndex(
                (item) => item.file === lightbox.media.file,
              ) + 1}{" "}
              de {lightbox.collection.length}
            </p>
            <small>Usa ← y → para avanzar · Esc para cerrar</small>
          </div>
        </div>
      )}
    </main>
  );
}
