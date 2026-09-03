"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ExecutionShell from "../ejecucion/ExecutionShell";
import { usePersistentState } from "../ejecucion/storage";
import { CADENCE, CALL_DISPOSITIONS, CLOSER_SCORE, COMMERCIAL_VERTICALS, PIPELINE_STAGES, QA_CALL, type PipelineStage } from "../ejecucion/commercial";
import styles from "./commercial.module.css";

type View = "hoy" | "caller" | "pipeline" | "closer" | "cadencia" | "calidad";
type Prospect = {
  id: string;
  company: string;
  contact: string;
  channel: string;
  unitId: string;
  stage: PipelineStage;
  owner: string;
  nextAction: string;
  nextDate: string;
  priority: "Alta" | "Media" | "Baja";
  notes: string;
};
type Daily = { calls: number; conversations: number; qualified: number; meetings: number; held: number; proposals: number; wins: number };
type Targets = Daily;

const EMPTY_DAILY: Daily = { calls: 0, conversations: 0, qualified: 0, meetings: 0, held: 0, proposals: 0, wins: 0 };
const DEFAULT_TARGETS: Targets = { calls: 60, conversations: 10, qualified: 5, meetings: 3, held: 2, proposals: 1, wins: 1 };
const VIEW_LABELS: Array<{ id: View; label: string }> = [
  { id: "hoy", label: "Hoy" }, { id: "caller", label: "Caller" }, { id: "pipeline", label: "Pipeline" },
  { id: "closer", label: "Closer" }, { id: "cadencia", label: "Cadencia" }, { id: "calidad", label: "Calidad" },
];

const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 400);
};

export default function CommercialOps() {
  const [view, setView] = useState<View>("hoy");
  const [verticalId, setVerticalId] = useState(COMMERCIAL_VERTICALS[0].id);
  const [prospects, setProspects] = usePersistentState<Prospect[]>("commercial-prospects", []);
  const [daily, setDaily] = usePersistentState<Daily>("commercial-daily", EMPTY_DAILY);
  const [targets, setTargets] = usePersistentState<Targets>("commercial-targets", DEFAULT_TARGETS);
  const [score, setScore] = usePersistentState<Record<string, number>>("commercial-closer-score", {});
  const [qa, setQa] = usePersistentState<Record<string, boolean>>("commercial-qa", {});
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");

  const vertical = COMMERCIAL_VERTICALS.find((item) => item.id === verticalId) || COMMERCIAL_VERTICALS[0];
  const totalScore = CLOSER_SCORE.reduce((sum, item) => sum + (score[item.id] || 0), 0);
  const filtered = useMemo(() => prospects.filter((item) => `${item.company} ${item.contact} ${item.owner} ${item.notes}`.toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))), [filter, prospects]);
  const kpis = [
    { key: "calls", label: "Marcaciones", value: daily.calls, target: targets.calls },
    { key: "conversations", label: "Conversaciones", value: daily.conversations, target: targets.conversations },
    { key: "qualified", label: "Cualificados", value: daily.qualified, target: targets.qualified },
    { key: "meetings", label: "Reuniones", value: daily.meetings, target: targets.meetings },
    { key: "held", label: "Celebradas", value: daily.held, target: targets.held },
    { key: "proposals", label: "Propuestas", value: daily.proposals, target: targets.proposals },
    { key: "wins", label: "Ganados", value: daily.wins, target: targets.wins },
  ] as const;

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 1800); };
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); flash("Texto copiado"); };
  const increment = (key: keyof Daily) => setDaily((current) => ({ ...current, [key]: current[key] + 1 }));
  const resetDay = () => { if (window.confirm("¿Reiniciar solamente los contadores de hoy?")) setDaily(EMPTY_DAILY); };
  const addExample = () => {
    if (prospects.length && !window.confirm("Se añadirán tres registros marcados como EJEMPLO. ¿Continuar?")) return;
    const today = new Date();
    const plus = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
    setProspects((current) => [...current,
      { id: crypto.randomUUID(), company: "EJEMPLO - BORRAR · Despacho Norte", contact: "Decisor por validar", channel: "Teléfono", unitId: "segunda-oportunidad", stage: "Contactado", owner: "Caller", nextAction: "Segundo intento", nextDate: plus(1), priority: "Alta", notes: "Registro de demostración; borrar o sustituir." },
      { id: crypto.randomUUID(), company: "EJEMPLO - BORRAR · Clínica Centro", contact: "Gerencia", channel: "LinkedIn", unitId: "dental", stage: "Reunión", owner: "Closer", nextAction: "Preparar diagnóstico", nextDate: plus(2), priority: "Media", notes: "Registro de demostración; no es un cliente real." },
      { id: crypto.randomUUID(), company: "EJEMPLO - BORRAR · Reformas Costa", contact: "Dirección", channel: "Email", unitId: "reformas", stage: "Propuesta", owner: "Closer", nextAction: "Confirmar decisión", nextDate: plus(3), priority: "Alta", notes: "Registro de demostración; no contiene datos reales." },
    ]);
    flash("Ejemplos añadidos y marcados");
  };
  const exportPipeline = () => {
    const headers = ["Empresa", "Contacto", "Canal", "Vertical", "Etapa", "Responsable", "Próxima acción", "Fecha", "Prioridad", "Notas"];
    const rows = prospects.map((item) => [item.company, item.contact, item.channel, COMMERCIAL_VERTICALS.find((v) => v.id === item.unitId)?.name || item.unitId, item.stage, item.owner, item.nextAction, item.nextDate, item.priority, item.notes]);
    download("pipeline-redvitalia.csv", [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };

  return <ExecutionShell active="commercial" compact eyebrow="CAPTACIÓN B2B PARA REDVITALIA" title="La operación comercial, en una sola mesa." description="RedVitalia vende captación a empresas: convierte conversaciones en diagnósticos y controla el pipeline hasta cliente ganado. Este espacio no gestiona los leads B2C de sus clientes." actions={<div className={styles.headerActions}><a href="/assets/ejecucion/enablement/KIT-COMERCIAL-REDVITALIA.zip" download>Descargar kit</a><Link prefetch={false} href="/laboratorio">Economía canónica</Link></div>}>
    <nav className={styles.viewNav} aria-label="Áreas de operación comercial">{VIEW_LABELS.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={view === item.id ? styles.active : ""}>{item.label}</button>)}</nav>

    {view === "hoy" && <>
      <section className={styles.command}>
        <div><p>OBJETIVO DE HOY</p><h2>Actividad visible. Siguiente acción clara.</h2><span>Los contadores se guardan en este navegador. No se envía ningún dato ni se ejecuta publicidad; la revisión humana sigue siendo obligatoria.</span></div>
        <div className={styles.commandActions}><button onClick={() => setView("caller")}>Abrir modo llamada</button><button onClick={() => setShowForm(true)}>Añadir prospecto</button></div>
      </section>
      <section className={styles.kpiGrid} aria-label="Marcador diario">{kpis.map((item) => { const progress = item.target ? Math.min(100, Math.round(item.value / item.target * 100)) : item.value ? 100 : 0; return <article key={item.key}><header><span>{item.label}</span><button aria-label={`Sumar ${item.label}`} onClick={() => increment(item.key)}>+1</button></header><strong>{item.value}<small> / {item.target}</small></strong><div><i style={{ width: `${progress}%` }} /></div><em>{progress}% del objetivo</em></article>; })}</section>
      <section className={styles.todayGrid}>
        <article className={styles.targetPanel}><header><div><p>OBJETIVOS EDITABLES</p><h2>Cuota diaria del equipo</h2></div><button onClick={resetDay}>Reiniciar hoy</button></header><div>{kpis.map((item) => <label key={item.key}><span>{item.label}</span><input type="number" min="0" value={targets[item.key]} onChange={(event) => setTargets((current) => ({ ...current, [item.key]: Number(event.target.value) }))} /></label>)}</div></article>
        <article className={styles.funnelPanel}><p>CONVERSIÓN DE HOY</p><h2>La fuga está en el paso que no avanza.</h2><div className={styles.funnel}>{[
          ["Contacto", daily.calls, daily.conversations], ["Cualificación", daily.conversations, daily.qualified], ["Agenda", daily.qualified, daily.meetings], ["Asistencia", daily.meetings, daily.held], ["Propuesta", daily.held, daily.proposals],
        ].map(([label, from, to]) => <div key={String(label)}><span>{label}</span><b>{Number(from) ? Math.round(Number(to) / Number(from) * 100) : 0}%</b><small>{to} de {from}</small></div>)}</div></article>
      </section>
      <section className={styles.nextSteps}><header><div><p>PRÓXIMAS ACCIONES</p><h2>{prospects.length ? "Nada queda en el aire" : "Empieza con una lista limpia"}</h2></div>{prospects.length ? <button onClick={() => setView("pipeline")}>Ver pipeline completo</button> : <button onClick={addExample}>Cargar ejemplos visibles</button>}</header>{prospects.length ? <div>{prospects.filter((item) => item.stage !== "Ganado" && item.stage !== "Perdido").sort((a,b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 6).map((item) => <article key={item.id}><span data-priority={item.priority}>{item.priority}</span><div><b>{item.company}</b><small>{item.nextAction} · {item.nextDate || "sin fecha"}</small></div><em>{item.stage}</em></article>)}</div> : <p className={styles.empty}>No hay datos ficticios cargados como si fueran reales. Añade tu primer prospecto o carga tres ejemplos claramente marcados.</p>}</section>
    </>}

    {view === "caller" && <section className={styles.callerDesk}>
      <header><div><p>MODO LLAMADA</p><h2>Abre con relevancia; gana el derecho a preguntar.</h2></div><label><span>Vertical</span><select value={verticalId} onChange={(event) => setVerticalId(event.target.value)}>{COMMERCIAL_VERTICALS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></header>
      <div className={styles.scriptGrid}>
        <article className={styles.scriptMain}><div className={styles.step}><i>01</i><p><span>PERMISO</span>“Hola, ¿{`{nombre}`}? Soy {`{tu nombre}`} de RedVitalia. Te llamo por {vertical.name.toLocaleLowerCase("es")}. ¿Te pillo con 30 segundos?”</p></div><div className={styles.step}><i>02</i><p><span>MOTIVO</span>{vertical.opener}</p><button onClick={() => copy(vertical.opener)}>Copiar</button></div><div className={styles.step}><i>03</i><p><span>SI HAY INTERÉS</span>“Perfecto. Para no contarte algo genérico: ¿qué queréis hacer crecer y qué os frena ahora mismo?”</p></div><div className={styles.step}><i>04</i><p><span>AGENDA</span>“Tiene sentido verlo con datos. Reservemos 25 minutos con la persona que decide y revisamos encaje, capacidad y medición. ¿Qué te viene mejor?”</p></div></article>
        <aside>
          <article><p>SEÑAL DE ENCAJE</p><h3>{vertical.signal}</h3></article>
          <article><p>TENSIÓN A EXPLORAR</p><h3>{vertical.tension}</h3></article>
          <article className={styles.redFlag}><p>NO AVANZAR</p><h3>{vertical.noGo}</h3></article>
        </aside>
      </div>
      <div className={styles.questionStrip}>{vertical.questions.map((question, index) => <button key={question} onClick={() => copy(question)}><i>0{index + 1}</i><span>{question}</span></button>)}</div>
      <section className={styles.outcome}><div><p>CIERRA Y REGISTRA</p><h2>¿Qué ocurrió en la llamada?</h2></div><div>{CALL_DISPOSITIONS.map((item) => <button key={item} onClick={() => { increment("calls"); if (["Conversación", "Reunión"].includes(item)) increment("conversations"); if (item === "Reunión") increment("meetings"); flash(`Resultado registrado: ${item}`); }}>{item}</button>)}</div></section>
    </section>}

    {view === "pipeline" && <section className={styles.pipelineSection}>
      <header className={styles.sectionToolbar}><div><p>PIPELINE B2B</p><h2>Una oportunidad sin siguiente acción no es una oportunidad.</h2></div><div><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar empresa o responsable" /><button onClick={() => setShowForm(true)}>Añadir</button><button onClick={exportPipeline} disabled={!prospects.length}>Exportar CSV</button></div></header>
      {!prospects.length ? <div className={styles.bigEmpty}><h3>Pipeline vacío y listo para datos reales.</h3><p>Añade prospectos manualmente o usa ejemplos marcados para aprender el flujo.</p><div><button onClick={() => setShowForm(true)}>Añadir primer prospecto</button><button onClick={addExample}>Cargar ejemplos</button></div></div> : <div className={styles.pipelineBoard}>{PIPELINE_STAGES.map((stage) => <section key={stage}><header><h3>{stage}</h3><span>{filtered.filter((item) => item.stage === stage).length}</span></header><div>{filtered.filter((item) => item.stage === stage).map((item) => { const index = PIPELINE_STAGES.indexOf(item.stage); const unit = COMMERCIAL_VERTICALS.find((v) => v.id === item.unitId); return <article key={item.id}><p><span data-priority={item.priority}>{item.priority}</span>{unit?.name}</p><h4>{item.company}</h4><small>{item.contact} · {item.owner}</small><div><b>{item.nextAction || "Definir siguiente acción"}</b><em>{item.nextDate || "Sin fecha"}</em></div><footer>{index > 0 && <button onClick={() => setProspects((all) => all.map((p) => p.id === item.id ? { ...p, stage: PIPELINE_STAGES[index - 1] } : p))}>←</button>}<button onClick={() => setProspects((all) => all.filter((p) => p.id !== item.id))}>Borrar</button>{index < PIPELINE_STAGES.length - 1 && <button onClick={() => setProspects((all) => all.map((p) => p.id === item.id ? { ...p, stage: PIPELINE_STAGES[index + 1] } : p))}>→</button>}</footer></article>; })}</div></section>)}</div>}
    </section>}

    {view === "closer" && <section className={styles.closerDesk}>
      <header><div><p>DIAGNÓSTICO DEL CLOSER</p><h2>Califica antes de proponer.</h2><span>0 = no existe · 1 = parcial · 2 = claro y verificable</span></div><div className={styles.scoreDial} data-level={totalScore >= 13 ? "high" : totalScore >= 8 ? "mid" : "low"}><strong>{totalScore}</strong><span>/ 16</span><small>{totalScore >= 13 ? "Encaje fuerte" : totalScore >= 8 ? "Encaje condicionado" : "No proponer todavía"}</small></div></header>
      <div className={styles.scoreGrid}>{CLOSER_SCORE.map((item) => <article key={item.id}><div><span>{item.label}</span><p>{item.question}</p></div><div>{[0,1,2].map((value) => <button key={value} onClick={() => setScore((current) => ({ ...current, [item.id]: value }))} className={(score[item.id] || 0) === value ? styles.selected : ""}>{value}</button>)}</div></article>)}</div>
      <div className={styles.decisionGrid}><article><p>0–7 · NO PROPONER</p><h3>Falta base comercial u operativa.</h3><span>Devolver una lista precisa de condiciones que tendrían que cambiar.</span></article><article><p>8–12 · CONDICIONAR</p><h3>Propuesta solo con requisitos.</h3><span>Definir responsables, capacidad, seguimiento y dato de éxito antes de empezar.</span></article><article><p>13–16 · AVANZAR</p><h3>Preparar propuesta y plan mutuo.</h3><span>Objetivo, alcance, dependencias, revisión humana y fecha de decisión.</span></article></div>
      <footer className={styles.closerFooter}><div><b>La tarifa no se memoriza ni se duplica aquí.</b><span>Consulta siempre la fuente económica canónica antes de redactar una propuesta.</span></div><Link prefetch={false} href="/laboratorio">Abrir laboratorio económico →</Link></footer>
    </section>}

    {view === "cadencia" && <section className={styles.cadenceSection}><header><div><p>SECUENCIA DE 15 DÍAS</p><h2>Nueve contactos con un motivo distinto.</h2><span>Personaliza con una observación real. Respeta oposición, privacidad, identificación y normas aplicables al canal.</span></div><a href="/assets/ejecucion/enablement/06-SECUENCIAS-MULTICANAL-B2B.docx" download>Descargar manual editable</a></header><div className={styles.timeline}>{CADENCE.map((item, index) => <article key={item.day}><i>{item.day}</i><div><p>DÍA {item.day} · {item.channel.toLocaleUpperCase("es")}</p><h3>{item.objective}</h3><span>{item.action}</span></div>{index < CADENCE.length - 1 && <b />}</article>)}</div></section>}

      {view === "calidad" && <section className={styles.qualitySection}><header><div><p>COACHING Y CONTROL</p><h2>La calidad se observa en comportamientos.</h2><span>Escucha una llamada completa y marca solo lo que realmente ocurrió.</span></div><div><strong>{Object.values(qa).filter(Boolean).length}/{QA_CALL.length}</strong><small>criterios cumplidos</small></div></header><div className={styles.qaGrid}>{QA_CALL.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(qa[String(index)])} onChange={(event) => setQa((current) => ({ ...current, [String(index)]: event.target.checked }))} /><i>{String(index + 1).padStart(2, "0")}</i><span>{item}</span></label>)}</div><div className={styles.reviewRhythm}><article><b>Diario · 15 min</b><span>Actividad, bloqueos y siguiente acción de oportunidades activas.</span></article><article><b>Semanal · 45 min</b><span>Conversiones por etapa, escucha de dos llamadas y práctica de una objeción.</span></article><article><b>Mensual · 60 min</b><span>Win/loss, economía, calidad de fuente y decisiones por vertical.</span></article></div></section>}

    {showForm && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowForm(false); }}><form className={styles.modal} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const prospect: Prospect = { id: crypto.randomUUID(), company: String(data.get("company") || ""), contact: String(data.get("contact") || "Pendiente"), channel: String(data.get("channel") || "Teléfono"), unitId: String(data.get("unitId") || verticalId), stage: "Lista", owner: String(data.get("owner") || "Sin asignar"), nextAction: String(data.get("nextAction") || "Primer contacto"), nextDate: String(data.get("nextDate") || ""), priority: String(data.get("priority") || "Media") as Prospect["priority"], notes: String(data.get("notes") || "") }; setProspects((current) => [...current, prospect]); setShowForm(false); flash("Prospecto añadido"); }}><header><div><p>NUEVO PROSPECTO</p><h2>Deja preparada la siguiente acción.</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar">×</button></header><div className={styles.formGrid}><label><span>Empresa *</span><input name="company" required /></label><label><span>Contacto</span><input name="contact" /></label><label><span>Vertical *</span><select name="unitId" defaultValue={verticalId}>{COMMERCIAL_VERTICALS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Canal</span><select name="channel"><option>Teléfono</option><option>Email</option><option>LinkedIn</option><option>WhatsApp con base válida</option><option>Referencia</option></select></label><label><span>Responsable</span><input name="owner" placeholder="Caller o closer" /></label><label><span>Prioridad</span><select name="priority"><option>Alta</option><option>Media</option><option>Baja</option></select></label><label><span>Próxima acción *</span><input name="nextAction" required defaultValue="Primer contacto" /></label><label><span>Fecha</span><input name="nextDate" type="date" /></label><label className={styles.full}><span>Notas verificables</span><textarea name="notes" placeholder="Qué sabemos, fuente y qué falta por confirmar" /></label></div><footer><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit">Guardar prospecto</button></footer></form></div>}
    {notice && <div className={styles.toast} role="status">{notice}</div>}
  </ExecutionShell>;
}
