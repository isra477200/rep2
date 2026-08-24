"use client";

import { useMemo, useState } from "react";
import {
  blankVariant,
  computeVariantMetrics,
  evaluateExperiment,
  formatMetric,
  metricLabel,
  recommendedExperiment,
  type Experiment,
  type ExperimentVariant,
  type OperationContext,
  type PrimaryMetric,
} from "./operations-model";
import styles from "./OperationsHub.module.css";

export type ExperimentPanelProps = {
  experiments: Experiment[];
  onExperiments: (next: Experiment[]) => void;
  context: OperationContext;
};

const downloadJson = (experiments: Experiment[]) => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          methodology:
            "Un ganador solo aparece en tasas cuando el test está cerrado, supera mínimos, confianza del 95%, lift del 5% y guardrail de coste. En costes e ingresos agregados se usa líder observado.",
          experiments,
        },
        null,
        2,
      ),
    ],
    { type: "application/json;charset=utf-8" },
  );
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `experimentos-redvitalia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const numericFields: Array<{
  key: keyof Pick<
    ExperimentVariant,
    | "spend"
    | "impressions"
    | "clicks"
    | "leads"
    | "qualifiedLeads"
    | "appointments"
    | "attendedAppointments"
    | "sales"
    | "revenue"
  >;
  label: string;
}> = [
  { key: "spend", label: "Gasto €" },
  { key: "impressions", label: "Impresiones" },
  { key: "clicks", label: "Clics" },
  { key: "leads", label: "Leads" },
  { key: "qualifiedLeads", label: "Leads cualificados" },
  { key: "appointments", label: "Citas reservadas" },
  { key: "attendedAppointments", label: "Citas asistidas" },
  { key: "sales", label: "Ventas" },
  { key: "revenue", label: "Ingresos €" },
];

export default function ExperimentPanel({
  experiments,
  onExperiments,
  context,
}: ExperimentPanelProps) {
  const [activeId, setActiveId] = useState(experiments[0]?.id || "");
  const active =
    experiments.find((experiment) => experiment.id === activeId) ||
    experiments[0] ||
    null;
  const evaluation = useMemo(
    () => (active ? evaluateExperiment(active) : null),
    [active],
  );

  const update = (patch: Partial<Experiment>) => {
    if (!active) return;
    onExperiments(
      experiments.map((item) =>
        item.id === active.id ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateVariant = (
    variantId: string,
    patch: Partial<ExperimentVariant>,
  ) => {
    if (!active) return;
    update({
      variants: active.variants.map((variant) =>
        variant.id === variantId ? { ...variant, ...patch } : variant,
      ),
    });
  };

  const createRecommended = () => {
    const next = recommendedExperiment(context);
    onExperiments([...experiments, next]);
    setActiveId(next.id);
  };

  return (
    <section className={styles.panel} aria-labelledby="experiment-title">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.kicker}>BUCLE DE RESULTADOS · DATOS PROPIOS</p>
          <h2 id="experiment-title">De candidato a aprendizaje demostrable</h2>
          <p>
            Registra el test completo y conecta gasto, lead, cita, venta e ingreso.
            La aplicación bloquea la palabra ganador mientras falten cierre,
            mínimos, coherencia, diferencia estadística corregida, lift o guardrail de coste.
          </p>
        </div>
        <div className={styles.headActions}>
          <button className={styles.primaryButton} onClick={createRecommended}>
            + Test recomendado
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => downloadJson(experiments)}
            disabled={!experiments.length}
          >
            Exportar todo
          </button>
        </div>
      </div>

      {!active ? (
        <div className={styles.emptyState}>
          <h3>No hay experimentos todavía</h3>
          <p>
            Crea un test recomendado desde el contexto de la operación. Nace sin
            métricas y sin ganador.
          </p>
          <button className={styles.primaryButton} onClick={createRecommended}>
            Crear primer test
          </button>
        </div>
      ) : (
        <div className={styles.experimentLayout}>
          <aside className={styles.experimentList}>
            <small>{experiments.length} TESTS GUARDADOS</small>
            {experiments.map((experiment) => (
              <button
                key={experiment.id}
                className={experiment.id === active.id ? styles.activeItem : ""}
                onClick={() => setActiveId(experiment.id)}
              >
                <span>{experiment.status}</span>
                <b>{experiment.title}</b>
                <small>{metricLabel(experiment.primaryMetric)}</small>
              </button>
            ))}
          </aside>

          <div className={styles.experimentEditor}>
            <div className={styles.experimentForm}>
              <label className={styles.wideField}>
                Nombre del test
                <input
                  value={active.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </label>
              <label className={styles.wideField}>
                Hipótesis
                <textarea
                  rows={2}
                  value={active.hypothesis}
                  onChange={(event) => update({ hypothesis: event.target.value })}
                />
              </label>
              <label>
                Única variable
                <input
                  value={active.variable}
                  onChange={(event) => update({ variable: event.target.value })}
                />
              </label>
              <label>
                Estado
                <select
                  value={active.status}
                  onChange={(event) =>
                    update({
                      status: event.target.value as Experiment["status"],
                    })
                  }
                >
                  <option value="planned">Planificado</option>
                  <option value="running">En marcha</option>
                  <option value="completed">Cerrado</option>
                </select>
              </label>
              <label>
                Métrica primaria
                <select
                  value={active.primaryMetric}
                  onChange={(event) =>
                    update({ primaryMetric: event.target.value as PrimaryMetric })
                  }
                >
                  <option value="ctr">CTR</option>
                  <option value="cpl">CPL</option>
                  <option value="cpql">CPQL</option>
                  <option value="appointmentRate">Lead → cita</option>
                  <option value="costPerAppointment">Coste por cita</option>
                  <option value="attendanceRate">Asistencia</option>
                  <option value="cac">CAC</option>
                  <option value="roas">ROAS</option>
                </select>
              </label>
              <label>
                Mín. impresiones / variante · suelo 1.000
                <input
                  type="number"
                  min="1000"
                  value={active.minImpressions}
                  onChange={(event) =>
                    update({ minImpressions: event.target.value })
                  }
                />
              </label>
              <label>
                Mín. leads / variante · suelo 20
                <input
                  type="number"
                  min="20"
                  value={active.minLeads}
                  onChange={(event) => update({ minLeads: event.target.value })}
                />
              </label>
            </div>

            <div
              className={`${styles.evaluationBanner} ${evaluation?.ready ? styles.ready : ""}`}
              aria-live="polite"
            >
              <span>
                {evaluation?.winnerId
                  ? "GANADOR ESTADÍSTICO"
                  : evaluation?.leaderId
                    ? "LÍDER OBSERVADO"
                    : "SIN GANADOR"}
              </span>
              <strong>
                {evaluation?.winnerId || evaluation?.leaderId
                  ? active.variants.find(
                      (variant) =>
                        variant.id ===
                        (evaluation.winnerId || evaluation.leaderId),
                    )?.name
                  : evaluation?.message}
              </strong>
              {(evaluation?.winnerId || evaluation?.leaderId) && (
                <small>
                  {evaluation.message}
                  {evaluation.confidence !== null
                    ? ` Confianza aproximada: ${(evaluation.confidence * 100).toFixed(1)}%.`
                    : ""}
                </small>
              )}
              {evaluation?.validationIssues?.length ? (
                <ul>
                  {evaluation.validationIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className={styles.variantStack}>
              {active.variants.map((variant) => {
                const metrics = computeVariantMetrics(variant);
                const isWinner = evaluation?.winnerId === variant.id;
                const isLeader =
                  !isWinner && evaluation?.leaderId === variant.id;
                return (
                  <article
                    key={variant.id}
                    className={`${styles.variantCard} ${isWinner ? styles.winner : isLeader ? styles.leader : ""}`}
                  >
                    <header>
                      <input
                        value={variant.name}
                        onChange={(event) =>
                          updateVariant(variant.id, { name: event.target.value })
                        }
                        aria-label="Nombre de variante"
                      />
                      {isWinner && <span>GANADOR ESTADÍSTICO</span>}
                      {isLeader && <span>LÍDER OBSERVADO</span>}
                      {active.variants.length > 2 && (
                        <button
                          onClick={() =>
                            update({
                              variants: active.variants.filter(
                                (item) => item.id !== variant.id,
                              ),
                            })
                          }
                          aria-label={`Eliminar ${variant.name}`}
                        >
                          ×
                        </button>
                      )}
                    </header>
                    <label>
                      Concepto / copy aislado
                      <input
                        value={variant.concept}
                        onChange={(event) =>
                          updateVariant(variant.id, { concept: event.target.value })
                        }
                      />
                    </label>
                    <div className={styles.metricInputs}>
                      {numericFields.map((field) => (
                        <label key={field.key}>
                          {field.label}
                          <input
                            type="number"
                            min="0"
                            step={field.key === "spend" || field.key === "revenue" ? "0.01" : "1"}
                            value={variant[field.key]}
                            onChange={(event) =>
                              updateVariant(variant.id, {
                                [field.key]: event.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className={styles.metricResults}>
                      <span><small>CTR</small><b>{formatMetric("ctr", metrics.ctr)}</b></span>
                      <span><small>CPL</small><b>{formatMetric("cpl", metrics.cpl)}</b></span>
                      <span><small>CPQL</small><b>{formatMetric("cpql", metrics.cpql)}</b></span>
                      <span><small>Lead → cita</small><b>{formatMetric("appointmentRate", metrics.appointmentRate)}</b></span>
                      <span><small>Coste / cita</small><b>{formatMetric("costPerAppointment", metrics.costPerAppointment)}</b></span>
                      <span><small>Asistencia</small><b>{formatMetric("attendanceRate", metrics.attendanceRate)}</b></span>
                      <span><small>CAC</small><b>{formatMetric("cac", metrics.cac)}</b></span>
                      <span><small>ROAS</small><b>{formatMetric("roas", metrics.roas)}</b></span>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className={styles.editorFooter}>
              <button
                onClick={() =>
                  update({
                    variants: [
                      ...active.variants,
                      blankVariant(
                        String.fromCharCode(65 + active.variants.length),
                      ),
                    ],
                  })
                }
                disabled={active.variants.length >= 6}
              >
                + Variante
              </button>
              <button
                className={styles.dangerText}
                onClick={() => {
                  const next = experiments.filter(
                    (experiment) => experiment.id !== active.id,
                  );
                  onExperiments(next);
                  setActiveId(next[0]?.id || "");
                }}
              >
                Eliminar test
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
