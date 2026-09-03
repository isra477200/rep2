import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Fábrica creativa · Ejecución RedVitalia", description: "Briefs, conceptos, composición y control creativo." };
export default function CreativeFactoryPage() { return <ExecutionWorkspace kind="creative" />; }
