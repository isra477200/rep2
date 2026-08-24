"use client";

import { useMemo, useState } from "react";
import type { AnuncioReal, Company } from "./data-types";
import {
  buildLandingHtml,
  buildOperationMarkdown,
  recommendedExperiment,
  type Experiment,
  type OperationContext,
  type OperationEvidence,
  type StrategicAxis,
} from "./operations-model";
import styles from "./OperationsHub.module.css";

export type OperationFactoryPanelProps = {
  companies: Company[];
  corpus: AnuncioReal[];
  context: OperationContext;
  onContext: (next: OperationContext) => void;
  onAddExperiment: (experiment: Experiment) => void;
  onOpenCompany: (companyId: string) => void;
};

const axisRules: Record<
  StrategicAxis,
  { label: string; pattern: RegExp; reason: string }
> = {
  exclusivity: {
    label: "Exclusividad territorial",
    pattern: /exclusiv|territori|una sola empresa|tu zona|tu ciudad/i,
    reason: "Señal poco frecuente y diferenciable; debe probarse, no asumirse.",
  },
  guarantee: {
    label: "Garantía medible",
    pattern: /garant|devolv|reembols|no pagas|sin riesgo/i,
    reason: "Reduce riesgo percibido cuando el remedio está escrito y es operativo.",
  },
  speed: {
    label: "Velocidad / SLA",
    pattern: /\d+\s*(?:min|hora|día)|24\s*\/\s*7|tiempo real|inmediat/i,
    reason: "Convierte una promesa difusa en un estándar verificable de operación.",
  },
  proof: {
    label: "Prueba y autoridad",
    pattern: /testimoni|reseña|caso de éxito|líder|más de \d|\d+\+/i,
    reason: "La prueba debe enlazarse a una fuente; nunca se rellena con cifras inventadas.",
  },
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

const download = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const slug = (value: string) =>
  normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
  "operacion-redvitalia";

export default function OperationFactoryPanel({
  companies,
  corpus,
  context,
  onContext,
  onAddExperiment,
  onOpenCompany,
}: OperationFactoryPanelProps) {
  const [competitorId, setCompetitorId] = useState("");
  const [copied, setCopied] = useState(false);
  const axis: StrategicAxis = context.strategicAxis || "exclusivity";
  const competitor = companies.find((company) => company.id === competitorId) || null;
  const candidates = useMemo(() => {
    const rule = axisRules[axis].pattern;
    return corpus
      .filter((item) => item.aptaPatrones !== false)
      .filter((item) =>
        rule.test(
          `${item.titular} ${item.texto} ${item.precioVisible} ${item.angulo}`,
        ),
      )
      .slice(0, 12);
  }, [axis, corpus]);
  const evidence: OperationEvidence[] = candidates.map((item) => ({
    name: item.name,
    title: item.titular || item.texto.slice(0, 100),
    pattern: axisRules[axis].label,
    url: item.fuenteUrl,
    file: item.file,
  }));
  const markdown = useMemo(
    () => buildOperationMarkdown(context, competitor, evidence),
    [competitor, context, evidence],
  );
  const landingHtml = useMemo(() => buildLandingHtml(context), [context]);
  const operationSlug = slug(`${context.name}-${context.zone}`);
  const fieldsReady = [
    context.vertical,
    context.zone,
    context.service,
    context.price,
    context.appointments,
    context.slaMinutes,
  ].every((value) => value.trim().length > 0);
  const axisReady =
    axis === "exclusivity"
      ? context.exclusivity !== "none"
      : axis === "guarantee"
        ? context.guarantee !== "none"
        : true;
  const outputReady = fieldsReady && axisReady;
  const readinessMessage = !fieldsReady
    ? "Completa nicho, zona, servicio, precio, objetivo y SLA para habilitar el paquete."
    : axis === "exclusivity" && !axisReady
      ? "Configura la exclusividad que quieres probar antes de copiar, descargar o guardar."
      : axis === "guarantee" && !axisReady
        ? "Configura una garantía real antes de copiar, descargar o guardar."
        : "";

  const change = <K extends keyof OperationContext>(
    key: K,
    value: OperationContext[K],
  ) => onContext({ ...context, [key]: value });

  return (
    <section className={styles.panel} aria-labelledby="factory-title">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.kicker}>FÁBRICA 360 · UN CONTEXTO, TODO EL PAQUETE</p>
          <h2 id="factory-title">Crear una operación completa y trazable</h2>
          <p>
            Posicionamiento, anuncios A/B/C, landing, guion, objeciones,
            seguimiento y ficha de experimento nacen del mismo contexto.
          </p>
        </div>
        <div className={styles.truthLegend}>
          <span><i className={styles.observedDot} /> Observado</span>
          <span><i className={styles.inferredDot} /> Inferido</span>
          <span><i className={styles.editorialDot} /> Propuesta editorial</span>
        </div>
      </div>

      <div className={styles.factoryLayout}>
        <div className={styles.contextCard}>
          <div className={styles.stepTitle}><span>01</span><b>Contexto único</b></div>
          <div className={styles.contextGrid}>
            <label className={styles.wideField}>
              Nombre de la operación
              <input value={context.name} onChange={(event) => change("name", event.target.value)} />
            </label>
            <label>
              Nicho
              <input value={context.vertical} onChange={(event) => change("vertical", event.target.value)} placeholder="Ej. clínicas dentales" />
            </label>
            <label>
              Zona
              <input value={context.zone} onChange={(event) => change("zone", event.target.value)} placeholder="Ej. Madrid" />
            </label>
            <label className={styles.wideField}>
              Servicio
              <input value={context.service} onChange={(event) => change("service", event.target.value)} placeholder="Ej. captación y agenda de citas" />
            </label>
            <label>
              Precio mensual €
              <input type="number" min="0" value={context.price} onChange={(event) => change("price", event.target.value)} />
            </label>
            <label>
              Objetivo de citas válidas
              <input type="number" min="0" value={context.appointments} onChange={(event) => change("appointments", event.target.value)} />
            </label>
            <label>
              SLA de primer contacto
              <select value={context.slaMinutes} onChange={(event) => change("slaMinutes", event.target.value)}>
                <option value="">Por definir</option><option value="1">1 minuto</option><option value="2">2 minutos</option><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="30">30 minutos</option><option value="120">2 horas</option>
              </select>
            </label>
            <label>
              Canal
              <select value={context.channel} onChange={(event) => change("channel", event.target.value as OperationContext["channel"])}>
                <option>Meta</option><option>Google</option><option>Meta + Google</option>
              </select>
            </label>
            <label>
              Garantía
              <select value={context.guarantee} onChange={(event) => change("guarantee", event.target.value as OperationContext["guarantee"])}>
                <option value="none">Sin garantía</option><option value="written">Escrita</option><option value="measurable">Medible</option><option value="remedy">Con remedio</option>
              </select>
            </label>
            <label>
              Exclusividad
              <select value={context.exclusivity} onChange={(event) => change("exclusivity", event.target.value as OperationContext["exclusivity"])}>
                <option value="none">Sin exclusividad</option><option value="lead">Lead exclusivo</option><option value="territory">Territorio protegido</option>
              </select>
            </label>
            <label className={styles.wideField}>
              Objetivo de negocio
              <input value={context.objective} onChange={(event) => change("objective", event.target.value)} />
            </label>
            <label className={styles.wideField}>
              Destino real del CTA
              <input type="url" value={context.contactUrl || ""} onChange={(event) => change("contactUrl", event.target.value)} placeholder="https://wa.me/… o URL del calendario" />
            </label>
          </div>
        </div>

        <div className={styles.contextCard}>
          <div className={styles.stepTitle}><span>02</span><b>Fuente estratégica</b></div>
          <label>
            Eje que queremos probar
            <select value={axis} onChange={(event) => change("strategicAxis", event.target.value as StrategicAxis)}>
              {Object.entries(axisRules).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <p className={styles.axisReason}>{axisRules[axis].reason}</p>
          <label>
            Competidor para la battlecard
            <select value={competitorId} onChange={(event) => setCompetitorId(event.target.value)}>
              <option value="">Sin competidor concreto</option>
              {companies.slice().sort((a, b) => a.name.localeCompare(b.name, "es")).map((company) => <option key={company.id} value={company.id}>{company.name} · {company.primaryCountry}</option>)}
            </select>
          </label>
          {competitor && (
            <button className={styles.textButton} onClick={() => onOpenCompany(competitor.id)}>
              Abrir evidencia de {competitor.name} →
            </button>
          )}
          <div className={styles.sourceList}>
            <small>{candidates.length} REFERENCIAS APTAS EN LA MUESTRA</small>
            {candidates.slice(0, 5).map((item) => (
              <article key={item.corpusKey || `${item.id}-${item.titular}`}>
                <b>{item.name}</b><span>{item.titular}</span>
                {item.fuenteUrl ? <a href={item.fuenteUrl} target="_blank" rel="noreferrer">Fuente ↗</a> : item.file ? <a href={item.file} target="_blank" rel="noreferrer">Captura ↗</a> : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.operationOutput}>
        <div className={styles.outputHead}>
          <div><p className={styles.kicker}>03 · PAQUETE GENERADO</p><h3>Paquete coherente para revisar y ejecutar</h3>{!outputReady && <small>{readinessMessage}</small>}</div>
          <div className={styles.headActions}>
            <button disabled={!outputReady} onClick={async () => { try { await navigator.clipboard.writeText(markdown); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar paquete"}</button>
            <button disabled={!outputReady} onClick={() => download(`${operationSlug}.md`, markdown, "text/markdown;charset=utf-8")}>Descargar operación</button>
            <button disabled={!outputReady} onClick={() => download(`${operationSlug}-landing.html`, landingHtml, "text/html;charset=utf-8")}>Descargar landing</button>
            <button disabled={!outputReady} className={styles.primaryButton} onClick={() => onAddExperiment(recommendedExperiment(context))}>Guardar como test</button>
          </div>
        </div>
        <pre className={styles.operationPreview}>{markdown}</pre>
      </div>
    </section>
  );
}
