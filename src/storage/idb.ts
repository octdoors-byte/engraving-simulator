export type AssetType =
  | "templateBg"
  | "logoOriginal"
  | "logoEdited"
  | "pdfConfirm"
  | "pdfEngrave";

export interface AssetRecord {
  id: string;
  type: AssetType;
  blob: Blob;
  createdAt: string;
}

const DB_NAME = "ksim_db";
const DB_VERSION = 10;
const STORE_NAME = "assets";

function ensureStore(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("type", "type", { unique: false });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      ensureStore(db);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const nextVersion = db.version + 1;
        db.close();
        const upgradeRequest = indexedDB.open(DB_NAME, nextVersion);
        upgradeRequest.onupgradeneeded = () => {
          const upgraded = upgradeRequest.result;
          ensureStore(upgraded);
        };
        upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
        upgradeRequest.onerror = () => reject(upgradeRequest.error);
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = callback(store);
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveAsset(asset: AssetRecord): Promise<void> {
  await withStore("readwrite", (store) => {
    store.put(asset);
  });
}

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await withStore("readwrite", (store) => {
    store.delete(id);
  });
}

export async function deleteAssets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withStore("readwrite", (store) => {
    ids.forEach((id) => store.delete(id));
  });
}

export async function listAssetsByType(type: AssetType): Promise<AssetRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("type");
    const request = index.getAll(type);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}
