import type { Metadata } from "next";
import MaestroWorkspace from "./MaestroWorkspace";

export const metadata: Metadata = {
  title: "Maestro MiniMax · RedVitalia",
  description: "Centro de mando conversacional para analizar, crear y auditar toda la operación de RedVitalia.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function MaestroPage() {
  return <MaestroWorkspace />;
}
