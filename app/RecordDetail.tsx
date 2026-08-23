"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import CompanyLogo from "./CompanyLogo";
import FunnelV3Panel from "./FunnelV3Panel";
import {
  classifyMediaResolution,
  dimensionsFromMedia,
  imagePresentationStyle,
  measureImage,
  MediaResolutionBadge,
  type MediaDimensions,
} from "./MediaResolution";
import type {
  Company,
  DeepReview,
  Dossier,
  FunnelV3Review,
  LogoManifest,
  Media,
  Takeaway,
} from "./data-types";

const scopeShort: Record<string, string> = {
  "Núcleo — agencia/leadgen": "Agencia / leadgen",
  "Vertical — broker/marketplace": "Broker / marketplace",
  "Adyacente — BPO/infraestructura": "BPO / infraestructura",
  "Excluir — fuente/no negocio": "Fuera del núcleo",
};

const markdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "details", "summary"],
  attributes: { ...defaultSchema.attributes, details: ["open"] },
};

const scalarText = (input: unknown): string => {
  if (typeof input === "string" || typeof input === "number")
    return String(input).replace(/\s+/g, " ").trim();
  if (typeof input === "boolean") return input ? "Sí" : "No";
  if (!input || typeof input !== "object") return "";
  if (Array.isArray(input))
    return input.map(scalarText).filter(Boolean).join(" · ");
  const row = input as Record<string, unknown>;
  for (const key of [
    "text",
    "detail",
    "explanation",
    "finding",
    "summary",
    "headline",
    "promise",
    "label",
    "name",
    "title",
    "trait",
    "pattern",
    "technology",
    "answer",
    "question",
    "value",
  ]) {
    const candidate = scalarText(row[key]);
    if (candidate) return candidate;
  }
  return "";
};

const value = (input: unknown, fallback = "No documentado públicamente") =>
  scalarText(input) || fallback;
const isPublicHref = (input?: string | null) => {
  if (!input) return false;
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
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

function PublicLink({
  href,
  children,
}: {
  href?: string | null;
  children: React.ReactNode;
}) {
  return href && isPublicHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  ) : (
    <span>{children}</span>
  );
}

function FullList({
  items,
  empty = "No observado públicamente",
}: {
  items?: unknown[];
  empty?: string;
}) {
  const visible = [...new Set((items || []).map(scalarText).filter(Boolean))];
  if (!visible.length) return <p className="record-empty compact">{empty}</p>;
  return (
    <div className="deep-full-list">
      {visible.map((item, index) => (
        <p key={`${item}-${index}`}>{item}</p>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`record-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function CompleteAnalysis({ text }: { text: string }) {
  const prepared = text.replace(
    /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${href.replace(/"/g, "&quot;")}">${label.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a>`,
  );
  return (
    <div className="complete-analysis">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
        components={{
          a: ({ href, children }) =>
            isPublicHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children} ↗
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => (
            <span className="analysis-image-note">
              {alt || "Imagen"}: el material visual se conserva en la galería
              local de esta ficha.
            </span>
          ),
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

function DetailMedia({
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
        <span>Incidencia controlada</span>
      </div>
    );
  if (item.type.includes("pdf") || /\.pdf$/i.test(item.file))
    return (
      <a
        className="media-tile document"
        href={item.file}
        target="_blank"
        rel="noopener noreferrer"
      >
        <b>PDF</b>
        <span>Abrir documento</span>
      </a>
    );
  if (item.type.includes("video") || /\.(mp4|webm|mov)$/i.test(item.file))
    return (
      <button
        className="media-tile"
        onClick={onOpen}
        aria-label={`Abrir vídeo de ${name}`}
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
  return (
    <button
      className={`media-tile${resolution.isLowResolution ? " media-low-resolution" : ""}`}
      onClick={onOpen}
      aria-label={
        resolution.isLowResolution
          ? `Abrir ${resolution.label?.toLocaleLowerCase("es")} de ${name}; ${resolution.dimensionLabel}`
          : `Abrir evidencia de ${name}`
      }
      data-media-resolution={resolution.kind}
    >
      <img
        src={item.file}
        alt={`Evidencia de ${name}`}
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

const mediaKind = (media: Media) =>
  media.type.includes("pdf") || /\.pdf$/i.test(media.file)
    ? "document"
    : media.type.includes("video") || /\.(mp4|webm|mov)$/i.test(media.file)
      ? "video"
      : "image";

const isVisibleFocusTarget = (element: HTMLElement) => {
  if (
    element.hidden ||
    element.tabIndex < 0 ||
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    (element instanceof HTMLInputElement && element.type === "hidden") ||
    element.closest('[hidden], [inert], [aria-hidden="true"]')
  ) {
    return false;
  }

  let ancestor: HTMLElement | null = element;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
      const summary = Array.from(ancestor.children).find(
        (child) => child instanceof HTMLElement && child.tagName === "SUMMARY",
      );
      if (!(summary instanceof HTMLElement) || !summary.contains(element)) {
        return false;
      }
    }

    const style = window.getComputedStyle(ancestor);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    ancestor = ancestor.parentElement;
  }

  return element.getClientRects().length > 0;
};

export default function RecordDetail({
  company: companySummary,
  logos,
  takeaway,
  dossier,
  compared,
  lightboxOpen,
  onClose,
  onMediaOpen,
  onShare,
  onLocate,
  onCompare,
}: {
  company: Company;
  logos: LogoManifest;
  takeaway?: Takeaway;
  dossier?: Dossier;
  compared: boolean;
  lightboxOpen: boolean;
  onClose: () => void;
  onMediaOpen: (
    media: Media,
    company: Company,
    collection?: Media[],
    source?: "gallery" | "funnel",
  ) => void;
  onShare: () => void;
  onLocate: () => void;
  onCompare: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [companyDetailResult, setCompanyDetailResult] = useState<{
    companyId: string;
    value: { body: string; sources: string[] } | null;
  } | null>(null);
  const companyDetail =
    companyDetailResult?.companyId === companySummary.id
      ? companyDetailResult.value
      : undefined;
  const company = useMemo<Company>(
    () => ({
      ...companySummary,
      body: companyDetail?.body || "",
      sources: companyDetail?.sources || [],
    }),
    [companyDetail, companySummary],
  );
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("record-identity");
  const [fullScroll, setFullScroll] = useState(false);
  const [deepResult, setDeepResult] = useState<{
    companyId: string;
    value: DeepReview | null;
  } | null>(null);
  const [deepV3Result, setDeepV3Result] = useState<{
    companyId: string;
    value: FunnelV3Review | null;
  } | null>(null);
  const deep =
    deepResult?.companyId === company.id ? deepResult.value : undefined;
  const deepV3 =
    deepV3Result?.companyId === company.id ? deepV3Result.value : undefined;
  const [mediaFilter, setMediaFilter] = useState<
    "all" | "image" | "video" | "document"
  >("all");
  const [mediaVisible, setMediaVisible] = useState(24);
  const euro =
    company.price.eur != null
      ? `≈ ${company.price.label}`
      : company.price.label;
  const logo = logos[company.id];
  const excluded =
    company.name.toLocaleLowerCase("es") === "habitissimo"
      ? Math.min(17, Math.max(0, company.mediaDeclared - company.media.length))
      : 0;
  const unavailable = Math.max(
    0,
    company.mediaDeclared - company.media.length - excluded,
  );
  const filteredMedia = useMemo(
    () =>
      company.media.filter(
        (media) => mediaFilter === "all" || mediaKind(media) === mediaFilter,
      ),
    [company.media, mediaFilter],
  );
  const markets = [
    ...new Set(
      [
        company.country,
        company.market,
        ...(company.markets || []),
        ...(company.countries || []),
      ].filter(Boolean),
    ),
  ];
  const setAllDetails = (open: boolean) => {
    contentRef.current?.querySelectorAll("details").forEach((detail) => {
      detail.open = open;
    });
    if (open) setAnalysisOpen(true);
  };
  /** Modo pestañas (por defecto): solo la sección activa está visible. */
  const sectionClass = (id: string) =>
    !fullScroll && activeSection === id ? "section-active" : undefined;
  const goToSection = (id: string) => {
    setActiveSection(id);
    if (id === "record-analysis") setAnalysisOpen(true);
    const section = document.getElementById(id);
    if (section instanceof HTMLDetailsElement) section.open = true;
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState(window.history.state, "", url);
  };

  const navigateToRecordSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    const id = event.currentTarget.hash.slice(1);
    const section = document.getElementById(id);
    if (
      !(section instanceof HTMLDetailsElement) ||
      !contentRef.current?.contains(section)
    ) {
      return;
    }

    if (!fullScroll) {
      goToSection(id);
      window.requestAnimationFrame(() => {
        contentRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      });
      return;
    }

    section.open = true;
    if (id === "record-analysis") setAnalysisOpen(true);
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState(window.history.state, "", url);

    window.requestAnimationFrame(() => {
      const summary = Array.from(section.children).find(
        (child) => child instanceof HTMLElement && child.tagName === "SUMMARY",
      );
      if (!(summary instanceof HTMLElement)) return;
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || !id.startsWith("record-")) return;
    const frame = window.requestAnimationFrame(() => {
      setActiveSection(id);
      if (id === "record-analysis") setAnalysisOpen(true);
      const section = document.getElementById(id);
      if (section instanceof HTMLDetailsElement) {
        section.open = true;
        window.setTimeout(() => section.scrollIntoView({ block: "start" }), 80);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [company.id]);

  useEffect(() => {
    let active = true;
    fetch(`/data/company-details/${company.id}.json`)
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ body: string; sources: string[] }>)
          : null,
      )
      .then(
        (result) =>
          active && setCompanyDetailResult({ companyId: company.id, value: result }),
      )
      .catch(
        () =>
          active && setCompanyDetailResult({ companyId: company.id, value: null }),
      );
    return () => {
      active = false;
    };
  }, [company.id]);

  useEffect(() => {
    let active = true;
    fetch(`/data/deep/records/${company.id}.json`)
      .then((response) =>
        response.ok ? (response.json() as Promise<DeepReview>) : null,
      )
      .then(
        (result) =>
          active && setDeepResult({ companyId: company.id, value: result }),
      )
      .catch(
        () =>
          active && setDeepResult({ companyId: company.id, value: null }),
      );
    return () => {
      active = false;
    };
  }, [company.id]);

  useEffect(() => {
    let active = true;
    fetch(`/data/funnel-v3/records/${company.id}.json`)
      .then((response) =>
        response.ok ? (response.json() as Promise<FunnelV3Review>) : null,
      )
      .then(
        (result) =>
          active && setDeepV3Result({ companyId: company.id, value: result }),
      )
      .catch(
        () =>
          active && setDeepV3Result({ companyId: company.id, value: null }),
      );
    return () => {
      active = false;
    };
  }, [company.id]);

  useEffect(() => {
    const priorFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      if (priorFocus && document.contains(priorFocus)) priorFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (lightboxOpen) return;
    const sheet = contentRef.current?.closest(".record-sheet");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !(sheet instanceof HTMLElement)) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), video[controls], audio[controls], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(isVisibleFocusTarget);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (
        !(activeElement instanceof HTMLElement) ||
        !sheet.contains(activeElement) ||
        !focusable.includes(activeElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, onClose]);

  return (
    <div
      className="record-backdrop"
      role="presentation"
      aria-hidden={lightboxOpen ? true : undefined}
      inert={lightboxOpen ? true : undefined}
      onMouseDown={(event) =>
        !lightboxOpen && event.target === event.currentTarget && onClose()
      }
    >
      <article
        className="record-sheet"
        role="dialog"
        aria-modal={lightboxOpen ? undefined : true}
        aria-label={`Ficha completa de ${company.name}`}
      >
        <button
          ref={closeRef}
          className="record-close"
          onClick={onClose}
          aria-label="Cerrar ficha"
        >
          ×
        </button>
        <header className="record-hero">
          <CompanyLogo company={company} logos={logos} size="large" />
          <div className="record-title">
            <p>
              {company.countries.join(" · ") || company.primaryCountry} ·
              ubicación a nivel territorio
            </p>
            <h2>{company.name}</h2>
            <div className="record-badges">
              <span>{company.score}/100</span>
              <span>{scopeShort[company.scope] || company.scope}</span>
              <span>{value(company.evidence)}</span>
              <span>{value(company.review)}</span>
              {deep && <span>Auditoría comercial · {deep.status}</span>}
            </div>
          </div>
          <div className="record-actions">
            {isPublicHref(company.website) && (
              <a href={company.website} target="_blank" rel="noopener noreferrer">
                Web oficial ↗
              </a>
            )}
            <button onClick={onLocate}>
              {company.location?.precision === "sin_punto"
                ? "Ver contexto territorial"
                : "Ver en mapa 3D"}
            </button>
            <button onClick={onShare}>Copiar enlace</button>
            <button
              className={compared ? "is-compared" : ""}
              aria-pressed={compared}
              onClick={onCompare}
            >
              {compared ? "✓ En comparación" : "Añadir a comparar"}
            </button>
          </div>
        </header>

        <section className="record-kpis">
          <article>
            <span>DECISIÓN RV</span>
            <strong>{value(company.decision)}</strong>
            <small>{value(company.relation)}</small>
          </article>
          <article>
            <span>PRECIO LOCAL</span>
            <strong>{value(company.priceLocal, "No publicado")}</strong>
            <small>{euro}</small>
          </article>
          <article>
            <span>ACTIVIDAD PUBLICITARIA</span>
            <strong>{company.metaAds + company.googleAds} resultados</strong>
            <small>
              Meta {company.metaAds} · Google {company.googleAds}
            </small>
          </article>
          <article>
            <span>EVIDENCIA VISUAL</span>
            <strong>{company.media.length} disponibles</strong>
            <small>
              {company.mediaDeclared} declarados · {company.sources.length}{" "}
              fuentes
            </small>
          </article>
        </section>

        {takeaway && (
          <section className={`record-takeaway copiable-${takeaway.copiable}`}>
            <div className="takeaway-mark">→</div>
            <div>
              <p className="eyebrow">
                QUÉ ME LLEVO · REPLICABILIDAD {takeaway.copiable.toUpperCase()}
              </p>
              <p className="takeaway-text">{takeaway.t}</p>
            </div>
          </section>
        )}

        <div className="record-toolbar">
          <span>Todos los campos de la ficha canónica, sin recortes</span>
          <button
            className={!fullScroll ? "mode-active" : undefined}
            onClick={() => {
              setFullScroll(false);
            }}
          >
            Por secciones
          </button>
          <button
            className={fullScroll ? "mode-active" : undefined}
            onClick={() => {
              setFullScroll(true);
              setAllDetails(true);
            }}
          >
            Todo en una página
          </button>
          {fullScroll && <button onClick={() => setAllDetails(false)}>Contraer todo</button>}
        </div>

        <div className="record-layout">
          <aside className="record-index">
            <p className="eyebrow">FICHA MADRE COMPLETA</p>
            <a href="#record-identity" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-identity" ? "active" : undefined}>
              Identidad
            </a>
            <a href="#record-offer" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-offer" ? "active" : undefined}>
              Oferta
            </a>
            <a href="#record-price" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-price" ? "active" : undefined}>
              Precio y contrato
            </a>
            <a href="#record-acquisition" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-acquisition" ? "active" : undefined}>
              Captación
            </a>
            <a href="#record-forensics-v3" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-forensics-v3" ? "active" : undefined}>
              Auditoría comercial profunda
            </a>
            <a href="#record-forensics" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-forensics" ? "active" : undefined}>
              Trazabilidad previa
            </a>
            <a href="#record-position" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-position" ? "active" : undefined}>
              Lectura RedVitalia
            </a>
            {dossier && (
              <a href="#record-dossier" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-dossier" ? "active" : undefined}>
                Dossier de investigación
              </a>
            )}
            <a href="#record-media" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-media" ? "active" : undefined}>
              Galería
            </a>
            <a href="#record-analysis" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-analysis" ? "active" : undefined}>
              Dossier íntegro
            </a>
            <a href="#record-sources" onClick={navigateToRecordSection} className={!fullScroll && activeSection === "record-sources" ? "active" : undefined}>
              Fuentes
            </a>
            <div className="record-trust">
              <b>{value(company.evidence)}</b>
              <span>Revisión: {company.reviewedAt || "fecha no indicada"}</span>
            </div>
          </aside>

          <div className={`record-content${fullScroll ? "" : " tabbed"}`} ref={contentRef}>
            <details id="record-identity" open className={sectionClass("record-identity")}>
              <summary>
                <span>01</span> Identidad, marca y precisión geográfica
              </summary>
              <div className="record-grid">
                <Field label="Identificador público">{company.id}</Field>
                <Field label="Título original">{value(company.title)}</Field>
                <Field label="Nombre">{company.name}</Field>
                <Field label="Dominio declarado">{value(company.domain)}</Field>
                <Field label="Web oficial">
                  {isPublicHref(company.website) ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      {company.website} ↗
                    </a>
                  ) : (
                    value(company.website)
                  )}
                </Field>
                <Field label="País principal de clasificación">
                  {value(company.primaryCountry)}
                </Field>
                <Field label="Territorio original" wide>
                  {value(company.country)}
                </Field>
                <Field label="Mercados y asociaciones" wide>
                  {markets.length ? markets.join(" · ") : "No documentados"}
                </Field>
                <Field label="Precisión del mapa" wide>
                  {company.location?.locationLabel ||
                    "No existe un punto único verificable; no se inventa una ubicación."}
                  {company.location?.limitation ? (
                    <small className="field-note">{company.location.limitation}</small>
                  ) : null}
                  {isPublicHref(company.location?.sourceUrl) ? (
                    <a
                      href={company.location?.sourceUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver evidencia geográfica ↗
                    </a>
                  ) : null}
                </Field>
                <Field label="Activo de marca" wide>
                  {logo?.file ? (
                    <span className="logo-trace">
                      {logo.status === "official"
                        ? "Logo/wordmark oficial"
                        : logo.status === "platform"
                          ? "Imagen de perfil de plataforma"
                          : "Icono oficial del sitio"}{" "}
                      · confianza {logo.confidence || "media"}
                      {logo.source ? (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={logo.source}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ver origen ↗
                          </a>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    `Monograma RedVitalia de respaldo. Motivo: ${logo?.reason || "no se localizó un activo público verificable"}.`
                  )}
                </Field>
                <Field label="Situación legal" wide>
                  {value(company.legal)}
                </Field>
              </div>
            </details>

            <details id="record-offer" open className={sectionClass("record-offer")}>
              <summary>
                <span>02</span> Oferta, mercado y público
              </summary>
              <div className="record-grid">
                <Field label="Oferta / promesa" wide>
                  {value(company.offer)}
                </Field>
                <Field label="Nicho / público" wide>
                  {value(company.niche)}
                </Field>
                <Field label="Tipo de agencia">
                  {value(company.agencyType)}
                </Field>
                <Field label="Modelo de alcance">
                  {scopeShort[company.scope] || company.scope}
                </Field>
                <Field label="Mercado principal">
                  {value(company.market || company.primaryCountry)}
                </Field>
                <Field label="Mercados estructurados">
                  {company.markets?.length
                    ? company.markets.join(", ")
                    : "No documentados de forma estructurada"}
                </Field>
                <Field label="Tamaño y equipo" wide>
                  {value(company.team)}
                </Field>
                <Field label="Prueba social / evidencia de resultados" wide>
                  {value(company.proof)}
                </Field>
              </div>
            </details>

            <details id="record-price" open className={sectionClass("record-price")}>
              <summary>
                <span>03</span> Precio, contrato y riesgo
              </summary>
              <div className="record-grid">
                <Field label="Precio local íntegro" wide>
                  {value(company.priceLocal, "No publicado")}
                </Field>
                <Field label="Estado del precio">
                  {value(company.priceStatus)}
                </Field>
                <Field label="Equivalencia EUR">{euro}</Field>
                <Field label="Moneda estructurada">
                  {value(
                    company.price.currency,
                    "No convertible: moneda no inequívoca",
                  )}
                </Field>
                <Field label="Importe estructurado">
                  {value(
                    company.price.amount,
                    "No convertible: importe no inequívoco",
                  )}
                </Field>
                <Field label="Importe EUR orientativo">
                  {value(
                    company.price.eur,
                    "No calculable sin moneda e importe inequívocos",
                  )}
                </Field>
                <Field label="Etiqueta normalizada">
                  {value(company.price.label)}
                </Field>
                <Field label="Ticket / economía" wide>
                  {value(company.ticket)}
                </Field>
                <Field label="Permanencia / contrato" wide>
                  {value(company.contract)}
                </Field>
                <Field label="Garantía / riesgo invertido" wide>
                  {value(company.guarantee)}
                </Field>
              </div>
            </details>

            <details id="record-acquisition" open className={sectionClass("record-acquisition")}>
              <summary>
                <span>04</span> Captación, canales, campañas y funnel
              </summary>
              <div className="record-grid">
                <Field label="CTA / conversión" wide>
                  {value(company.cta)}
                </Field>
                <Field label="Funnel verificado" wide>
                  {value(company.funnel)}
                </Field>
                <Field label="Canales" wide>
                  <div className="record-badges light">
                    {company.channels.length
                      ? company.channels.map((channel) => (
                          <span key={channel}>{channel}</span>
                        ))
                      : "No documentados públicamente"}
                  </div>
                </Field>
                <Field label="Meta Ads">
                  {value(company.metaStatus)} · {company.metaAds} resultados
                  archivados
                </Field>
                <Field label="Google Ads">
                  {value(company.googleStatus)} · {company.googleAds} resultados
                  archivados
                </Field>
                <Field label="Archivo creativo declarado">
                  {company.creativeArchive}
                </Field>
                <Field label="Materiales declarados">
                  {company.mediaDeclared}
                </Field>
              </div>
            </details>

            <details id="record-forensics-v3" open className={sectionClass("record-forensics-v3")}>
              <summary>
                <span>05</span> Auditoría comercial profunda · funnel, voz, formularios
                y economía
              </summary>
              {deepV3 === undefined ? (
                <div className="deep-loading" role="status">
                  Cargando la auditoría comercial profunda…
                </div>
              ) : deepV3 === null ? (
                <p className="record-empty">
                  La ampliación profunda de esta ficha aún no está publicada. Se
                  mantiene visible la capa anterior, sin presentar el pendiente
                  como trabajo terminado.
                </p>
              ) : (
                <FunnelV3Panel
                  review={deepV3}
                  company={company}
                  onMediaOpen={onMediaOpen}
                />
              )}
            </details>

            <details id="record-forensics" open className={sectionClass("record-forensics")}>
              <summary>
                <span>06</span> Trazabilidad previa conservada
              </summary>
              {deep === undefined ? (
                <div className="deep-loading" role="status">
                  Cargando la investigación comercial anterior…
                </div>
              ) : deep === null ? (
                <p className="record-empty">
                  Esta capa todavía no está publicada para la ficha. La ausencia
                  se muestra de forma explícita y no se sustituye por una
                  inferencia.
                </p>
              ) : (
                <div className="deep-review">
                  <div className="deep-overview">
                    <article>
                      <span>ESTADO DEL ANÁLISIS</span>
                      <strong>{value(deep.status)}</strong>
                      <small>
                        Confianza {deep.confidence.toLowerCase()} · método{" "}
                        {deep.reviewMethod === "manual" ? "manual" : "estructurado"}
                      </small>
                    </article>
                    <article>
                      <span>COBERTURA OBSERVABLE</span>
                      <strong>{deep.coveragePercent}%</strong>
                      <small>
                        Lo no visible queda explicado, nunca rellenado
                      </small>
                    </article>
                    <article>
                      <span>CAPTURA PRINCIPAL</span>
                      <strong>{value(deep.conversion.captureType)}</strong>
                      <small>
                        {deep.conversion.formAnalysis.minFields
                          ? `${deep.conversion.formAnalysis.minFields}–${deep.conversion.formAnalysis.maxFields} campos visibles`
                          : "Sin campos medibles"}
                      </small>
                    </article>
                    <article>
                      <span>EVIDENCIAS</span>
                      <strong>{new Set([
                        ...deep.evidence.map((source) => source.url),
                        ...(deep.manual?.sources.map((source) => source.url) || []),
                      ]).size}</strong>
                      <small>
                        URLs públicas trazables
                        {deep.archivedEvidenceCount
                          ? ` · ${deep.archivedEvidenceCount} activos temporales retirados del enlace público`
                          : ""}
                      </small>
                    </article>
                  </div>

                  <div className="deep-integrity-note">
                    <b>Lectura de integridad:</b>{" "}
                    {deep.researchReadiness === "usable"
                      ? "investigación pública utilizable"
                      : deep.researchReadiness === "partial"
                        ? "investigación pública parcial"
                        : deep.researchReadiness === "manual_only"
                          ? "revisión manual disponible; cobertura automática insuficiente"
                          : deep.researchReadiness === "not_applicable"
                            ? "registro fuera del alcance comercial"
                            : "sin cobertura web observable suficiente"}
                    {deep.schemaValid
                      ? " · esquema validado."
                      : " · esquema pendiente de validación."}
                  </div>

                  {deep.manual ? (
                    <section className="manual-review-panel">
                      <div className="manual-review-head">
                        <div>
                          <p className="eyebrow">REVISIÓN MANUAL PRIORITARIA</p>
                          <h4>{value(deep.manual.reviewLabel)} · {value(deep.manual.reviewedAt)}</h4>
                        </div>
                        <span>Sin formularios enviados ni contacto</span>
                      </div>
                      <blockquote>
                        {value(
                          deep.manual.message.headline || deep.manual.message.promise,
                          "Mensaje no observable",
                        )}
                      </blockquote>
                      <div className="manual-review-grid">
                        <article>
                          <span>PROMESA Y POSICIONAMIENTO</span>
                          <p>{value(deep.manual.message.promise, "No observable")}</p>
                          <p>{value(deep.manual.message.positioning, "Sin posicionamiento adicional")}</p>
                          <p>
                            <b>Público:</b>{" "}
                            {value(deep.manual.message.audience, "No observable")}
                          </p>
                          <div className="record-badges light">
                            {deep.manual.message.voice.map((voice, index) => (
                              <span key={`${value(voice)}-${index}`}>{value(voice)}</span>
                            ))}
                          </div>
                          <FullList
                            items={deep.manual.message.patterns}
                            empty="Sin patrones verbales adicionales documentados"
                          />
                        </article>
                        <article>
                          <span>CTA Y CAPTURA</span>
                          <h5>{value(deep.manual.cta.primary, "CTA no observable")}</h5>
                          <FullList
                            items={deep.manual.cta.secondary}
                            empty="Sin CTA secundario observado"
                          />
                          {deep.manual.cta.forms.map((form, index) => (
                            <div className="deep-form-card" key={`${form.url}-${index}`}>
                              <h5>
                                <PublicLink href={form.url}>
                                  Formulario {index + 1}
                                </PublicLink>
                              </h5>
                              <p>
                                 {value(form.purpose, "Propósito no documentado")} ·{" "}
                                {form.fieldCount ?? "?"} campos ·{" "}
                                 {value(form.friction, "fricción no medible")}
                              </p>
                              <FullList
                                items={form.fields}
                                empty="Campos exactos no observables"
                              />
                              <small>No enviado durante la investigación.</small>
                            </div>
                          ))}
                        </article>
                      </div>
                      {deep.manual.funnel.length ? (
                        <div className="manual-funnel">
                          {deep.manual.funnel.map((stage, index) => (
                            <article key={`${stage.stage}-${index}`}>
                              <b>{String(index + 1).padStart(2, "0")}</b>
                              <div>
                                <h5>{value(stage.stage)}</h5>
                                <span>{value(stage.status)}</span>
                                <p>{value(stage.detail, "Sin detalle público adicional")}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                      <div className="manual-review-grid">
                        <article>
                          <span>PRECIOS, CONTRATO Y GARANTÍA</span>
                          <FullList
                            items={[
                              ...deep.manual.terms.pricing,
                              ...deep.manual.terms.contract,
                              ...deep.manual.terms.guarantee,
                            ]}
                          />
                        </article>
                        <article className="manual-contradictions">
                          <span>CONTRADICCIONES Y LÍMITES</span>
                          <FullList
                            items={[
                              ...deep.manual.contradictions,
                              ...deep.manual.limitations,
                            ]}
                          />
                        </article>
                      </div>
                      <div className="manual-review-grid">
                        <article>
                          <span>DECISIONES REDVITALIA</span>
                          <FullList
                            items={[
                              ...deep.manual.lessons.copy,
                              ...deep.manual.lessons.adapt,
                              ...deep.manual.lessons.avoid,
                              ...deep.manual.lessons.test,
                            ]}
                          />
                        </article>
                        <article>
                          <span>FUENTES MANUALES EXACTAS</span>
                          <div className="deep-sources">
                            {deep.manual.sources.map((source) => (
                              <PublicLink key={source.url} href={source.url}>
                                {source.label} · {source.status}
                              </PublicLink>
                            ))}
                          </div>
                        </article>
                      </div>
                      <div className="manual-review-grid">
                        <article>
                          <span>PRUEBA Y OBJECIONES</span>
                          <FullList
                            items={[
                              ...deep.manual.proof,
                              ...deep.manual.objections,
                            ]}
                          />
                        </article>
                        <article>
                          <span>TECNOLOGÍA, INFERENCIAS Y NO OBSERVABLE</span>
                          <FullList
                            items={[
                              ...deep.manual.technology,
                              ...deep.manual.inferences,
                              ...deep.manual.notObservable,
                            ]}
                          />
                        </article>
                      </div>
                    </section>
                  ) : null}

                  <section className="deep-message">
                    <p className="eyebrow">CÓMO SE POSICIONA Y CÓMO HABLA</p>
                    <blockquote>{value(deep.message.hero)}</blockquote>
                    <div className="deep-message-copy">
                      <p>
                        <b>Origen del titular:</b>{" "}
                        {deep.message.heroObserved === false
                          ? "síntesis separada; no observado como hero actual"
                          : "contenido público observado o síntesis trazable"}
                        .
                      </p>
                      <p>{value(deep.message.voice)}</p>
                    </div>
                    <details className="deep-subdetails">
                      <summary>
                        Titulares secundarios ({deep.message.supportingHeadings.length})
                      </summary>
                      <FullList
                        items={deep.message.supportingHeadings}
                        empty="No se recuperaron titulares secundarios"
                      />
                    </details>
                    {deep.message.priorSummary ? (
                      <details className="deep-subdetails">
                        <summary>Síntesis canónica anterior</summary>
                        <p>{value(deep.message.priorSummary)}</p>
                      </details>
                    ) : null}
                  </section>

                  <section className="deep-two-columns">
                    <article className="deep-block">
                      <p className="eyebrow">OFERTA Y PÚBLICO</p>
                      <h4>Qué vende y para quién</h4>
                      <p>
                        <b>Resumen:</b>{" "}
                        {value(deep.offer.existingSummary)}
                      </p>
                      <p>
                        <b>Público:</b>{" "}
                        {value(deep.offer.audience)}
                      </p>
                    </article>
                    <article className="deep-block">
                      <p className="eyebrow">PRECIOS OBSERVADOS</p>
                      <h4>Importes y condiciones visibles</h4>
                      <FullList
                        items={deep.offer.prices}
                        empty="No se recuperó un precio público inequívoco"
                      />
                    </article>
                  </section>

                  <section className="deep-block">
                    <div className="deep-block-title">
                      <div>
                        <p className="eyebrow">RECORRIDO DE VENTA</p>
                        <h4>Qué ocurre y qué solo podemos inferir</h4>
                      </div>
                      <span className="deep-route">{value(deep.route)}</span>
                    </div>
                    <div className="deep-funnel">
                      {deep.funnel.map((stage, index) => (
                        <article key={`${stage.stage}-${index}`}>
                          <div className={`deep-stage-state ${stage.status.replaceAll(" ", "-")}`}>
                            {stage.status === "observado"
                              ? "✓"
                              : stage.status === "inferido"
                                ? "≈"
                                : "·"}
                          </div>
                          <div>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <h5>{value(stage.stage)}</h5>
                            <b>{value(stage.status)}</b>
                            {stage.evidence?.length ? (
                              <FullList items={stage.evidence} />
                            ) : (
                              <p>{value(stage.note, "Sin evidencia pública adicional.")}</p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="deep-two-columns">
                    <article className="deep-block">
                      <p className="eyebrow">INTERFAZ DE CONVERSIÓN</p>
                      <h4>
                        {value(deep.conversion.primaryCta, "CTA no observable")}
                      </h4>
                      <p>{value(deep.conversion.formAnalysis.text)}</p>
                      <p>
                        <b>Fricción:</b>{" "}
                        {value(deep.conversion.formAnalysis.friction, "No medible")}
                      </p>
                      <p>
                        <b>Cualificación visible:</b>{" "}
                        {deep.conversion.formAnalysis.qualification.join(" · ") ||
                          "No observable"}
                      </p>
                      {deep.conversion.primaryCtaEvidence ? (
                        <p>
                          <b>Evidencia del CTA:</b>{" "}
                          {value(deep.conversion.primaryCtaEvidence)}
                        </p>
                      ) : null}
                      <div className="record-badges light">
                        {deep.conversion.ctas.map((cta, index) => (
                          <span key={`${value(cta)}-${index}`}>{value(cta)}</span>
                        ))}
                      </div>
                      {deep.conversion.forms.length ? (
                        <div className="deep-forms">
                          {deep.conversion.forms.map((form, index) => (
                            <article key={`${form.pageUrl}-${index}`}>
                              <PublicLink href={form.pageUrl}>
                                Formulario {index + 1}
                              </PublicLink>
                              <b>
                                {form.visibleFieldCount} campos · {form.requiredFieldCount}{" "}
                                obligatorios
                              </b>
                              <p>
                                {form.kind || "tipo no clasificado"} · método{" "}
                                {form.method || "no medible"} · acción{" "}
                                {form.action || "no visible"}
                              </p>
                              <p>
                                Botón: {form.submitText || "texto no recuperado"} ·{" "}
                                {form.hiddenFieldCount} campos ocultos
                              </p>
                              <p>
                                {form.fields
                                  .map(
                                    (field) =>
                                      `${field.label || field.name || field.placeholder || field.type}${field.required ? " (obligatorio)" : ""}`,
                                  )
                                  .join(" · ")}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </article>

                    <article className="deep-block">
                      <p className="eyebrow">TECNOLOGÍA Y CANALES</p>
                      <h4>Stack públicamente detectable</h4>
                      <div className="record-badges light">
                        {deep.conversion.technologies.length
                          ? deep.conversion.technologies.map((technology, index) => (
                              <span key={`${value(technology)}-${index}`}>
                                {value(technology)}
                              </span>
                            ))
                          : "No detectado: no significa que no exista"}
                      </div>
                      <p>
                        Contactos visibles:{" "}
                        {deep.conversion.contacts.map(scalarText).filter(Boolean).join(" · ") ||
                          "ninguno recuperable"}.
                        Agenda {deep.conversion.bookingObserved ? "observada" : "no observada"};
                        checkout {deep.conversion.checkoutObserved ? "observado" : "no observado"}.
                      </p>
                    </article>
                  </section>

                  <section className="deep-two-columns">
                    <article className="deep-block">
                      <p className="eyebrow">PERSUASIÓN</p>
                      <h4>Prueba, objeciones, garantía y urgencia</h4>
                      {[
                        ...deep.offer.proof,
                        ...deep.offer.objections,
                        ...deep.offer.guarantee,
                        ...deep.offer.urgency,
                      ]
                        .map((item, index) => (
                          <p className="deep-evidence-line" key={`${item}-${index}`}>
                            {value(item)}
                          </p>
                        ))}
                    </article>
                    <article className="deep-block deep-rv">
                      <p className="eyebrow">APLICACIÓN REDVITALIA</p>
                      <h4>Qué copiar, adaptar, probar o evitar</h4>
                      {deep.redVitalia.length ? (
                        <CompleteAnalysis
                          text={deep.redVitalia
                            .map((item) => `- ${value(item)}`)
                            .join("\n")}
                        />
                      ) : (
                        <p className="record-empty">
                          No hay recomendaciones estratégicas fiables: la
                          evidencia observable es insuficiente. Se mantiene la
                          ficha para trazabilidad, no para copiar decisiones.
                        </p>
                      )}
                    </article>
                  </section>

                  {deep.offer.evidence ? (
                    <section className="deep-block">
                      <p className="eyebrow">EVIDENCIA TEXTUAL DETALLADA</p>
                      <h4>
                        Precio, prueba, objeciones, garantías y descargos
                      </h4>
                      {Object.entries(deep.offer.evidence).map(
                        ([kind, entries]) => (
                          <details className="deep-subdetails" key={kind}>
                            <summary>
                              {kind} ({entries?.length || 0})
                            </summary>
                            {(entries || []).length ? (
                              (entries || []).map((entry, index) => (
                                <div
                                  className="deep-evidence-card"
                                  key={`${kind}-${entry.url || ""}-${index}`}
                                >
                                  <p>{value(entry.text)}</p>
                                  <small>
                                    {[
                                      entry.pageTitle,
                                      entry.pageCategory,
                                      entry.polarity,
                                      entry.guaranteeType,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </small>
                                  {entry.url ? (
                                    <PublicLink href={entry.url}>
                                      Abrir evidencia
                                    </PublicLink>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <p className="record-empty compact">
                                Sin evidencia textual adicional en esta
                                categoría.
                              </p>
                            )}
                          </details>
                        ),
                      )}
                    </section>
                  ) : null}

                  <section className="deep-two-columns">
                    <article className="deep-block">
                      <p className="eyebrow">FUENTES DEL ANÁLISIS COMERCIAL</p>
                      <div className="deep-sources">
                        {deep.evidence.map((source) => (
                          <PublicLink key={source.url} href={source.url}>
                            {value(source.label, "Fuente pública")}
                          </PublicLink>
                        ))}
                      </div>
                      {deep.archivedEvidenceNote ? (
                        <p className="record-empty compact">
                          {deep.archivedEvidenceNote}
                        </p>
                      ) : null}
                    </article>
                    <article className="deep-block deep-limitations">
                      <p className="eyebrow">LÍMITES EXPLÍCITOS</p>
                      {deep.limitations.map((limitation, index) => (
                        <p key={`${value(limitation)}-${index}`}>{value(limitation)}</p>
                      ))}
                    </article>
                  </section>
                </div>
              )}
            </details>

            <details id="record-position" open className={sectionClass("record-position")}>
              <summary>
                <span>06</span> Lectura estratégica RedVitalia
              </summary>
              <div className="record-grid">
                <Field label="Decisión">{value(company.decision)}</Field>
                <Field label="Relación">{value(company.relation)}</Field>
                <Field label="Amenaza">{value(company.threat)}</Field>
                <Field label="Puntuación estratégica">
                  {company.score}/100
                </Field>
                <Field label="Nivel de evidencia">
                  {value(company.evidence)}
                </Field>
                <Field label="Estado de revisión">
                  {value(company.review)}
                </Field>
                <Field label="Fecha de revisión">
                  {value(company.reviewedAt, "No indicada en el origen")}
                </Field>
                <Field label="Alcance canónico">{value(company.scope)}</Field>
              </div>
            </details>

            {dossier && (
              <details id="record-dossier" open className={sectionClass("record-dossier")}>
                <summary>
                  <span>D</span> Dossier de investigación · web pública {dossier.checkedAt}
                </summary>
                <div className="dossier-body">
                  <p className="dossier-resumen">{dossier.resumen}</p>
                  <div className="record-grid">
                    <Field label="Equipo y tamaño (con fuente)" wide>
                      {dossier.equipo || "No observable"}
                    </Field>
                    {dossier.hitos.length > 0 && (
                      <Field label="Hitos públicos" wide>
                        <div className="deep-full-list">
                          {dossier.hitos.map((hito, index) => (
                            <p key={index}>{hito}</p>
                          ))}
                        </div>
                      </Field>
                    )}
                    <Field label="Stack visible en su web" wide>
                      {dossier.stack.length ? (
                        <div className="record-badges light">
                          {dossier.stack.map((tool) => (
                            <span key={tool}>{tool}</span>
                          ))}
                        </div>
                      ) : (
                        "No detectado (no significa que no exista)"
                      )}
                    </Field>
                    <Field label="Economía unitaria · Estimado, cálculo a la vista" wide>
                      <b>Supuesto:</b> {dossier.economics.supuesto}
                      {"\n"}
                      <b>Cálculo:</b> {dossier.economics.calculo}
                      {"\n"}
                      <b>Lectura:</b> {dossier.economics.lectura}
                    </Field>
                    <Field label="Fuentes del dossier" wide>
                      <div className="deep-sources">
                        {dossier.fuentes.map((fuente) => (
                          <PublicLink key={fuente.url} href={fuente.url}>
                            {fuente.label}
                          </PublicLink>
                        ))}
                      </div>
                    </Field>
                    <Field label="Confianza de la investigación">
                      {dossier.confianza}
                    </Field>
                  </div>
                </div>
              </details>
            )}

            <details id="record-media" open className={sectionClass("record-media")}>
              <summary>
                <span>07</span> Galería dentro de la ficha madre (
                {company.media.length})
              </summary>
              <div className="media-audit-strip">
                <span>
                  <b>{company.mediaDeclared}</b> declarados
                </span>
                <span>
                  <b>{company.media.length}</b> disponibles
                </span>
                <span>
                  <b>{unavailable}</b> no recuperables
                </span>
                <span>
                  <b>{excluded}</b> rastros técnicos excluidos
                </span>
              </div>
              {company.media.length ? (
                <>
                  <div className="record-media-filters">
                    {(
                      [
                        ["all", "Todo"],
                        ["image", "Imágenes"],
                        ["video", "Vídeos"],
                        ["document", "Documentos"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        className={mediaFilter === id ? "active" : ""}
                        onClick={() => {
                          setMediaFilter(id);
                          setMediaVisible(24);
                        }}
                      >
                        {label} ·{" "}
                        {id === "all"
                          ? company.media.length
                          : company.media.filter(
                              (media) => mediaKind(media) === id,
                            ).length}
                      </button>
                    ))}
                  </div>
                  <div className="record-media-grid">
                    {filteredMedia.slice(0, mediaVisible).map((item) => (
                      <DetailMedia
                        key={item.file}
                        item={item}
                        name={company.name}
                        onOpen={() => onMediaOpen(item, company)}
                      />
                    ))}
                  </div>
                  {mediaVisible < filteredMedia.length && (
                    <button
                      className="record-load-more"
                      onClick={() => setMediaVisible((current) => current + 24)}
                    >
                      Mostrar 24 materiales más
                    </button>
                  )}
                </>
              ) : (
                <p className="record-empty">
                  No existe una evidencia visual pública recuperable para esta
                  ficha. Si hubo materiales declarados, el contador anterior
                  explica su estado.
                </p>
              )}
            </details>

            <details
              id="record-analysis"
              className={sectionClass("record-analysis")}
              onToggle={(event) => setAnalysisOpen(event.currentTarget.open)}
            >
              <summary>
                <span>08</span> Dossier canónico íntegro
                {companyDetail === undefined
                  ? " (cargando…)"
                  : ` (${company.body.length.toLocaleString("es-ES")} caracteres)`}
              </summary>
              {analysisOpen ? (
                companyDetail === undefined ? (
                  <p className="record-empty" role="status">
                    Cargando el dossier completo de esta empresa…
                  </p>
                ) : company.body ? (
                  <CompleteAnalysis text={company.body} />
                ) : (
                  <p className="record-empty">
                    No hay texto analítico adicional.
                  </p>
                )
              ) : (
                <button
                  className="analysis-load"
                  onClick={() => setAnalysisOpen(true)}
                >
                  Cargar texto íntegro, tablas y enlaces
                </button>
              )}
            </details>

            <details id="record-sources" open className={sectionClass("record-sources")}>
              <summary>
                <span>09</span> Todas las fuentes públicas
                {companyDetail === undefined ? " (cargando…)" : ` (${company.sources.length})`}
              </summary>
              {companyDetail === undefined ? (
                <p className="record-empty" role="status">
                  Cargando las fuentes públicas de la ficha…
                </p>
              ) : company.sources.length ? (
                <div className="record-sources">
                  {company.sources.map((source, index) =>
                    isPublicHref(source) ? (
                      <a
                        key={`${source}-${index}`}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <b>{index + 1}</b>
                        <span>{source}</span>↗
                      </a>
                    ) : (
                      <div
                        className="source-blocked"
                        key={`${source}-${index}`}
                      >
                        <b>{index + 1}</b>
                        <span>
                          Referencia interna omitida de la versión compartible
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="record-empty">
                  No hay una URL pública independiente conservada.
                </p>
              )}
            </details>
          </div>
        </div>
      </article>
    </div>
  );
}
