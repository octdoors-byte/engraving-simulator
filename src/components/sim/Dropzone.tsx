import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";

type DropzoneProps = {
  onFileAccepted: (file: File) => void;
  onReject?: (message: string) => void;
  disabled?: boolean;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function Dropzone({ onFileAccepted, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerInput = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!ACCEPTED_TYPES.includes(file.type)) {
        onReject?.("PNG/JPEG/WEBP のいずれかを選択してください");
        return;
      }
      if (file.size > MAX_BYTES) {
        onReject?.("5MB 以下のファイルのみアップロードできます");
        return;
      }
      onFileAccepted(file);
    },
    [onFileAccepted, onReject]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        disabled ? "border-slate-200 bg-slate-50 text-slate-400" : isDragging ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white text-slate-500"
      }`}
      onClick={triggerInput}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(event) => handleFiles(event.target.files)}
        disabled={disabled}
      />
      <p className="font-semibold text-slate-900">ロゴ画像をアップロード</p>
      <p className="text-xs">
        PNG/JPEG/WEBP、5MB以下。ドラッグ&ドロップまたはクリックして選択してください。
      </p>
      {disabled && <p className="mt-2 text-xxs text-rose-500">処理中のためアップロードできません</p>}
    </div>
  );
}
