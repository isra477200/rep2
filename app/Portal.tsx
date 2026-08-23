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
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import CompanyLogo from "./CompanyLogo";
import {
  classifyMediaResolution,
  dimensionsFromMedia,
  imagePresentationStyle,
  measureImage,
  MediaResolutionBadge,
  MediaResolutionNotice,
  type MediaDimensions,
} from "./MediaResolution";
import RecordDetail from "./RecordDetail";
import type {
  AdsKitData,
  Analytics,
  ArsenalData,
  Company,
  Country,
  CountryGeo,
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

const WorldMap = lazy(() => import("./WorldMap"));

type View =
  | "home"
  | "exec"
  | "resources"
  | "tools"
  | "arsenal"
  | "verticals"
  | "watch"
  | "companies"
  | "funnels"
  | "map"
  | "countries"
  | "ads"
  | "compare"
  | "insights"
  | "playbooks"
  | "analysis"
  | "expansion"
  | "mystery"
  | "blueprint"
  | "audit";

const nav: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Resumen", icon: "⌂" },
  { id: "exec", label: "Ejecutar", icon: "▸" },
  { id: "resources", label: "Recursos", icon: "⤓" },
  { id: "tools", label: "Herramientas", icon: "◳" },
  { id: "arsenal", label: "Arsenal", icon: "⚑" },
  { id: "companies", label: "Empresas", icon: "◎" },
  { id: "funnels", label: "Funnels de venta", icon: "⌁" },
  { id: "map", label: "Mapa 3D", icon: "◉" },
  { id: "countries", label: "Países", icon: "◈" },
  { id: "ads", label: "Galerías", icon: "▣" },
  { id: "compare", label: "Comparador", icon: "⇄" },
  { id: "verticals", label: "Nichos", icon: "▤" },
  { id: "insights", label: "Conclusiones", icon: "∴" },
  { id: "playbooks", label: "Métodos", icon: "⚙" },
  { id: "analysis", label: "Análisis", icon: "∑" },
  { id: "watch", label: "Vigilancia", icon: "◔" },
  { id: "expansion", label: "Expansión", icon: "❖" },
  { id: "mystery", label: "Mystery", icon: "◍" },
  { id: "blueprint", label: "Blueprint", icon: "✦" },
  { id: "audit", label: "Auditoría", icon: "✓" },
];

const navGroups: Array<{ label: string | null; ids: View[] }> = [
  { label: null, ids: ["home"] },
  { label: "Acción", ids: ["exec", "resources", "tools", "arsenal"] },
  { label: "Base", ids: ["companies", "funnels", "map", "countries", "ads", "compare"] },
  { label: "Análisis", ids: ["verticals", "insights", "playbooks", "analysis", "watch", "expansion", "mystery"] },
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

const editorialMarkdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "details", "summary"],
  attributes: { ...defaultSchema.attributes, details: ["open"] },
};

const isPublicHref = (input?: string) => {
  if (!input) return false;
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 =
      /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        hostname,
      );
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !/(^|\.)notion\.(?:com|so|site)$/i.test(hostname) &&
      !/(^|\.)(?:localhost|local|internal)$/i.test(hostname) &&
      !privateIpv4
    );
  } catch {
    return false;
  }
};

function EditorialText({
  text,
  companyById,
  onOpen,
}: {
  text: string;
  companyById: Map<string, Company>;
  onOpen: (company: Company) => void;
}) {
  return (
    <div className="rich-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, editorialMarkdownSchema]]}
        components={{
          a: ({ href, children }) => {
            const internal = href?.match(/^\?empresa=([^&#]+)$/);
            if (internal) {
              const company = companyById.get(decodeURIComponent(internal[1]));
              return company ? (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(company);
                  }}
                >
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              );
            }
            return isPublicHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children} ↗
              </a>
            ) : (
              <span>{children}</span>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function MediaTile({
  item,
  name,
  onOpen,
}: {
  item: Media;
  name: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<MediaDimensions | null>(() =>
    dimensionsFromMedia(item),
  );
  const resolution = classifyMediaResolution(dimensions);
  if (failed)
    return (
      <div className="media-tile media-fallback" role="status">
        <b>Vista no disponible</b>
        <span>El archivo está documentado para revisión técnica.</span>
      </div>
    );
  if (item.type.includes("video") || /\.(mp4|webm|mov)$/i.test(item.file))
    return (
      <button
        className="media-tile"
        onClick={onOpen}
        aria-label={"Abrir vídeo de " + name}
      >
        <video
          src={item.file}
          muted
          preload="metadata"
          onError={() => setFailed(true)}
        />
        <span className="play">▶</span>
      </button>
    );
  if (item.type.includes("pdf") || /\.pdf$/i.test(item.file))
    return (
      <a
        className="media-tile document"
        href={item.file}
        target="_blank"
        rel="noreferrer"
      >
        <b>PDF</b>
        <span>Abrir documento</span>
      </a>
    );
  return (
    <button
      className={`media-tile${resolution.isLowResolution ? " media-low-resolution" : ""}`}
      onClick={onOpen}
      aria-label={
        resolution.isLowResolution
          ? `Abrir ${resolution.label?.toLocaleLowerCase("es")} de ${name}; ${resolution.dimensionLabel}`
          : "Abrir material de " + name
      }
      data-media-resolution={resolution.kind}
    >
      <img
        src={item.file}
        alt={"Material de " + name}
        loading="lazy"
        decoding="async"
        style={imagePresentationStyle(resolution, "tile")}
        onLoad={(event) => {
          const measured = measureImage(event.currentTarget);
          if (measured) setDimensions(measured);
        }}
        onError={() => setFailed(true)}
      />
      <MediaResolutionBadge resolution={resolution} />
    </button>
  );
}

function MediaRail({
  company,
  onOpen,
}: {
  company: Company;
  onOpen: (m: Media, c: Company) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  return (
    <article className="rail-card">
      <div className="rail-head">
        <div>
          <span>{company.primaryCountry}</span>
          <h3>{company.name}</h3>
        </div>
        <div className="rail-tools">
          <b>{company.media.length} materiales</b>
          <button
            onClick={() =>
              rail.current?.scrollBy({ left: -640, behavior: scrollBehavior() })
            }
            aria-label="Anterior"
          >
            ←
          </button>
          <button
            onClick={() =>
              rail.current?.scrollBy({ left: 640, behavior: scrollBehavior() })
            }
            aria-label="Siguiente"
          >
            →
          </button>
        </div>
      </div>
      <div className="media-rail" ref={rail}>
        {company.media.map((m) => (
          <MediaTile
            key={m.file}
            item={m}
            name={company.name}
            onOpen={() => onOpen(m, company)}
          />
        ))}
      </div>
    </article>
  );
}

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
        <span className={"score score-" + scoreClass}>{c.score}/100</span>
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
    [geo, setGeo] = useState<CountryGeo[]>([]),
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
    [homesTimeline, setHomesTimeline] = useState<HomesTimelineData | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [simPrice, setSimPrice] = useState(""),
    [propVertical, setPropVertical] = useState("clinicas-salud"),
    [propZona, setPropZona] = useState(""),
    [propServicio, setPropServicio] = useState(""),
    [propPrecio, setPropPrecio] = useState(""),
    [titularQuery, setTitularQuery] = useState(""),
    [titularFormula, setTitularFormula] = useState("Todas"),
    [garantiaKind, setGarantiaKind] = useState("Todas");
  const [actionStates, setActionStates] = useState<Record<string, { estado: string; nota: string }>>({});
  useEffect(() => {
    try {
      const storedNav = window.localStorage.getItem("rv-nav-collapsed");
      if (storedNav === "1") setNavCollapsed(true);
      const storedActions = window.localStorage.getItem("rv-backlog-estado");
      if (storedActions) setActionStates(JSON.parse(storedActions));
    } catch {}
  }, []);
  const toggleNav = () => {
    setNavCollapsed((current) => {
      try { window.localStorage.setItem("rv-nav-collapsed", current ? "0" : "1"); } catch {}
      return !current;
    });
  };
  const setActionState = (title: string, estado: string) => {
    setActionStates((current) => {
      const next = { ...current, [title]: { estado, nota: current[title]?.nota || "" } };
      try { window.localStorage.setItem("rv-backlog-estado", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [view, setView] = useState<View>("home"),
    [query, setQuery] = useState(""),
    [scope, setScope] = useState("Todos"),
    [country, setCountry] = useState("Todos");
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
    [galleryLimit, setGalleryLimit] = useState(8),
    [editorialTab, setEditorialTab] = useState<keyof Editorial>("blueprint");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [failedLightboxFile, setFailedLightboxFile] = useState<string | null>(null),
    [focusCountry, setFocusCountry] = useState<string | null>(null),
    [focusCompanyId, setFocusCompanyId] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const editorialTabRefs = useRef<
    Partial<Record<keyof Editorial, HTMLButtonElement | null>>
  >({});
  const [measuredImageDimensions, setMeasuredImageDimensions] = useState<
    Record<string, MediaDimensions>
  >({});

  useEffect(() => {
    Promise.all([
      fetch("/data/companies-index.json").then(
        (r) => r.json() as Promise<Company[]>,
      ),
      fetch("/data/countries.json").then(
        (r) => r.json() as Promise<Country[]>,
      ),
      fetch("/data/summary.json").then(
        (r) => r.json() as Promise<Summary>,
      ),
      fetch("/data/editorial.json").then(
        (r) => r.json() as Promise<Editorial>,
      ),
      fetch("/data/country-geo.json").then(
        (r) => r.json() as Promise<CountryGeo[]>,
      ),
      fetch("/data/logos.json").then((r) =>
        r.ok ? (r.json() as Promise<LogoManifest>) : {},
      ),
      fetch("/data/deep/index.json").then((r) =>
        r.ok ? (r.json() as Promise<DeepIndex>) : null,
      ),
      fetch("/data/funnel-v3/index.json")
        .then((r) =>
          r.ok ? (r.json() as Promise<FunnelV3Index>) : null,
        )
        .catch(() => null),
      fetch("/data/insights.json")
        .then((r) => (r.ok ? (r.json() as Promise<Insights>) : null))
        .catch(() => null),
      fetch("/data/analytics.json")
        .then((r) => (r.ok ? (r.json() as Promise<Analytics>) : null))
        .catch(() => null),
      fetch("/data/expansion.json")
        .then((r) => (r.ok ? (r.json() as Promise<ExpansionData>) : null))
        .catch(() => null),
      fetch("/data/mystery.json")
        .then((r) => (r.ok ? (r.json() as Promise<MysteryData>) : null))
        .catch(() => null),
      fetch("/data/takeaways.json")
        .then((r) => (r.ok ? (r.json() as Promise<TakeawaysData>) : null))
        .catch(() => null),
      fetch("/data/patterns.json")
        .then((r) => (r.ok ? (r.json() as Promise<PatternsData>) : null))
        .catch(() => null),
      fetch("/data/execution.json")
        .then((r) => (r.ok ? (r.json() as Promise<ExecutionBacklog>) : null))
        .catch(() => null),
      fetch("/data/dossiers.json")
        .then((r) => (r.ok ? (r.json() as Promise<DossiersData>) : null))
        .catch(() => null),
      fetch("/data/recursos.json")
        .then((r) => (r.ok ? (r.json() as Promise<RecursosData>) : null))
        .catch(() => null),
      fetch("/data/verticales.json")
        .then((r) => (r.ok ? (r.json() as Promise<VerticalesData>) : null))
        .catch(() => null),
      fetch("/data/arsenal.json")
        .then((r) => (r.ok ? (r.json() as Promise<ArsenalData>) : null))
        .catch(() => null),
      fetch("/data/ads-kit.json")
        .then((r) => (r.ok ? (r.json() as Promise<AdsKitData>) : null))
        .catch(() => null),
      fetch("/data/vigilancia.json")
        .then((r) => (r.ok ? (r.json() as Promise<VigilanciaData>) : null))
        .catch(() => null),
      fetch("/data/homes-timeline.json")
        .then((r) => (r.ok ? (r.json() as Promise<HomesTimelineData>) : null))
        .catch(() => null),
    ])
      .then(([c, co, s, e, g, l, d, v3, ins, ana, exp, mys, tks, pats, execd, doss, recs, verts, ars, adsk, vig, homes]) => {
        setCompanies(c);
        setCountries(co);
        setSummary(s);
        setEditorial(e);
        setGeo(g);
        setLogos(l);
        setDeepIndex(d);
        setV3Index(v3);
        setInsights(ins);
        setAnalytics(ana);
        setExpansion(exp);
        setMystery(mys);
        setTakeaways(tks);
        setPatterns(pats);
        setExecution(execd);
        setDossiers(doss);
        setRecursos(recs);
        setVerticales(verts);
        setArsenal(ars);
        setAdsKit(adsk);
        setVigilancia(vig);
        setHomesTimeline(homes);
        setCompare(c.slice(0, 3).map((x: Company) => x.id));
        const params = new URLSearchParams(window.location.search);
        const requestedView = params.get("vista");
        if (nav.some((item) => item.id === requestedView)) setView(requestedView as View);
        const requested = params.get("empresa");
        const requestedCompany = requested
          ? c.find((x: Company) => x.id === requested)
          : null;
        if (requestedCompany) {
          setActive(requestedCompany);
          const mediaIndex = Number(params.get("media")) - 1;
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
      })
      .catch(() => {
        setError("No se pudo cargar la instantánea de inteligencia competitiva.");
        setLoading(false);
      });
  }, []);

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
  const priceDistribution = useMemo(
    () =>
      companies
        .filter((c) => c.price && typeof c.price.eur === "number" && c.price.eur > 0)
        .map((c) => c.price.eur as number)
        .sort((a, b) => a - b),
    [companies],
  );
  const simStats = useMemo(() => {
    const value = Number(simPrice.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || !priceDistribution.length) return null;
    const below = priceDistribution.filter((p) => p <= value).length;
    const pct = Math.round((below / priceDistribution.length) * 100);
    const median = priceDistribution[Math.floor(priceDistribution.length / 2)];
    return { value, pct, median, n: priceDistribution.length };
  }, [simPrice, priceDistribution]);
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
Hemos auditado ${vertical.n} empresas de captación del vertical «${vertical.label}» en todo el mundo (${vertical.spainN} en España). ${vertical.medianEur ? `El precio mediano del mercado es de ${vertical.medianEur} € y solo una parte publica tarifas.` : "La mayoría oculta sus tarifas."} El ${vertical.adsActivePct}% mantiene anuncios activos: quien vive de captar, invierte en captarse a sí mismo. Referentes analizados: ${refs}.

2. QUÉ TE PROPONEMOS
Citas cualificadas con clientes de ${zona} interesados en ${servicio}, agendadas directamente en tu calendario por nuestro equipo de setters. Tú solo atiendes la reunión.

3. NUESTRAS TRES GARANTÍAS (por contrato, no de palabra)
· Garantía de Zona Protegida: un solo negocio de tu sector en ${zona}. Tu plaza queda registrada y bloqueada.
· Cita válida o repuesta: la cita duplicada, falsa o fuera de zona se repone sin coste, con criterios firmados antes de empezar.
· Volumen o seguimos gratis: si un ciclo no alcanza el volumen pactado, seguimos trabajando sin coste hasta cumplirlo.

4. CÓMO ARRANCAMOS (Semana 0)
Firma → conoces a tu setter → apruebas el guion por escrito → criterios de cita válida firmados → lanzamos. La primera factura llega solo cuando todo lo anterior está hecho.

5. INVERSIÓN
${precio} €/mes, sin permanencia oculta ni renovación automática escondida. Compáralo con un comercial en plantilla (≈2.200 €/mes con Seguridad Social, sin garantía de volumen).

6. TU PLAZA
Cada zona tiene una sola plaza por sector. La de ${zona} para ${servicio}, a fecha de esta propuesta, está LIBRE. Reservarla no cuesta nada: firmarla, sí — para tu competencia.

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
          (channel === "Todos" || c.channels.includes(channel))
        );
      }),
    [companies, query, scope, country, priceOnly, channel],
  );
  const galleries = useMemo(() => {
    const q = query.toLocaleLowerCase("es");
    return companies
      .filter(
        (x) =>
          x.media.length &&
          (!q ||
            [x.name, x.primaryCountry, ...x.countries, x.niche, x.offer]
              .join(" ")
              .toLocaleLowerCase("es")
              .includes(q)),
      )
      .sort((a, b) => b.media.length - a.media.length);
  }, [companies, query]);
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
  const go = (v: View) => {
    if (v === "map") {
      setFocusCountry(null);
      setFocusCompanyId(null);
    }
    setView(v);
    const url = new URL(window.location.href);
    if (v === "home") url.searchParams.delete("vista");
    else url.searchParams.set("vista", v);
    window.history.pushState({ vista: v }, "", url);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
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
    url.searchParams.delete("evidence");
    url.hash = "";
    window.history.replaceState(
      { vista: url.searchParams.get("vista") || "home" },
      "",
      url,
    );
  }, []);
  const dismissCompanyInPlace = useCallback(() => {
    setActive(null);
    setLightbox(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("empresa");
    url.searchParams.delete("media");
    url.searchParams.delete("evidence");
    url.hash = "";
    window.history.replaceState(
      { vista: url.searchParams.get("vista") || "home" },
      "",
      url,
    );
  }, []);
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
    setLightbox({ media, company, collection, source });
    const url = new URL(window.location.href);
    url.searchParams.set("empresa", company.id);
    url.searchParams.delete("media");
    url.searchParams.delete("evidence");
    url.searchParams.set(source === "funnel" ? "evidence" : "media", String(index + 1));
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
        url.searchParams.delete("evidence");
        url.searchParams.set(current.source === "funnel" ? "evidence" : "media", String(next + 1));
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
      setView(nav.some((item) => item.id === requestedView) ? requestedView as View : "home");
      const requested = params.get("empresa");
      const company = requested
        ? companies.find((item) => item.id === requested) || null
        : null;
      setActive(company);
      const mediaIndex = Number(params.get("media")) - 1;
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
                    {!navCollapsed && item.id === "ads" && <b>{fmt(summary.media)}</b>}
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
          <div className="global-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => {
                const nextQuery = e.target.value;
                setQuery(nextQuery);
                if (
                  nextQuery &&
                  !(["companies", "funnels", "ads", "compare"] as View[]).includes(
                    view,
                  )
                ) {
                  go("companies");
                  setToast("Búsqueda abierta en Empresas");
                }
              }}
              placeholder="Busca empresa, país, modelo, canal o precio…"
              aria-label="Buscar en toda la investigación"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Borrar búsqueda">
                ×
              </button>
            )}
          </div>
          <div className="data-date">CORTE · {BUILD_DATE}</div>
          <span className="avatar">RV</span>
        </header>

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
                  <button onClick={() => go("companies")}>
                    Explorar las {fmt(companies.length)} empresas
                  </button>
                  <button className="secondary" onClick={() => go("map")}>
                    Abrir mapa 3D
                  </button>
                  <button className="secondary" onClick={() => go("blueprint")}>
                    Abrir Blueprint
                  </button>
                </div>
              </div>
              <div className="hero-orbit">
                <span>195</span>
                <strong>países auditados</strong>
                <small>Una sola fuente canónica</small>
              </div>
            </section>
            <section className="stat-grid">
              <article>
                <span>EMPRESAS CANÓNICAS</span>
                <strong>{fmt(summary.companies)}</strong>
                <small>Fichas madre estructuradas y trazables</small>
              </article>
              <article>
                <span>MATERIALES LOCALES</span>
                <strong>{fmt(summary.media)}</strong>
                <small>Imágenes, vídeo y documentos</small>
              </article>
              <article>
                <span>URLS PÚBLICAS ÚNICAS</span>
                <strong>
                  {fmt(v3Index?.stats.uniqueEvidenceUrlsGlobal ?? summary.sources)}
                </strong>
                <small>
                  {fmt(v3Index?.stats.evidenceReferences ?? 0)} referencias
                  analíticas · {fmt(v3Index?.stats.usableEvidenceReferences ?? 0)} enlazables · {fmt(v3Index?.stats.unavailableEvidenceReferences ?? 0)} no disponible ·{" "}
                  {fmt(v3Index?.stats.uniqueEvidenceUrlsWithinRecords ?? 0)}
                  {" "}únicas por ficha
                </small>
              </article>
              <article>
                <span>PRECIOS AUDITADOS · LOCAL + EUR</span>
                <strong>{fmt(auditedPriceRecords)}</strong>
                <small>{auditedPricePercent}% del universo</small>
              </article>
            </section>
            <section className="brand-coverage">
              <div className="brand-coverage-mark">✓</div>
              <div>
                <p className="eyebrow">IDENTIDAD VISUAL CON TRAZABILIDAD</p>
                <h2>
                  {fmt(summary.logos.authentic)} marcas auténticas guardadas
                  localmente
                </h2>
                <p>
                  {fmt(summary.logos.official)} logos o wordmarks,{" "}
                  {fmt(summary.logos.favicon)} iconos oficiales y{" "}
                  {fmt(summary.logos.platform)} perfiles de plataforma
                  verificados. Las {fmt(summary.logos.fallback)} fichas
                  restantes muestran iniciales honestas; ninguna utiliza una
                  marca inventada ni una imagen enlazada en caliente.
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
              <button onClick={() => go("map")}>
                <b>01</b>
                <span>
                  <strong>Volar por mercados</strong>
                  <small>Globo 3D, presencia y huecos</small>
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
              <button onClick={() => go("blueprint")}>
                <b>03</b>
                <span>
                  <strong>Decidir qué aplicar</strong>
                  <small>Blueprint y sistema operativo</small>
                </span>
                →
              </button>
            </section>
          </div>
        )}

        {view === "exec" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">EJECUTAR · DESTILADO ACCIONABLE</p>
              <h1>Del dato a la decisión</h1>
              <p>
                Las {fmt(companies.length)} fichas, reducidas a lo que se puede
                copiar ya: un backlog priorizado, los patrones que separan a los
                ganadores del montón y los dossiers profundos del top 30. Cada
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
                    <h2>Qué hacen distinto los {patterns.winnersN} con puntuación 80+</h2>
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
                          <small>Ganadores</small>
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
                <h3 className="analysis-title">Validados dos veces: puntuación 80+ y anuncios pagados ahora mismo</h3>
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

        {view === "resources" && (
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

        {view === "tools" && (
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

            <section className="content-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">SIMULADOR DE PRICING</p>
                  <h2>¿Dónde cae tu precio frente al mundo?</h2>
                </div>
              </div>
              <div className="tool-card">
                <div className="tool-controls">
                  <label>
                    Tu precio mensual (€)
                    <input value={simPrice} placeholder="p. ej. 750" onChange={(e) => setSimPrice(e.target.value)} />
                  </label>
                </div>
                {simStats ? (
                  <div className="sim-result">
                    <div className="sim-gauge" aria-hidden>
                      <i style={{ width: `${simStats.pct}%` }} />
                      <span style={{ left: `${Math.min(97, simStats.pct)}%` }}>{simStats.pct}%</span>
                    </div>
                    <p>
                      Con <b>{fmt(simStats.value)} €</b> estás por encima del{" "}
                      <b>{simStats.pct}%</b> de los {fmt(simStats.n)} precios públicos
                      de la base (mediana mundial: {fmt(simStats.median)} €).{" "}
                      {simStats.pct >= 75
                        ? "Zona premium: exige garantía fuerte y prueba visible para sostenerse."
                        : simStats.pct >= 40
                          ? "Zona media del mercado: la diferenciación no vendrá del precio, sino de la garantía y la exclusividad."
                          : "Zona de entrada: hay recorrido para subir precio si la garantía y la prueba acompañan."}
                    </p>
                  </div>
                ) : (
                  <p className="record-empty">Escribe un precio para posicionarlo contra la distribución mundial.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {view === "arsenal" && (
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
                  {["Todas", ...new Set(arsenal.garantias.items.flatMap((g) => g.kinds))].map((kind) => (
                    <button key={kind} className={garantiaKind === kind ? "selected" : ""} onClick={() => setGarantiaKind(kind)}>
                      {kind}
                    </button>
                  ))}
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
          </div>
        )}

        {view === "verticals" && verticales && (
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

        {view === "watch" && vigilancia && (
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
              <div className="matrix-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr><th></th><th>Empresa</th><th>Amenaza</th><th>Score</th><th>Ads activos</th><th>Precio público</th><th>Garantía</th></tr>
                  </thead>
                  <tbody>
                    {vigilancia.semaforo.slice(0, 60).map((s) => {
                      const c = companyById.get(s.id);
                      return (
                        <tr key={s.id}>
                          <td><span className={`sem-dot sem-${s.nivel}`} title={s.nivel} /></td>
                          <td><button className="ref-chip" onClick={() => c && openCompany(c)}>{s.name}</button></td>
                          <td>{s.threat}</td>
                          <td>{s.score}</td>
                          <td>{s.adsActive ? `Sí · M${s.metaAds}/G${s.googleAds}` : "No"}</td>
                          <td>{s.pricePublic ? "Sí" : "No"}</td>
                          <td>{s.hasGuarantee ? "Sí" : "No"}</td>
                        </tr>
                      );
                    })}
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
              <button onClick={clearCompanyFilters}>
                Limpiar
              </button>
            </section>
            <div className="result-line">
              <strong>{fmt(filtered.length)} resultados</strong>
              <span>Ordenados por puntuación estratégica</span>
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

        {view === "funnels" && (
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

        {view === "map" && (
          <div className="view map-view">
            <section className="page-head map-page-head">
              <p className="eyebrow">CARTOGRAFÍA ESTRATÉGICA</p>
              <h1>Un globo 3D para volar hasta cada competidor</h1>
              <p>
                Pulsa un punto, una agrupación o el selector territorial. El
                vuelo distingue puntos publicados, centros de ciudad y simples
                referencias de país o mercado. Desde cada punto puedes abrir su
                ficha madre completa.
              </p>
            </section>
            <Suspense
              fallback={
                <div className="map-loading inline-map-loading">
                  <span />
                  <b>Preparando el globo 3D…</b>
                  <small>La base empresarial ya está disponible</small>
                </div>
              }
            >
              <WorldMap
                companies={companies}
                countries={countries}
                geo={geo}
                logos={logos}
                takeaways={takeaways?.items}
                focusCountry={focusCountry}
                focusCompanyId={focusCompanyId}
                onOpen={openCompany}
              />
            </Suspense>
            <p className="source-note">
              Geolocalización auditada: 67 puntos publicados por la empresa,
              107 centros de ciudad derivados, 535 centros de país o mercado y
              3 fichas sin punto inventado. Ninguno se presenta como sede
              central confirmada.
            </p>
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
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">ARCHIVO VISUAL VERIFICADO</p>
              <h1>Galerías que cargan y se pueden recorrer</h1>
              <p>
                {fmt(summary.media)} archivos visuales comprobados, organizados
                por ficha madre. Desliza, usa las flechas o abre cualquier pieza
                a pantalla completa; dentro del visor también funcionan las
                teclas ← y →.
              </p>
            </section>
            <div className="gallery-stats">
              <span>
                <b>{fmt(summary.withMedia)}</b> empresas con galería
              </span>
              <span>
                <b>{fmt(summary.media)}</b> archivos disponibles y verificados
              </span>
              <span>
                <b>{fmt(summary.mediaFileTypeCorrections)}</b> formatos
                reparados
              </span>
              <span>
                <b>{summary.technicalArtifactsExcluded}</b> rastros técnicos
                excluidos
              </span>
              <span>
                <b>{summary.mediaFailed}</b> URLs no recuperables
              </span>
            </div>
            {query && (
              <div className="result-line gallery-result">
                <strong>
                  {fmt(galleries.length)} galerías coinciden con “{query}”
                </strong>
                <button onClick={() => setQuery("")}>Ver todas</button>
              </div>
            )}
            <section className="rails">
              {galleries.slice(0, galleryLimit).map((c) => (
                <MediaRail key={c.id} company={c} onOpen={openMedia} />
              ))}
            </section>
            {!galleries.length && (
              <div className="empty-state">
                No hay galerías que coincidan con la búsqueda.
              </div>
            )}
            {galleryLimit < galleries.length && (
              <button
                className="load-more"
                onClick={() => setGalleryLimit((x) => x + 8)}
              >
                Mostrar 8 galerías más
              </button>
            )}
            <div className="limitation">
              <strong>Control de calidad de los materiales</strong>
              <p>
                Se corrigieron {fmt(summary.mediaFileTypeCorrections)} archivos
                cuyo contenido real no coincidía con la extensión. Los{" "}
                {summary.technicalArtifactsExcluded} rastros técnicos inválidos
                no se muestran como creatividades y se conservan en cuarentena
                de auditoría. Las {summary.mediaFailed} URLs públicas que
                responden 403/404 o dejaron de servir el archivo siguen
                documentadas; no se sustituyen por imágenes inventadas.
              </p>
            </div>
          </div>
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

        {view === "insights" && insights && (
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
        {view === "playbooks" && insights && (
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
        {view === "analysis" && analytics && (
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
              <p className="matrix-hint">Celdas con punto = nadie detectado: cada una es un hueco potencial. Verde intenso = zona saturada.</p>
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
                  <h3 className="analysis-title">Las palabras de los mejores ({analytics.copyAnalysis.winnersN} fichas 80+) vs el montón</h3>
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
        {view === "expansion" && expansion && (
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
        {view === "mystery" && mystery && (
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
        {view === "blueprint" && editorial && (
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
                <EditorialText
                  text={editorial[tab.id].body}
                  companyById={companyById}
                  onOpen={openCompany}
                />
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
                <strong>712 / 195</strong>
                <p>Empresas canónicas y Estados auditados.</p>
              </article>
              <article>
                <span>MEDIOS VERIFICADOS</span>
                <strong>
                  {fmt(summary.media)} /{" "}
                  {fmt(
                    summary.media +
                      summary.mediaFailed +
                      summary.technicalArtifactsExcluded,
                  )}
                </strong>
                <p>
                  Disponibles frente a 3.979 declarados; 5 no recuperables y 17
                  rastros excluidos.
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
                <span>MARCAS AUTÉNTICAS</span>
                <strong>{summary.logos.authentic} / 712</strong>
                <p>
                  {summary.logos.coveragePercent}% con logo, wordmark o icono
                  oficial local.
                </p>
              </article>
              <article>
                <span>FICHAS MADRE INDEXADAS</span>
                <strong>712 / 712</strong>
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
              <p className="eyebrow">CRITERIOS DE CIERRE</p>
              <h2>{summary.completion.status}</h2>
              <p>{summary.completion.status === "TERMINADO"
                ? "La auditoría canónica no conserva trabajo abierto ni evidencia disponible fuera de su ficha madre."
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
                <b>{fmt(v3Index?.stats.uniqueEvidenceUrlsGlobal || 0)}</b> URLs públicas
                únicas de funnel
              </span>
              <span>
                <b>{fmt(v3Index?.stats.screenshots || 0)}</b> capturas de funnel
              </span>
              <span>
                <b>{fmt(v3Index?.stats.verified || 0)}</b> fichas comerciales
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
          onLocate={() => {
            const selectedCompany = active;
            dismissCompanyInPlace();
            go("map");
            setFocusCountry(
              selectedCompany.location?.canonicalMarket ||
                selectedCompany.primaryCountry,
            );
            setFocusCompanyId(selectedCompany.id);
          }}
          onCompare={() => toggleCompare(active.id)}
        />
      )}
      {toast && (
        <div className="portal-toast" role="status">
          {toast}
        </div>
      )}
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
