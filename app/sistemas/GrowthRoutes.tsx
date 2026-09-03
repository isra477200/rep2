"use client";

import { useState } from "react";
import { ALL_GROWTH_ROUTES, GROWTH_ROUTES, ROUTE_KIND_META, routeFitScore, type GrowthRouteKind } from "./growth-routes";
import styles from "./growth-routes.module.css";

export type RouteSystem = {
  id: string;
  name: string;
  phase: string;
  channel: string;
  salesCycle: string;
  unitId: string;
  dimensions: Record<string, number>;
  competitorCount: number;
  decisions: string[];
};

type RouteMode = "routes" | "funnel" | "matrix" | "sprint";

const MODES: Array<{ id: RouteMode; label: string; note: string }> = [
  { id: "routes", label: "4 vías", note: "Qué camino elegir" },
  { id: "funnel", label: "Embudo", note: "Cómo fluye" },
  { id: "matrix", label: "Matriz", note: "Qué encaja mejor" },
  { id: "sprint", label: "Sprint 30 días", note: "Qué hacer" },
];

const KIND_ORDER: GrowthRouteKind[] = ["client", "intent", "demand", "expansion"];
const scoreLabel = (score: number) => score >= 80 ? "Encaje alto" : score >= 68 ? "Encaje medio" : "Validar primero";

const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

export default function GrowthRoutes({ systems, initialSystemId }: { systems: RouteSystem[]; initialSystemId?: string }) {
  const [systemId, setSystemId] = useState(initialSystemId || systems[0]?.id || "legal");
  const [mode, setMode] = useState<RouteMode>("routes");
  const [kind, setKind] = useState<GrowthRouteKind>("client");

  const system = systems.find((item) => item.id === systemId) || systems[0];
  const routes = GROWTH_ROUTES[system?.id] || [];
  const selected = routes.find((item) => item.kind === kind) || routes[0];
  const selectedScore = selected && system ? routeFitScore(selected, system.dimensions) : 0;
  const decisionSummary = [...new Set(system?.decisions || [])].join(" · ") || "Sin clasificación";

  if (!system || !selected) return null;

  const exportMatrix = () => {
    const header = ["Sistema", "Fase", "Ruta", "Ámbito", "Título", "Encaje", "North star", "Decisión"];
    const rows = systems.flatMap((item) => (GROWTH_ROUTES[item.id] || []).map((route) => [
      item.name, item.phase, ROUTE_KIND_META[route.kind].label, ROUTE_KIND_META[route.kind].scope,
      route.title, Math.round(routeFitScore(route, item.dimensions)), route.northStar, route.decision,
    ]));
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    download("40-rutas-redvitalia.csv", [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n"), "text/csv;charset=utf-8");
  };

  return <section className={styles.lab} aria-label="Rutas de crecimiento por sistema">
    <header className={styles.labHeader}>
      <div>
        <p>ARQUITECTURA DE CRECIMIENTO · 40 RUTAS</p>
        <h2>Cuatro maneras de construir cada sistema.</h2>
        <span>Separa la captación B2B de RedVitalia, la ejecución para el cliente, la creación de demanda y la expansión de la cuenta.</span>
      </div>
      <div className={styles.headerControls}>
        {systems.length > 1 ? <label><span>Sistema</span><select value={system.id} onChange={(event) => { setSystemId(event.target.value); setKind("client"); }}>
          {systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label> : null}
        <button onClick={exportMatrix}>Exportar 40 rutas</button>
      </div>
    </header>

    <nav className={styles.modeNav} aria-label="Formas de ver las rutas">
      {MODES.map((item) => <button key={item.id} className={mode === item.id ? styles.modeActive : ""} onClick={() => setMode(item.id)}>
        <strong>{item.label}</strong><span>{item.note}</span>
      </button>)}
    </nav>

    {mode === "routes" ? <>
      <div className={styles.contextStrip}>
        <div><span>SISTEMA</span><strong>{system.name}</strong></div>
        <div><span>FASE</span><strong>{system.phase}</strong></div>
        <div><span>CANAL BASE</span><strong>{system.channel}</strong></div>
        <div><span>CICLO</span><strong>{system.salesCycle}</strong></div>
        <div><span>REFERENCIAS</span><strong>{system.competitorCount} fichas · {decisionSummary}</strong></div>
      </div>
      <div className={styles.routeCards}>
        {routes.map((route) => { const score = routeFitScore(route, system.dimensions); return <button key={route.id} className={selected.id === route.id ? styles.routeSelected : ""} onClick={() => setKind(route.kind)}>
          <span className={styles.routeCode}>{route.code}</span>
          <div><small>{ROUTE_KIND_META[route.kind].scope}</small><h3>{route.title}</h3><p>{route.premise}</p></div>
          <footer><span>{scoreLabel(score)}</span><strong>{Math.round(score)}</strong></footer>
        </button>; })}
      </div>

      <article className={styles.routeDetail}>
        <header>
          <div><p>RUTA {selected.code} · SÍNTESIS E HIPÓTESIS OPERATIVA</p><h2>{selected.title}</h2><span>{ROUTE_KIND_META[selected.kind].label} · {ROUTE_KIND_META[selected.kind].scope}</span></div>
          <div className={styles.fitDial} data-fit={selectedScore >= 80 ? "high" : selectedScore >= 68 ? "mid" : "low"}><strong>{Math.round(selectedScore)}</strong><span>/100</span><small>{scoreLabel(selectedScore)}</small></div>
        </header>
        <div className={styles.routeFacts}>
          <article><span>PARA QUIÉN</span><p>{selected.audience}</p></article>
          <article><span>SEÑAL DE ENTRADA</span><p>{selected.trigger}</p></article>
          <article><span>QUÉ SE OFRECE</span><p>{selected.offer}</p></article>
          <article><span>MÉTRICA NORTE</span><p>{selected.northStar}</p></article>
        </div>
        <div className={styles.channelRow}>{selected.channels.map((channel) => <span key={channel}>{channel}</span>)}</div>
        <div className={styles.miniFunnel}>{selected.funnel.map((step, index) => <div key={step}><i>{String(index + 1).padStart(2, "0")}</i><span>{step}</span></div>)}</div>
        <div className={styles.detailColumns}>
          <section><h3>Qué debe existir</h3>{selected.assets.map((item) => <p key={item}>{item}</p>)}</section>
          <section><h3>Cómo se cualifica</h3>{selected.qualification.map((item) => <p key={item}>{item}</p>)}</section>
          <section><h3>Evidencia a utilizar</h3>{selected.evidence.map((item) => <p key={item}>{item}</p>)}</section>
          <section className={styles.guardrail}><h3>Límites</h3>{selected.guardrails.map((item) => <p key={item}>{item}</p>)}</section>
        </div>
        <footer className={styles.decisionBar}>
          <div><span>REGLA DE DECISIÓN</span><strong>{selected.decision}</strong></div>
          <nav><a href={selected.kind === "client" ? "/operacion-comercial" : `/campanas?unidad=${system.unitId}`}>{selected.kind === "client" ? "Abrir operación B2B" : "Abrir campañas"}</a><button onClick={() => download(`ruta-${selected.id}.json`, JSON.stringify({ system, route: selected, fitScore: selectedScore }, null, 2), "application/json")}>Exportar ruta</button></nav>
        </footer>
      </article>
    </> : null}

    {mode === "funnel" ? <div className={styles.funnelBoard}>
      <header><p>CUATRO MOVIMIENTOS · {system.name.toLocaleUpperCase("es")}</p><h2>El mismo sistema visto como flujos diferentes.</h2><span>No todos empiezan en un anuncio ni terminan en un lead.</span></header>
      {routes.map((route) => <article key={route.id}>
        <div className={styles.laneTitle}><i>{route.code}</i><span><small>{ROUTE_KIND_META[route.kind].scope}</small><strong>{route.title}</strong></span></div>
        <div className={styles.laneSteps}>{route.funnel.map((step, index) => <div key={step}><span>{index + 1}</span><p>{step}</p></div>)}</div>
        <div className={styles.laneOutcome}><span>DECIDE</span><strong>{route.northStar}</strong></div>
      </article>)}
    </div> : null}

    {mode === "matrix" ? <div className={styles.matrixWrap}>
      <header><div><p>MATRIZ DE ENCAJE</p><h2>Diez sistemas × cuatro rutas.</h2><span>El encaje se calcula con cuatro dimensiones existentes del modelo; no es un resultado real ni una promesa.</span></div><button onClick={exportMatrix}>Descargar CSV</button></header>
      <div className={styles.matrix}>
        <div className={styles.matrixHead}><span>Sistema</span>{KIND_ORDER.map((item) => <span key={item}>{ROUTE_KIND_META[item].label}<small>{ROUTE_KIND_META[item].dimensions.join(" · ")}</small></span>)}</div>
        {systems.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.phase}</span></div>{KIND_ORDER.map((routeKind) => { const route = GROWTH_ROUTES[item.id]?.find((candidate) => candidate.kind === routeKind); if (!route) return <span key={routeKind}>—</span>; const score = routeFitScore(route, item.dimensions); return <button key={route.id} onClick={() => { setSystemId(item.id); setKind(routeKind); setMode("routes"); }}><strong>{Math.round(score)}</strong><i><b style={{ width: `${score}%` }} /></i><span>{route.title}</span></button>; })}</article>)}
      </div>
      <footer className={styles.formulaNote}>Captar cuenta = experiencia + demostrabilidad + estandarización + competencia favorable · Intención = demanda + cualificación + velocidad + demostrabilidad · Demanda = valor + defendibilidad + volumen + riesgo controlable · Expansión = margen + escalabilidad + estandarización + experiencia.</footer>
    </div> : null}

    {mode === "sprint" ? <div className={styles.sprintBoard}>
      <header><div><p>SPRINT DE ACTIVACIÓN</p><h2>{system.name}: de decisión a señal en 30 días.</h2><span>Elige una ruta. Cada bloque termina con evidencia y una decisión, no con actividad decorativa.</span></div><div>{routes.map((route) => <button key={route.id} className={selected.id === route.id ? styles.sprintSelected : ""} onClick={() => setKind(route.kind)}>{route.code} · {ROUTE_KIND_META[route.kind].label}</button>)}</div></header>
      <div className={styles.sprintTimeline}>{selected.sprint.map((phase, index) => <article key={phase.phase}><div><i>{index + 1}</i><span>{phase.phase}</span></div><h3>{phase.objective}</h3>{phase.actions.map((action) => <p key={action}>{action}</p>)}</article>)}</div>
      <div className={styles.sprintGate}><div><span>SEÑAL QUE DECIDE</span><strong>{selected.northStar}</strong></div><div><span>REGLA</span><strong>{selected.decision}</strong></div><button onClick={() => download(`sprint-${selected.id}.json`, JSON.stringify(selected, null, 2), "application/json")}>Descargar sprint</button></div>
    </div> : null}
  </section>;
}

export const ROUTE_COUNT = ALL_GROWTH_ROUTES.length;
