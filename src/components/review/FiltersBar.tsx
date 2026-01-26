import type { ExtractCondition } from "@/domain/review/types";
import { HelpIcon } from "./HelpIcon";

interface FiltersBarProps {
  condition: ExtractCondition;
  onConditionChange: (condition: ExtractCondition) => void;
  filteredCount: number;
}

export function FiltersBar({
  condition,
  onConditionChange,
  filteredCount
}: FiltersBarProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-gray-900">
          2. 使うレビューを選ぶ
        </h2>
        <HelpIcon
          content={
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Q. どのレビューを選べばいい？</p>
                <p className="mt-1 text-xs">
                  まずは★4以上・10件で試すのがおすすめです。
                </p>
              </div>
            </div>
          }
        />
      </div>

      {/* 簡易フィルター（1行に横並び） */}
      <div className="flex flex-wrap items-end gap-4">
        {/* ★下限 */}
        <div className="flex-shrink-0">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            ★下限
          </label>
          <div className="flex gap-1">
            {[3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() =>
                  onConditionChange({ ...condition, minRating: rating })
                }
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  condition.minRating === rating
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {rating}+
              </button>
            ))}
          </div>
        </div>

        {/* 件数 */}
        <div className="flex-shrink-0">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            件数
          </label>
          <div className="flex gap-1">
            {[10, 20, 50].map((count) => (
              <button
                key={count}
                onClick={() =>
                  onConditionChange({ ...condition, maxCount: count })
                }
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  condition.maxCount === count
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* 並び順 */}
        <div className="flex-shrink-0">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            並び順
          </label>
          <div className="flex gap-1">
            <button
              onClick={() =>
                onConditionChange({ ...condition, sortBy: "date-desc" })
              }
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                condition.sortBy === "date-desc"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              新しい順
            </button>
            <button
              onClick={() =>
                onConditionChange({ ...condition, sortBy: "rating-desc" })
              }
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                condition.sortBy === "rating-desc"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              評価順
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        <span className="font-semibold">{filteredCount}件</span>
      </p>
    </div>
  );
}
