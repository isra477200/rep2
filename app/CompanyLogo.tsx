"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Company, LogoManifest } from "./data-types";

const STATUS_LABELS = {
  official: "Logo oficial",
  platform: "Perfil oficial",
  favicon: "Icono del sitio",
  fallback: "Identidad provisional",
} as const;

export default function CompanyLogo({
  company,
  logos,
  size = "medium",
  showStatus = false,
}: {
  company: Pick<Company, "id" | "name">;
  logos: LogoManifest;
  size?: "small" | "medium" | "large";
  showStatus?: boolean;
}) {
  const record = logos[company.id];
  const logoKey = `${company.id}|${record?.file || "fallback"}`;
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey === logoKey;
  const initials =
    company.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "RV";
  const hasImage = Boolean(record?.file && !failed);
  const tone = hasImage && record?.tone ? ` tone-${record.tone}` : "";
  const fallbackTone = Array.from(company.id).reduce(
    (total, character) => (total + character.charCodeAt(0)) % 8,
    0,
  );
  const status = hasImage ? record?.status || "official" : "fallback";
  const sourceHost = record?.sourceHost || (() => {
    try {
      return record?.source ? new URL(record.source).hostname.replace(/^www\./, "") : null;
    } catch {
      return null;
    }
  })();
  const mark = (
    <span
      className={`company-logo logo-${size}${hasImage ? " has-image" : ` is-fallback fallback-tone-${fallbackTone}`}${tone}`}
      role="img"
      aria-label={
        hasImage
          ? `Identidad visual de ${company.name}`
          : `Sin logotipo verificado de ${company.name}; se muestran las iniciales ${initials}`
      }
      data-logo-status={status}
      title={
        hasImage
          ? `Identidad visual obtenida de ${sourceHost || "la web pública"}`
          : "Identidad visual provisional: iniciales, nunca una marca inventada"
      }
    >
      {hasImage ? (
        <img
          src={record?.file || ""}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedKey(logoKey)}
        />
      ) : (
        <b aria-hidden="true">{initials}</b>
      )}
    </span>
  );
  if (!showStatus) return mark;
  return (
    <span className={`company-logo-lockup identity-${size}`}>
      {mark}
      <span className="company-logo-meta">
        <b>{STATUS_LABELS[status]}</b>
        <small>{hasImage ? sourceHost || "origen público verificado" : "Iniciales · no es un logo inventado"}</small>
      </span>
    </span>
  );
}
