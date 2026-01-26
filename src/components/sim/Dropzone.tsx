import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";

type DropzoneProps = {
  onFileAccepted: (file: File) => void;
  onReject?: (message: string) => void;
  disabled?: boolean;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function Dropzone({ onFileAccepted, onReject, disabled }: DropzoneProps) {
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
        onReject?.("画像形式は PNG/JPEG/WEBP を選択してください。");
        return;
      }
      if (file.size > MAX_BYTES) {
        onReject?.("5MB 以上のファイルはアップロードできません。");
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
      if (!disabled) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles, disabled]
  );

  return (
    <div
      className={`rounded-md border-2 border-dashed px-6 py-8 text-center transition-all ${
        disabled
          ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
          : isDragging
            ? "border-slate-400 bg-slate-100 shadow-md"
            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
      }`}
      role="button"
      tabIndex={0}
      onClick={triggerInput}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerInput();
        }
      }}
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
      <div className="mb-2">
        <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p className="text-sm font-bold text-slate-900 mb-1">画像ファイルを選択</p>
      <p className="text-xs text-slate-600 leading-relaxed">
        対応形式: PNG / JPEG / WEBP<br />
        最大サイズ: 5MB<br />
        ドラッグ&ドロップでも選択できます
      </p>
      {disabled && <p className="mt-2 text-xs font-medium text-slate-500">作成中はアップロードできません</p>}
    </div>
  );
}
