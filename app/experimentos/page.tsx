import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Experimentos · Ejecución RedVitalia", description: "Hipótesis, control, criterios de aprobación y aprendizaje." };
export default function ExperimentsPage() { return <ExecutionWorkspace kind="experiments" />; }
