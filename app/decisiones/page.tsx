import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Decisiones · Ejecución RedVitalia", description: "Decisiones de cartera con evidencia, riesgo y aprobación humana." };
export default function DecisionsPage() { return <ExecutionWorkspace kind="decisions" />; }
