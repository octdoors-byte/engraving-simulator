import { useCallback, useState } from "react";
import { HelpIcon } from "./HelpIcon";

interface UploadCardProps {
  onFileLoad: (file: File, encoding: "shift_jis" | "utf-8") => void;
  isLoading: boolean;
  loadedCount: number;
  encoding: "shift_jis" | "utf-8";
  onEncodingChange: (encoding: "shift_jis" | "utf-8") => void;
  hasEncodingError: boolean;
}

export function UploadCard({
  onFileLoad,
  isLoading,
  loadedCount,
  encoding,
  onEncodingChange,
  hasEncodingError
}: UploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        onFileLoad(file, encoding);
      }
    },
    [onFileLoad, encoding]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileLoad(file, encoding);
      }
    },
    [onFileLoad, encoding]
  );

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-gray-900">
          1. レビューCSVを入れる
        </h2>
        <HelpIcon
          content={
            <div className="space-y-2">
              <p className="font-semibold">Q. 文字が崩れます</p>
              <p className="text-xs">
                文字コードを「UTF-8 / Shift-JIS」で切り替えて再読み込みしてください。
              </p>
            </div>
          }
        />
      </div>

      {/* ドロップゾーンと文字コード選択（左右分割） */}
      <div className="flex gap-4">
        {/* 左：ドロップゾーン（大） */}
        <div className="flex-1">
          <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
            onDragLeave={() => setIsDragging(false)}
            className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : hasEncodingError
                ? "border-red-300 bg-red-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isLoading}
            />

            {isLoading ? (
              <div className="text-center">
                <div className="mb-2 text-2xl">⏳</div>
                <p className="text-gray-600">読み込み中...</p>
              </div>
            ) : loadedCount > 0 ? (
              <div className="text-center">
                <div className="mb-2 text-3xl">✅</div>
                <p className="text-lg font-semibold text-gray-900">
                  {loadedCount}件 読み込み完了
                </p>
                {hasEncodingError && (
                  <div className="mt-2">
                <p className="text-sm text-red-600">
                  文字化けの場合は文字コードを切り替えてください
                </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-2 text-4xl">📄</div>
                <p className="text-lg font-semibold text-gray-900">
                  ここにレビューCSVをドロップ
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  またはクリックしてファイルを選択
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  楽天のレビューCSVに対応（Shift-JIS / UTF-8）
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 右：文字コード選択（小さく） */}
        {loadedCount === 0 && (
          <div className="flex flex-col items-end gap-2">
            <label className="text-sm text-gray-600">
              文字コード
            </label>
            <select
              value={encoding}
              onChange={(e) =>
                onEncodingChange(e.target.value as "shift_jis" | "utf-8")
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
              disabled={isLoading}
            >
              <option value="shift_jis">Shift-JIS</option>
              <option value="utf-8">UTF-8</option>
            </select>
          </div>
        )}
      </div>

    </div>
  );
}
