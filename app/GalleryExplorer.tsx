"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompanyLogo from "./CompanyLogo";
import {
  classifyMediaResolution,
  dimensionsFromMedia,
  imagePresentationStyle,
  measureImage,
  MediaResolutionBadge,
  type MediaDimensions,
} from "./MediaResolution";
import type { GalleryMetrics } from "./gallery-metrics";
import type { Company, LogoManifest, Media, Summary } from "./data-types";
import styles from "./GalleryExplorer.module.css";

type ExplorerMode = "collections" | "assets";
type MediaKind = "all" | "image" | "video" | "document";
type PlatformFilter = "all" | "ads" | "meta" | "google" | "display" | "other" | "archive";
type LanguageFilter = "all" | "es" | "foreign" | "translated" | "pending";
type QualityFilter = "all" | "usable" | "small" | "unknown";
type AngleFilter = "all" | "value" | "price" | "territory" | "speed" | "lead-magnet" | "number" | "guarantee" | "authority" | "pain" | "other";
type SortMode = "media" | "score" | "name";

type GalleryIndexItem = {
  h: string;
  w: number | null;
  y: number | null;
  o: "landscape" | "portrait" | "square" | "unknown";
  v: number;
  g: number;
  p: "meta" | "instagram" | "google" | "display" | "unknown" | "archive";
  l: string;
  n: string | null;
  t: boolean;
  s: string | null;
  r: string | null;
  a: boolean;
  e: boolean | null;
  f: Exclude<AngleFilter, "all"> | null;
  d: string | number | null;
  q: string | null;
  c: string | null;
  x: string | null;
};

type GalleryIndex = {
  schema: string;
  generatedAt: string;
  stats: {
    companies: number;
    files: number;
    unique: number;
    duplicates: number;
    withAdData: number;
    withoutAdData: number;
    foreign: number;
    translated: number;
    patternReady: number;
    platforms: Record<string, number>;
  };
  items: Record<string, GalleryIndexItem>;
};

type CollectionResult = {
  company: Company;
  media: Media[];
  rawCount: number;
};

type AssetResult = {
  company: Company;
  media: Media;
  collection: Media[];
};

const collectionPageSizes = [12, 24] as const;
const assetPageSizes = [24, 36, 48] as const;
const emptyIndexItems: Record<string, GalleryIndexItem> = {};
const scopeLabels: Record<string, string> = {
  "Núcleo — agencia/leadgen": "Agencia / leadgen",
  "Vertical — broker/marketplace": "Broker / marketplace",
  "Adyacente — BPO/infraestructura": "BPO / infraestructura",
  "Excluir — fuente/no negocio": "Fuera del núcleo",
};

const angleLabels: Record<Exclude<AngleFilter, "all">, string> = {
  value: "Propuesta de valor",
  price: "Precio / oferta",
  territory: "Exclusividad territorial",
  speed: "Velocidad / SLA",
  "lead-magnet": "Lead magnet",
  number: "Cifra concreta",
  guarantee: "Garantía",
  authority: "Autoridad / prueba",
  pain: "Dolor / problema",
  other: "Otros ángulos",
};

const numberFormat = new Intl.NumberFormat("es-ES");
const fmt = (value: number) => numberFormat.format(value);

function fold(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function mediaKind(media: Media): Exclude<MediaKind, "all"> {
  if (media.type.includes("video") || /\.(mp4|webm|mov)$/i.test(media.file)) return "video";
  if (media.type.includes("pdf") || /\.pdf$/i.test(media.file)) return "document";
  return "image";
}

function mediaPlatform(media: Media, metadata?: GalleryIndexItem): GalleryIndexItem["p"] {
  if (metadata?.p) return metadata.p;
  const evidence = `${media.label || ""} ${media.title || ""}`;
  return /anuncio meta|· meta \d/i.test(evidence) ? "meta" : "archive";
}

function kindLabel(kind: Exclude<MediaKind, "all">): string {
  if (kind === "video") return "Vídeo";
  if (kind === "document") return "Documento";
  return "Imagen";
}

function platformLabel(platform: GalleryIndexItem["p"]): string {
  if (platform === "meta") return "Meta";
  if (platform === "instagram") return "Instagram";
  if (platform === "google") return "Google";
  if (platform === "display") return "Display";
  if (platform === "unknown") return "Anuncio · plataforma no consta";
  return "Captura / archivo";
}

function companySearchText(company: Company): string {
  return fold([
    company.name,
    company.primaryCountry,
    ...company.countries,
    company.niche,
    company.offer,
    company.agencyType,
    company.scope,
    ...company.channels,
  ].join(" "));
}

function mediaSearchText(media: Media, metadata?: GalleryIndexItem): string {
  return fold(`${media.label || ""} ${media.title || ""} ${media.file} ${metadata?.q || ""} ${metadata?.c || ""} ${metadata?.x || ""} ${metadata?.n || ""} ${metadata?.f ? angleLabels[metadata.f] : ""}`);
}

function isForeignLanguage(metadata?: GalleryIndexItem): boolean {
  return Boolean(metadata && !["es", "und", "zxx", "mul"].includes(metadata.l));
}

function isUsableResolution(metadata?: GalleryIndexItem): boolean {
  return Boolean(metadata?.w && metadata?.y && Math.min(metadata.w, metadata.y) >= 400);
}

function previewScore(media: Media, metadata?: GalleryIndexItem): number {
  const extension = media.file.split(".").pop()?.toLowerCase() || "";
  let score = 0;
  if (metadata && metadata.p !== "archive") score += 120;
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) score += 55;
  if (isUsableResolution(metadata)) score += 40;
  if (media.bytes >= 5_000) score += 20;
  if (metadata?.o === "portrait" || metadata?.o === "square") score += 10;
  if (extension === "svg") score -= 45;
  if (extension === "heic") score -= 90;
  return score;
}

function GalleryMediaTile({
  item,
  company,
  onOpen,
}: {
  item: Media;
  company: Company;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<MediaDimensions | null>(() => dimensionsFromMedia(item));
  const resolution = classifyMediaResolution(dimensions);
  const kind = mediaKind(item);

  if (failed) {
    return (
      <div className={`${styles.mediaTile} ${styles.mediaFallback}`} role="status">
        <b>Vista no disponible</b>
        <span>El archivo sigue documentado para revisión.</span>
      </div>
    );
  }

  if (kind === "document") {
    return (
      <a className={`${styles.mediaTile} ${styles.documentTile}`} href={item.file} target="_blank" rel="noreferrer">
        <span>PDF</span>
        <b>Abrir documento</b>
      </a>
    );
  }

  if (kind === "video") {
    return (
      <button className={styles.mediaTile} onClick={onOpen} aria-label={`Abrir vídeo de ${company.name}`}>
        <video src={item.file} muted playsInline preload="none" onError={() => setFailed(true)} />
        <span className={styles.play} aria-hidden="true">▶</span>
      </button>
    );
  }

  return (
    <button
      className={`${styles.mediaTile}${resolution.isLowResolution ? ` ${styles.lowResolution}` : ""}`}
      onClick={onOpen}
      aria-label={`Abrir material de ${company.name}`}
      data-media-resolution={resolution.kind}
    >
      <img
        src={item.file}
        alt={`Material de ${company.name}`}
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

function Pagination({
  page,
  pages,
  pageSize,
  total,
  options,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  options: readonly number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <nav className={styles.pagination} aria-label="Paginación de la galería">
      <span>{fmt(total)} resultados</span>
      <div>
        <button onClick={() => onPage(1)} disabled={page <= 1} aria-label="Primera página">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}>Anterior</button>
        <label>
          <span className={styles.visuallyHidden}>Página</span>
          <select value={page} onChange={(event) => onPage(Number(event.target.value))} aria-label="Página actual">
            {Array.from({ length: pages }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>Página {value} de {pages}</option>
            ))}
          </select>
        </label>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages}>Siguiente</button>
        <button onClick={() => onPage(pages)} disabled={page >= pages} aria-label="Última página">»</button>
      </div>
      <label>
        Mostrar
        <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
          {options.map((size) => <option key={size} value={size}>{size} por página</option>)}
        </select>
      </label>
    </nav>
  );
}

function CollectionCard({
  result,
  logos,
  indexItems,
  onEnter,
  onOpenCompany,
}: {
  result: CollectionResult;
  logos: LogoManifest;
  indexItems: Record<string, GalleryIndexItem>;
  onEnter: () => void;
  onOpenCompany: () => void;
}) {
  const { company, media } = result;
  const previews = [...media]
    .filter((item) => mediaKind(item) === "image")
    .sort((a, b) => previewScore(b, indexItems[b.file]) - previewScore(a, indexItems[a.file]))
    .slice(0, 3);
  const adCount = media.filter((item) => mediaPlatform(item, indexItems[item.file]) !== "archive").length;
  const videoCount = media.filter((item) => mediaKind(item) === "video").length;
  const hiddenVariants = Math.max(0, result.rawCount - media.length);

  return (
    <article className={styles.collectionCard}>
      <button className={styles.collectionMain} onClick={onEnter} aria-label={`Entrar en la galería de ${company.name}`}>
        <span className={`${styles.collage} ${previews.length === 1 ? styles.onePreview : ""}`}>
          {previews.length ? previews.map((item) => (
            <img key={item.file} src={item.file} alt="" loading="lazy" decoding="async" />
          )) : (
            <span className={styles.noPreview}><b>{company.media.length}</b> materiales</span>
          )}
          {media.length > previews.length && previews.length > 0 && (
            <span className={styles.moreMedia}>+{media.length - previews.length}</span>
          )}
        </span>
        <span className={styles.collectionIdentity}>
          <CompanyLogo company={company} logos={logos} size="medium" />
          <span><small>{company.primaryCountry}</small><strong>{company.name}</strong></span>
          <b>{company.score}</b>
        </span>
        <span className={styles.collectionSummary}>{company.offer || company.niche || "Archivo visual de la empresa"}</span>
      </button>
      <footer>
        <span><b>{fmt(media.length)}</b> creatividades</span>
        {hiddenVariants > 0 && <span><b>+{fmt(hiddenVariants)}</b> variantes</span>}
        {adCount > 0 && <span><b>{fmt(adCount)}</b> anuncios</span>}
        {videoCount > 0 && <span><b>{fmt(videoCount)}</b> vídeo</span>}
        <button onClick={onOpenCompany}>Abrir ficha</button>
      </footer>
    </article>
  );
}

function AssetCard({
  result,
  logos,
  metadata,
  onOpen,
  onEnterCompany,
}: {
  result: AssetResult;
  logos: LogoManifest;
  metadata?: GalleryIndexItem;
  onOpen: () => void;
  onEnterCompany: () => void;
}) {
  const { company, media } = result;
  const kind = mediaKind(media);
  const platform = mediaPlatform(media, metadata);
  return (
    <article className={styles.assetCard}>
      <GalleryMediaTile item={media} company={company} onOpen={onOpen} />
      <div className={styles.assetMeta}>
        <button onClick={onEnterCompany} aria-label={`Entrar en la galería de ${company.name}`}>
          <CompanyLogo company={company} logos={logos} size="small" />
          <span><strong>{company.name}</strong><small>{metadata?.q || media.title || media.label || `Pieza ${media.order}`}</small></span>
        </button>
        <div>
          <span>{platformLabel(platform)}</span>
          <span>{kindLabel(kind)}</span>
          {(metadata?.v || 1) > 1 && <span>{metadata?.v} variantes</span>}
          {metadata?.t && <span className={styles.translationTag}>Traducida ES</span>}
          {isForeignLanguage(metadata) && !metadata?.t && <span className={styles.pendingTag}>Traducción pendiente</span>}
        </div>
      </div>
    </article>
  );
}

export default function GalleryExplorer({
  companies,
  metrics,
  logos,
  summary,
  onOpenMedia,
  onOpenCompany,
}: {
  companies: Company[];
  metrics: GalleryMetrics;
  logos: LogoManifest;
  summary: Summary;
  onOpenMedia: (media: Media, company: Company, collection?: Media[]) => void;
  onOpenCompany: (company: Company) => void;
}) {
  const topRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filtersRef = useRef<HTMLElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<ExplorerMode>("collections");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [scope, setScope] = useState("all");
  const [kind, setKind] = useState<MediaKind>("all");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [language, setLanguage] = useState<LanguageFilter>("all");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [angle, setAngle] = useState<AngleFilter>("all");
  const [patternsOnly, setPatternsOnly] = useState(false);
  const [groupDuplicates, setGroupDuplicates] = useState(true);
  const [minimum, setMinimum] = useState(0);
  const [sort, setSort] = useState<SortMode>("media");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<GalleryIndex | null>(null);
  const [indexUnavailable, setIndexUnavailable] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/gallery-index.json", { signal: controller.signal, cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Gallery index ${response.status}`);
        return response.json() as Promise<GalleryIndex>;
      })
      .then((value) => setGalleryIndex(value))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setIndexUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const applyUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextMode: ExplorerMode = params.get("modo") === "piezas" ? "assets" : "collections";
      const gallery = params.get("galeria");
      const nextPage = Math.max(1, Number(params.get("pagina")) || 1);
      const defaultSize = gallery || nextMode === "assets" ? 24 : 12;
      const requestedSize = Number(params.get("tamano")) || defaultSize;
      const validSize = (gallery || nextMode === "assets" ? assetPageSizes : collectionPageSizes).includes(requestedSize as never)
        ? requestedSize
        : defaultSize;

      setMode(nextMode);
      setSelectedCompanyId(gallery);
      setSearch(params.get("q") || "");
      setCountry(params.get("pais") || "all");
      setScope(params.get("alcance") || "all");
      setKind((params.get("formato") as MediaKind) || "all");
      setPlatform((params.get("plataforma") as PlatformFilter) || "all");
      setLanguage((params.get("idioma") as LanguageFilter) || "all");
      setQuality((params.get("calidad") as QualityFilter) || "all");
      setAngle((params.get("angulo") as AngleFilter) || "all");
      setPatternsOnly(params.get("patrones") === "si");
      setGroupDuplicates(params.get("variantes") !== "todas");
      setMinimum(Math.max(0, Number(params.get("minimo")) || 0));
      setSort((params.get("orden") as SortMode) || "media");
      setPage(nextPage);
      setPageSize(validSize);
      setUrlReady(true);
    };

    applyUrl();
    window.addEventListener("popstate", applyUrl);
    return () => window.removeEventListener("popstate", applyUrl);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const setOptional = (name: string, value: string, defaultValue = "all") => {
      if (!value || value === defaultValue) params.delete(name);
      else params.set(name, value);
    };

    setOptional("modo", mode === "assets" ? "piezas" : "", "");
    setOptional("galeria", selectedCompanyId || "", "");
    setOptional("q", search.trim(), "");
    setOptional("pais", country);
    setOptional("alcance", scope);
    setOptional("formato", kind);
    setOptional("plataforma", platform);
    setOptional("idioma", language);
    setOptional("calidad", quality);
    setOptional("angulo", angle);
    setOptional("patrones", patternsOnly ? "si" : "", "");
    setOptional("variantes", groupDuplicates ? "" : "todas", "");
    setOptional("minimo", minimum ? String(minimum) : "", "");
    setOptional("orden", sort, "media");
    setOptional("pagina", page > 1 ? String(page) : "", "");
    const defaultSize = selectedCompanyId || mode === "assets" ? 24 : 12;
    setOptional("tamano", pageSize !== defaultSize ? String(pageSize) : "", "");
    window.history.replaceState(
      { ...window.history.state, rvGallery: Boolean(selectedCompanyId) },
      "",
      `${url.pathname}?${params.toString()}${url.hash}`,
    );
  }, [angle, country, groupDuplicates, kind, language, minimum, mode, page, pageSize, patternsOnly, platform, quality, scope, search, selectedCompanyId, sort, urlReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const priorOverflow = document.body.style.overflow;
    const returnFocus = filterButtonRef.current;
    const frame = window.requestAnimationFrame(() => filterCloseRef.current?.focus());
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        filtersRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      returnFocus?.focus();
    };
  }, [filtersOpen]);

  const galleryCompanies = useMemo(() => companies.filter((company) => company.media.length > 0), [companies]);
  const indexItems = galleryIndex?.items || emptyIndexItems;
  const selectedCompany = selectedCompanyId
    ? galleryCompanies.find((company) => company.id === selectedCompanyId) || null
    : null;
  const query = fold(search);

  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of galleryCompanies) {
      for (const companyCountry of new Set([company.primaryCountry, ...company.countries].filter(Boolean))) {
        counts.set(companyCountry, (counts.get(companyCountry) || 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  }, [galleryCompanies]);

  const scopeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of galleryCompanies) counts.set(company.scope, (counts.get(company.scope) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [galleryCompanies]);

  const sourceTotals = galleryIndex?.stats || {
    files: metrics.media,
    unique: metrics.media,
    duplicates: 0,
    withAdData: 0,
    withoutAdData: metrics.media,
    foreign: 0,
    translated: 0,
    patternReady: 0,
    platforms: { meta: 0, google: 0, display: 0, unknown: 0 },
  };

  const mediaForCompany = useCallback((company: Company): { media: Media[]; rawCount: number } => {
    const companyMatches = !query || companySearchText(company).includes(query);
    const raw = company.media.filter((item) => {
      const metadata = indexItems[item.file];
      const itemPlatform = mediaPlatform(item, metadata);
      if (kind !== "all" && mediaKind(item) !== kind) return false;
      if (platform === "ads" && itemPlatform === "archive") return false;
      if (platform === "meta" && itemPlatform !== "meta" && itemPlatform !== "instagram") return false;
      if (platform === "google" && itemPlatform !== "google") return false;
      if (platform === "display" && itemPlatform !== "display") return false;
      if (platform === "other" && itemPlatform !== "unknown") return false;
      if (platform === "archive" && itemPlatform !== "archive") return false;
      if (language === "es" && metadata?.l !== "es") return false;
      if (language === "foreign" && !isForeignLanguage(metadata)) return false;
      if (language === "translated" && !metadata?.t) return false;
      if (language === "pending" && (!isForeignLanguage(metadata) || metadata?.t)) return false;
      if (quality === "usable" && !isUsableResolution(metadata)) return false;
      if (quality === "small" && (!metadata?.w || !metadata?.y || Math.min(metadata.w, metadata.y) >= 400)) return false;
      if (quality === "unknown" && metadata?.w && metadata?.y) return false;
      if (angle !== "all" && metadata?.f !== angle) return false;
      if (patternsOnly && !metadata?.a) return false;
      if (!query || companyMatches) return true;
      return mediaSearchText(item, metadata).includes(query);
    });

    if (!groupDuplicates || !galleryIndex) return { media: raw, rawCount: raw.length };
    const unique = new Map<string, Media>();
    for (const item of raw) {
      const metadata = indexItems[item.file];
      const key = metadata?.h || item.file;
      const previous = unique.get(key);
      if (!previous || previewScore(item, metadata) > previewScore(previous, indexItems[previous.file])) unique.set(key, item);
    }
    return {
      media: [...unique.values()].sort((a, b) => a.order - b.order),
      rawCount: raw.length,
    };
  }, [angle, galleryIndex, groupDuplicates, indexItems, kind, language, patternsOnly, platform, quality, query]);

  const collections = useMemo(() => {
    const results = galleryCompanies
      .filter((company) => country === "all" || company.primaryCountry === country || company.countries.includes(country))
      .filter((company) => scope === "all" || company.scope === scope)
      .filter((company) => company.media.length >= minimum)
      .map((company) => ({ company, ...mediaForCompany(company) }))
      .filter((result) => result.media.length > 0);
    return results.sort((a, b) => {
      if (sort === "score") return b.company.score - a.company.score || b.media.length - a.media.length;
      if (sort === "name") return a.company.name.localeCompare(b.company.name, "es");
      return b.media.length - a.media.length || b.company.score - a.company.score;
    });
  }, [country, galleryCompanies, mediaForCompany, minimum, scope, sort]);

  const assets = useMemo<AssetResult[]>(() => collections.flatMap((result) =>
    result.media.map((media) => ({ company: result.company, media, collection: result.media }))), [collections]);
  const selectedResult = selectedCompany ? mediaForCompany(selectedCompany) : { media: [], rawCount: 0 };
  const selectedMedia = selectedResult.media;
  const total = selectedCompany ? selectedMedia.length : mode === "collections" ? collections.length : assets.length;
  const pageSizeOptions = selectedCompany || mode === "assets" ? assetPageSizes : collectionPageSizes;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const shownCollections = collections.slice(start, start + pageSize);
  const shownAssets = (selectedCompany
    ? selectedMedia.map((media) => ({ company: selectedCompany, media, collection: selectedMedia }))
    : assets).slice(start, start + pageSize);
  const activeFilterCount = Number(Boolean(search.trim())) + Number(country !== "all") + Number(scope !== "all") + Number(kind !== "all") + Number(platform !== "all") + Number(language !== "all") + Number(quality !== "all") + Number(angle !== "all") + Number(patternsOnly) + Number(!groupDuplicates) + Number(minimum > 0);

  const navigatePage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(pages, nextPage)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setSearch("");
    setCountry("all");
    setScope("all");
    setKind("all");
    setPlatform("all");
    setLanguage("all");
    setQuality("all");
    setAngle("all");
    setPatternsOnly(false);
    setGroupDuplicates(true);
    setMinimum(0);
    setPage(1);
  };
  const enterCompany = (company: Company) => {
    const url = new URL(window.location.href);
    url.searchParams.set("galeria", company.id);
    url.searchParams.delete("pagina");
    url.searchParams.delete("tamano");
    window.history.pushState({ ...window.history.state, rvGallery: true }, "", url);
    setSelectedCompanyId(company.id);
    setPage(1);
    setPageSize(24);
    setFiltersOpen(false);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const leaveCompany = () => {
    if (window.history.state?.rvGallery) {
      window.history.back();
      return;
    }
    setSelectedCompanyId(null);
    setPage(1);
    setPageSize(mode === "assets" ? 24 : 12);
  };

  return (
    <section className={styles.shell} ref={topRef}>
      <header className={styles.hero} inert={filtersOpen ? true : undefined}>
        <div>
          <p>ARCHIVO VISUAL · EXPLORADOR</p>
          <h1>Encuentra una creatividad sin bajar eternamente.</h1>
          <span>Entra por empresa o recorre piezas concretas. Filtra, compara y abre el visor sin perder tu posición.</span>
        </div>
        <div className={styles.heroMetrics} aria-label="Resumen del archivo visual">
          <span><b>{fmt(metrics.media)}</b><small>archivos verificados</small></span>
          <span><b>{galleryIndex ? fmt(sourceTotals.unique) : "…"}</b><small>contenidos únicos globales</small></span>
          <span><b>{fmt(metrics.withMedia)}</b><small>galerías de empresa</small></span>
        </div>
      </header>

      <div className={styles.searchBar} inert={filtersOpen ? true : undefined}>
        <label>
          <span aria-hidden="true">⌕</span>
          <span className={styles.visuallyHidden}>Buscar empresa, país, nicho o pieza</span>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Buscar empresa, país, nicho, oferta o anuncio…"
          />
          {search && <button onClick={() => { setSearch(""); resetPage(); }} aria-label="Borrar búsqueda">×</button>}
        </label>
        {!selectedCompany && (
          <div className={styles.modeSwitch} aria-label="Vista del explorador">
            <button className={mode === "collections" ? styles.active : ""} onClick={() => { setMode("collections"); setPageSize(12); resetPage(); }}>Empresas <b>{fmt(collections.length)}</b></button>
            <button className={mode === "assets" ? styles.active : ""} onClick={() => { setMode("assets"); setPageSize(24); resetPage(); }}>Piezas <b>{fmt(assets.length)}</b></button>
          </div>
        )}
        <button ref={filterButtonRef} className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} aria-controls="gallery-filter-panel">
          Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ""}
        </button>
      </div>

      <div className={styles.workspace}>
        <aside
          id="gallery-filter-panel"
          ref={filtersRef}
          className={`${styles.filters}${filtersOpen ? ` ${styles.filtersOpen}` : ""}`}
          aria-label="Filtros de la galería"
          aria-modal={filtersOpen ? true : undefined}
          role={filtersOpen ? "dialog" : undefined}
        >
          <header><div><span id="gallery-filter-title">FILTROS</span><b>{activeFilterCount ? `${activeFilterCount} activos` : "Sin filtros"}</b></div><button ref={filterCloseRef} onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">×</button></header>
          {!selectedCompany && (
            <>
              <label>País principal
                <select value={country} onChange={(event) => { setCountry(event.target.value); resetPage(); }}>
                  <option value="all">Todos los países · {galleryCompanies.length}</option>
                  {countryOptions.map(([name, count]) => <option key={name} value={name}>{name} · {count}</option>)}
                </select>
              </label>
              <label>Tipo de negocio
                <select value={scope} onChange={(event) => { setScope(event.target.value); resetPage(); }}>
                  <option value="all">Todos los tipos</option>
                  {scopeOptions.map(([value, count]) => <option key={value} value={value}>{scopeLabels[value] || value} · {count}</option>)}
                </select>
              </label>
              <label>Volumen de archivo
                <select value={minimum} onChange={(event) => { setMinimum(Number(event.target.value)); resetPage(); }}>
                  <option value={0}>Cualquier cantidad</option>
                  <option value={10}>10 piezas o más</option>
                  <option value={25}>25 piezas o más</option>
                  <option value={50}>50 piezas o más</option>
                </select>
              </label>
            </>
          )}
          <fieldset>
            <legend>Formato</legend>
            {(["all", "image", "video", "document"] as MediaKind[]).map((value) => (
              <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); resetPage(); }}>
                {value === "all" ? "Todos" : kindLabel(value)}
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Plataforma / procedencia</legend>
            <button aria-pressed={platform === "all"} onClick={() => { setPlatform("all"); resetPage(); }}>Todo el archivo <b>{fmt(metrics.media)}</b></button>
            <button aria-pressed={platform === "ads"} onClick={() => { setPlatform("ads"); resetPage(); }}>Anuncios enriquecidos <b>{fmt(sourceTotals.withAdData)}</b></button>
            <button aria-pressed={platform === "meta"} onClick={() => { setPlatform("meta"); resetPage(); }}>Meta <b>{fmt(sourceTotals.platforms.meta || 0)}</b></button>
            <button aria-pressed={platform === "google"} onClick={() => { setPlatform("google"); resetPage(); }}>Google <b>{fmt(sourceTotals.platforms.google || 0)}</b></button>
            <button aria-pressed={platform === "display"} onClick={() => { setPlatform("display"); resetPage(); }}>Display <b>{fmt(sourceTotals.platforms.display || 0)}</b></button>
            <button aria-pressed={platform === "other"} onClick={() => { setPlatform("other"); resetPage(); }}>Otra / no consta <b>{fmt(sourceTotals.platforms.unknown || 0)}</b></button>
            <button aria-pressed={platform === "archive"} onClick={() => { setPlatform("archive"); resetPage(); }}>Archivo sin enriquecer <b>{fmt(sourceTotals.withoutAdData)}</b></button>
          </fieldset>
          <fieldset>
            <legend>Variantes exactas</legend>
            <button
              aria-pressed={groupDuplicates}
              disabled={!galleryIndex}
              onClick={() => { setGroupDuplicates((value) => !value); resetPage(); }}
            >
              {groupDuplicates ? "Agrupadas" : "Mostrar todas"}
              <b>{galleryIndex ? `${fmt(sourceTotals.duplicates)} repeticiones globales` : "indexando…"}</b>
            </button>
          </fieldset>
          <label>Idioma y traducción
            <select value={language} onChange={(event) => { setLanguage(event.target.value as LanguageFilter); resetPage(); }}>
              <option value="all">Todos los idiomas</option>
              <option value="es">Original en español</option>
              <option value="foreign">Idioma extranjero · {fmt(sourceTotals.foreign)}</option>
              <option value="translated">Con traducción ES · {fmt(sourceTotals.translated)}</option>
              <option value="pending">Extranjero sin traducción</option>
            </select>
          </label>
          <label>Calidad visual
            <select value={quality} onChange={(event) => { setQuality(event.target.value as QualityFilter); resetPage(); }}>
              <option value="all">Cualquier resolución</option>
              <option value="usable">Lado menor de 400 px o más</option>
              <option value="small">Miniatura · menos de 400 px</option>
              <option value="unknown">Dimensiones no disponibles</option>
            </select>
          </label>
          <label>Ángulo del anuncio
            <select value={angle} onChange={(event) => { setAngle(event.target.value as AngleFilter); resetPage(); }}>
              <option value="all">Todos los ángulos</option>
              {(Object.entries(angleLabels) as Array<[Exclude<AngleFilter, "all">, string]>).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Uso analítico</legend>
            <button aria-pressed={patternsOnly} onClick={() => { setPatternsOnly((value) => !value); resetPage(); }}>
              Aptas para buscar patrones <b>{fmt(sourceTotals.patternReady)}</b>
            </button>
          </fieldset>
          {!selectedCompany && <label>Ordenar por
            <select value={sort} onChange={(event) => { setSort(event.target.value as SortMode); resetPage(); }}>
              <option value="media">Más creatividades únicas</option>
              <option value="score">Mayor puntuación</option>
              <option value="name">Nombre A–Z</option>
            </select>
          </label>}
          {activeFilterCount > 0 && <button className={styles.clearFilters} onClick={clearFilters}>Borrar todos los filtros</button>}
          <p>{indexUnavailable ? "El índice enriquecido no ha podido cargarse; el archivo visual básico sigue disponible." : "El índice ligero enlaza cada pieza con su hash, plataforma, idioma, traducción y estado analítico. Una creatividad compartida conserva su atribución en cada empresa, por eso el total atribuido puede superar el único global."}</p>
        </aside>

        <main className={styles.results} inert={filtersOpen ? true : undefined}>
          {selectedCompany ? (
            <header className={styles.companyHeader}>
              <button onClick={leaveCompany}>← Volver al explorador</button>
              <div>
                <CompanyLogo company={selectedCompany} logos={logos} size="large" />
                <span><small>{selectedCompany.primaryCountry} · {scopeLabels[selectedCompany.scope] || selectedCompany.scope}</small><h2>{selectedCompany.name}</h2><p>{selectedCompany.offer}</p></span>
                <b>{fmt(selectedMedia.length)}<small>creatividades visibles{selectedResult.rawCount > selectedMedia.length ? ` · ${fmt(selectedResult.rawCount - selectedMedia.length)} variantes agrupadas` : ""}</small></b>
              </div>
              <button className={styles.openCompany} onClick={() => onOpenCompany(selectedCompany)}>Abrir ficha completa</button>
            </header>
          ) : (
            <header className={styles.resultsHeader}>
              <div><span>{mode === "collections" ? "EMPRESAS CON MATERIAL" : "ARCHIVO COMPLETO"}</span><h2>{mode === "collections" ? `${fmt(collections.length)} galerías · ${fmt(assets.length)} creatividades atribuidas` : `${fmt(assets.length)} creatividades atribuidas`}</h2></div>
              <p aria-live="polite">Página {safePage} de {pages}</p>
            </header>
          )}

          {total > 0 ? (
            <>
              {selectedCompany || mode === "assets" ? (
                <div className={styles.assetGrid}>
                  {shownAssets.map((result) => (
                    <AssetCard
                      key={`${result.company.id}|${result.media.file}`}
                      result={result}
                      logos={logos}
                      metadata={indexItems[result.media.file]}
                      onOpen={() => onOpenMedia(result.media, result.company, result.collection)}
                      onEnterCompany={() => enterCompany(result.company)}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.collectionGrid}>
                  {shownCollections.map((result) => (
                    <CollectionCard
                      key={result.company.id}
                      result={result}
                      logos={logos}
                      indexItems={indexItems}
                      onEnter={() => enterCompany(result.company)}
                      onOpenCompany={() => onOpenCompany(result.company)}
                    />
                  ))}
                </div>
              )}
              <Pagination
                page={safePage}
                pages={pages}
                pageSize={pageSize}
                total={total}
                options={pageSizeOptions}
                onPage={navigatePage}
                onPageSize={(size) => { setPageSize(size); setPage(1); }}
              />
            </>
          ) : (
            <div className={styles.emptyState}>
              <span>⌕</span><h2>No hay resultados con esta combinación</h2><p>Prueba a quitar un filtro o vuelve al archivo completo.</p><button onClick={clearFilters}>Borrar filtros</button>
            </div>
          )}

          <details className={styles.qualityNote}>
            <summary>Calidad y límites del archivo</summary>
            <p>El inventario visible se calcula sobre las {fmt(metrics.withMedia)} galerías y {fmt(metrics.media)} archivos actuales. Como control histórico separado: {fmt(summary.mediaFileTypeCorrections)} formatos fueron reparados, {summary.technicalArtifactsExcluded} rastros técnicos quedaron fuera y {summary.mediaFailed} URLs públicas no recuperables siguen documentadas. No se sustituyen por creatividades inventadas.</p>
          </details>
        </main>
      </div>
      {filtersOpen && <button className={styles.filterBackdrop} onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" />}
    </section>
  );
}
