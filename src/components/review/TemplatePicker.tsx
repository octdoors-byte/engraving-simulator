import type { TemplateId } from "@/domain/review/types";
import { TemplateRenderer } from "./TemplateRenderer";
import type { Review } from "@/domain/review/types";
import { HelpIcon } from "./HelpIcon";

interface TemplatePickerProps {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  backgroundImage?: string | null;
  onBackgroundImageChange: (image: string | null) => void;
  sampleReview?: Review;
}

const templateNames: Record<TemplateId, string> = {
  "template-1": "テンプレート1",
  "template-2": "テンプレート2",
  "template-3": "テンプレート3",
  "template-4": "テンプレート4",
  "template-5": "テンプレート5"
};

export function TemplatePicker({
  templateId,
  onTemplateChange,
  backgroundImage,
  onBackgroundImageChange,
  sampleReview
}: TemplatePickerProps) {
  const templates: TemplateId[] = [
    "template-1",
    "template-2",
    "template-3",
    "template-4",
    "template-5"
  ];

  // サンプルレビュー（なければデフォルト）
  const previewReview: Review = sampleReview || {
    id: "preview",
    rating: 5,
    comment: "とても良い商品でした。使いやすくて気に入っています。",
    author: "サンプルユーザー",
    date: "2024/01/15",
    rowNumber: 0
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-gray-900">3. 見た目を選ぶ</h2>
        <HelpIcon
          content={
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Q. 背景画像は必須？</p>
                <p className="mt-1 text-xs">
                  必須ではありません。入れると雰囲気が変わります。
                </p>
              </div>
              <div>
                <p className="font-semibold">Q. 出力サイズは？</p>
                <p className="mt-1 text-xs">
                  800×800pxで出力します（SNS投稿向け）。
                </p>
              </div>
            </div>
          }
        />
      </div>

      {/* テンプレート選択（サムネ横並び） */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-4 pb-2">
          {templates.map((id) => (
            <button
              key={id}
              onClick={() => onTemplateChange(id)}
              className={`flex-shrink-0 rounded-xl border-2 p-2 transition ${
                templateId === id
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-2 flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                <div className="scale-50">
                  <TemplateRenderer
                    review={previewReview}
                    templateId={id}
                    backgroundImage={backgroundImage || undefined}
                  />
                </div>
              </div>
              <p className="text-center text-xs font-medium text-gray-700">
                {templateNames[id]}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 背景画像アップロード（右側に小さく） */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    onBackgroundImageChange(event.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
            <span>背景画像を追加</span>
          </label>

          {backgroundImage && (
            <>
              <div className="h-16 w-16 overflow-hidden rounded-lg border">
                <img
                  src={backgroundImage}
                  alt="背景プレビュー"
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                onClick={() => onBackgroundImageChange(null)}
                className="text-sm text-red-600 hover:text-red-800 hover:underline"
              >
                クリア
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500">
          背景画像は任意です
        </p>
      </div>
    </div>
  );
}
