"use client";

import { useRef, useState, type ChangeEvent } from "react";
import styles from "./execution.module.css";
import {
  createExecutionSnapshot,
  downloadJson,
  importExecutionSnapshot,
} from "./storage";

export default function WorkspaceTransfer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const exportWorkspace = () => {
    const snapshot = createExecutionSnapshot(window.localStorage);
    downloadJson(`redvitalia-ejecucion-${new Date().toISOString().slice(0, 10)}.json`, snapshot);
    setError(false);
    setMessage(`${Object.keys(snapshot.entries).length} bloques exportados.`);
  };

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("El archivo supera el límite seguro de 2 MB.");
      const parsed = JSON.parse(await file.text()) as unknown;
      const count = importExecutionSnapshot(window.localStorage, parsed);
      setError(false);
      setMessage(`${count} bloques importados. Recargando…`);
      window.setTimeout(() => window.location.reload(), 450);
    } catch (reason) {
      setError(true);
      setMessage(reason instanceof Error ? reason.message : "No se pudo importar el archivo.");
    }
  };

  return (
    <div className={styles.workspaceTransfer}>
      <button type="button" onClick={exportWorkspace}>Exportar trabajo</button>
      <button type="button" onClick={() => inputRef.current?.click()}>Importar</button>
      <input
        ref={inputRef}
        className={styles.srOnly}
        type="file"
        accept="application/json,.json"
        onChange={importWorkspace}
        aria-label="Importar trabajo de Ejecución RedVitalia"
      />
      {message ? <span role={error ? "alert" : "status"} className={error ? styles.transferError : undefined}>{message}</span> : null}
    </div>
  );
}
