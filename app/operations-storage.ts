const DB_NAME = "redvitalia-operations";
const STORE_NAME = "workspace";
const RECORD_KEY = "current";
const LEGACY_KEY = "rv-operations-hub-v1";

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const loadOperationsWorkspace = async <T,>(recordKey = RECORD_KEY): Promise<T | null> => {
  try {
    const database = await openDatabase();
    const value = await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(recordKey);
      request.onsuccess = () => resolve((request.result as T | undefined) || null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (value) return value;
  } catch {
    // El fallback mantiene compatibilidad con navegadores sin IndexedDB.
  }
  try {
    const storageKey = recordKey === RECORD_KEY ? LEGACY_KEY : `${LEGACY_KEY}:${recordKey}`;
    const legacy = window.localStorage.getItem(storageKey);
    return legacy ? (JSON.parse(legacy) as T) : null;
  } catch {
    return null;
  }
};

let saveQueue: Promise<boolean> = Promise.resolve(true);

const persistOperationsWorkspace = async <T,>(value: T, recordKey: string) => {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, recordKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    try {
      if (recordKey === RECORD_KEY) window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // La migración ya se ha guardado en IndexedDB.
    }
    return true;
  } catch {
    try {
      window.localStorage.setItem(recordKey === RECORD_KEY ? LEGACY_KEY : `${LEGACY_KEY}:${recordKey}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

export const saveOperationsWorkspace = <T,>(value: T, recordKey = RECORD_KEY) => {
  saveQueue = saveQueue.then(() => persistOperationsWorkspace(value, recordKey));
  return saveQueue;
};
