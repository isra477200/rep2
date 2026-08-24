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

export const loadOperationsWorkspace = async <T,>(): Promise<T | null> => {
  try {
    const database = await openDatabase();
    const value = await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as T | undefined) || null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (value) return value;
  } catch {
    // El fallback mantiene compatibilidad con navegadores sin IndexedDB.
  }
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    return legacy ? (JSON.parse(legacy) as T) : null;
  } catch {
    return null;
  }
};

let saveQueue: Promise<boolean> = Promise.resolve(true);

const persistOperationsWorkspace = async <T,>(value: T) => {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // La migración ya se ha guardado en IndexedDB.
    }
    return true;
  } catch {
    try {
      window.localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

export const saveOperationsWorkspace = <T,>(value: T) => {
  saveQueue = saveQueue.then(() => persistOperationsWorkspace(value));
  return saveQueue;
};
