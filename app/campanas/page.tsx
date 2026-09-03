import type { Metadata } from "next";
import ExecutionWorkspace from "../ejecucion/ExecutionWorkspace";

export const metadata: Metadata = { title: "Campañas · Ejecución RedVitalia", description: "Fábrica de campañas B2B y B2C con aprobación humana." };
export default function CampaignsPage() { return <ExecutionWorkspace kind="campaigns" />; }
