import type { Company } from "./data-types";

export type OperationsTab =
  | "command"
  | "factory"
  | "coverage"
  | "review"
  | "experiments"
  | "warroom";

export type ReviewStatus = "pending" | "accepted" | "rejected";

export type ReviewDecision = {
  status: ReviewStatus;
  correctedText: string;
  note: string;
  updatedAt: string;
};

export type ReviewState = Record<string, ReviewDecision>;

export type PrimaryMetric =
  | "ctr"
  | "cpl"
  | "cpql"
  | "appointmentRate"
  | "costPerAppointment"
  | "attendanceRate"
  | "cac"
  | "roas";

export type ExperimentStatus = "planned" | "running" | "completed";

export type StrategicAxis =
  | "exclusivity"
  | "guarantee"
  | "speed"
  | "proof";

export type ExperimentVariant = {
  id: string;
  name: string;
  concept: string;
  spend: string;
  impressions: string;
  clicks: string;
  leads: string;
  qualifiedLeads: string;
  appointments: string;
  attendedAppointments: string;
  sales: string;
  revenue: string;
};

export type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  variable: string;
  primaryMetric: PrimaryMetric;
  status: ExperimentStatus;
  minImpressions: string;
  minLeads: string;
  createdAt: string;
  variants: ExperimentVariant[];
};

export type OperationContext = {
  name: string;
  vertical: string;
  zone: string;
  service: string;
  price: string;
  appointments: string;
  slaMinutes: string;
  guarantee: "none" | "written" | "measurable" | "remedy";
  exclusivity: "none" | "lead" | "territory";
  channel: "Meta" | "Google" | "Meta + Google";
  objective: string;
  strategicAxis: StrategicAxis;
  contactUrl: string;
};

export type OperationEvidence = {
  name: string;
  title: string;
  pattern: string;
  url?: string | null;
  file?: string | null;
};

export type VariantMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  appointments: number;
  attendedAppointments: number;
  sales: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cpql: number | null;
  appointmentRate: number | null;
  costPerAppointment: number | null;
  attendanceRate: number | null;
  cac: number | null;
  roas: number | null;
};

export type ExperimentEvaluation = {
  ready: boolean;
  decision:
    | "open"
    | "invalid"
    | "insufficient"
    | "inconclusive"
    | "leader"
    | "winner";
  leaderId: string | null;
  winnerId: string | null;
  message: string;
  values: Record<string, number | null>;
  confidence: number | null;
  validationIssues?: string[];
};

export const defaultOperationContext: OperationContext = {
  name: "Nueva operación RedVitalia",
  vertical: "",
  zone: "",
  service: "",
  price: "",
  appointments: "",
  slaMinutes: "",
  guarantee: "none",
  exclusivity: "none",
  channel: "Meta + Google",
  objective: "Validar una oferta defendible antes de escalar inversión",
  strategicAxis: "exclusivity",
  contactUrl: "",
};

const numberValue = (value: string) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const ratio = (numerator: number, denominator: number, scale = 1) =>
  denominator > 0 ? (numerator / denominator) * scale : null;

export const computeVariantMetrics = (
  variant: ExperimentVariant,
): VariantMetrics => {
  const spend = numberValue(variant.spend);
  const impressions = numberValue(variant.impressions);
  const clicks = numberValue(variant.clicks);
  const leads = numberValue(variant.leads);
  const qualifiedLeads = numberValue(variant.qualifiedLeads);
  const appointments = numberValue(variant.appointments);
  const attendedAppointments = numberValue(variant.attendedAppointments);
  const sales = numberValue(variant.sales);
  const revenue = numberValue(variant.revenue);
  return {
    spend,
    impressions,
    clicks,
    leads,
    qualifiedLeads,
    appointments,
    attendedAppointments,
    sales,
    revenue,
    ctr: ratio(clicks, impressions, 100),
    cpc: ratio(spend, clicks),
    cpl: ratio(spend, leads),
    cpql: ratio(spend, qualifiedLeads),
    appointmentRate: ratio(appointments, leads, 100),
    costPerAppointment: ratio(spend, appointments),
    attendanceRate: ratio(attendedAppointments, appointments, 100),
    cac: ratio(spend, sales),
    roas: ratio(revenue, spend),
  };
};

const metricNeedsLeads = () => true;

const lowerIsBetter = (metric: PrimaryMetric) =>
  ["cpl", "cpql", "costPerAppointment", "cac"].includes(metric);

export const metricLabel = (metric: PrimaryMetric) =>
  ({
    ctr: "CTR",
    cpl: "CPL",
    cpql: "CPQL",
    appointmentRate: "Lead → cita",
    costPerAppointment: "Coste por cita",
    attendanceRate: "Asistencia",
    cac: "CAC",
    roas: "ROAS",
  })[metric];

const erf = (value: number) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return sign * y;
};

const normalCdf = (value: number) => (1 + erf(value / Math.sqrt(2))) / 2;

const proportionTest = (
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
) => {
  if (totalA <= 0 || totalB <= 0) return null;
  if (
    successA < 5 ||
    totalA - successA < 5 ||
    successB < 5 ||
    totalB - successB < 5
  )
    return null;
  const pA = successA / totalA;
  const pB = successB / totalB;
  const pooled = (successA + successB) / (totalA + totalB);
  const error = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
  if (!Number.isFinite(error) || error <= 0) return null;
  const z = Math.abs(pA - pB) / error;
  const pValue = 2 * (1 - normalCdf(z));
  return { pValue, confidence: 1 - pValue, pA, pB };
};

const experimentValidationIssues = (experiment: Experiment) => {
  const issues: string[] = [];
  if (numberValue(experiment.minImpressions) <= 0)
    issues.push("El mínimo de impresiones debe ser mayor que cero.");
  if (numberValue(experiment.minLeads) <= 0)
    issues.push("El mínimo de leads debe ser mayor que cero.");
  experiment.variants.forEach((variant) => {
    const metrics = computeVariantMetrics(variant);
    const label = variant.name || "Variante sin nombre";
    if (metrics.clicks > metrics.impressions)
      issues.push(`${label}: los clics superan las impresiones.`);
    if (metrics.qualifiedLeads > metrics.leads)
      issues.push(`${label}: los leads cualificados superan los leads.`);
    if (metrics.appointments > metrics.leads)
      issues.push(`${label}: las citas superan los leads.`);
    if (metrics.attendedAppointments > metrics.appointments)
      issues.push(`${label}: las asistencias superan las citas reservadas.`);
    if (metrics.sales > metrics.leads)
      issues.push(`${label}: las ventas superan los leads.`);
    if (metrics.sales > metrics.attendedAppointments)
      issues.push(`${label}: las ventas superan las citas asistidas.`);
    if (
      experiment.status === "completed" &&
      metrics.impressions > 0 &&
      metrics.spend <= 0
    )
      issues.push(`${label}: un test publicitario cerrado necesita gasto registrado.`);
  });
  return [...new Set(issues)];
};

export const evaluateExperiment = (
  experiment: Experiment,
): ExperimentEvaluation => {
  const minImpressions = Math.max(
    1000,
    numberValue(experiment.minImpressions),
  );
  const minLeads = Math.max(20, numberValue(experiment.minLeads));
  const metrics = experiment.variants.map((variant) => ({
    id: variant.id,
    values: computeVariantMetrics(variant),
  }));
  const values = Object.fromEntries(
    metrics.map((entry) => [entry.id, entry.values[experiment.primaryMetric]]),
  );
  const validationIssues = experimentValidationIssues(experiment);
  if (validationIssues.length) {
    return {
      ready: false,
      decision: "invalid",
      leaderId: null,
      winnerId: null,
      values,
      message: "Hay datos incoherentes o umbrales inválidos. Corrígelos antes de comparar.",
      confidence: null,
      validationIssues,
    };
  }
  const hasMinimums = metrics.every(
    ({ values: item }) =>
      item.impressions >= minImpressions &&
      (!metricNeedsLeads() || item.leads >= minLeads) &&
      item[experiment.primaryMetric] !== null,
  );
  if (experiment.status !== "completed") {
    return {
      ready: false,
      decision: "open",
      leaderId: null,
      winnerId: null,
      values,
      message: "Test abierto: cualquier liderazgo es provisional.",
      confidence: null,
    };
  }
  if (!hasMinimums) {
    return {
      ready: false,
      decision: "insufficient",
      leaderId: null,
      winnerId: null,
      values,
      message: "Test cerrado, pero alguna variante no alcanza los mínimos definidos.",
      confidence: null,
    };
  }
  const ranked = metrics
    .filter((entry) => entry.values[experiment.primaryMetric] !== null)
    .sort((a, b) => {
      const left = a.values[experiment.primaryMetric] as number;
      const right = b.values[experiment.primaryMetric] as number;
      return lowerIsBetter(experiment.primaryMetric)
        ? left - right
        : right - left;
    });
  if (ranked.length < 2) {
    return {
      ready: false,
      decision: "insufficient",
      leaderId: null,
      winnerId: null,
      values,
      message: "No hay suficientes variantes comparables.",
      confidence: null,
    };
  }
  const first = ranked[0].values[experiment.primaryMetric] as number;
  const second = ranked[1].values[experiment.primaryMetric] as number;
  if (Math.abs(first - second) < 0.000001) {
    return {
      ready: true,
      decision: "inconclusive",
      leaderId: null,
      winnerId: null,
      values,
      message: "Empate según el criterio primario definido.",
      confidence: null,
    };
  }
  const leaderId = ranked[0].id;
  if (
    !["ctr", "appointmentRate", "attendanceRate"].includes(
      experiment.primaryMetric,
    )
  ) {
    return {
      ready: true,
      decision: "leader",
      leaderId,
      winnerId: null,
      values,
      message:
        "Líder observado. Los agregados de coste o ingreso no permiten estimar incertidumbre temporal ni declarar ganador.",
      confidence: null,
    };
  }
  const leader = metrics.find((entry) => entry.id === leaderId);
  const competitors = ranked
    .slice(1)
    .map((entry) => metrics.find((metric) => metric.id === entry.id))
    .filter((entry): entry is (typeof metrics)[number] => Boolean(entry));
  if (!leader || !competitors.length) {
    return {
      ready: true,
      decision: "inconclusive",
      leaderId,
      winnerId: null,
      values,
      message: "No se pudo construir la comparación estadística.",
      confidence: null,
    };
  }
  const rateInputs = (
    entry: (typeof metrics)[number],
  ): [number, number] => {
    if (experiment.primaryMetric === "ctr")
      return [entry.values.clicks, entry.values.impressions];
    if (experiment.primaryMetric === "attendanceRate")
      return [entry.values.attendedAppointments, entry.values.appointments];
    return [entry.values.appointments, entry.values.leads];
  };
  const [leaderSuccess, leaderTotal] = rateInputs(leader);
  const comparisons = competitors.map((competitor) => {
    const [success, total] = rateInputs(competitor);
    const comparison = proportionTest(
      leaderSuccess,
      leaderTotal,
      success,
      total,
    );
    const leaderRate = leaderTotal > 0 ? leaderSuccess / leaderTotal : 0;
    const competitorRate = total > 0 ? success / total : 0;
    const relativeLift =
      competitorRate > 0
        ? (leaderRate - competitorRate) / competitorRate
        : leaderRate > 0
          ? Number.POSITIVE_INFINITY
          : 0;
    const guardrailLeader =
      experiment.primaryMetric === "ctr"
        ? leader.values.cpl
        : leader.values.costPerAppointment;
    const guardrailCompetitor =
      experiment.primaryMetric === "ctr"
        ? competitor.values.cpl
        : competitor.values.costPerAppointment;
    return {
      comparison,
      relativeLift,
      guardrailReady:
        guardrailLeader !== null &&
        guardrailCompetitor !== null &&
        guardrailLeader <= guardrailCompetitor * 1.2,
    };
  });
  const requiredConfidence = 1 - 0.05 / comparisons.length;
  const confidence = comparisons.every((item) => item.comparison)
    ? Math.min(
        ...comparisons.map((item) => item.comparison?.confidence || 0),
      )
    : null;
  if (
    comparisons.some(
      (item) =>
        !item.comparison ||
        item.comparison.confidence < requiredConfidence ||
        item.relativeLift < 0.05 ||
        !item.guardrailReady,
    )
  ) {
    return {
      ready: true,
      decision: "leader",
      leaderId,
      winnerId: null,
      values,
      confidence,
      message:
        `Líder observado, todavía no ganador: exige ≥${(requiredConfidence * 100).toFixed(1)}% de confianza corregida, lift ≥5% y guardrail de coste frente a cada alternativa.`,
    };
  }
  return {
    ready: true,
    decision: "winner",
    leaderId,
    winnerId: leaderId,
    values,
    message:
      `Ganador estadístico: confianza corregida para ${comparisons.length} comparación(es), lift mínimo y guardrail de coste superados frente a cada alternativa.`,
    confidence,
  };
};

export const blankVariant = (
  name: string,
  concept = "",
): ExperimentVariant => ({
  id: `${Date.now()}-${name}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  concept,
  spend: "",
  impressions: "",
  clicks: "",
  leads: "",
  qualifiedLeads: "",
  appointments: "",
  attendedAppointments: "",
  sales: "",
  revenue: "",
});

export const recommendedExperiment = (
  context: OperationContext,
): Experiment => {
  const axis = context.strategicAxis || "exclusivity";
  const vertical = context.vertical.trim() || "nicho por definir";
  const zone = context.zone.trim() || "zona por definir";
  const service = context.service.trim() || "servicio por definir";
  const sla = context.slaMinutes.trim();
  const slaLabel = sla ? `${sla} minutos` : "un plazo por definir";
  const exclusivityDefinition = context.exclusivity === "lead"
    ? {
        hypothesis:
          "La entrega de cada contacto a una única empresa mejorará el coste por cita frente a una propuesta sin esa regla.",
        concepts: [
          `Especialistas en ${service}`,
          `Cada contacto se entrega a una sola empresa de ${vertical}`,
          `Entrega exclusiva por contacto para ${vertical} en ${zone}, sujeta a contrato`,
        ] as [string, string, string],
      }
    : context.exclusivity === "territory"
      ? {
          hypothesis:
            "Una protección territorial concreta mejorará el coste por cita frente a una propuesta sin esa regla.",
          concepts: [
            `Especialistas en ${service}`,
            `Una sola empresa de ${vertical} por zona, sujeta a disponibilidad`,
            `Territorio protegido para ${vertical} en ${zone}, sujeto a disponibilidad comprobada y contrato`,
          ] as [string, string, string],
        }
      : {
          hypothesis:
            "La regla de exclusividad está pendiente de configurar; no se debe lanzar este test hasta definirla.",
          concepts: [
            `Especialistas en ${service}`,
            "[Definir si la exclusividad será por contacto o por territorio]",
            "[Comprobar disponibilidad y reflejar la regla elegida en el contrato]",
          ] as [string, string, string],
        };
  const guaranteeDefinition = context.guarantee === "none"
    ? {
        hypothesis:
          "La garantía y su remedio están pendientes de configurar; no se debe lanzar este test hasta definirlos.",
        concepts: [
          `Sistema medible de ${service}`,
          "[Definir qué se garantiza, cómo se mide y durante qué periodo]",
          "[Definir por escrito el remedio aplicable si se incumple]",
        ] as [string, string, string],
      }
    : {
        hypothesis:
          "Una garantía configurada por escrito mejorará el coste por cita frente a una promesa sin reducción de riesgo.",
        concepts: [
          `Sistema medible de ${service}`,
          "Criterios y garantía definidos por escrito antes de lanzar",
          context.guarantee === "remedy"
            ? "Si se incumple lo firmado, se aplica el remedio contractual acordado"
            : "Alcance, medición y condiciones de la garantía documentados antes de lanzar",
        ] as [string, string, string],
      };
  const definitions: Record<
    StrategicAxis,
    { label: string; hypothesis: string; concepts: [string, string, string] }
  > = {
    exclusivity: {
      label: "exclusividad",
      ...exclusivityDefinition,
    },
    guarantee: {
      label: "garantía",
      ...guaranteeDefinition,
    },
    speed: {
      label: "velocidad",
      hypothesis:
        "Un SLA concreto de primer contacto mejorará el coste por cita frente a una promesa genérica de rapidez.",
      concepts: [
        `Gestión de oportunidades para ${vertical}`,
        `Objetivo de primer contacto en ${slaLabel}`,
        `${sla ? `SLA de ${sla} minutos` : "SLA pendiente de definir"} medido y revisado cada semana`,
      ],
    },
    proof: {
      label: "prueba",
      hypothesis:
        "Una prueba verificable y enlazada mejorará el coste por cita frente a una afirmación de autoridad genérica.",
      concepts: [
        `Metodología de ${service}`,
        "Proceso auditable desde inversión hasta venta",
        "Evidencia pública enlazada y resultados propios separados por experimento",
      ],
    },
  };
  const definition = definitions[axis];
  return {
    id: `test-${Date.now()}`,
    title: `${vertical} · ${zone} · ${definition.label}`,
    hypothesis: definition.hypothesis,
    variable: definition.label,
    primaryMetric: "costPerAppointment",
    status: "planned",
    minImpressions: "1000",
    minLeads: "20",
    createdAt: new Date().toISOString(),
    variants: definition.concepts.map((concept, index) =>
      blankVariant(`${String.fromCharCode(65 + index)} · ${index ? definition.label : "Control"}`, concept),
    ),
  };
};

const guaranteeText = (value: OperationContext["guarantee"]) =>
  ({
    none: "Sin garantía configurada",
    written: "Garantía escrita en la propuesta",
    measurable: "Garantía medible por volumen, calidad o plazo",
    remedy: "Garantía con un remedio concreto definido en el contrato",
  })[value];

const exclusivityText = (value: OperationContext["exclusivity"]) =>
  ({
    none: "Sin exclusividad",
    lead: "Cada contacto se entrega a un único cliente",
    territory: "Una sola empresa por nicho y zona",
  })[value];

const safeText = (value: string, fallback: string) =>
  value.trim() || fallback;

export const buildOperationMarkdown = (
  context: OperationContext,
  competitor: Company | null,
  evidence: OperationEvidence[],
) => {
  const vertical = safeText(context.vertical, "el nicho elegido");
  const zone = safeText(context.zone, "la zona elegida");
  const service = safeText(context.service, "captación y agenda de citas");
  const appointments = safeText(context.appointments, "el volumen acordado");
  const price = safeText(context.price, "precio por definir");
  const sla = context.slaMinutes.trim();
  const slaLabel = sla ? `${sla} minutos` : "un plazo por definir";
  const experiment = recommendedExperiment(context);
  const competitorBlock = competitor
    ? `\n## Competidor de referencia · observado\n\n- Empresa: ${competitor.name}\n- Oferta pública: ${competitor.offer || "No documentada"}\n- Precio: ${competitor.priceLocal || "No publicado"}\n- Garantía: ${competitor.guarantee || "No publicada"}\n- Contrato: ${competitor.contract || "No publicado"}\n- Canales documentados: ${competitor.channels.join(", ") || "No documentados"}\n`
    : "";
  const sources = evidence.length
    ? evidence
        .slice(0, 8)
        .map(
          (item, index) =>
            `${index + 1}. ${item.name} — ${item.title} · patrón: ${item.pattern}${item.url ? ` · ${item.url}` : item.file ? ` · ${item.file}` : ""}`,
        )
        .join("\n")
    : "Sin referencias seleccionadas. Añadir evidencia antes de lanzar.";
  return `# ${safeText(context.name, "Operación RedVitalia")}

Estado: propuesta editorial para test. No contiene resultados de campaña.

## Contexto operativo

- Nicho: ${vertical}
- Zona: ${zone}
- Servicio: ${service}
- Canal: ${context.channel}
- Objetivo: ${safeText(context.objective, "Validar una oferta antes de escalar")}
- Precio configurado: ${price === "precio por definir" ? price : `${price} €/mes`}
- Objetivo operativo configurado: ${appointments} citas válidas
- SLA propuesto: primer contacto en ${slaLabel}
- Garantía propuesta: ${guaranteeText(context.guarantee)}
- Exclusividad propuesta: ${exclusivityText(context.exclusivity)}

## Posicionamiento · propuesta editorial

RedVitalia instala un sistema de ${service} para ${vertical} en ${zone}, con criterios de cita válida acordados antes del lanzamiento, trazabilidad de cada oportunidad y un responsable operativo visible.

## Oferta · propuesta editorial

Objetivo de ${appointments} citas válidas bajo criterios firmados. Inversión de ${price === "precio por definir" ? price : `${price} €/mes`}. ${guaranteeText(context.guarantee)}. ${exclusivityText(context.exclusivity)}. El objetivo es una condición de diseño del test, no un resultado histórico.

## Test A/B/C · una variable

Variable aislada: ${experiment.variable}.

${experiment.variants.map((variant) => `- ${variant.name}: “${variant.concept}”.`).join("\n")}

Mantener audiencia, presupuesto, formato, periodo y landing constantes. Métrica primaria recomendada: coste por cita válida. Registrar también CTR, CPL, asistencia, venta y CAC.

## Landing · estructura

1. Titular: “${appointments} citas válidas para ${vertical} en ${zone}, con criterios acordados antes de lanzar”.
2. Subtitular: “Captación, cualificación, primer contacto y agenda en un solo sistema”.
3. Prueba: metodología y fuentes verificables; no usar testimonios o cifras no documentadas.
4. Cómo funciona: diagnóstico → criterios → campaña → respuesta en ${slaLabel} → agenda → revisión semanal.
5. Reducción de riesgo: ${guaranteeText(context.guarantee)}.
6. CTA: “Comprobar disponibilidad en ${zone}”.

## Guion de apertura

“He revisado cómo se está publicando ${service} en ${zone}. Queremos validar una propuesta concreta: criterios de cita firmados, objetivo de respuesta en ${slaLabel} y ${exclusivityText(context.exclusivity).toLocaleLowerCase("es")}. ¿Dónde se rompe hoy vuestro proceso: captación, contacto o asistencia?”

## Preguntas de diagnóstico

1. ¿Cuántos leads entran y cuántos reciben respuesta dentro de ${slaLabel}?
2. ¿Qué condiciones convierten una cita en válida para vuestro equipo?
3. ¿Cuántas citas podéis atender sin deteriorar la experiencia?
4. ¿Qué ocurre hoy cuando un lead no responde al primer intento?
5. ¿Qué dato tendría que mejorar para considerar rentable el sistema?

## Objeciones

- “Ya hacemos anuncios”: el test no compara tener o no anuncios; compara promesas con la misma audiencia y medición.
- “Los leads no funcionan”: se separan lead, cita válida, asistencia y venta para localizar la fuga real.
- “Es caro”: la comparación se hará contra coste por cita y CAC, no contra una cuota aislada.
- “Quiero resultados garantizados”: solo se garantiza lo firmado y medible; no se inventa una tasa de cierre.

## Seguimiento WhatsApp

“Te dejo resumida la propuesta para ${vertical} en ${zone}: criterios de cita válida por escrito, primer contacto en ${slaLabel}, ${exclusivityText(context.exclusivity).toLocaleLowerCase("es")} y medición hasta venta. Si encaja, el siguiente paso es fijar capacidad y umbral económico del test.”
${competitorBlock}
## Evidencias utilizadas

${sources}

## Regla de verdad

Los patrones sirven para diseñar el test. En costes o ingresos agregados solo se declara líder observado. La palabra ganador exige test cerrado, mínimos, diferencia estadística, lift mínimo y guardrail de coste.
`;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const buildLandingHtml = (context: OperationContext) => {
  const vertical = escapeHtml(safeText(context.vertical, "tu sector"));
  const zone = escapeHtml(safeText(context.zone, "tu zona"));
  const service = escapeHtml(
    safeText(context.service, "captación y agenda de citas"),
  );
  const appointments = escapeHtml(
    safeText(context.appointments, "el volumen acordado"),
  );
  const rawSla = context.slaMinutes.trim();
  const slaLabel = rawSla
    ? `${escapeHtml(rawSla)} minutos`
    : "un plazo por definir";
  const axis = context.strategicAxis || "exclusivity";
  const exclusivityHeadline = context.exclusivity === "lead"
    ? `${appointments} citas válidas en ${zone}, con entrega a una sola empresa por contacto, sujeta a contrato.`
    : context.exclusivity === "territory"
      ? `${appointments} citas válidas en ${zone}, con protección territorial sujeta a disponibilidad comprobada y contrato.`
      : `${appointments} citas válidas en ${zone}, con una regla de exclusividad pendiente de definir.`;
  const guaranteeHeadline = context.guarantee === "none"
    ? `${appointments} citas válidas en ${zone}, con garantía y remedio pendientes de definir.`
    : `${appointments} citas válidas en ${zone}, con la garantía configurada por escrito antes de lanzar.`;
  const headline = ({
    exclusivity: exclusivityHeadline,
    guarantee: guaranteeHeadline,
    speed: `Objetivo de primer contacto en ${slaLabel} para las oportunidades de ${vertical} en ${zone}.`,
    proof: `${service} en ${zone}, con evidencia y medición separadas desde el primer test.`,
  } as Record<StrategicAxis, string>)[axis];
  const rawContactUrl = safeText(context.contactUrl || "", "");
  const contactUrl = /^(?:https?:|mailto:|tel:)/i.test(rawContactUrl)
    ? escapeHtml(rawContactUrl)
    : "#configurar-contacto";
  const contactLabel = rawContactUrl
    ? "Solicitar diagnóstico"
    : "Configurar destino antes de publicar";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(context.name)}</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;color:#151922}main{max-width:920px;margin:auto;padding:64px 24px}.hero,.card{background:white;border:1px solid #dfe5ef;border-radius:24px;padding:40px;margin-bottom:20px}.eyebrow{color:#0b57d0;font-weight:800;letter-spacing:.1em;font-size:12px}h1{font-size:52px;line-height:1.02;margin:16px 0}p{font-size:18px;line-height:1.6}.cta{display:inline-block;background:#0b57d0;color:white;padding:16px 22px;border-radius:12px;text-decoration:none;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.grid div{background:#eef4ff;padding:18px;border-radius:14px}.fine{font-size:13px;color:#657087}@media(max-width:700px){h1{font-size:36px}.grid{grid-template-columns:1fr}}</style></head>
<body><main><section class="hero"><div class="eyebrow">REDVITALIA · PROPUESTA PARA ${vertical.toUpperCase()}</div><h1>${headline}</h1><p>${service}, cualificación, primer contacto y agenda dentro del mismo sistema.</p><a class="cta" href="#diagnostico">Comprobar encaje en ${zone}</a></section>
<section class="card"><h2>Un proceso que se puede auditar</h2><div class="grid"><div><b>01 · Criterios</b><p>Definimos por escrito qué cuenta como cita válida.</p></div><div><b>02 · Respuesta</b><p>Objetivo operativo de primer contacto en ${slaLabel}.</p></div><div><b>03 · Resultado</b><p>Separamos lead, cita, asistencia y venta.</p></div></div></section>
<section class="card"><h2>Riesgo definido antes de empezar</h2><p>${escapeHtml(guaranteeText(context.guarantee))}. ${escapeHtml(exclusivityText(context.exclusivity))}.</p><p class="fine">El volumen mostrado es el objetivo configurado para la propuesta, no un resultado histórico. La garantía final depende del contrato firmado.</p></section>
<section class="card" id="diagnostico"><h2>Primero comprobamos si encaja</h2><p>Capacidad, zona, criterios de cita y umbral económico. Si no se puede medir, no se lanza.</p><a class="cta" href="${contactUrl}">${contactLabel}</a>${rawContactUrl ? "" : '<p class="fine" id="configurar-contacto">Esta plantilla no incluye un contacto inventado. Vuelve a la Fábrica 360, añade la URL real de WhatsApp, calendario o formulario y descarga de nuevo.</p>'}</section></main></body></html>`;
};

export const formatMetric = (
  metric: keyof Pick<
    VariantMetrics,
    | "ctr"
    | "cpl"
    | "cpql"
    | "appointmentRate"
    | "costPerAppointment"
    | "attendanceRate"
    | "cac"
    | "roas"
  >,
  value: number | null,
) => {
  if (value === null) return "—";
  if (["ctr", "appointmentRate", "attendanceRate"].includes(metric))
    return `${value.toFixed(1)}%`;
  if (metric === "roas") return `${value.toFixed(2)}×`;
  return `${value.toFixed(2)} €`;
};
