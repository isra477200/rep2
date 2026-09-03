"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaestroMessage, MaestroMode, MaestroStatus, MaestroTask } from "./types";

const STORAGE_KEY = "redvitalia:maestro:v1";
const MAX_MESSAGES = 30;
const MAX_TASKS = 24;

type StoredState = {
  conversationId: string;
  messages: MaestroMessage[];
  tasks: MaestroTask[];
};

const uid = () => `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

const emptyState = (): StoredState => ({
  conversationId: crypto.randomUUID(),
  messages: [],
  tasks: [],
});

const readStoredState = (): StoredState => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<StoredState> | null;
    if (!parsed || !Array.isArray(parsed.messages) || !Array.isArray(parsed.tasks)) return emptyState();
    return {
      conversationId: typeof parsed.conversationId === "string" ? parsed.conversationId : crypto.randomUUID(),
      messages: parsed.messages.filter((item) => item?.role === "user" || item?.role === "assistant").slice(-MAX_MESSAGES),
      tasks: parsed.tasks.filter((item) => typeof item?.content === "string").slice(0, MAX_TASKS),
    };
  } catch {
    return emptyState();
  }
};

const errorMessage = (error: string) => ({
  gateway_not_configured: "El puente privado todavía no está configurado en este entorno. Reinicia el servidor después de añadir sus variables locales.",
  assistant_unavailable: "MiniMax no está respondiendo ahora mismo. El encargo no se ha perdido: puedes volver a enviarlo.",
  rate_limit: "Se ha alcanzado el límite temporal de consultas. Espera un momento antes de reintentarlo.",
  unauthorized: "El puente privado y n8n no comparten la misma llave. Hay que revisar la configuración segura.",
  request_too_large: "El encargo es demasiado grande para enviarlo de una vez. Divídelo en dos partes.",
  knowledge_unavailable: "La memoria de RedVitalia no está disponible en este momento. Vuelve a generar el contexto de la aplicación.",
  invalid_content: "El encargo necesita algo más de detalle para que Maestro pueda resolverlo.",
  empty_model_response: "MiniMax ha devuelto una respuesta vacía. Puedes reintentar el encargo.",
} as Record<string, string>)[error] || "No se ha podido completar el encargo. Puedes reintentarlo sin perder el historial.";

const pageContext = () => {
  const heading = document.querySelector("h1")?.textContent?.trim() || "";
  return JSON.stringify({ title: document.title, heading });
};

export function useMaestro() {
  const [state, setState] = useState<StoredState | null>(null);
  const [mode, setMode] = useState<MaestroMode>("ask");
  const [status, setStatus] = useState<MaestroStatus>("checking");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setState(readStoredState()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // El asistente sigue funcionando aunque el navegador bloquee el guardado local.
    }
  }, [state]);

  const checkStatus = useCallback(async () => {
    setStatus("checking");
    try {
      const response = await fetch("/api/redvitalia-ai", { method: "GET", cache: "no-store" });
      const result = await response.json() as { ok?: boolean; configured?: boolean; error?: string };
      if (response.ok && result.ok && result.configured) setStatus("ready");
      else if (result.error === "gateway_not_configured") setStatus("unconfigured");
      else setStatus("offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [checkStatus]);

  const ask = useCallback(async (question: string, requestedMode: MaestroMode = mode) => {
    const clean = question.trim();
    if (!clean || !state || busy) return false;

    const userMessage: MaestroMessage = { id: uid(), role: "user", content: clean, createdAt: new Date().toISOString(), mode: requestedMode };
    const history = state.messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setState((current) => current ? { ...current, messages: [...current.messages, userMessage].slice(-MAX_MESSAGES) } : current);
    setBusy(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/redvitalia-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          conversationId: state.conversationId,
          mode: requestedMode,
          page: window.location.pathname + window.location.search + window.location.hash,
          question: clean,
          pageContext: pageContext(),
          history,
        }),
      });
      const result = await response.json() as { ok?: boolean; answer?: string; error?: string };
      if (!response.ok || !result.ok || !result.answer) throw new Error(result.error || "assistant_unavailable");
      const answer: MaestroMessage = { id: uid(), role: "assistant", content: result.answer, createdAt: new Date().toISOString(), mode: requestedMode };
      setState((current) => current ? { ...current, messages: [...current.messages, answer].slice(-MAX_MESSAGES) } : current);
      setStatus("ready");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      const code = error instanceof Error ? error.message : "assistant_unavailable";
      const failure: MaestroMessage = { id: uid(), role: "assistant", content: errorMessage(code), createdAt: new Date().toISOString(), mode: requestedMode };
      setState((current) => current ? { ...current, messages: [...current.messages, failure].slice(-MAX_MESSAGES) } : current);
      setStatus(code === "gateway_not_configured" ? "unconfigured" : "offline");
      return false;
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, mode, state]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    if (!window.confirm("¿Borrar la conversación? Los encargos guardados se conservarán.")) return;
    setState((current) => current ? { ...current, conversationId: crypto.randomUUID(), messages: [] } : current);
  }, []);

  const saveTask = useCallback((message: MaestroMessage) => {
    const title = message.content.replace(/[#*_`>\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 82) || "Encargo de Maestro";
    const task: MaestroTask = { id: uid(), title, content: message.content, createdAt: new Date().toISOString(), mode: message.mode, status: "Listo" };
    setState((current) => current ? { ...current, tasks: [task, ...current.tasks].slice(0, MAX_TASKS) } : current);
  }, []);

  const archiveTask = useCallback((id: string) => {
    setState((current) => current ? { ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, status: task.status === "Listo" ? "Archivado" : "Listo" } : task) } : current);
  }, []);

  const removeTask = useCallback((id: string) => {
    setState((current) => current ? { ...current, tasks: current.tasks.filter((task) => task.id !== id) } : current);
  }, []);

  const exportConversation = useCallback(() => {
    if (!state?.messages.length) return;
    const markdown = [`# Conversación con Maestro · RedVitalia`, "", `Fecha: ${new Date().toLocaleString("es-ES")}`, "", ...state.messages.flatMap((message) => [`## ${message.role === "user" ? "Isra" : "Maestro"}`, "", message.content, ""])].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `redvitalia-maestro-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [state]);

  return {
    ready: state !== null,
    messages: state?.messages || [],
    tasks: state?.tasks || [],
    mode,
    setMode,
    status,
    busy,
    ask,
    cancel,
    clear,
    saveTask,
    archiveTask,
    removeTask,
    exportConversation,
    checkStatus,
  };
}
