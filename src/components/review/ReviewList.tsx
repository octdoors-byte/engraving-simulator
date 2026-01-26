import type { Review } from "@/domain/review/types";

interface ReviewListProps {
  reviews: Review[];
  selectedIds: Set<string>;
  onToggle: (reviewId: string) => void;
  onToggleAll: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ReviewList({
  reviews,
  selectedIds,
  onToggle,
  onToggleAll,
  searchQuery,
  onSearchChange
}: ReviewListProps) {
  const allSelected = reviews.length > 0 && selectedIds.size === reviews.length;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">レビュー一覧</h2>
        </div>
        <div className="flex items-center gap-4">
          {/* 検索（任意） */}
          <input
            type="text"
            placeholder="本文/商品名で検索"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          {/* 全選択/全解除 */}
          <button
            onClick={onToggleAll}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {allSelected ? "全解除" : "全選択"}
          </button>
        </div>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            レビューがありません
          </p>
        ) : (
          reviews.map((review) => {
            const isSelected = selectedIds.has(review.id);
            return (
              <label
                key={review.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(review.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  {/* 評価と日付（右寄せ） */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-yellow-500">
                        {"★".repeat(review.rating)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {review.rating}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{review.date}</span>
                  </div>

                  {/* レビュー本文（2-3行でclamp） */}
                  <p className="line-clamp-3 text-sm leading-relaxed text-gray-800">
                    {review.comment}
                  </p>

                  {/* 商品名・投稿者（下段・薄字） */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    {review.productName && (
                      <>
                        <span>{review.productName}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{review.author}</span>
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>

      <p className="mt-4 text-sm text-gray-600">
        <span className="font-semibold">{selectedIds.size}件</span> 選択中
      </p>
    </div>
  );
}
