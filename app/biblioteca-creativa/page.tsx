import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Biblioteca creativa · Ejecución RedVitalia", description: "Conceptos maestros, adaptaciones y metadatos creativos." };
export default function CreativeLibraryPage() { return <ExecutionWorkspace kind="library" />; }
