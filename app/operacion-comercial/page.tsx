import type { Metadata } from "next";
import CommercialOps from "./CommercialOps";

export const metadata: Metadata = {
  title: "Operación comercial · RedVitalia",
  description: "Sistema interno de prospección, llamadas, diagnóstico, pipeline y control comercial B2B.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function CommercialOperationsPage() {
  return <CommercialOps />;
}
