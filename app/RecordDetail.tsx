"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import CompanyLogo from "./CompanyLogo";
import type { Company, LogoManifest, Media } from "./data-types";

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

const value = (
  input: string | number | null | undefined,
  fallback = "No documentado públicamente",
) =>
  input === null || input === undefined || input === ""
    ? fallback
    : String(input);
const isPublicHref = (input?: string) => {
  if (!input) return false;
  try {
    const url = new URL(input);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !/(^|\.)notion\.(?:so|site)$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
};

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
              <a href={href} target="_blank" rel="noreferrer">
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
        rel="noreferrer"
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
      className="media-tile"
      onClick={onOpen}
      aria-label={`Ampliar evidencia de ${name}`}
    >
      <img
        src={item.file}
        alt={`Evidencia de ${name}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

const mediaKind = (media: Media) =>
  media.type.includes("pdf") || /\.pdf$/i.test(media.file)
    ? "document"
    : media.type.includes("video") || /\.(mp4|webm|mov)$/i.test(media.file)
      ? "video"
      : "image";

export default function RecordDetail({
  company,
  logos,
  compared,
  onClose,
  onMediaOpen,
  onShare,
  onLocate,
  onCompare,
}: {
  company: Company;
  logos: LogoManifest;
  compared: boolean;
  onClose: () => void;
  onMediaOpen: (media: Media, company: Company) => void;
  onShare: () => void;
  onLocate: () => void;
  onCompare: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
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

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const section = document.getElementById(id);
    if (section instanceof HTMLDetailsElement) {
      section.open = true;
      window.setTimeout(() => section.scrollIntoView({ block: "start" }), 80);
    }
  }, [company.id]);

  return (
    <div
      className="record-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <article
        className="record-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha completa de ${company.name}`}
      >
        <button
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
            </div>
          </div>
          <div className="record-actions">
            {isPublicHref(company.website) && (
              <a href={company.website} target="_blank" rel="noreferrer">
                Web oficial ↗
              </a>
            )}
            <button onClick={onLocate}>Ver en mapa 3D</button>
            <button onClick={onShare}>Copiar enlace</button>
            <button
              className={compared ? "is-compared" : ""}
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

        <div className="record-toolbar">
          <span>Todos los campos de la ficha canónica, sin recortes</span>
          <button onClick={() => setAllDetails(true)}>Expandir todo</button>
          <button onClick={() => setAllDetails(false)}>Contraer todo</button>
        </div>

        <div className="record-layout">
          <aside className="record-index">
            <p className="eyebrow">FICHA MADRE COMPLETA</p>
            <a href="#record-identity">Identidad</a>
            <a href="#record-offer">Oferta</a>
            <a href="#record-price">Precio y contrato</a>
            <a href="#record-acquisition">Captación</a>
            <a href="#record-position">Lectura RedVitalia</a>
            <a href="#record-media">Galería</a>
            <a href="#record-analysis">Dossier íntegro</a>
            <a href="#record-sources">Fuentes</a>
            <div className="record-trust">
              <b>{value(company.evidence)}</b>
              <span>Revisión: {company.reviewedAt || "fecha no indicada"}</span>
            </div>
          </aside>

          <div className="record-content" ref={contentRef}>
            <details id="record-identity" open>
              <summary>
                <span>01</span> Identidad, marca y precisión geográfica
              </summary>
              <div className="record-grid">
                <Field label="Identificador canónico">{company.id}</Field>
                <Field label="Título original">{value(company.title)}</Field>
                <Field label="Nombre">{company.name}</Field>
                <Field label="Dominio declarado">{value(company.domain)}</Field>
                <Field label="Web oficial">
                  {isPublicHref(company.website) ? (
                    <a href={company.website} target="_blank" rel="noreferrer">
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
                  Centroide del país o territorio asociado. El dataset no
                  contiene ciudad, dirección ni coordenadas de sede verificadas;
                  por ello no se presenta el punto como ubicación empresarial
                  exacta.
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
                            rel="noreferrer"
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

            <details id="record-offer" open>
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

            <details id="record-price" open>
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

            <details id="record-acquisition" open>
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

            <details id="record-position" open>
              <summary>
                <span>05</span> Lectura estratégica RedVitalia
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

            <details id="record-media" open>
              <summary>
                <span>06</span> Galería dentro de la ficha madre (
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
              onToggle={(event) => setAnalysisOpen(event.currentTarget.open)}
            >
              <summary>
                <span>07</span> Dossier canónico íntegro (
                {company.body.length.toLocaleString("es-ES")} caracteres)
              </summary>
              {analysisOpen ? (
                company.body ? (
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

            <details id="record-sources" open>
              <summary>
                <span>08</span> Todas las fuentes públicas (
                {company.sources.length})
              </summary>
              {company.sources.length ? (
                <div className="record-sources">
                  {company.sources.map((source, index) =>
                    isPublicHref(source) ? (
                      <a
                        key={`${source}-${index}`}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
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
