import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Aprendizajes · Ejecución RedVitalia", description: "Reglas de copiar, adaptar, probar, vigilar y descartar." };
export default function LearningsPage() { return <ExecutionWorkspace kind="learnings" />; }
