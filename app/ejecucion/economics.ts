import { PRICING } from "./catalog.ts";

export type LabInputs = {
  plan: string;
  activation: number;
  media: number;
  cpl: number;
  valid: number;
  contact: number;
  appointment: number;
  show: number;
  close: number;
  ticket: number;
  margin: number;
  duration: number;
  followup: number;
  creative: number;
  commercial: number;
  technology: number;
};

const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const percentage = (value: number) => Math.min(100, nonNegative(value)) / 100;

export const calculateEconomics = (input: LabInputs, factor = 1) => {
  const plan = PRICING.find((item) => item.id === input.plan) || PRICING[0];
  const duration = Math.max(1, Math.round(nonNegative(input.duration)));
  const monthlyMedia = nonNegative(input.media);
  const mediaTotal = monthlyMedia * duration;
  const feeTotal = plan.net * duration;
  const oneTimeCost = nonNegative(input.activation) + nonNegative(input.followup) + nonNegative(input.creative) + nonNegative(input.commercial) + nonNegative(input.technology);
  const adjustedCpl = nonNegative(input.cpl) * Math.max(0.01, nonNegative(factor));
  const leads = adjustedCpl > 0 ? mediaTotal / adjustedCpl : 0;
  const valid = leads * percentage(input.valid);
  const contacted = valid * percentage(input.contact);
  const appointments = contacted * percentage(input.appointment);
  const attended = appointments * percentage(input.show);
  const sales = attended * percentage(input.close);
  const revenue = sales * nonNegative(input.ticket);
  const grossMargin = revenue * percentage(input.margin);
  const totalCost = mediaTotal + feeTotal + oneTimeCost;
  const contribution = grossMargin - totalCost;
  const cac = sales > 0 ? totalCost / sales : 0;
  const costPerAttended = attended > 0 ? totalCost / attended : 0;
  const profitPerSale = nonNegative(input.ticket) * percentage(input.margin);
  const breakEvenSales = profitPerSale > 0 ? totalCost / profitPerSale : 0;
  const salesPerLead = percentage(input.valid) * percentage(input.contact) * percentage(input.appointment) * percentage(input.show) * percentage(input.close);
  const maxCpl = mediaTotal > 0
    ? (profitPerSale * salesPerLead) / (1 + (totalCost - mediaTotal) / mediaTotal)
    : 0;
  const maxCostPerAttended = profitPerSale * percentage(input.close);
  const maxCostPerSale = profitPerSale;
  const roas = mediaTotal > 0 ? revenue / mediaTotal : 0;
  const mer = totalCost > 0 ? revenue / totalCost : 0;
  const monthlyGrossMargin = duration > 0 ? grossMargin / duration : 0;
  const monthlyRecurringCost = monthlyMedia + plan.net;
  const monthlyContributionBeforeOneTime = monthlyGrossMargin - monthlyRecurringCost;
  const recoveryMonths = monthlyContributionBeforeOneTime > 0 ? oneTimeCost / monthlyContributionBeforeOneTime : null;

  return { plan, duration, mediaTotal, feeTotal, oneTimeCost, leads, valid, contacted, appointments, attended, sales, revenue, grossMargin, totalCost, contribution, cac, costPerAttended, breakEvenSales, maxCpl, maxCostPerAttended, maxCostPerSale, roas, mer, recoveryMonths };
};
