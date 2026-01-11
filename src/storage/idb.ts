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
const DB_VERSION = 11;
const STORE_ASSETS = "assets";
const STORE_BACKUPS = "backups";

function ensureStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(STORE_ASSETS)) {
    const store = db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
    store.createIndex("type", "type", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
    db.createObjectStore(STORE_BACKUPS, { keyPath: "id" });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      ensureStores(db);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS) || !db.objectStoreNames.contains(STORE_BACKUPS)) {
        const nextVersion = db.version + 1;
        db.close();
        const upgradeRequest = indexedDB.open(DB_NAME, nextVersion);
        upgradeRequest.onupgradeneeded = () => {
          const upgraded = upgradeRequest.result;
          ensureStores(upgraded);
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

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveAsset(asset: AssetRecord): Promise<void> {
  await withStore(STORE_ASSETS, "readwrite", (store) => {
    store.put(asset);
  });
}

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readonly");
    const request = tx.objectStore(STORE_ASSETS).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await withStore(STORE_ASSETS, "readwrite", (store) => {
    store.delete(id);
  });
}

export async function deleteAssets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withStore(STORE_ASSETS, "readwrite", (store) => {
    ids.forEach((id) => store.delete(id));
  });
}

export async function listAssetsByType(type: AssetType): Promise<AssetRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readonly");
    const index = tx.objectStore(STORE_ASSETS).index("type");
    const request = index.getAll(type);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readonly");
    const request = tx.objectStore(STORE_ASSETS).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export type BackupRecord = {
  id: string;
  createdAt: string;
  payload: string;
};

export async function saveBackupRecord(record: BackupRecord): Promise<void> {
  await withStore(STORE_BACKUPS, "readwrite", (store) => {
    store.put(record);
  });
}

export async function getBackupRecord(id: string): Promise<BackupRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, "readonly");
    const request = tx.objectStore(STORE_BACKUPS).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
