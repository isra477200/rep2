import type { Metadata } from "next";
import DeliveryCenter from "./DeliveryCenter";

export const metadata: Metadata = {
  title: "Entregables · RedVitalia",
  description: "Paquetes revisables de campañas, landings y creatividad de RedVitalia.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function DeliverablesPage() {
  return <DeliveryCenter />;
}
