import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Laboratorio económico · Ejecución RedVitalia", description: "Escenarios editables, contribución, CAC y punto de equilibrio." };
export default function EconomicsPage() { return <ExecutionWorkspace kind="economics" />; }
