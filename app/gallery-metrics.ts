import type { Company, Summary } from "./data-types";

export type GalleryMetrics = {
  companies: number;
  withMedia: number;
  media: number;
  source: "companies-index" | "summary-fallback";
};

type GalleryCompany = Pick<Company, "media">;
type GallerySummary = Pick<Summary, "companies" | "withMedia" | "media">;

const safeCount = (value: number | undefined) =>
  Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;

/**
 * El índice de empresas es la fuente viva que consume la galería. summary.json
 * conserva el snapshot base y solo sirve como fallback durante la carga inicial.
 */
export function deriveGalleryMetrics(
  companies: readonly GalleryCompany[] | null | undefined,
  fallback: GallerySummary | null | undefined,
): GalleryMetrics {
  if (!companies?.length) {
    return {
      companies: safeCount(fallback?.companies),
      withMedia: safeCount(fallback?.withMedia),
      media: safeCount(fallback?.media),
      source: "summary-fallback",
    };
  }

  let withMedia = 0;
  let media = 0;
  for (const company of companies) {
    const companyMedia = Array.isArray(company.media) ? company.media.length : 0;
    if (companyMedia > 0) withMedia += 1;
    media += companyMedia;
  }

  return {
    companies: companies.length,
    withMedia,
    media,
    source: "companies-index",
  };
}
