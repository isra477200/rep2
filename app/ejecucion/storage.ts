"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const EXECUTION_STORAGE_PREFIX = "rv-execution-v2-";
export const EXECUTION_SNAPSHOT_VERSION = 2;

type Envelope<T> = {
  version: number;
  savedAt: string;
  value: T;
};

export type ExecutionSnapshot = {
  product: "RedVitalia Execution";
  version: number;
  exportedAt: string;
  entries: Record<string, unknown>;
};

const hasStorage = () => typeof window !== "undefined";

export const storageKey = (name: string) => `${EXECUTION_STORAGE_PREFIX}${name}`;

export const encodeStoredValue = <T,>(value: T): string => JSON.stringify({
  version: EXECUTION_SNAPSHOT_VERSION,
  savedAt: new Date().toISOString(),
  value,
} satisfies Envelope<T>);

export const decodeStoredValue = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Envelope<T> | T;
    if (parsed && typeof parsed === "object" && "value" in parsed && "version" in parsed) {
      return (parsed as Envelope<T>).value;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
};

export const readStoredValue = <T,>(name: string, fallback: T): T => {
  if (!hasStorage()) return fallback;
  try {
    return decodeStoredValue(window.localStorage.getItem(storageKey(name)), fallback);
  } catch {
    return fallback;
  }
};

export const writeStoredValue = <T,>(name: string, value: T): boolean => {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(storageKey(name), encodeStoredValue(value));
    window.dispatchEvent(new CustomEvent("rv-execution-storage", { detail: { name } }));
    return true;
  } catch {
    return false;
  }
};

export function usePersistentState<T>(name: string, fallback: T) {
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readStoredValue(name, fallbackRef.current));
    setHydrated(true);
  }, [name]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      writeStoredValue(name, resolved);
      return resolved;
    });
  }, [name]);

  return [value, update, hydrated] as const;
}

export const createExecutionSnapshot = (storage: Pick<Storage, "length" | "key" | "getItem">): ExecutionSnapshot => {
  const entries: Record<string, unknown> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(EXECUTION_STORAGE_PREFIX)) continue;
    entries[key] = decodeStoredValue(storage.getItem(key), null);
  }
  return {
    product: "RedVitalia Execution",
    version: EXECUTION_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
};

export const validateExecutionSnapshot = (value: unknown): value is ExecutionSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ExecutionSnapshot>;
  if (snapshot.product !== "RedVitalia Execution" || snapshot.version !== EXECUTION_SNAPSHOT_VERSION) return false;
  if (!snapshot.entries || typeof snapshot.entries !== "object" || Array.isArray(snapshot.entries)) return false;
  const entries = Object.entries(snapshot.entries);
  if (entries.length > 200) return false;
  return entries.every(([key, entry]) => {
    if (!key.startsWith(EXECUTION_STORAGE_PREFIX) || key.length > 120 || key.includes("__proto__")) return false;
    try {
      return JSON.stringify(entry).length <= 200_000;
    } catch {
      return false;
    }
  });
};

export const importExecutionSnapshot = (storage: Pick<Storage, "setItem">, value: unknown): number => {
  if (!validateExecutionSnapshot(value)) throw new Error("El archivo no es una exportación compatible de Ejecución RedVitalia.");
  let imported = 0;
  for (const [key, entry] of Object.entries(value.entries)) {
    storage.setItem(key, encodeStoredValue(entry));
    imported += 1;
  }
  return imported;
};

export const downloadJson = (filename: string, value: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};
