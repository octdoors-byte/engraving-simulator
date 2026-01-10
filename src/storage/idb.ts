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
const STORE_NAME = "assets";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("type", "type", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
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
