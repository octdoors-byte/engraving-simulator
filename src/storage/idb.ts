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

type StoredAssetRecord =
  | (Omit<AssetRecord, "blob"> & { blob: Blob })
  | (Omit<AssetRecord, "blob"> & { blobDataUrl: string; blobMimeType: string; blobSize: number });

const DB_NAME = "ksim_db";
const DB_VERSION = 11;
const STORE_ASSETS = "assets";
const STORE_BACKUPS = "backups";

const isWebKitLike = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleWebKit = /AppleWebKit/i.test(ua);
  const isChromeFamily = /Chrome\/|CriOS\/|Edg\//i.test(ua);
  const isFirefox = /Firefox\/|FxiOS/i.test(ua);
  return isAppleWebKit && !isChromeFamily && !isFirefox;
};

const shouldStoreAsDataUrl = isWebKitLike();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const type = mimeType || "application/octet-stream";
  return new Blob([bytes], { type });
}

async function toStoredAsset(asset: AssetRecord): Promise<StoredAssetRecord> {
  if (!shouldStoreAsDataUrl) return asset;
  const dataUrl = await blobToDataUrl(asset.blob);
  return {
    id: asset.id,
    type: asset.type,
    createdAt: asset.createdAt,
    blobDataUrl: dataUrl,
    blobMimeType: asset.blob.type || "application/octet-stream",
    blobSize: asset.blob.size
  };
}

async function reviveAsset(record: StoredAssetRecord | undefined | null): Promise<AssetRecord | null> {
  if (!record) return null;
  if ("blob" in record) return record;
  const blob = dataUrlToBlob(record.blobDataUrl, record.blobMimeType);
  return {
    id: record.id,
    type: record.type,
    createdAt: record.createdAt,
    blob
  };
}

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
        upgradeRequest.onblocked = () => reject(new Error("indexedDB blocked"));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("indexedDB blocked"));
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
    tx.onerror = (event) => {
      const err = tx.error ?? (event as any)?.target?.error ?? null;
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("idb tx error", { storeName, mode, message, stack });
      reject(err);
    };
    tx.onabort = (event) => {
      const err = tx.error ?? (event as any)?.target?.error ?? null;
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("idb tx abort", { storeName, mode, message, stack });
      reject(err);
    };
  });
}

export async function saveAsset(asset: AssetRecord): Promise<void> {
  const stored = await toStoredAsset(asset);
  await withStore(STORE_ASSETS, "readwrite", (store) => {
    try {
      store.put(stored);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("saveAsset failed", asset.id, asset.type, message, stack ?? "", error);
      throw error;
    }
  });
}

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readonly");
    const request = tx.objectStore(STORE_ASSETS).get(id);
    request.onsuccess = () => {
      reviveAsset(request.result as StoredAssetRecord | undefined | null)
        .then(resolve)
        .catch(reject);
    };
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
    request.onsuccess = () => {
      const records = (request.result ?? []) as StoredAssetRecord[];
      Promise.all(records.map((record) => reviveAsset(record)))
        .then((assets) => resolve(assets.filter(Boolean) as AssetRecord[]))
        .catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readonly");
    const request = tx.objectStore(STORE_ASSETS).getAll();
    request.onsuccess = () => {
      const records = (request.result ?? []) as StoredAssetRecord[];
      Promise.all(records.map((record) => reviveAsset(record)))
        .then((assets) => resolve(assets.filter(Boolean) as AssetRecord[]))
        .catch(reject);
    };
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
