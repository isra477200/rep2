"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { AnuncioReal } from "./data-types";
import type {
  ReviewDecision,
  ReviewState,
  ReviewStatus,
} from "./operations-model";
import styles from "./OperationsHub.module.css";

type ConfidenceFilter = "all" | "90" | "75" | "low";

export type OcrReviewPanelProps = {
  items: AnuncioReal[];
  reviewState: ReviewState;
  onReviewState: (next: ReviewState) => void;
  onOpenCompany: (companyId: string) => void;
  defaultConfidence?: ConfidenceFilter;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

const itemKey = (item: AnuncioReal, index: number) =>
  item.archivoSha256 || item.corpusKey || item.file || `${item.id}-${index}`;

const sourceText = (item: AnuncioReal) =>
  [item.titular, item.texto].filter(Boolean).join("\n\n");

const downloadJson = (name: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

export default function OcrReviewPanel({
  items,
  reviewState,
  onReviewState,
  onOpenCompany,
  defaultConfidence = "all",
}: OcrReviewPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "all">("pending");
  const [confidence, setConfidence] = useState<ConfidenceFilter>(defaultConfidence);
  const [cursor, setCursor] = useState(0);
  const normalizedQuery = normalize(query);
  const filtered = useMemo(
    () =>
      items.filter((item, index) => {
        const key = itemKey(item, index);
        const decision = reviewState[key];
        const currentStatus = decision?.status || "pending";
        const score = Number(item.confianza) || 0;
        if (status !== "all" && currentStatus !== status) return false;
        if (confidence === "90" && score < 90) return false;
        if (confidence === "75" && (score < 75 || score >= 90)) return false;
        if (confidence === "low" && score >= 75) return false;
        if (
          normalizedQuery &&
          !normalize(
            `${item.name} ${item.id} ${item.titular} ${item.texto} ${item.plataforma}`,
          ).includes(normalizedQuery)
        )
          return false;
        return true;
      }),
    [confidence, items, normalizedQuery, reviewState, status],
  );
  const safeCursor = filtered.length ? Math.min(cursor, filtered.length - 1) : 0;
  const current = filtered[safeCursor];
  const sourceIndex = current ? items.indexOf(current) : -1;
  const key = current ? itemKey(current, sourceIndex) : "";
  const decision = key ? reviewState[key] : undefined;
  const reviewed = Object.values(reviewState).filter(
    (item) => item.status !== "pending",
  ).length;
  const accepted = Object.values(reviewState).filter(
    (item) => item.status === "accepted",
  ).length;
  const rejected = Object.values(reviewState).filter(
    (item) => item.status === "rejected",
  ).length;

  const updateDecision = (
    patch: Partial<ReviewDecision> & { status?: ReviewStatus },
  ) => {
    if (!current || !key) return;
    const next: ReviewDecision = {
      status: patch.status || decision?.status || "pending",
      correctedText:
        patch.correctedText ?? decision?.correctedText ?? sourceText(current),
      note: patch.note ?? decision?.note ?? "",
      updatedAt: new Date().toISOString(),
    };
    onReviewState({ ...reviewState, [key]: next });
  };

  const chooseFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCursor(0);
  };

  return (
    <section className={styles.panel} aria-labelledby="ocr-review-title">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.kicker}>BANDEJA DE EVIDENCIA · OCR MULTILINGÜE</p>
          <h2 id="ocr-review-title">Validar antes de convertir texto en patrón</h2>
          <p>
            La confianza OCR prioriza la cola; no demuestra literalidad ni atribución.
            Cada decisión queda guardada en este navegador y puede exportarse como
            parche auditable.
          </p>
        </div>
        <div className={styles.reviewStats}>
          <span><b>{items.length}</b> OCR</span>
          <span><b>{reviewed}</b> revisadas</span>
          <span><b>{accepted}</b> aceptadas</span>
          <span><b>{rejected}</b> rechazadas</span>
        </div>
      </div>

      <div className={styles.filterGrid}>
        <label>
          Buscar
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="Empresa, titular o texto…"
          />
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) =>
              chooseFilter(setStatus, event.target.value as ReviewStatus | "all")
            }
          >
            <option value="pending">Pendiente</option>
            <option value="accepted">Aceptada</option>
            <option value="rejected">Rechazada</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label>
          Confianza OCR
          <select
            value={confidence}
            onChange={(event) =>
              chooseFilter(
                setConfidence,
                event.target.value as ConfidenceFilter,
              )
            }
          >
            <option value="all">Todas</option>
            <option value="90">90–100 · revisar primero</option>
            <option value="75">75–89</option>
            <option value="low">55–74 · revisión lenta</option>
          </select>
        </label>
        <button
          className={styles.secondaryButton}
          onClick={() =>
            downloadJson(`revision-ocr-${new Date().toISOString().slice(0, 10)}.json`, {
              generatedAt: new Date().toISOString(),
              sourceItems: items.length,
              reviewed,
              decisions: reviewState,
            })
          }
          disabled={!Object.keys(reviewState).length}
        >
          Exportar revisión
        </button>
      </div>

      {!current ? (
        <div className={styles.emptyState}>
          No hay piezas con estos filtros. Cambia el estado o la confianza.
        </div>
      ) : (
        <div className={styles.reviewer}>
          <div className={styles.reviewVisual}>
            <div className={styles.reviewImage}>
              {current.file ? (
                <img src={current.file} alt={`Captura de ${current.name}`} />
              ) : (
                <span>Sin archivo visual</span>
              )}
            </div>
            <div className={styles.evidenceMeta}>
              <span>{current.plataforma}</span>
              <span>OCR {Number(current.confianza) || 0}%</span>
              <span>{current.atribucion || "Atribución sin clasificar"}</span>
            </div>
            <button
              className={styles.textButton}
              onClick={() => onOpenCompany(current.id)}
            >
              Abrir ficha de {current.name} →
            </button>
          </div>

          <div className={styles.reviewEditor}>
            <div className={styles.reviewTitle}>
              <div>
                <small>PIEZA {safeCursor + 1} DE {filtered.length}</small>
                <h3>{current.name}</h3>
              </div>
              <span className={`${styles.statusBadge} ${styles[decision?.status || "pending"]}`}>
                {decision?.status === "accepted"
                  ? "ACEPTADA"
                  : decision?.status === "rejected"
                    ? "RECHAZADA"
                    : "PENDIENTE"}
              </span>
            </div>
            <label>
              Transcripción corregida
              <textarea
                rows={12}
                value={decision?.correctedText ?? sourceText(current)}
                onChange={(event) =>
                  updateDecision({ correctedText: event.target.value })
                }
              />
            </label>
            <label>
              Nota de validación
              <input
                value={decision?.note || ""}
                onChange={(event) => updateDecision({ note: event.target.value })}
                placeholder="Idioma, recorte, atribución, texto ilegible…"
              />
            </label>
            <div className={styles.reviewActions}>
              <button
                className={styles.acceptButton}
                onClick={() => updateDecision({ status: "accepted" })}
              >
                Aceptar texto
              </button>
              <button
                className={styles.rejectButton}
                onClick={() => updateDecision({ status: "rejected" })}
              >
                Rechazar
              </button>
              <button onClick={() => updateDecision({ status: "pending" })}>
                Dejar pendiente
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      decision?.correctedText ?? sourceText(current),
                    );
                  } catch {
                    // El texto sigue visible y seleccionable si el portapapeles no está disponible.
                  }
                }}
              >
                Copiar
              </button>
            </div>
            <div className={styles.reviewNav}>
              <button
                onClick={() => setCursor(Math.max(0, safeCursor - 1))}
                disabled={safeCursor === 0}
              >
                ← Anterior
              </button>
              <div className={styles.progressTrack} role="progressbar" aria-label="Progreso en la cola filtrada" aria-valuemin={1} aria-valuemax={filtered.length} aria-valuenow={safeCursor + 1}>
                <i style={{ width: `${((safeCursor + 1) / filtered.length) * 100}%` }} />
              </div>
              <button
                onClick={() =>
                  setCursor(Math.min(filtered.length - 1, safeCursor + 1))
                }
                disabled={safeCursor >= filtered.length - 1}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
