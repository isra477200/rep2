"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ExecutionShell from "../ejecucion/ExecutionShell";
import { MAESTRO_MODES, maestroMode, type MaestroMessage } from "./types";
import { useMaestro } from "./useMaestro";
import styles from "./maestro.module.css";

const STATUS = {
  checking: { label: "Comprobando conexión", detail: "Verificando el puente privado con n8n." },
  ready: { label: "MiniMax M3 operativo", detail: "Credencial protegida en n8n · listo para encargos." },
  offline: { label: "Conexión no disponible", detail: "El historial local se conserva. Reintenta en unos instantes." },
  unconfigured: { label: "Pendiente de reinicio", detail: "El puente privado se activará al reiniciar el servidor." },
} as const;

const METRICS = [
  ["1.091", "fichas"],
  ["712", "profundas"],
  ["10", "sistemas"],
  ["40", "vías"],
  ["24", "campañas"],
  ["27", "landings"],
] as const;

const copyText = async (text: string) => navigator.clipboard.writeText(text);

function Message({ message, onSave }: { message: MaestroMessage; onSave: () => void }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  return (
    <article className={`${styles.message} ${isAssistant ? styles.assistant : styles.user}`}>
      <header>
        <div><span>{isAssistant ? "✦" : "IS"}</span><strong>{isAssistant ? "Maestro" : "Isra"}</strong></div>
        <time>{new Date(message.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>
      </header>
      <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
      {isAssistant ? <footer>
        <button type="button" onClick={async () => { await copyText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}>{copied ? "Copiado" : "Copiar"}</button>
        <button type="button" onClick={onSave}>Guardar como encargo</button>
      </footer> : null}
    </article>
  );
}

export default function MaestroWorkspace() {
  const maestro = useMaestro();
  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<"conversation" | "tasks">("conversation");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mode = maestroMode(maestro.mode);
  const activeTasks = useMemo(() => maestro.tasks.filter((task) => task.status === "Listo"), [maestro.tasks]);

  useEffect(() => {
    if (view === "conversation") endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [maestro.messages, maestro.busy, view]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;
    setPrompt("");
    setView("conversation");
    await maestro.ask(clean);
  };

  return (
    <ExecutionShell
      active="maestro"
      eyebrow="CENTRO DE MANDO · MINIMAX M3"
      title="Maestro de RedVitalia"
      description="Pregunta, analiza, crea y audita usando el conocimiento estructurado de toda la aplicación. Cada resultado sigue necesitando criterio y aprobación humana."
      compact
      actions={<div className={`${styles.connection} ${styles[`connection_${maestro.status}`]}`}><i /><div><strong>{STATUS[maestro.status].label}</strong><span>{STATUS[maestro.status].detail}</span></div><button type="button" onClick={() => void maestro.checkStatus()}>Revisar</button></div>}
    >
      <section className={styles.commandBar} aria-label="Cobertura del contexto de Maestro">
        <div><span>MEMORIA ACTIVA</span><strong>Toda la operación, en una conversación</strong></div>
        <div className={styles.metrics}>{METRICS.map(([value, label]) => <span key={label}><b>{value}</b>{label}</span>)}</div>
        <p><i /> Solo lectura externa: prepara, compara y produce; no publica ni toca Ads, CRM o mensajes.</p>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.modeRail} aria-label="Modo de trabajo">
          <div className={styles.railHead}><span>01</span><div><strong>Elige cómo debe pensar</strong><small>El modo cambia el tipo de respuesta.</small></div></div>
          <div className={styles.modeList}>
            {MAESTRO_MODES.map((item, index) => <button type="button" key={item.id} className={maestro.mode === item.id ? styles.modeActive : ""} onClick={() => maestro.setMode(item.id)}>
              <i>{String(index + 1).padStart(2, "0")}</i><span><strong>{item.label}</strong><small>{item.short}</small></span>
            </button>)}
          </div>
          <div className={styles.modeDetail}><span>MODO ACTIVO</span><strong>{mode.label}</strong><p>{mode.description}</p></div>
          <div className={styles.suggestions}><span>ATAJOS ÚTILES</span>{mode.prompts.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
        </aside>

        <section className={styles.conversation} aria-label="Conversación con Maestro">
          <header className={styles.conversationHead}>
            <div><span>02</span><div><strong>Mesa de trabajo</strong><small>{maestro.messages.length ? `${maestro.messages.length} intervenciones guardadas en este navegador` : "Lista para el primer encargo"}</small></div></div>
            <nav aria-label="Vistas de Maestro">
              <button type="button" className={view === "conversation" ? styles.tabActive : ""} onClick={() => setView("conversation")}>Conversación</button>
              <button type="button" className={view === "tasks" ? styles.tabActive : ""} onClick={() => setView("tasks")}>Encargos <b>{activeTasks.length}</b></button>
            </nav>
          </header>

          {view === "conversation" ? <>
            <div className={styles.messageList} aria-live="polite">
              {!maestro.ready ? <div className={styles.empty}><span>✦</span><strong>Recuperando tu mesa de trabajo…</strong></div> : null}
              {maestro.ready && maestro.messages.length === 0 ? <div className={styles.welcome}>
                <span>✦</span><h2>¿Qué ponemos en marcha?</h2>
                <p>Puedo cruzar los sistemas, preparar materiales terminados, encontrar huecos o convertir una decisión en un plan ejecutable.</p>
                <div>{mode.prompts.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}><b>↗</b>{item}</button>)}</div>
              </div> : null}
              {maestro.messages.map((message) => <Message key={message.id} message={message} onSave={() => maestro.saveTask(message)} />)}
              {maestro.busy ? <article className={`${styles.message} ${styles.assistant} ${styles.thinking}`}><header><div><span>✦</span><strong>Maestro</strong></div><time>trabajando</time></header><div><i /><i /><i /><p>Consultando la memoria de RedVitalia y construyendo el encargo…</p></div><button type="button" onClick={maestro.cancel}>Detener</button></article> : null}
              <div ref={endRef} />
            </div>
            <form className={styles.composer} onSubmit={submit}>
              <div className={styles.composerLabel}><span><i />{mode.label}</span><small>Ctrl + Enter para enviar</small></div>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submit(); }} placeholder={mode.placeholder} maxLength={8000} disabled={maestro.busy} aria-label="Encargo para Maestro" />
              <footer><span>{prompt.length.toLocaleString("es-ES")} / 8.000</span><button type="submit" disabled={!prompt.trim() || maestro.busy}>{maestro.busy ? "Resolviendo…" : "Enviar a Maestro"}<b>↗</b></button></footer>
            </form>
          </> : <div className={styles.taskBoard}>
            <div className={styles.taskIntro}><div><span>ENCARGOS GUARDADOS</span><h2>Resultados que merece la pena conservar</h2></div><p>Guarda cualquier respuesta de Maestro para volver a ella sin rebuscar en la conversación.</p></div>
            {maestro.tasks.length === 0 ? <div className={styles.empty}><span>◇</span><strong>Todavía no hay encargos guardados</strong><p>En cualquier respuesta pulsa “Guardar como encargo”.</p></div> : <div className={styles.tasks}>{maestro.tasks.map((task) => <article key={task.id} className={task.status === "Archivado" ? styles.taskArchived : ""}>
              <header><span>{maestroMode(task.mode).label}</span><time>{new Date(task.createdAt).toLocaleDateString("es-ES")}</time></header>
              <button type="button" className={styles.taskTitle} onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}><strong>{task.title}</strong><i>{expandedTask === task.id ? "−" : "+"}</i></button>
              {expandedTask === task.id ? <div className={styles.taskContent}><ReactMarkdown remarkPlugins={[remarkGfm]}>{task.content}</ReactMarkdown></div> : null}
              <footer><button type="button" onClick={() => void copyText(task.content)}>Copiar</button><button type="button" onClick={() => maestro.archiveTask(task.id)}>{task.status === "Listo" ? "Archivar" : "Recuperar"}</button><button type="button" onClick={() => maestro.removeTask(task.id)}>Eliminar</button></footer>
            </article>)}</div>}
          </div>}
        </section>

        <aside className={styles.contextRail}>
          <div className={styles.railHead}><span>03</span><div><strong>Memoria y control</strong><small>Qué sabe y qué límites respeta.</small></div></div>
          <article className={styles.contextCard}>
            <header><span>CONTEXTO CONECTADO</span><b>ACTIVO</b></header>
            <ul><li>1.091 fichas de mercado</li><li>712 expedientes profundos</li><li>157 patrones e hipótesis</li><li>Oferta y tarifas canónicas</li><li>Sistemas y 40 vías</li><li>Caller, closer y economía</li></ul>
          </article>
          <article className={styles.controlCard}><span>REGLA DE VERDAD</span><p><b>Dato</b>, evidencia, síntesis, hipótesis y pendiente permanecen separados. Maestro no inventa resultados ni permisos.</p></article>
          <article className={styles.controlCard}><span>REGLA DE ACCIÓN</span><p>Puede producir un encargo completo. Si requiere publicar, enviar o cambiar sistemas externos, prepara el material y marca la aprobación necesaria.</p></article>
          <div className={styles.railActions}><button type="button" onClick={maestro.exportConversation} disabled={!maestro.messages.length}>Exportar conversación</button><button type="button" onClick={maestro.clear} disabled={!maestro.messages.length}>Nueva conversación</button></div>
        </aside>
      </div>
    </ExecutionShell>
  );
}
