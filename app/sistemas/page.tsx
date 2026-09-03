import type { Metadata } from "next";
import NichosDashboard from "./NichosDashboard";

export const metadata: Metadata = {
  title: "Sistemas RedVitalia · Inteligencia Mundial de Captación",
  description:
    "Ampliación operativa por nichos, campañas, economía y competencia, sin sustituir ninguna vista existente del mercado.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function SistemasRedVitaliaPage() {
  return <NichosDashboard />;
}
