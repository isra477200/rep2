import type { CSSProperties } from "react";
import type { Media } from "./data-types";

export const LOW_RESOLUTION_BOUNDARY_PX = 200;
export const ICON_THUMBNAIL_MAX_PX = 96;

export type MediaDimensions = {
  width: number;
  height: number;
};

export type MediaResolution = {
  kind: "unknown" | "standard" | "thumbnail-icon" | "low-resolution";
  dimensions: MediaDimensions | null;
  isLowResolution: boolean;
  label: string | null;
  dimensionLabel: string | null;
};

const validDimension = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function dimensionsFromMedia(
  media?: Pick<Media, "width" | "height"> | null,
): MediaDimensions | null {
  return validDimension(media?.width) && validDimension(media?.height)
    ? { width: media.width, height: media.height }
    : null;
}

export function measureImage(image: HTMLImageElement): MediaDimensions | null {
  return validDimension(image.naturalWidth) && validDimension(image.naturalHeight)
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
}

export function classifyMediaResolution(
  dimensions: MediaDimensions | null,
): MediaResolution {
  if (!dimensions)
    return {
      kind: "unknown",
      dimensions: null,
      isLowResolution: false,
      label: null,
      dimensionLabel: null,
    };

  const isLowResolution =
    dimensions.width < LOW_RESOLUTION_BOUNDARY_PX &&
    dimensions.height < LOW_RESOLUTION_BOUNDARY_PX;
  const isThumbnailIcon =
    isLowResolution &&
    Math.max(dimensions.width, dimensions.height) <= ICON_THUMBNAIL_MAX_PX;

  return {
    kind: isThumbnailIcon
      ? "thumbnail-icon"
      : isLowResolution
        ? "low-resolution"
        : "standard",
    dimensions,
    isLowResolution,
    label: isThumbnailIcon
      ? "Miniatura / icono"
      : isLowResolution
        ? "Material de baja resolución"
        : null,
    dimensionLabel: `${dimensions.width}×${dimensions.height} px`,
  };
}

export function imagePresentationStyle(
  resolution: MediaResolution,
  context: "tile" | "viewer",
): CSSProperties | undefined {
  if (!resolution.isLowResolution || !resolution.dimensions) return undefined;
  const naturalSize: CSSProperties = {
    width: resolution.dimensions.width,
    height: resolution.dimensions.height,
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  };
  return context === "tile"
    ? {
        ...naturalSize,
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }
    : naturalSize;
}

export function MediaResolutionBadge({
  resolution,
}: {
  resolution: MediaResolution;
}) {
  if (!resolution.isLowResolution) return null;
  return (
    <span
      role="note"
      data-media-resolution={resolution.kind}
      style={{
        position: "absolute",
        zIndex: 2,
        right: 7,
        bottom: 7,
        left: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        padding: "6px 8px",
        border: "1px solid rgba(255,255,255,.22)",
        borderRadius: 7,
        background: "rgba(8,34,25,.92)",
        color: "#fff",
        fontSize: 9,
        lineHeight: 1.25,
        pointerEvents: "none",
      }}
    >
      <strong>{resolution.label}</strong>
      <span style={{ whiteSpace: "nowrap", opacity: 0.82 }}>
        {resolution.dimensionLabel}
      </span>
    </span>
  );
}

export function MediaResolutionNotice({
  resolution,
  file,
}: {
  resolution: MediaResolution;
  file: string;
}) {
  if (!resolution.isLowResolution) return null;
  return (
    <div
      role="note"
      data-media-resolution-warning={resolution.kind}
      style={{
        width: "min(560px, 86vw)",
        margin: "14px auto 8px",
        padding: "11px 13px",
        border: "1px solid #8d7650",
        borderRadius: 9,
        background: "#2d271c",
        color: "#fff4d6",
        textAlign: "left",
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>
        {resolution.label} · {resolution.dimensionLabel}
      </strong>
      <span style={{ display: "block" }}>
        El archivo mide menos de 200×200 px. Se muestra a tamaño original: no
        se fuerza una ampliación ni se presupone que el contenido sea legible.
      </span>
      <a
        href={file}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-block", marginTop: 7, fontWeight: 700 }}
      >
        Abrir archivo original ↗
      </a>
    </div>
  );
}
