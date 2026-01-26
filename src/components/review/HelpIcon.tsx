import { useState } from "react";

interface HelpIconProps {
  content: React.ReactNode;
}

export function HelpIcon({ content }: HelpIconProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-600 hover:bg-gray-50"
        title="ヘルプ"
      >
        ?
      </button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* ツールチップ */}
          <div className="absolute right-0 top-6 z-50 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
            <div className="text-sm text-gray-700">{content}</div>
          </div>
        </>
      )}
    </div>
  );
}
