export type CommercialModelId = "managed-pilot" | "qualified-opportunity" | "held-meeting";

export type CommercialModel = {
  id: CommercialModelId;
  label: string;
  short: string;
  charge: string;
  bestFor: string;
  condition: string;
};

export const commercialModels: CommercialModel[] = [
  {
    id: "managed-pilot",
    label: "Piloto gestionado",
    short: "RedVitalia diseña, lanza y optimiza el sistema completo.",
    charge: "Configuración + gestión mensual + inversión publicitaria del cliente.",
    bestFor: "clientes que necesitan campaña, landing, seguimiento y aprendizaje desde cero",
    condition: "El resultado se revisa con métricas acordadas; no se vende un volumen garantizado sin histórico.",
  },
  {
    id: "qualified-opportunity",
    label: "Oportunidad válida",
    short: "El cliente paga por cada contacto que cumple la definición pactada.",
    charge: "Precio por oportunidad aceptada, con exclusiones y reclamación por escrito.",
    bestFor: "servicios con criterios objetivos, margen suficiente y respuesta comercial rápida",
    condition: "Definir duplicados, exclusividad, cobertura, plazo de reclamación y evidencia de contacto.",
  },
  {
    id: "held-meeting",
    label: "Reunión celebrada",
    short: "RedVitalia entrega citas que cumplen criterios y llegan a celebrarse.",
    charge: "Precio por reunión celebrada o paquete mensual con mínimo operativo.",
    bestFor: "B2B, servicios consultivos y tickets donde una reunión permite diagnosticar y cerrar",
    condition: "Acordar cargo, empresa, necesidad, asistencia, reprogramaciones y no-show.",
  },
];

export type EconomicsInput = {
  averageTicket: string;
  grossMarginPct: string;
  closeRatePct: string;
  monthlyCapacity: string;
  pilotBudget: string;
  serviceFee: string;
};

export type EconomicsResult = {
  valid: boolean;
  viable: boolean;
  contributionPerSale: number;
  valuePerOpportunity: number;
  maxAcquisitionCost: number;
  targetOpportunities: number;
  expectedSales: number;
  totalPilotCost: number;
  expectedContribution: number;
  expectedNetContribution: number;
  capacityWarning: string;
};

export const ACQUISITION_SAFETY_SHARE = 0.35;

export function parseNumber(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateEconomics(input: EconomicsInput): EconomicsResult {
  const ticket = parseNumber(input.averageTicket);
  const rawMarginPct = parseNumber(input.grossMarginPct);
  const rawCloseRatePct = parseNumber(input.closeRatePct);
  const margin = Math.min(100, Math.max(0, rawMarginPct)) / 100;
  const closeRate = Math.min(100, Math.max(0, rawCloseRatePct)) / 100;
  const capacity = Math.max(0, Math.floor(parseNumber(input.monthlyCapacity)));
  const budget = Math.max(0, parseNumber(input.pilotBudget));
  const serviceFee = Math.max(0, parseNumber(input.serviceFee));
  const contributionPerSale = ticket * margin;
  const valuePerOpportunity = contributionPerSale * closeRate;
  const maxAcquisitionCost = valuePerOpportunity * ACQUISITION_SAFETY_SHARE;
  const budgetTarget = maxAcquisitionCost > 0 ? Math.floor(budget / maxAcquisitionCost) : 0;
  const targetOpportunities = budgetTarget > 0 ? (capacity > 0 ? Math.min(capacity, budgetTarget) : budgetTarget) : 0;
  const expectedSales = targetOpportunities * closeRate;
  const totalPilotCost = budget + serviceFee;
  const expectedContribution = expectedSales * contributionPerSale;
  const expectedNetContribution = expectedContribution - totalPilotCost;
  const valid = ticket > 0 && rawMarginPct > 0 && rawMarginPct <= 100 && rawCloseRatePct > 0 && rawCloseRatePct <= 100 && capacity > 0 && budget > 0 && serviceFee > 0;
  const viable = valid && targetOpportunities > 0 && expectedNetContribution >= 0;
  const capacityWarning = (rawMarginPct > 100 || rawCloseRatePct > 100)
    ? "Margen y tasa de cierre deben estar entre 0% y 100%."
    : budget > 0 && maxAcquisitionCost > 0 && budgetTarget === 0
    ? `La inversión en medios no alcanza ni una oportunidad al coste máximo prudente de ${formatEuro(maxAcquisitionCost)}.`
    : valid && expectedContribution < totalPilotCost
      ? `La contribución esperada de ${formatEuro(expectedContribution)} no cubre el coste total del piloto de ${formatEuro(totalPilotCost)}. No aprobar esta configuración.`
    : capacity && budgetTarget > capacity
    ? `El presupuesto podría generar más oportunidades de las ${capacity} que el equipo declara poder atender.`
    : capacity && budgetTarget && budgetTarget < 5
      ? "El piloto produciría una muestra muy pequeña; conviene ampliar presupuesto o revisar el coste máximo."
      : "Capacidad y presupuesto quedan pendientes de validar con datos reales del cliente.";
  return { valid, viable, contributionPerSale, valuePerOpportunity, maxAcquisitionCost, targetOpportunities, expectedSales, totalPilotCost, expectedContribution, expectedNetContribution, capacityWarning };
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
}
