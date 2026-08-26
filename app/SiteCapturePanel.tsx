"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { DeepReview, FunnelV3Review, Media, Company } from "./data-types";
import styles from "./SiteCapturePanel.module.css";

export type SiteCaptureAsset = {
  file: string;
  type?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  sha256?: string | null;
};

export type SiteCommercialRead = {
  headline?: string | null;
  promise?: string | null;
  audience?: string | null;
  offer?: string | null;
  mechanism?: string[] | null;
  primaryCta?: string | null;
  proof?: string | null;
  price?: string | null;
  guarantee?: string | null;
  funnel?: string[] | null;
};

export type SiteCapturePage = {
  id: string;
  role?: string | null;
  label?: string | null;
  requestedUrl?: string | null;
  finalUrl?: string | null;
  title?: string | null;
  status?: string | null;
  capturedAt?: string | null;
  fullPage?: boolean | null;
  image?: SiteCaptureAsset | null;
  thumbnail?: SiteCaptureAsset | null;
  text?: {
    language?: string | null;
    h1?: string | null;
    headings?: string[] | null;
    ctas?: string[] | null;
  } | null;
  issue?: string | null;
};

export type SiteCaptureRecord = {
  schemaVersion?: "site-captures-v1" | string | null;
  id?: string | null;
  name?: string | null;
  primaryCountry?: string | null;
  markets?: string[] | null;
  website?: string | null;
  status?: string | null;
  coverage?: {
    planned?: number | null;
    captured?: number | null;
    failed?: number | null;
  } | null;
  language?: {
    original?: string | null;
    translationStatus?: string | null;
  } | null;
  commercialRead?: SiteCommercialRead | null;
  translation?: {
    sourceLanguage?: string | null;
    status?: string | null;
    spanish?: Partial<SiteCommercialRead> | null;
  } | null;
  pages?: SiteCapturePage[] | null;
};

export type SiteCapturePanelProps = {
  company: Company;
  review?: FunnelV3Review | DeepReview | null;
  captureRecord?: SiteCaptureRecord | null;
  onMediaOpen: (
    media: Media,
    company: Company,
    collection?: Media[],
    source?: "gallery" | "funnel",
  ) => void;
};

type SummaryKey = Exclude<keyof SiteCommercialRead, "funnel">;

const SUMMARY_FIELDS: Array<{
  key: SummaryKey;
  label: string;
  eyebrow: string;
  wide?: boolean;
}> = [
  { key: "headline", label: "Titular", eyebrow: "01", wide: true },
  { key: "promise", label: "Promesa", eyebrow: "02", wide: true },
  { key: "audience", label: "A quién se dirige", eyebrow: "03" },
  { key: "offer", label: "Qué ofrece", eyebrow: "04" },
  {
    key: "mechanism",
    label: "Cómo dice que funciona",
    eyebrow: "05",
    wide: true,
  },
  { key: "primaryCta", label: "Acción que pide", eyebrow: "06" },
  { key: "proof", label: "Prueba y confianza", eyebrow: "07" },
  { key: "price", label: "Precio", eyebrow: "08" },
  { key: "guarantee", label: "Garantía", eyebrow: "09" },
];

const clean = (input: unknown): string =>
  typeof input === "string" || typeof input === "number"
    ? String(input).replace(/\s+/g, " ").trim()
    : "";

const cleanList = (input: unknown): string[] => {
  if (Array.isArray(input))
    return [...new Set(input.map(clean).filter(Boolean))];
  const single = clean(input);
  return single ? [single] : [];
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
};

const objectText = (value: unknown, preferred: string[] = []): string => {
  if (typeof value === "string" || typeof value === "number")
    return clean(value);
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value))
    return value
      .map((item) => objectText(item, preferred))
      .filter(Boolean)
      .join(" · ");
  const row = value as Record<string, unknown>;
  for (const key of [
    ...preferred,
    "text",
    "label",
    "title",
    "headline",
    "promise",
    "detail",
    "summary",
    "value",
  ]) {
    const result = objectText(row[key]);
    if (result) return result;
  }
  return "";
};

const normalizeCode = (value?: string | null) =>
  clean(value).toLowerCase().split(/[-_]/)[0];

const languageName = (value?: string | null) => {
  const code = normalizeCode(value);
  const labels: Record<string, string> = {
    es: "Español",
    fr: "Francés",
    en: "Inglés",
    ca: "Catalán",
    eu: "Euskera",
    gl: "Gallego",
  };
  return labels[code] || clean(value) || "No identificado";
};

const statusLabel = (value?: string | null) => {
  const normalized = clean(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  if (!normalized) return "Estado no indicado";
  if (normalized === "not needed") return "No necesita traducción";
  if (normalized === "existing spanish summary")
    return "Resumen revisado en español";
  if (normalized === "not available") return "Traducción no disponible";
  if (/complete|completed|captured|success|ok|ready|verific/.test(normalized))
    return "Capturada";
  if (/partial|limit|incomplete/.test(normalized)) return "Cobertura parcial";
  if (/fail|error|blocked|unavailable/.test(normalized)) return "No disponible";
  if (/pending|queued|progress/.test(normalized)) return "Pendiente";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const statusTone = (value?: string | null) => {
  const normalized = clean(value).toLowerCase();
  if (/complete|completed|captured|success|ok|ready|verific/.test(normalized))
    return "success";
  if (/fail|error|blocked|unavailable/.test(normalized)) return "danger";
  if (/partial|limit|incomplete|pending|queued|progress/.test(normalized))
    return "warning";
  return "neutral";
};

const publicUrl = (input?: string | null): string | null => {
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (
      /(^|\.)(?:localhost|local|internal|notion\.com|notion\.so|notion\.site)$/.test(
        host,
      )
    )
      return null;
    if (
      /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        host,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
};

const formatBytes = (bytes?: number | null) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1_000_000)
    return `${(size / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(size / 1_000)).toLocaleString("es-ES")} kB`;
};

const formatDate = (date?: string | null) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return clean(date);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

function extractReviewRead(
  review?: FunnelV3Review | DeepReview | null,
): SiteCommercialRead {
  if (!review) return {};
  if ("messageArchitecture" in review) {
    const message = review.messageArchitecture || {};
    const cta = review.ctaLadder || {};
    const price = review.offerEconomics || {};
    return {
      headline: objectText(message.headline, ["statement"]),
      promise: objectText(message.promise, ["statement"]),
      audience: objectText(message.audience, ["statement"]),
      mechanism: cleanList(objectText(message.mechanism, ["statement"])),
      primaryCta: objectText(cta.primary, ["text", "cta", "label"]),
      proof: objectText(review.proofAndTrust, [
        "summary",
        "statement",
        "proof",
      ]),
      price: objectText(price, ["price", "summary", "statement"]),
      guarantee: objectText(price, ["guarantee", "riskReversal"]),
      funnel: (review.funnel || [])
        .map((stage) => firstText(stage.detail, stage.stage))
        .filter(Boolean),
    };
  }
  return {
    headline: firstText(review.manual?.message.headline, review.message.hero),
    promise: firstText(
      review.manual?.message.promise,
      review.offer.existingSummary,
    ),
    audience: firstText(review.manual?.message.audience, review.offer.audience),
    primaryCta: firstText(
      review.manual?.cta.primary,
      review.conversion.primaryCta,
    ),
    proof: firstText(
      ...(review.manual?.proof || []),
      ...(review.offer.proof || []),
    ),
    price: firstText(
      ...(review.manual?.terms.pricing || []),
      ...(review.offer.prices || []),
    ),
    guarantee: firstText(
      ...(review.manual?.terms.guarantee || []),
      ...(review.offer.guarantee || []),
    ),
    funnel: (review.funnel || [])
      .map((stage) => firstText(stage.note, stage.stage))
      .filter(Boolean),
  };
}

function fallbackRead(company: Company): SiteCommercialRead {
  return {
    headline: firstText(company.title, company.offer),
    promise: clean(company.offer),
    audience: clean(company.niche),
    primaryCta: clean(company.cta),
    proof: clean(company.proof),
    price: firstText(company.priceLocal, company.price?.label),
    guarantee: clean(company.guarantee),
    funnel: clean(company.funnel)
      .split(/\s*(?:→|>|\|)\s*/)
      .map(clean)
      .filter(Boolean),
  };
}

function mergeRead(
  ...reads: Array<Partial<SiteCommercialRead> | null | undefined>
): SiteCommercialRead {
  const result: SiteCommercialRead = {};
  for (const key of [
    ...SUMMARY_FIELDS.map((field) => field.key),
    "funnel" as const,
  ]) {
    for (const read of reads) {
      const value = read?.[key];
      if (key === "mechanism" || key === "funnel") {
        const list = cleanList(value);
        if (list.length) {
          result[key] = list;
          break;
        }
      } else {
        const text = clean(value);
        if (text) {
          result[key] = text;
          break;
        }
      }
    }
  }
  return result;
}

const summaryValue = (read: SiteCommercialRead, key: SummaryKey) =>
  key === "mechanism" ? cleanList(read[key]) : clean(read[key]);

const hasValue = (value: string | string[]) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);

function ReadValue({ value }: { value: string | string[] }) {
  if (!hasValue(value))
    return (
      <p className={styles.emptyValue}>
        No se ha podido verificar públicamente.
      </p>
    );
  if (Array.isArray(value)) {
    return (
      <ul className={styles.valueList}>
        {value.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className={styles.valueText}>{value}</p>;
}

function SummaryCard({
  field,
  read,
  original,
  translated,
  originalLanguage,
}: {
  field: (typeof SUMMARY_FIELDS)[number];
  read: SiteCommercialRead;
  original: SiteCommercialRead;
  translated: boolean;
  originalLanguage: string;
}) {
  const value = summaryValue(read, field.key);
  const originalValue = summaryValue(original, field.key);
  const showOriginal =
    translated &&
    hasValue(originalValue) &&
    JSON.stringify(value) !== JSON.stringify(originalValue);
  return (
    <article
      className={`${styles.summaryCard}${field.wide ? ` ${styles.summaryCardWide}` : ""}`}
    >
      <header>
        <span>{field.eyebrow}</span>
        <h4>{field.label}</h4>
      </header>
      <ReadValue value={value} />
      {showOriginal ? (
        <details className={styles.originalDetail}>
          <summary>Ver original · {originalLanguage}</summary>
          <ReadValue value={originalValue} />
        </details>
      ) : null}
    </article>
  );
}

function captureMedia(page: SiteCapturePage, index: number): Media | null {
  if (!page.image?.file) return null;
  return {
    file: page.image.file,
    type: page.image.type || "image/webp",
    bytes: Number(page.image.bytes || 0),
    order: index + 1,
    width: page.image.width,
    height: page.image.height,
    label: firstText(page.label, page.role, `Página ${index + 1}`),
    title: firstText(page.title, page.label, page.role),
  };
}

function PageCard({
  page,
  index,
  companyName,
  onCaptureOpen,
}: {
  page: SiteCapturePage;
  index: number;
  companyName: string;
  onCaptureOpen: (page: SiteCapturePage, index: number) => void;
}) {
  const media = captureMedia(page, index);
  const preview = page.thumbnail?.file || page.image?.file;
  const link = publicUrl(page.finalUrl || page.requestedUrl);
  const title = firstText(
    page.label,
    page.title,
    page.role,
    `Página ${index + 1}`,
  );
  const dimensions =
    page.image?.width && page.image?.height
      ? `${page.image.width.toLocaleString("es-ES")} × ${page.image.height.toLocaleString("es-ES")} px`
      : "";
  const metadata = [
    dimensions,
    formatBytes(page.image?.bytes),
    formatDate(page.capturedAt),
  ].filter(Boolean);
  const originalTexts = [
    clean(page.text?.h1),
    ...cleanList(page.text?.headings).slice(0, 3),
  ].filter((item, itemIndex, all) => all.indexOf(item) === itemIndex);
  const ctas = cleanList(page.text?.ctas);
  return (
    <article className={styles.pageCard}>
      <div className={styles.pagePreview}>
        {preview && media ? (
          <button
            type="button"
            onClick={() => onCaptureOpen(page, index)}
            aria-label={`Abrir captura completa de ${title}`}
          >
            <img
              src={preview}
              alt={`Vista previa de ${title} de ${companyName}`}
              loading="lazy"
              decoding="async"
            />
            <span className={styles.openOverlay}>Abrir captura completa</span>
          </button>
        ) : (
          <div className={styles.noPreview} role="status">
            <span aria-hidden="true">□</span>
            <strong>Sin captura visual</strong>
            <small>
              {clean(page.issue) ||
                "La página queda registrada, pero no hay una imagen utilizable."}
            </small>
          </div>
        )}
        <div className={styles.previewBadges}>
          <span data-tone={statusTone(page.status)}>
            {statusLabel(page.status)}
          </span>
          {page.fullPage ? <span>Web completa</span> : null}
        </div>
      </div>
      <div className={styles.pageBody}>
        <header className={styles.pageHeader}>
          <div>
            <span>
              {firstText(
                page.role,
                `Paso ${String(index + 1).padStart(2, "0")}`,
              )}
            </span>
            <h4>{title}</h4>
          </div>
          <b>{String(index + 1).padStart(2, "0")}</b>
        </header>
        {clean(page.title) && clean(page.title) !== title ? (
          <p className={styles.browserTitle}>{page.title}</p>
        ) : null}
        {metadata.length ? (
          <p className={styles.metadata}>{metadata.join(" · ")}</p>
        ) : null}
        {originalTexts.length || ctas.length ? (
          <div className={styles.pageCopy}>
            <span>Texto visible · {languageName(page.text?.language)}</span>
            {originalTexts.map((text, textIndex) => (
              <p key={`${text}-${textIndex}`}>{text}</p>
            ))}
            {ctas.length ? (
              <div
                className={styles.ctaRow}
                aria-label="Llamadas a la acción visibles"
              >
                {ctas.slice(0, 4).map((cta, ctaIndex) => (
                  <span key={`${cta}-${ctaIndex}`}>{cta}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {clean(page.issue) && preview ? (
          <p className={styles.issue}>Incidencia: {page.issue}</p>
        ) : null}
        {link ? (
          <a
            className={styles.pageLink}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visitar página original <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className={styles.pageLinkDisabled}>
            URL pública no disponible
          </span>
        )}
      </div>
    </article>
  );
}

function LongCaptureViewer({
  page,
  index,
  company,
  collection,
  onMediaOpen,
  onClose,
}: {
  page: SiteCapturePage;
  index: number;
  company: Company;
  collection: Media[];
  onMediaOpen: SiteCapturePanelProps["onMediaOpen"];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"width" | "contain">("width");
  const closeRef = useRef<HTMLButtonElement>(null);
  const media = captureMedia(page, index);
  const pageUrl = publicUrl(page.finalUrl || page.requestedUrl);
  const title = firstText(
    page.label,
    page.title,
    page.role,
    `Página ${index + 1}`,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  if (!media) return null;
  return (
    <div
      className={styles.viewerBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.viewer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-capture-viewer-title"
      >
        <header className={styles.viewerHeader}>
          <div className={styles.viewerIdentity}>
            <span>
              {company.name} · {firstText(page.role, "Captura web")}
            </span>
            <h3 id="site-capture-viewer-title">{title}</h3>
          </div>
          <div className={styles.viewerTools}>
            <div
              className={styles.modeSwitch}
              role="group"
              aria-label="Modo de visualización"
            >
              <button
                type="button"
                aria-pressed={mode === "width"}
                onClick={() => setMode("width")}
              >
                Ajustar ancho
              </button>
              <button
                type="button"
                aria-pressed={mode === "contain"}
                onClick={() => setMode("contain")}
              >
                Vista completa
              </button>
            </div>
            <button
              ref={closeRef}
              type="button"
              className={styles.closeViewer}
              onClick={onClose}
              aria-label="Cerrar captura"
            >
              Cerrar <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div className={styles.viewerMeta}>
          <p>
            {mode === "width"
              ? "Ancho legible · desplázate hacia abajo para recorrer toda la página"
              : "Página completa · útil para entender la estructura general"}
          </p>
          <div>
            {pageUrl ? (
              <a href={pageUrl} target="_blank" rel="noopener noreferrer">
                Visitar web ↗
              </a>
            ) : null}
            <a href={media.file} target="_blank" rel="noopener noreferrer">
              Abrir archivo original ↗
            </a>
            <button
              type="button"
              onClick={() => onMediaOpen(media, company, collection, "funnel")}
            >
              Visor multimedia
            </button>
          </div>
        </div>
        <div className={styles.viewerCanvas} data-mode={mode}>
          <img
            src={media.file}
            alt={`Captura completa de ${title} de ${company.name}`}
          />
        </div>
      </section>
    </div>
  );
}

export default function SiteCapturePanel({
  company,
  review,
  captureRecord,
  onMediaOpen,
}: SiteCapturePanelProps) {
  const [viewer, setViewer] = useState<{
    page: SiteCapturePage;
    index: number;
  } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const record = captureRecord || null;
  const reviewRead = extractReviewRead(review);
  const companyRead = fallbackRead(company);
  const originalRead = mergeRead(
    record?.commercialRead,
    reviewRead,
    companyRead,
  );
  const spanishRead = record?.translation?.spanish || null;
  const translated = Boolean(
    spanishRead &&
    Object.values(spanishRead).some((value) => cleanList(value).length),
  );
  const mainRead = translated
    ? mergeRead(spanishRead, record?.commercialRead, reviewRead, companyRead)
    : originalRead;
  const pages = (record?.pages || []).filter(Boolean);
  const collection = pages
    .map((page, index) => captureMedia(page, index))
    .filter((media): media is Media => Boolean(media));
  const planned = Math.max(
    0,
    Number(record?.coverage?.planned || pages.length || 0),
  );
  const captured = Math.max(
    0,
    Number(record?.coverage?.captured ?? collection.length),
  );
  const failed = Math.max(
    0,
    Number(
      record?.coverage?.failed ||
        pages.filter((page) => /fail|error|blocked/i.test(clean(page.status)))
          .length,
    ),
  );
  const coveragePct = planned
    ? Math.min(100, Math.round((captured / planned) * 100))
    : 0;
  const originalCode = normalizeCode(
    record?.language?.original || record?.translation?.sourceLanguage,
  );
  const originalLanguage = languageName(originalCode);
  const website = publicUrl(record?.website || company.website);
  const funnel = cleanList(mainRead.funnel).length
    ? cleanList(mainRead.funnel)
    : pages.map((page, index) =>
        firstText(page.label, page.role, `Paso ${index + 1}`),
      );
  const titleId = `site-capture-${company.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const closeViewer = () => {
    setViewer(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.panelHeader}>
        <div className={styles.headingBlock}>
          <p className={styles.kicker}>
            LECTURA DE LA WEB Y SU RECORRIDO COMERCIAL
          </p>
          <h2 id={titleId}>Qué dice esta web</h2>
          <p>
            El mensaje comercial de {company.name}, ordenado para entenderlo de
            un vistazo y contrastarlo con las páginas capturadas.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span
            className={styles.statusBadge}
            data-tone={statusTone(record?.status)}
          >
            <i aria-hidden="true" /> {statusLabel(record?.status)}
          </span>
          {website ? (
            <a href={website} target="_blank" rel="noopener noreferrer">
              Abrir web <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </header>

      <div className={styles.contextBar}>
        <div className={styles.coverage}>
          <div>
            <span>Cobertura visual</span>
            <b>
              {captured} de {planned || captured} páginas
            </b>
          </div>
          <div
            className={styles.coverageTrack}
            role="progressbar"
            aria-label="Cobertura de páginas capturadas"
            aria-valuemin={0}
            aria-valuemax={planned || captured || 1}
            aria-valuenow={captured}
          >
            <span style={{ width: `${coveragePct}%` }} />
          </div>
          {failed ? (
            <small>
              {failed} página{failed === 1 ? "" : "s"} con incidencia
            </small>
          ) : null}
        </div>
        <div className={styles.languageInfo}>
          <span>Idioma original</span>
          <b>{originalLanguage}</b>
          {originalCode ? <small>{originalCode.toUpperCase()}</small> : null}
        </div>
        <div className={styles.languageInfo}>
          <span>Lectura mostrada</span>
          <b>{translated ? "Traducción al español" : originalLanguage}</b>
          <small>
            {statusLabel(
              record?.translation?.status ||
                record?.language?.translationStatus,
            )}
          </small>
        </div>
      </div>

      {!record ? (
        <div className={styles.notice} role="note">
          <strong>Captura web todavía no incorporada</strong>
          <p>
            La lectura utiliza temporalmente la investigación comercial
            existente de la ficha. La galería aparecerá cuando se vincule su
            registro site-captures-v1.
          </p>
        </div>
      ) : null}

      <div className={styles.summaryGrid}>
        {SUMMARY_FIELDS.map((field) => (
          <SummaryCard
            key={field.key}
            field={field}
            read={mainRead}
            original={originalRead}
            translated={translated}
            originalLanguage={originalLanguage}
          />
        ))}
      </div>

      <section
        className={styles.journey}
        aria-labelledby={`${titleId}-journey`}
      >
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>DEL PRIMER IMPACTO A LA CONVERSIÓN</p>
            <h3 id={`${titleId}-journey`}>Recorrido comercial</h3>
          </div>
          <span>
            {funnel.length} etapa{funnel.length === 1 ? "" : "s"} documentada
            {funnel.length === 1 ? "" : "s"}
          </span>
        </header>
        {funnel.length ? (
          <ol className={styles.journeyList}>
            {funnel.map((step, index) => (
              <li key={`${step}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyJourney}>
            No hay suficientes páginas públicas para reconstruir el recorrido
            comercial.
          </p>
        )}
      </section>

      <section
        className={styles.gallery}
        aria-labelledby={`${titleId}-gallery`}
      >
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>EVIDENCIA VISUAL NAVEGABLE</p>
            <h3 id={`${titleId}-gallery`}>Web, landing y funnel</h3>
          </div>
          <span>
            {collection.length} captura{collection.length === 1 ? "" : "s"} a
            página completa
          </span>
        </header>
        {pages.length ? (
          <div className={styles.galleryGrid}>
            {pages.map((page, index) => (
              <PageCard
                key={page.id || `${page.requestedUrl}-${index}`}
                page={page}
                index={index}
                companyName={company.name}
                onCaptureOpen={(selectedPage, selectedIndex) => {
                  openerRef.current =
                    document.activeElement instanceof HTMLElement
                      ? document.activeElement
                      : null;
                  setViewer({ page: selectedPage, index: selectedIndex });
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.galleryEmpty}>
            <strong>No hay capturas asociadas todavía</strong>
            <p>
              La ficha conserva el análisis disponible, pero no debe confundirse
              con una inspección visual completa de la web.
            </p>
          </div>
        )}
      </section>
      {viewer ? (
        <LongCaptureViewer
          page={viewer.page}
          index={viewer.index}
          company={company}
          collection={collection}
          onMediaOpen={onMediaOpen}
          onClose={closeViewer}
        />
      ) : null}
    </section>
  );
}
