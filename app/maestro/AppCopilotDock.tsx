"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MAESTRO_MODES, maestroMode } from "./types";
import { useMaestro } from "./useMaestro";
import styles from "./maestro.module.css";

export default function AppCopilotDock() {
  const pathname = usePathname();
  const maestro = useMaestro();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    endRef.current?.scrollIntoView({ block: "nearest" });
    return () => window.removeEventListener("keydown", close);
  }, [open, maestro.messages, maestro.busy]);

  if (pathname === "/maestro") return null;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;
    setPrompt("");
    await maestro.ask(clean);
  };

  const recent = maestro.messages.slice(-6);
  return <>
    <button type="button" className={styles.dockButton} onClick={() => setOpen(true)} aria-label="Abrir Maestro MiniMax">
      <span>✦</span><div><strong>Maestro</strong><small>{maestro.status === "ready" ? "MiniMax M3 · listo" : "Copiloto RedVitalia"}</small></div><i>↗</i>
    </button>
    {open ? <div className={styles.dockBackdrop}>
      <aside className={styles.dock} role="dialog" aria-modal="true" aria-label="Maestro MiniMax">
        <header className={styles.dockHead}>
          <div><span>✦</span><div><strong>Maestro</strong><small><i data-status={maestro.status} /> MiniMax M3 · {pathname}</small></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar Maestro">×</button>
        </header>
        <div className={styles.dockModes}>{MAESTRO_MODES.map((item) => <button type="button" key={item.id} className={maestro.mode === item.id ? styles.dockModeActive : ""} onClick={() => maestro.setMode(item.id)}>{item.label}</button>)}</div>
        <div className={styles.dockMessages} aria-live="polite">
          {!recent.length ? <div className={styles.dockWelcome}><span>Estoy viendo dónde estás.</span><h2>¿Qué necesitas resolver aquí?</h2><p>Usaré esta pantalla y la memoria completa de RedVitalia.</p>{maestroMode(maestro.mode).prompts.slice(0, 2).map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div> : null}
          {recent.map((message) => <article key={message.id} className={message.role === "assistant" ? styles.dockAssistant : styles.dockUser}><span>{message.role === "assistant" ? "MAESTRO" : "TÚ"}</span><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>{message.role === "assistant" ? <button type="button" onClick={() => maestro.saveTask(message)}>Guardar encargo</button> : null}</article>)}
          {maestro.busy ? <div className={styles.dockThinking}><i /><i /><i /><span>Construyendo respuesta…</span></div> : null}
          <div ref={endRef} />
        </div>
        <form className={styles.dockComposer} onSubmit={submit}>
          <label><span>{maestroMode(maestro.mode).label}</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={maestroMode(maestro.mode).placeholder} maxLength={8000} disabled={maestro.busy} /></label>
          <footer><Link prefetch={false} href="/maestro">Abrir centro de mando</Link><button type="submit" disabled={!prompt.trim() || maestro.busy}>{maestro.busy ? "Pensando…" : "Enviar"} ↗</button></footer>
        </form>
      </aside>
    </div> : null}
  </>;
}
