import { listAssets, saveAsset, saveBackupRecord, getBackupRecord } from "./idb";

export type BackupPayload = {
  version: string;
  exportedAt: string;
  localStorage: Record<string, string>;
  assets: Array<{ id: string; type: string; createdAt: string; dataUrl: string }>;
};

const AUTO_BACKUP_ID = "auto-latest";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Invalid data URL"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function createBackupPayload(): Promise<BackupPayload> {
  const localData: Record<string, string> = {};
  Object.keys(localStorage)
    .filter((key) => key.startsWith("ksim:"))
    .forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) localData[key] = value;
    });
  const assets = await listAssets();
  const assetData = await Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      type: asset.type,
      createdAt: asset.createdAt,
      dataUrl: await blobToDataUrl(asset.blob)
    }))
  );
  return {
    version: "1.1",
    exportedAt: new Date().toISOString(),
    localStorage: localData,
    assets: assetData
  };
}

export async function saveAutoBackup(): Promise<void> {
  const payload = await createBackupPayload();
  await saveBackupRecord({
    id: AUTO_BACKUP_ID,
    createdAt: payload.exportedAt,
    payload: JSON.stringify(payload)
  });
}

export async function getAutoBackupPayload(): Promise<BackupPayload | null> {
  const record = await getBackupRecord(AUTO_BACKUP_ID);
  if (!record) return null;
  return JSON.parse(record.payload) as BackupPayload;
}

export async function restoreFromPayload(payload: BackupPayload): Promise<void> {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("ksim:"))
    .forEach((key) => localStorage.removeItem(key));
  const request = indexedDB.deleteDatabase("ksim_db");
  await new Promise((resolve) => {
    request.onsuccess = () => resolve(null);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  Object.entries(payload.localStorage ?? {}).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
  if (Array.isArray(payload.assets)) {
    for (const asset of payload.assets) {
      const blob = dataUrlToBlob(asset.dataUrl);
      await saveAsset({
        id: asset.id,
        type: asset.type as never,
        blob,
        createdAt: asset.createdAt
      });
    }
  }
}
