import type { Metadata } from "next";
import NichosDashboard from "./NichosDashboard";

export const metadata: Metadata = {
  title: "Nichos y competencia · Inteligencia Mundial de Captación · RedVitalia",
  description:
    "Sala de decisión de RedVitalia: cartera de verticales, economía editable, funnel, ejecución y competencia conectada con el mercado.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function NichosPage() {
  return <NichosDashboard />;
}
