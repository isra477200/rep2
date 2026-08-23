"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Company, LogoManifest } from "./data-types";

export default function CompanyLogo({
  company,
  logos,
  size = "medium",
}: {
  company: Company;
  logos: LogoManifest;
  size?: "small" | "medium" | "large";
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
  return (
    <span
      className={`company-logo logo-${size}${hasImage ? " has-image" : ""}${tone}`}
      title={
        hasImage
          ? `Identidad visual obtenida de ${record?.source || "la web pública"}`
          : "Identidad visual no localizada; se muestran iniciales"
      }
    >
      {hasImage ? (
        <img
          src={record?.file || ""}
          alt={`Logo de ${company.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedKey(logoKey)}
        />
      ) : (
        <b>{initials}</b>
      )}
    </span>
  );
}
