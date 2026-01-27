export type WpKsimUploadResult = {
  ok: true;
  designId: string;
  attachmentId: number;
  pdfUrl: string;
  fileName: string;
  sizeBytes: number;
};

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getWpKsimConfig(): { baseUrl: string; uploadKey: string } | null {
  // Vite exposes only variables prefixed with VITE_.
  const baseUrl = normalizeBaseUrl(import.meta.env.VITE_WP_KSIM_API_BASE);
  const uploadKey = typeof import.meta.env.VITE_WP_KSIM_UPLOAD_KEY === "string" ? import.meta.env.VITE_WP_KSIM_UPLOAD_KEY : "";
  if (!baseUrl || !uploadKey) return null;
  return { baseUrl, uploadKey };
}

export async function uploadConfirmPdfToWp(args: {
  designId: string;
  templateKey: string;
  createdAt: string;
  pdfBlob: Blob;
}): Promise<WpKsimUploadResult> {
  const config = getWpKsimConfig();
  if (!config) {
    throw new Error("WP upload is not configured (missing VITE_WP_KSIM_API_BASE or VITE_WP_KSIM_UPLOAD_KEY).");
  }

  const form = new FormData();
  form.append("designId", args.designId);
  form.append("templateKey", args.templateKey);
  form.append("createdAt", args.createdAt);
  form.append("pdf", args.pdfBlob, `${args.designId}-confirm.pdf`);

  const res = await fetch(`${config.baseUrl}/designs`, {
    method: "POST",
    headers: {
      "X-KSIM-KEY": config.uploadKey
    },
    body: form
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WP upload failed: HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text) as WpKsimUploadResult;
  } catch {
    throw new Error(`WP upload returned non-JSON: ${text.slice(0, 500)}`);
  }
}

