"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnuncioReal, Company } from "./data-types";
import {
  buildLandingHtml,
  buildOperationLandingBrief,
  buildOperationMarkdown,
  recommendedExperiment,
  type Experiment,
  type OperationContext,
  type OperationEvidence,
  type StrategicAxis,
} from "./operations-model";
import { landingReadiness, type LandingBrief } from "./landings/model";
import styles from "./OperationsHub.module.css";

export type OperationFactoryPanelProps = {
  companies: Company[];
  corpus: AnuncioReal[];
  context: OperationContext;
  onContext: (next: OperationContext) => void;
  onAddExperiment: (experiment: Experiment) => void;
  onOpenCompany: (companyId: string) => void;
  onOpenLanding: (brief: LandingBrief) => void;
};

type IntelligenceOption = {
  id: string;
  label: string;
  detail: string;
  verticalId?: string;
};

type FactoryIntelligence = {
  playbooks: IntelligenceOption[];
  patterns: IntelligenceOption[];
  hypotheses: IntelligenceOption[];
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

const LANDING_VERTICAL_ALIASES: Record<string, string> = {
  "clinics-health": "clinicas-salud",
  generalist: "generalista",
  "reforms-home": "reformas-hogar",
  "b2b-sdr": "b2b-sdr",
  "real-estate": "inmobiliario",
  "legal-finance-insurance": "legal",
  "beauty-wellness": "belleza-bienestar",
  "solar-energy": "solar-energia",
};

export const selectDiverseEvidence = (
  corpus: AnuncioReal[],
  pattern: RegExp,
  market: string,
  limit = 12,
) => {
  const uniqueCompanies = new Map<string, AnuncioReal>();
  for (const item of corpus) {
    if (item.aptaPatrones === false) continue;
    if (market && normalize(item.country || "") !== normalize(market)) continue;
    if (
      !pattern.test(
        `${item.titular} ${item.texto} ${item.precioVisible} ${item.angulo}`,
      )
    )
      continue;
    if (!uniqueCompanies.has(item.id)) uniqueCompanies.set(item.id, item);
    if (uniqueCompanies.size >= limit) break;
  }
  return [...uniqueCompanies.values()];
};

export default function OperationFactoryPanel({
  companies,
  corpus,
  context,
  onContext,
  onAddExperiment,
  onOpenCompany,
  onOpenLanding,
}: OperationFactoryPanelProps) {
  const [competitorId, setCompetitorId] = useState("");
  const [copied, setCopied] = useState(false);
  const [intelligence, setIntelligence] = useState<FactoryIntelligence>({
    playbooks: [],
    patterns: [],
    hypotheses: [],
  });
  const axis: StrategicAxis = context.strategicAxis || "exclusivity";
  const competitor = companies.find((company) => company.id === competitorId) || null;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/competitive-intelligence.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!payload || typeof payload !== "object") return;
        const source = payload as Record<string, unknown>;
        const playbooks = Array.isArray(source.playbooks) ? source.playbooks : [];
        const patterns = Array.isArray(source.patternLibrary)
          ? source.patternLibrary
          : [];
        const ranking = source.hypothesisRanking;
        const hypotheses =
          ranking && typeof ranking === "object" && Array.isArray((ranking as { items?: unknown[] }).items)
            ? (ranking as { items: unknown[] }).items
            : [];
        const record = (value: unknown) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)
            : null;
        setIntelligence({
          playbooks: playbooks.map((value, index) => {
            const item = record(value);
            const denominator = record(item?.denominator);
            return {
              id: String(item?.verticalId || index),
              label: String(item?.label || "Playbook sin nombre"),
              detail: `${Number(denominator?.companies || 0)} empresas · ${Number(denominator?.uniqueIdentities || 0)} identidades · ${Number(denominator?.landingCompanies || 0)} landings`,
              verticalId: String(item?.verticalId || ""),
            };
          }),
          patterns: patterns.map((value, index) => {
            const item = record(value);
            const metrics = record(item?.metrics);
            return {
              id: String(item?.id || index),
              label: String(item?.label || "Patrón sin nombre"),
              detail: `${Number(metrics?.companies || 0)} empresas · ${Number(metrics?.adoptionPct || 0)}% de adopción observada`,
            };
          }),
          hypotheses: hypotheses.map((value, index) => {
            const item = record(value);
            return {
              id: String(item?.patternId || index),
              label: String(item?.label || "Hipótesis sin nombre"),
              detail: String(item?.claim || "Candidato para un test medido"),
            };
          }),
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const candidates = useMemo(() => {
    const rule = axisRules[axis].pattern;
    return selectDiverseEvidence(corpus, rule, context.market, 12);
  }, [axis, context.market, corpus]);
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
  const landingBrief = useMemo(
    () => buildOperationLandingBrief(context),
    [context],
  );
  const landingHtml = useMemo(() => buildLandingHtml(context), [context]);
  const landingQuality = useMemo(
    () => landingReadiness(landingBrief),
    [landingBrief],
  );
  const operationSlug = slug(`${context.name}-${context.zone}`);
  const fieldsReady = [
    context.vertical,
    context.zone,
    context.service,
    context.audience,
    context.result,
    context.offer,
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
    ? "Completa nicho, zona, servicio, público, resultado, oferta, precio, objetivo y SLA para habilitar el paquete."
    : axis === "exclusivity" && !axisReady
      ? "Configura la exclusividad que quieres probar antes de copiar, descargar o guardar."
      : axis === "guarantee" && !axisReady
        ? "Configura una garantía real antes de copiar, descargar o guardar."
        : "";
  const franceExploratory = normalize(context.market) === "francia";
  const selectedPlaybook = intelligence.playbooks.find(
    (item) => item.label === context.sourcePlaybook,
  );

  const change = <K extends keyof OperationContext>(
    key: K,
    value: OperationContext[K],
  ) => onContext({ ...context, [key]: value });

  const applyPlaybook = (label: string) => {
    const selected = intelligence.playbooks.find((item) => item.label === label);
    if (!selected) {
      change("sourcePlaybook", "");
      return;
    }
    onContext({
      ...context,
      market: "España",
      sourcePlaybook: selected.label,
      landingVerticalId:
        LANDING_VERTICAL_ALIASES[selected.verticalId || ""] || "generalista",
      vertical: context.vertical || selected.label,
    });
  };

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
              Mercado
              <select value={context.market} onChange={(event) => change("market", event.target.value)}>
                <option>España</option><option>Francia</option>
              </select>
            </label>
            <label>
              Nicho
              <input value={context.vertical} onChange={(event) => change("vertical", event.target.value)} placeholder="Ej. clínicas dentales" />
            </label>
            <label>
              Motor de landing
              <select value={context.landingVerticalId} onChange={(event) => change("landingVerticalId", event.target.value)}>
                <option value="generalista">Generalista</option><option value="clinicas-salud">Clínicas y salud</option><option value="reformas-hogar">Reformas y hogar</option><option value="solar-energia">Solar y energía</option><option value="inmobiliario">Inmobiliario</option><option value="legal">Legal y seguros</option><option value="coches-motor">Coches y motor</option><option value="b2b-sdr">B2B y SDR</option><option value="belleza-bienestar">Belleza y bienestar</option><option value="hosteleria-turismo">Hostelería y turismo</option>
              </select>
            </label>
            <label>
              Zona
              <input value={context.zone} onChange={(event) => change("zone", event.target.value)} placeholder="Ej. Madrid" />
            </label>
            <label className={styles.wideField}>
              Servicio
              <input value={context.service} onChange={(event) => change("service", event.target.value)} placeholder="Ej. captación y agenda de citas" />
            </label>
            <label className={styles.wideField}>
              Público concreto
              <input value={context.audience} onChange={(event) => change("audience", event.target.value)} placeholder="Ej. clínicas dentales con capacidad para 20 primeras visitas al mes" />
            </label>
            <label className={styles.wideField}>
              Problema observado
              <input value={context.pain} onChange={(event) => change("pain", event.target.value)} placeholder="Ej. solicitudes sin contexto que se enfrían antes del contacto" />
            </label>
            <label className={styles.wideField}>
              Resultado que proponemos
              <input value={context.result} onChange={(event) => change("result", event.target.value)} placeholder="Ej. más conversaciones comerciales con encaje y seguimiento visible" />
            </label>
            <label className={styles.wideField}>
              Oferta completa
              <textarea value={context.offer} onChange={(event) => change("offer", event.target.value)} placeholder="Qué incluye, qué no incluye y cómo funciona" />
            </label>
            <label className={styles.wideField}>
              Prueba propia verificable
              <textarea value={context.proof} onChange={(event) => change("proof", event.target.value)} placeholder="Caso, periodo, muestra, fuente o URL. Déjalo vacío si aún no existe." />
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
              Campos del formulario
              <select value={context.formFields} onChange={(event) => change("formFields", event.target.value)}>
                <option value="3">3 · contacto simple</option><option value="4">4 · reserva</option><option value="5">5 · cualificación</option><option value="6">6 · cualificación alta</option><option value="7">7 · caso complejo</option><option value="8">8 · máximo recomendado</option>
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
          <div className={styles.marketSignal} data-exploratory={franceExploratory}>
            <b>{context.market}</b>
            <span>
              {franceExploratory
                ? "Muestra exploratoria: 26 fichas y 20 negocios con capturas, pero solo 1 pieza publicitaria apta para patrón. Úsala para estudiar landing y funnel; no para afirmar patrones de anuncios."
                : "Muestra sólida: 8 playbooks por vertical, patrones publicitarios y landings capturadas con denominadores explícitos."}
            </span>
          </div>
          <label>
            Playbook país × vertical
            <select value={context.sourcePlaybook} onChange={(event) => applyPlaybook(event.target.value)} disabled={franceExploratory}>
              <option value="">Sin playbook seleccionado</option>
              {intelligence.playbooks.map((item) => <option key={item.id} value={item.label}>{item.label} · {item.detail}</option>)}
            </select>
          </label>
          {selectedPlaybook ? <p className={styles.sourceHint}>Base elegida: {selectedPlaybook.detail}. España; evidencia de mercado, no rendimiento.</p> : null}
          <label>
            Patrón observado
            <select value={context.sourcePattern} onChange={(event) => change("sourcePattern", event.target.value)} disabled={franceExploratory}>
              <option value="">Sin patrón seleccionado</option>
              {intelligence.patterns.map((item) => <option key={item.id} value={item.label}>{item.label} · {item.detail}</option>)}
            </select>
          </label>
          <label>
            Hipótesis medible
            <select value={context.sourceHypothesis} onChange={(event) => change("sourceHypothesis", event.target.value)} disabled={franceExploratory}>
              <option value="">Sin hipótesis seleccionada</option>
              {intelligence.hypotheses.map((item) => <option key={item.id} value={item.detail}>{item.label} · {item.detail}</option>)}
            </select>
          </label>
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
            <small>{candidates.length} EMPRESAS DISTINTAS CON REFERENCIA APTA EN {context.market.toLocaleUpperCase("es")}</small>
            {candidates.slice(0, 5).map((item) => (
              <article key={item.corpusKey || `${item.id}-${item.titular}`}>
                <b>{item.name}</b><span>{item.titular}</span>
                {item.fuenteUrl ? <a href={item.fuenteUrl} target="_blank" rel="noreferrer">Fuente ↗</a> : item.file ? <a href={item.file} target="_blank" rel="noreferrer">Captura ↗</a> : null}
              </article>
            ))}
            {!candidates.length ? <p className={styles.sourceHint}>No hay evidencia publicitaria suficiente para este eje y mercado. Cambia de eje o usa la lectura de landing/funnel como referencia exploratoria.</p> : null}
          </div>
        </div>
      </div>

      <section className={styles.publicationCard} aria-labelledby="publication-title">
        <div className={styles.stepTitle}><span>03</span><b id="publication-title">Entrega, legal y medición</b></div>
        <div className={styles.publicationLayout}>
          <div className={styles.contextGrid}>
            <label>
              Responsable legal
              <input value={context.legalName} onChange={(event) => change("legalName", event.target.value)} placeholder="Razón social o responsable" />
            </label>
            <label>
              Política de privacidad
              <input type="url" value={context.privacyUrl} onChange={(event) => change("privacyUrl", event.target.value)} placeholder="https://…/privacidad" />
            </label>
            <label>
              Política de cookies
              <input type="url" value={context.cookiesUrl} onChange={(event) => change("cookiesUrl", event.target.value)} placeholder="https://…/cookies" />
            </label>
            <label>
              Endpoint real de leads
              <input type="url" value={context.leadEndpoint} onChange={(event) => change("leadEndpoint", event.target.value)} placeholder="https://…/api/leads" />
            </label>
            <label>
              Google Tag Manager
              <input value={context.gtmId} onChange={(event) => change("gtmId", event.target.value)} placeholder="GTM-XXXXXXX" />
            </label>
            <div className={styles.validationChecks}>
              <label><input type="checkbox" checked={context.leadEndpointVerified} onChange={(event) => change("leadEndpointVerified", event.target.checked)} /> Endpoint probado con respuesta 2xx</label>
              <label><input type="checkbox" checked={context.trackingVerified} onChange={(event) => change("trackingVerified", event.target.checked)} /> Evento de conversión comprobado</label>
            </div>
          </div>
          <aside className={styles.landingReadiness}>
            <span>LANDING V3 BASADA EN EVIDENCIA</span>
            <strong>{landingQuality.score}/100</strong>
            <b>{landingQuality.publishable ? "Lista para publicar" : `${landingQuality.blockers.length} bloqueos de publicación`}</b>
            <p>La landing ya usa el mismo motor profesional de Landing Studio. Si faltan legal, entrega o tracking se exporta marcada como borrador y no como página lista.</p>
            <div>
              {landingQuality.blockers.slice(0, 4).map((item) => <small key={item.id}>• {item.label}</small>)}
            </div>
            <button type="button" disabled={!fieldsReady} onClick={() => onOpenLanding(landingBrief)}>Continuar en Landing Studio →</button>
          </aside>
        </div>
      </section>

      <div className={styles.operationOutput}>
        <div className={styles.outputHead}>
          <div><p className={styles.kicker}>04 · PAQUETE GENERADO</p><h3>Paquete coherente para revisar y ejecutar</h3>{!outputReady && <small>{readinessMessage}</small>}</div>
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
