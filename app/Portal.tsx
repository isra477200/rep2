"use client";
/* eslint-disable @next/next/no-img-element */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CompanyLogo from "./CompanyLogo";
import RecordDetail from "./RecordDetail";
import type {
  Company,
  Country,
  CountryGeo,
  Editorial,
  LogoManifest,
  Media,
  Summary,
} from "./data-types";

const WorldMap = lazy(() => import("./WorldMap"));

type View =
  | "home"
  | "companies"
  | "map"
  | "countries"
  | "ads"
  | "compare"
  | "blueprint"
  | "audit";

const nav: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Resumen", icon: "⌂" },
  { id: "companies", label: "Empresas", icon: "◎" },
  { id: "map", label: "Mapa 3D", icon: "◉" },
  { id: "countries", label: "Países", icon: "◈" },
  { id: "ads", label: "Galerías", icon: "▣" },
  { id: "compare", label: "Comparador", icon: "⇄" },
  { id: "blueprint", label: "Blueprint", icon: "✦" },
  { id: "audit", label: "Auditoría", icon: "✓" },
];
const scopeShort: Record<string, string> = {
  "Núcleo — agencia/leadgen": "Agencia / leadgen",
  "Vertical — broker/marketplace": "Broker / marketplace",
  "Adyacente — BPO/infraestructura": "BPO / infraestructura",
  "Excluir — fuente/no negocio": "Fuera del núcleo",
};
const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const strip = (s: string) =>
  s
    .replace(/[*_#]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
const short = (s: string, n = 170) =>
  s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;

function RichText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <div className="rich-text">
      {lines.map((line, i) => {
        const clean = strip(line);
        if (!clean) return null;
        if (line.startsWith("### ")) return <h4 key={i}>{clean}</h4>;
        if (line.startsWith("## ")) return <h3 key={i}>{clean}</h3>;
        if (line.startsWith("# ")) return <h2 key={i}>{clean}</h2>;
        if (/^[-*] /.test(line))
          return (
            <p className="bullet" key={i}>
              {clean}
            </p>
          );
        if (/^\d+\. /.test(line))
          return (
            <p className="numbered" key={i}>
              {clean}
            </p>
          );
        if (/^---+$/.test(line) || /^<(?:table|tr|td)/.test(line)) return null;
        return <p key={i}>{clean}</p>;
      })}
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
      className="media-tile"
      onClick={onOpen}
      aria-label={"Ampliar material de " + name}
    >
      <img
        src={item.file}
        alt={"Material de " + name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
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
              rail.current?.scrollBy({ left: -640, behavior: "smooth" })
            }
            aria-label="Anterior"
          >
            ←
          </button>
          <button
            onClick={() =>
              rail.current?.scrollBy({ left: 640, behavior: "smooth" })
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
}: {
  c: Company;
  logos: LogoManifest;
  onOpen: () => void;
  onCompare: () => void;
  selected: boolean;
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
    [logos, setLogos] = useState<LogoManifest>({});
  const [view, setView] = useState<View>("home"),
    [query, setQuery] = useState(""),
    [scope, setScope] = useState("Todos"),
    [country, setCountry] = useState("Todos");
  const [priceOnly, setPriceOnly] = useState(false),
    [channel, setChannel] = useState("Todos"),
    [visible, setVisible] = useState(24);
  const [active, setActive] = useState<Company | null>(null),
    [lightbox, setLightbox] = useState<{
      media: Media;
      company: Company;
    } | null>(null);
  const [compare, setCompare] = useState<string[]>([]),
    [galleryLimit, setGalleryLimit] = useState(8),
    [editorialTab, setEditorialTab] = useState<keyof Editorial>("blueprint");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [failedLightboxFile, setFailedLightboxFile] = useState<string | null>(null),
    [focusCountry, setFocusCountry] = useState<string | null>(null),
    [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/data/companies.json").then((r) => r.json()),
      fetch("/data/countries.json").then((r) => r.json()),
      fetch("/data/summary.json").then((r) => r.json()),
      fetch("/data/editorial.json").then((r) => r.json()),
      fetch("/data/country-geo.json").then((r) => r.json()),
      fetch("/data/logos.json").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([c, co, s, e, g, l]) => {
        setCompanies(c);
        setCountries(co);
        setSummary(s);
        setEditorial(e);
        setGeo(g);
        setLogos(l);
        setCompare(c.slice(0, 3).map((x: Company) => x.id));
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("empresa");
        const requestedCompany = requested
          ? c.find((x: Company) => x.id === requested)
          : null;
        if (requestedCompany) {
          setActive(requestedCompany);
          const mediaIndex = Number(params.get("media")) - 1;
          if (
            Number.isInteger(mediaIndex) &&
            requestedCompany.media[mediaIndex]
          )
            setLightbox({
              company: requestedCompany,
              media: requestedCompany.media[mediaIndex],
            });
        }
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar la instantánea del radar.");
        setLoading(false);
      });
  }, []);

  const scopes = useMemo(
    () => ["Todos", ...new Set(companies.map((x) => x.scope))],
    [companies],
  );
  const channels = useMemo(
    () => ["Todos", ...new Set(companies.flatMap((x) => x.channels))].sort(),
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
  const top = companies.slice(0, 4);
  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const chooseCountry = (name: string) => {
    setCountry(name);
    setView("companies");
    setVisible(24);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleCompare = (id: string) =>
    setCompare((x) =>
      x.includes(id)
        ? x.filter((y) => y !== id)
        : x.length < 4
          ? [...x, id]
          : x,
    );
  const openCompany = useCallback((company: Company) => {
    setActive(company);
    setLightbox(null);
    const url = new URL(window.location.href);
    url.searchParams.set("empresa", company.id);
    url.searchParams.delete("media");
    url.hash = "";
    window.history.pushState({ empresa: company.id }, "", url);
  }, []);
  const closeCompany = useCallback(() => {
    setActive(null);
    setLightbox(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("empresa");
    url.searchParams.delete("media");
    url.hash = "";
    window.history.pushState({}, "", url);
  }, []);
  const shareCompany = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Enlace de la ficha copiado");
    } catch {
      setToast("Copia la dirección del navegador para compartir esta ficha");
    }
  }, []);
  const openMedia = useCallback((media: Media, company: Company) => {
    setLightbox({ media, company });
    const url = new URL(window.location.href);
    url.searchParams.set("empresa", company.id);
    url.searchParams.set(
      "media",
      String(company.media.findIndex((item) => item.file === media.file) + 1),
    );
    window.history.pushState(
      { empresa: company.id, media: media.file },
      "",
      url,
    );
  }, []);
  const closeMedia = useCallback(() => {
    setLightbox(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("media");
    window.history.pushState(active ? { empresa: active.id } : {}, "", url);
  }, [active]);
  const stepLightbox = useCallback(
    (direction: number) =>
      setLightbox((current) => {
        if (!current || current.company.media.length < 2) return current;
        const index = current.company.media.findIndex(
          (item) => item.file === current.media.file,
        );
        const next =
          (index + direction + current.company.media.length) %
          current.company.media.length;
        const nextMedia = current.company.media[next];
        const url = new URL(window.location.href);
        url.searchParams.set("empresa", current.company.id);
        url.searchParams.set("media", String(next + 1));
        window.history.replaceState(
          { empresa: current.company.id, media: nextMedia.file },
          "",
          url,
        );
        return { company: current.company, media: nextMedia };
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
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [active, closeCompany, closeMedia, lightbox, stepLightbox]);
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("empresa");
      const company = requested
        ? companies.find((item) => item.id === requested) || null
        : null;
      setActive(company);
      const mediaIndex = Number(params.get("media")) - 1;
      setLightbox(
        company && Number.isInteger(mediaIndex) && company.media[mediaIndex]
          ? { company, media: company.media[mediaIndex] }
          : null,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [companies]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (loading)
    return (
      <main className="loading-screen">
        <div className="brandmark">RV</div>
        <h1>Preparando el radar mundial</h1>
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go("home")}>
          <span className="brandmark">RV</span>
          <span>
            <strong>RedVitalia</strong>
            <small>Radar mundial de captación</small>
          </span>
        </button>
        <nav aria-label="Navegación principal">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <i>{n.icon}</i>
              <span>{n.label}</span>
              {n.id === "companies" && <b>712</b>}
              {n.id === "countries" && <b>195</b>}
              {n.id === "ads" && <b>{fmt(summary.media)}</b>}
            </button>
          ))}
        </nav>
        <div className="side-status">
          <span className="dot" />
          <div>
            <strong>Instantánea verificada</strong>
            <small>22 agosto 2026</small>
          </div>
        </div>
      </aside>
      <section className="main">
        <header className="topbar">
          <div className="global-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value && view === "home") setView("companies");
              }}
              placeholder="Busca empresa, país, modelo, canal o precio…"
              aria-label="Buscar en todo el radar"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Borrar búsqueda">
                ×
              </button>
            )}
          </div>
          <div className="data-date">CORTE · 22 AGO 2026</div>
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
                    Explorar las 712 empresas
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
                <small>Fichas madre completas</small>
              </article>
              <article>
                <span>MATERIALES LOCALES</span>
                <strong>{fmt(summary.media)}</strong>
                <small>Imágenes, vídeo y documentos</small>
              </article>
              <article>
                <span>FUENTES PÚBLICAS</span>
                <strong>{fmt(summary.sources)}</strong>
                <small>Sin enlaces privados</small>
              </article>
              <article>
                <span>PRECIOS CONVERTIBLES</span>
                <strong>{fmt(summary.publicPrices)}</strong>
                <small>{summary.priceCoveragePercent}% del universo</small>
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

        {view === "companies" && (
          <div className="view">
            <section className="page-head">
              <p className="eyebrow">BASE EMPRESARIAL</p>
              <h1>712 fichas madre, sin ruido</h1>
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
              <button
                onClick={() => {
                  setScope("Todos");
                  setCountry("Todos");
                  setChannel("Todos");
                  setPriceOnly(false);
                  setQuery("");
                }}
              >
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

        {view === "map" && (
          <div className="view map-view">
            <section className="page-head map-page-head">
              <p className="eyebrow">CARTOGRAFÍA ESTRATÉGICA</p>
              <h1>Un globo 3D para volar hasta cada mercado</h1>
              <p>
                Pulsa un punto, una agrupación o el selector territorial. El
                vuelo abre las empresas asociadas y cada una conduce a su ficha
                madre completa.
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
                focusCountry={focusCountry}
                onOpen={openCompany}
              />
            </Suspense>
            <p className="source-note">
              Geolocalización honesta: los puntos usan centroides de país o
              territorio porque la fuente canónica no contiene coordenadas de
              sede. Se muestran 708 fichas vinculables a un territorio; los
              cuatro modelos globales permanecen en una lista separada para no
              inventar una ubicación.
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
                <b>{fmt(summary.media)}</b> archivos legibles
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
            <div className="compare-picker">
              {companies.slice(0, 40).map((c) => (
                <button
                  key={c.id}
                  className={compare.includes(c.id) ? "selected" : ""}
                  onClick={() => toggleCompare(c.id)}
                >
                  {compare.includes(c.id) ? "✓ " : ""}
                  {c.name}
                </button>
              ))}
            </div>
            {compared.length ? (
              <div className="compare-table">
                <div className="compare-row header">
                  <b>Dimensión</b>
                  {compared.map((c) => (
                    <strong key={c.id}>
                      {c.name}
                      <button onClick={() => toggleCompare(c.id)}>×</button>
                    </strong>
                  ))}
                </div>
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
                  <div className="compare-row" key={item[0] as string}>
                    <b>{item[0] as string}</b>
                    {compared.map((c) => (
                      <span key={c.id}>
                        {(item[1] as (c: Company) => string)(c)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Añade empresas al comparador desde la base.
              </div>
            )}
          </div>
        )}

        {view === "blueprint" && editorial && (
          <div className="view editorial-view">
            <section className="page-head">
              <p className="eyebrow">CONCLUSIONES Y EJECUCIÓN</p>
              <h1>Del radar al negocio definitivo</h1>
              <p>
                La síntesis estratégica completa, separada de la base para que
                el equipo pueda decidir sin atravesar miles de registros.
              </p>
            </section>
            <div className="editorial-tabs">
              <button
                className={editorialTab === "blueprint" ? "active" : ""}
                onClick={() => setEditorialTab("blueprint")}
              >
                Blueprint
              </button>
              <button
                className={editorialTab === "execution" ? "active" : ""}
                onClick={() => setEditorialTab("execution")}
              >
                Sistema operativo
              </button>
              <button
                className={editorialTab === "report" ? "active" : ""}
                onClick={() => setEditorialTab("report")}
              >
                Informe estratégico
              </button>
            </div>
            <article className="editorial-paper">
              <div className="paper-title">
                <span>REDVITALIA · 22/08/2026</span>
                <h2>{editorial[editorialTab].title}</h2>
              </div>
              <RichText text={editorial[editorialTab].body} />
            </article>
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
                <span>MEDIOS LEGIBLES</span>
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
                <span>PRECIOS</span>
                <strong>{summary.publicPrices}</strong>
                <p>Con importe y moneda convertibles.</p>
              </article>
              <article>
                <span>FUENTES</span>
                <strong>{fmt(summary.sources)}</strong>
                <p>URLs públicas únicas conservadas.</p>
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
                <span>FICHAS SIN RECORTE</span>
                <strong>712 / 712</strong>
                <p>42 campos principales, tablas, enlaces y dossier íntegro.</p>
              </article>
              <article>
                <span>MAPA TERRITORIAL</span>
                <strong>708 + 4</strong>
                <p>
                  708 vinculables a territorio y 4 globales sin punto inventado.
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
                  <li>
                    “Radar” es el estudio; “Universo activo” era una etiqueta
                    histórica.
                  </li>
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
            <div className="completion-mark">✓</div>
            <div>
              <p className="eyebrow">CRITERIOS DE CIERRE</p>
              <h2>{summary.completion.status}</h2>
              <p>
                La auditoría canónica no conserva trabajo abierto ni evidencia
                disponible fuera de su ficha madre.
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
            </div>
          </section>
        )}
      </section>

      {active && (
        <RecordDetail
          company={active}
          logos={logos}
          compared={compare.includes(active.id)}
          onClose={closeCompany}
          onMediaOpen={openMedia}
          onShare={shareCompany}
          onLocate={() => {
            setFocusCountry(active.primaryCountry);
            setView("map");
            closeCompany();
            window.scrollTo({ top: 0, behavior: "smooth" });
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
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={"Visor de materiales de " + lightbox.company.name}
        >
          <button
            className="lightbox-close"
            aria-label="Cerrar"
            onClick={closeMedia}
          >
            ×
          </button>
          {lightbox.company.media.length > 1 && (
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
                alt={"Material ampliado de " + lightbox.company.name}
                onError={() => setFailedLightboxFile(lightbox.media.file)}
              />
            )}
            <p>
              {lightbox.company.name} · material{" "}
              {lightbox.company.media.findIndex(
                (item) => item.file === lightbox.media.file,
              ) + 1}{" "}
              de {lightbox.company.media.length}
            </p>
            <small>Usa ← y → para avanzar · Esc para cerrar</small>
          </div>
        </div>
      )}
    </main>
  );
}
