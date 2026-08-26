"use client";
/* eslint-disable @next/next/no-img-element */

import { useId, useState } from "react";
import type {
  Company,
  FunnelV3Form,
  FunnelV3Review,
  Media,
} from "./data-types";
import styles from "./FunnelV3Panel.module.css";

const DEFAULT_VISIBLE_ROWS = 4;

const semanticTextKeys = [
  "text",
  "detail",
  "explanation",
  "finding",
  "summary",
  "headline",
  "promise",
  "trait",
  "pattern",
  "technology",
  "label",
  "name",
  "title",
  "term",
  "question",
  "answer",
  "objection",
  "value",
] as const;

const internalFields = new Set([
  "accessedAt",
  "action",
  "autocomplete",
  "bytes",
  "commitment",
  "destinationLabel",
  "element",
  "embedded",
  "evidenceIds",
  "file",
  "fieldInventoryStatus",
  "formIndex",
  "format",
  "href",
  "id",
  "inputMode",
  "manualOrder",
  "maximum",
  "method",
  "minimum",
  "multiple",
  "pageUrl",
  "parentPageUrl",
  "placeholder",
  "relation",
  "required",
  "requiredBasis",
  "role",
  "sha256",
  "sourceUrl",
  "sourceStage",
  "sourceType",
  "status",
  "submissionPerformed",
  "supports",
  "tag",
  "type",
  "url",
]);

const clean = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";

const isPublicHref = (input?: string | null) => {
  if (!input) return false;
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !/(^|\.)notion\.(?:com|so|site)$/i.test(hostname) &&
      !/(^|\.)(?:localhost|local|internal)$/i.test(hostname) &&
      !/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        hostname,
      )
    );
  } catch {
    return false;
  }
};

function PublicEvidenceLink({
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

function scalarText(value: unknown, depth = 0): string {
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (!value || typeof value !== "object" || depth > 8) return "";
  if (Array.isArray(value)) {
    return value
      .map((child) => scalarText(child, depth + 1))
      .filter(Boolean)
      .join(" · ");
  }
  const row = value as Record<string, unknown>;
  for (const key of semanticTextKeys) {
    const text = scalarText(row[key], depth + 1);
    if (text) return text;
  }
  for (const [key, child] of Object.entries(row)) {
    if (internalFields.has(key)) continue;
    const text = scalarText(child, depth + 1);
    if (text) return text;
  }
  return "";
}

function flattenText(value: unknown, rows: string[] = [], depth = 0): string[] {
  if (value === null || value === undefined || value === "") return rows;
  if (typeof value === "string" || typeof value === "number") {
    const text = clean(value);
    if (text) rows.push(text);
    return rows;
  }
  if (typeof value === "boolean" || depth > 8) return rows;
  if (Array.isArray(value)) {
    value.forEach((child) => flattenText(child, rows, depth + 1));
    return rows;
  }
  if (typeof value !== "object") return rows;
  const object = value as Record<string, unknown>;
  const preferredKey = semanticTextKeys.find((key) => scalarText(object[key]));
  if (preferredKey) {
    const preferredText = scalarText(object[preferredKey], depth + 1);
    if (preferredText) rows.push(preferredText);
  }
  for (const [key, child] of Object.entries(object)) {
    if (internalFields.has(key) || key === preferredKey) continue;
    flattenText(child, rows, depth + 1);
  }
  return rows;
}

function TextList({
  value,
  empty = "No observable públicamente",
  limit = DEFAULT_VISIBLE_ROWS,
}: {
  value: unknown;
  empty?: string;
  limit?: number;
}) {
  const allRows = [...new Set(flattenText(value))].filter(Boolean);
  const contentKey = allRows.join("\u001f");
  const listId = useId();
  const [disclosure, setDisclosure] = useState({ key: "", expanded: false });
  const expanded = disclosure.key === contentKey && disclosure.expanded;
  const initialRows = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : allRows.length;
  const rows = expanded ? allRows : allRows.slice(0, initialRows);
  const hiddenRows = allRows.length - rows.length;
  if (!rows.length) return <p className="v3-empty">{empty}</p>;
  return (
    <div>
      <ul className="v3-list" id={listId}>
        {rows.map((row, index) => (
          <li key={`${row}-${index}`}>{row}</li>
        ))}
      </ul>
      {allRows.length > initialRows ? (
        <div className={styles.listDisclosure}>
          <button
            type="button"
            className={styles.listToggle}
            aria-controls={listId}
            aria-expanded={expanded}
            onClick={() =>
              setDisclosure((current) => ({
                key: contentKey,
                expanded:
                  current.key === contentKey ? !current.expanded : true,
              }))
            }
          >
            {expanded ? "Ver menos" : `Ver más (${hiddenRows})`}
          </button>
          <span className={styles.listCount}>
            {rows.length} de {allRows.length} hallazgos
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Status({ value }: { value: unknown }) {
  const status = clean(value) || "no observable";
  return (
    <span className={`v3-status ${status.replaceAll(" ", "-").toLowerCase()}`}>
      {status}
    </span>
  );
}

function FormCard({ form, index }: { form: FunnelV3Form; index: number }) {
  const friction =
    typeof form.friction === "string"
      ? form.friction
      : clean(form.friction?.level || form.friction?.reported);
  return (
    <article className="v3-form-card">
      <header>
        <div>
          <small>FORMULARIO {String(index + 1).padStart(2, "0")}</small>
          <h5>{clean(form.purpose) || "Captura comercial pública"}</h5>
        </div>
        <b>
          {form.visibleFieldCount} campos · {form.requiredFieldCount} obligatorios
        </b>
      </header>
      <p>
        <PublicEvidenceLink href={form.sourceUrl || form.pageUrl}>
          Ver superficie pública
        </PublicEvidenceLink>{" "}
        · método {clean(form.method) || "no visible"} · fricción {friction || "no medible"}
      </p>
      {clean(form.destinationLabel) || Number(form.steps) ? (
        <p>
          {Number(form.steps) ? `${Number(form.steps)} paso(s)` : "Pasos no determinados"}
          {clean(form.destinationLabel) ? ` · destino: ${clean(form.destinationLabel)}` : ""}
        </p>
      ) : null}
      <div className="v3-field-grid">
        {(form.fields || []).map((field, fieldIndex) => (
          <div key={`${field.label || field.name || field.type}-${fieldIndex}`}>
            <span>{field.required ? "Obligatorio" : "Opcional"}</span>
            <strong>
              {clean(field.label || field.name || field.placeholder) || field.type}
            </strong>
            <small>{field.type}</small>
            {field.options?.length ? (
              <details>
                <summary>{field.options.length} opciones</summary>
                <p>
                  {field.options
                    .map((option) => scalarText(option))
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </details>
            ) : null}
          </div>
        ))}
      </div>
      {form.consentText?.length ? (
        <details className="v3-inline-details">
          <summary>Consentimiento visible</summary>
          <TextList value={form.consentText} />
        </details>
      ) : null}
      <small className="v3-safety">No se envió durante la investigación.</small>
    </article>
  );
}

function EvidenceScreenshot({
  item,
  index,
  company,
  collection,
  onMediaOpen,
}: {
  item: FunnelV3Review["evidenceScreenshots"][number];
  index: number;
  company: Company;
  collection: Media[];
  onMediaOpen: (
    media: Media,
    company: Company,
    collection?: Media[],
    source?: "gallery" | "funnel",
  ) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="v3-screenshot-unavailable">
        <span className="v3-screenshot-fallback" role="img" aria-label={`${item.label}: imagen no disponible`}>
          <b>Vista no disponible</b>
          <small>La evidencia textual y su fuente siguen visibles en la ficha.</small>
        </span>
        <span className="v3-screenshot-label">{item.label}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Ampliar ${item.label} de ${company.name}`}
      onClick={() =>
        onMediaOpen(
          {
            file: item.file,
            type: item.type,
            bytes: item.bytes,
            order: index + 1,
            label: item.label,
          },
          company,
          collection,
          "funnel",
        )
      }
    >
      <img
        src={item.file}
        alt={`${item.label} de ${company.name}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span className="v3-screenshot-label">{item.label}</span>
    </button>
  );
}

export default function FunnelV3Panel({
  review,
  company,
  onMediaOpen,
}: {
  review: FunnelV3Review;
  company: Company;
  onMediaOpen: (
    media: Media,
    company: Company,
    collection?: Media[],
    source?: "gallery" | "funnel",
  ) => void;
}) {
  const message = review.messageArchitecture || {};
  const voice = (message.voiceAnalysis || {}) as Record<string, unknown>;
  const cta = review.ctaLadder || {};
  const capture = review.captureAndQualification || {};
  const forms = (capture.forms || []) as FunnelV3Form[];
  const primary = (cta.primary || {}) as Record<string, unknown>;
  const price = review.offerEconomics || {};
  const screenshotCollection: Media[] = (review.evidenceScreenshots || []).map(
    (item, index) => ({
      file: item.file,
      type: item.type,
      bytes: item.bytes,
      order: index + 1,
      label: item.label,
    }),
  );
  const allCtas = [
    ...((cta.lowCommitment || []) as unknown[]),
    ...((cta.mediumCommitment || []) as unknown[]),
    ...((cta.highCommitment || []) as unknown[]),
  ];
  return (
    <div className="v3-review">
      <section className="v3-kpis">
        <article>
          <span>ESTADO</span>
          <strong>{review.status}</strong>
          <small>Auditoría comercial verificada</small>
        </article>
        <article>
          <span>COBERTURA PÚBLICA</span>
          <strong>{review.coveragePercent}%</strong>
          <small>Sin rellenar fases privadas</small>
        </article>
        <article>
          <span>CAPTURA INVENTARIADA</span>
          <strong>{forms.length}</strong>
          <small>
            {forms.reduce((sum, form) => sum + Number(form.visibleFieldCount || 0), 0)} campos visibles
          </small>
        </article>
        <article>
          <span>EVIDENCIA</span>
          <strong>{review.evidence?.length || 0}</strong>
          <small>{review.verification.manualEvidence ? "Incluye revisión manual" : "Evidencia renderizada"}</small>
        </article>
      </section>

      <section className="v3-message-card">
        <div>
          <p className="eyebrow">CÓMO HABLA Y QUÉ PROMETE</p>
          <blockquote>
            {clean(message.headline || message.promise) || "Mensaje principal no observable"}
          </blockquote>
          <p>{clean(message.promise)}</p>
          <p>
            <b>Público:</b> {clean(message.audience) || "No delimitado públicamente"}
          </p>
        </div>
        <div>
          <h5>Voz comercial</h5>
          <div className="record-badges light">
            {((message.tone || []) as unknown[]).map((row, index) => (
              <span key={`${scalarText(row)}-${index}`}>{scalarText(row)}</span>
            ))}
          </div>
          <p>{clean(voice.addressStyle)}</p>
          <TextList value={voice.dominantTraits} empty="Tono no clasificable con evidencia suficiente" />
        </div>
        <details>
          <summary>Patrones verbales, dolores, resultados y mecanismo</summary>
          <div className="v3-three-columns">
            <article>
              <h6>Patrones</h6>
              <TextList value={message.languagePatterns} />
            </article>
            <article>
              <h6>Dolores y resultados</h6>
              <TextList value={[message.painLanguage, message.outcomeLanguage]} />
            </article>
            <article>
              <h6>Mecanismo y contradicciones</h6>
              <TextList value={[message.mechanism, message.contradictions]} />
            </article>
          </div>
        </details>
        {message.manualDimension ? (
          <details>
            <summary>Arquitectura manual completa: submensaje, diferenciales, resultados y prueba</summary>
            <TextList value={message.manualDimension} />
          </details>
        ) : null}
      </section>

      <section className="v3-two-columns">
        <article className="v3-card">
          <p className="eyebrow">ESCALERA DE CONVERSIÓN</p>
          <Status value={cta.status} />
          <h4>{clean(primary.text || primary.label) || "CTA principal no observable"}</h4>
          <PublicEvidenceLink href={clean(primary.href)}>
            {clean(primary.href) ? "Abrir destino del CTA" : "Destino no publicable o no observado"}
          </PublicEvidenceLink>
          <TextList value={allCtas} empty="Sin CTA secundarios documentados" />
          {cta.manualLadder ? (
            <details className="v3-inline-details">
              <summary>Escalera manual completa y progresión de compromiso</summary>
              <TextList value={cta.manualLadder} />
            </details>
          ) : null}
        </article>
        <article className="v3-card">
          <p className="eyebrow">CUALIFICACIÓN</p>
          <Status value={capture.status} />
          <h4>{clean(capture.explanation) || "Qué pide antes de hablar"}</h4>
          <TextList value={capture.qualificationDimensions} empty="Sin filtros explícitos observables" />
          <TextList value={capture.contactChannels} empty="Sin canal directo observable" />
          {capture.manualCapture ? (
            <details className="v3-inline-details">
              <summary>Consentimiento, filtros, fricción, agenda, chat y contacto</summary>
              <TextList value={capture.manualCapture} />
            </details>
          ) : null}
        </article>
      </section>

      {forms.length ? (
        <section className="v3-forms">
          <div className="v3-section-title">
            <p className="eyebrow">FORMULARIOS Y CAMPOS EXACTOS</p>
            <h4>Qué pregunta, qué obliga y dónde introduce fricción</h4>
          </div>
          {forms.map((form, index) => (
            <FormCard form={form} index={index} key={`${form.sourceUrl || form.pageUrl}-${index}`} />
          ))}
        </section>
      ) : null}

      <section className="v3-card">
        <div className="v3-section-title">
          <p className="eyebrow">FUNNEL DE VENTA · 12 ETAPAS</p>
          <h4>Observado, inferido y no observable sin mezclarlos</h4>
        </div>
        <div className="v3-funnel">
          {(review.funnel || []).map((stage, index) => (
            <article key={`${stage.stage}-${index}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <Status value={stage.status} />
                <h5>{stage.stage}</h5>
                <p>{scalarText(stage.detail) || "Detalle no observable públicamente"}</p>
                {stage.manualFindings?.length ? (
                  <details>
                    <summary>Hallazgos manuales</summary>
                    <TextList value={stage.manualFindings} />
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="v3-two-columns">
        <article className="v3-card">
          <p className="eyebrow">OFERTA Y ECONOMÍA</p>
          <Status value={price.status} />
          <h4>{clean(price.offer) || company.offer || "Oferta no observable"}</h4>
          <TextList value={price.productsOrPlans} empty="Sin planes públicos inequívocos" />
          <TextList value={price.manualPriceConversions} empty="Sin precios adicionales convertibles" />
          <TextList value={price.unknowns} />
        </article>
        <article className="v3-card">
          <p className="eyebrow">CONTRATO, GARANTÍA Y RIESGO</p>
          <h4>{clean(price.billingModel) || "Modelo de cobro no determinado"}</h4>
          <TextList value={[price.contract, price.guarantee, price.guaranteeSignals, price.manualTerms]} />
        </article>
      </section>

      <section className="v3-three-columns">
        <article className="v3-card">
          <p className="eyebrow">PRUEBA Y CONFIANZA</p>
          <Status value={review.proofAndTrust?.status} />
          <TextList value={review.proofAndTrust} />
        </article>
        <article className="v3-card">
          <p className="eyebrow">OBJECIONES Y VENTA</p>
          <Status value={review.objectionsAndSales?.status} />
          <TextList value={review.objectionsAndSales} />
        </article>
        <article className="v3-card">
          <p className="eyebrow">TECNOLOGÍA Y NURTURE</p>
          <Status value={review.technologyAndNurture?.status} />
          <TextList value={review.technologyAndNurture} />
        </article>
      </section>

      <section className="v3-two-columns">
        <article className="v3-card">
          <p className="eyebrow">ADQUISICIÓN Y ENTRADAS</p>
          <Status value={review.acquisition?.status} />
          <TextList value={review.acquisition} />
        </article>
        <article className="v3-card">
          <p className="eyebrow">ENTREGA Y OPERACIÓN</p>
          <Status value={review.deliveryOperations?.status} />
          <TextList value={review.deliveryOperations} />
        </article>
      </section>

      <section className="v3-strategy">
        <p className="eyebrow">LECTURA REDVITALIA</p>
        <h4>Qué copiar, adaptar, evitar y probar</h4>
        <div className="v3-three-columns">
          <article>
            <h6>Fortalezas y ángulos</h6>
            <TextList value={[review.competitiveAssessment?.strengths, review.competitiveAssessment?.attackAngles]} />
          </article>
          <article>
            <h6>Copiar / adaptar</h6>
            <TextList value={[review.competitiveAssessment?.copy, review.competitiveAssessment?.adapt, review.competitiveAssessment?.manualLessons]} />
          </article>
          <article>
            <h6>Evitar / probar</h6>
            <TextList value={[review.competitiveAssessment?.weaknesses, review.competitiveAssessment?.avoid, review.competitiveAssessment?.tests]} />
          </article>
        </div>
      </section>

      {review.evidenceScreenshots?.length ? (
        <section className="v3-card">
          <p className="eyebrow">EVIDENCIA VISUAL</p>
          <div className="v3-screenshots">
            {review.evidenceScreenshots.map((item, index) => (
              <EvidenceScreenshot
                key={item.file}
                item={item}
                index={index}
                company={company}
                collection={screenshotCollection}
                onMediaOpen={onMediaOpen}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="v3-two-columns">
        <article className="v3-card">
          <p className="eyebrow">FUENTES PÚBLICAS</p>
          <div className="v3-sources">
            {(review.evidence || []).map((source) =>
              source.url ? (
                <PublicEvidenceLink key={source.id} href={source.url}>
                  {source.id} · {source.title || source.sourceType || "Fuente pública"}
                </PublicEvidenceLink>
              ) : (
                <span className="v3-source-unavailable" key={source.id}>
                  {source.id} · {source.title || "Fuente no disponible"} · {source.limitation || "Limitación documentada"}
                </span>
              ),
            )}
          </div>
        </article>
        <article className="v3-card v3-limitations">
          <p className="eyebrow">LÍMITES EXPLÍCITOS</p>
          <TextList value={review.limitations} />
        </article>
      </section>
    </div>
  );
}
