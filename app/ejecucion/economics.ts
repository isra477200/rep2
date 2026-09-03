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

export const calculateEconomics = (input: LabInputs, factor = 1) => {
  const plan = PRICING.find((item) => item.id === input.plan) || PRICING[0];
  const leads = input.cpl > 0 ? input.media / (input.cpl * factor) : 0;
  const valid = leads * input.valid / 100;
  const contacted = valid * input.contact / 100;
  const appointments = contacted * input.appointment / 100;
  const attended = appointments * input.show / 100;
  const sales = attended * input.close / 100;
  const revenue = sales * input.ticket;
  const grossMargin = revenue * input.margin / 100;
  const totalCost = input.media + plan.net + input.activation + input.followup + input.creative + input.commercial + input.technology;
  const contribution = grossMargin - totalCost;
  const cac = sales > 0 ? totalCost / sales : 0;
  const profitPerSale = input.ticket * input.margin / 100;
  const breakEvenSales = profitPerSale > 0 ? totalCost / profitPerSale : 0;
  const maxCpl = input.media > 0
    ? (profitPerSale * input.valid / 100 * input.contact / 100 * input.appointment / 100 * input.show / 100 * input.close / 100) / (1 + (totalCost - input.media) / input.media)
    : 0;
  const roas = input.media > 0 ? revenue / input.media : 0;
  const mer = totalCost > 0 ? revenue / totalCost : 0;

  return { plan, leads, valid, contacted, appointments, attended, sales, revenue, grossMargin, totalCost, contribution, cac, breakEvenSales, maxCpl, roas, mer };
};
