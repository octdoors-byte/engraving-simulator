import { useState, useCallback, useMemo } from "react";
import type { Review, ExtractCondition, TemplateId } from "@/domain/review/types";
import { parseReviewCSV } from "@/domain/review/csvParser";
import { filterAndSortReviews } from "@/domain/review/filter";
import { UploadCard } from "@/components/review/UploadCard";
import { FiltersBar } from "@/components/review/FiltersBar";
import { ReviewList } from "@/components/review/ReviewList";
import { TemplatePicker } from "@/components/review/TemplatePicker";
import { StickyFooterCTA } from "@/components/review/StickyFooterCTA";
import { TemplateRenderer } from "@/components/review/TemplateRenderer";
import { useReviewZip } from "@/hooks/useReviewZip";

export function ReviewGeneratorPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState<ExtractCondition>({
    minRating: 3,
    maxCount: 10,
    sortBy: "rating-desc"
  });
  const [templateId, setTemplateId] = useState<TemplateId>("template-1");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<"shift_jis" | "utf-8">("shift_jis");
  const [isLoading, setIsLoading] = useState(false);
  const [hasEncodingError, setHasEncodingError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { generateZip, isGenerating, progress } = useReviewZip();

  // CSV読み込み
  const handleFileLoad = useCallback(
    async (file: File, fileEncoding: "shift_jis" | "utf-8") => {
      setIsLoading(true);
      setHasEncodingError(false);
      try {
        const parsed = await parseReviewCSV(file, fileEncoding);
        setReviews(parsed);
        setSelectedReviewIds(new Set());
      } catch (error) {
        console.error("CSV読み込みエラー:", error);
        setHasEncodingError(true);
        // エラー時は文字コードを切り替えて再試行を促す
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 抽出条件適用
  const filteredReviews = useMemo(() => {
    let result = filterAndSortReviews(reviews, condition);

    // 検索フィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.comment.toLowerCase().includes(query) ||
          r.productName?.toLowerCase().includes(query) ||
          r.author.toLowerCase().includes(query)
      );
    }

    return result;
  }, [reviews, condition, searchQuery]);

  // レビュー選択
  const toggleReview = useCallback((reviewId: string) => {
    setSelectedReviewIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  }, []);

  // 全選択/全解除
  const toggleAll = useCallback(() => {
    if (selectedReviewIds.size === filteredReviews.length) {
      setSelectedReviewIds(new Set());
    } else {
      setSelectedReviewIds(new Set(filteredReviews.map((r) => r.id)));
    }
  }, [selectedReviewIds.size, filteredReviews]);

  // ZIP出力
  const handleExport = useCallback(async () => {
    const selectedReviews = filteredReviews.filter((r) =>
      selectedReviewIds.has(r.id)
    );

    if (selectedReviews.length === 0) {
      alert("レビューを1件以上選択してください");
      return;
    }

    try {
      await generateZip(selectedReviews, templateId, backgroundImage || undefined);
    } catch (error) {
      alert(`ZIP出力エラー: ${error instanceof Error ? error.message : "不明なエラー"}`);
    }
  }, [filteredReviews, selectedReviewIds, templateId, backgroundImage, generateZip]);

  const selectedReviews = filteredReviews.filter((r) => selectedReviewIds.has(r.id));
  const sampleReview = filteredReviews[0]; // プレビュー用

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* ヘッダー（薄く） */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            顧客の声 画像ジェネレーター
          </h1>
          <p className="mt-2 text-base text-gray-700">
            CSVからレビュー画像を一括作成
          </p>
        </div>
      </div>

      {/* 本体（中央1カラム：max-w-4xl） */}
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Card A: CSVを入れる */}
        <UploadCard
          onFileLoad={handleFileLoad}
          isLoading={isLoading}
          loadedCount={reviews.length}
          encoding={encoding}
          onEncodingChange={setEncoding}
          hasEncodingError={hasEncodingError}
        />

        {/* Card B: 使うレビューを選ぶ */}
        {reviews.length > 0 && (
          <>
            <FiltersBar
              condition={condition}
              onConditionChange={setCondition}
              filteredCount={filteredReviews.length}
            />

            <ReviewList
              reviews={filteredReviews}
              selectedIds={selectedReviewIds}
              onToggle={toggleReview}
              onToggleAll={toggleAll}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </>
        )}

        {/* Card C: 見た目を選ぶ */}
        {selectedReviews.length > 0 && (
          <TemplatePicker
            templateId={templateId}
            onTemplateChange={setTemplateId}
            backgroundImage={backgroundImage}
            onBackgroundImageChange={setBackgroundImage}
            sampleReview={sampleReview}
          />
        )}

        {/* プレビュー（任意・折りたたみ可能） */}
        {selectedReviews.length > 0 && (
          <details className="rounded-2xl bg-white p-6 shadow-sm">
            <summary className="cursor-pointer text-lg font-semibold text-gray-900">
              プレビューを見る（{selectedReviews.length}件）
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              {selectedReviews.map((review) => (
                <div
                  key={review.id}
                  data-review-id={review.id}
                  className="flex justify-center"
                >
                  <TemplateRenderer
                    review={review}
                    templateId={templateId}
                    backgroundImage={backgroundImage || undefined}
                  />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* 固定フッターCTA */}
      {selectedReviews.length > 0 && (
        <StickyFooterCTA
          selectedCount={selectedReviewIds.size}
          templateId={templateId}
          hasBackgroundImage={!!backgroundImage}
          isGenerating={isGenerating}
          progress={progress}
          onGenerate={handleExport}
        />
      )}
    </div>
  );
}
