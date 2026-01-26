import type { TemplateId } from "@/domain/review/types";

interface StickyFooterCTAProps {
  selectedCount: number;
  templateId: TemplateId;
  hasBackgroundImage: boolean;
  isGenerating: boolean;
  progress: { current: number; total: number };
  onGenerate: () => void;
}

const templateNames: Record<TemplateId, string> = {
  "template-1": "T1",
  "template-2": "T2",
  "template-3": "T3",
  "template-4": "T4",
  "template-5": "T5"
};

export function StickyFooterCTA({
  selectedCount,
  templateId,
  hasBackgroundImage,
  isGenerating,
  progress,
  onGenerate
}: StickyFooterCTAProps) {
  const canGenerate = selectedCount > 0 && !isGenerating;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* 左：状態テキスト */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <span className="font-semibold">{selectedCount}件</span>
          </span>
          <span>•</span>
          <span>
            <span className="font-semibold">{templateNames[templateId]}</span>
          </span>
          <span>•</span>
          <span>
            <span className="font-semibold">{hasBackgroundImage ? "背景あり" : "背景なし"}</span>
          </span>
        </div>

        {/* 右：主ボタン */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`rounded-lg px-8 py-3 font-semibold text-white transition ${
            canGenerate
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating
            ? `作成中…（${progress.current}/${progress.total}）`
            : "ZIPを作る"}
        </button>
      </div>
    </div>
  );
}
