import type { Review } from "@/domain/review/types";

interface Template1Props {
  review: Review;
  backgroundImage?: string;
}

export function Template1({ review, backgroundImage }: Template1Props) {
  return (
    <div
      className="relative flex h-[800px] w-[800px] items-center justify-center overflow-hidden rounded-lg"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : "rgb(240, 253, 250)" // emerald-50
      }}
    >
      {/* オーバーレイ（背景画像がある場合） */}
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/20" />
      )}

      {/* コンテンツ */}
      <div className="relative z-10 flex w-full max-w-[700px] flex-col items-center gap-6 px-8 text-center">
        {/* 評価 */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`text-4xl ${
                i < review.rating ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              ★
            </span>
          ))}
          <span className="ml-2 text-2xl font-bold text-white drop-shadow-lg">
            {review.rating}
          </span>
        </div>

        {/* レビュー本文 */}
        <p className="text-2xl leading-relaxed text-white drop-shadow-lg">
          {review.comment}
        </p>

        {/* 投稿者・日付 */}
        <div className="mt-auto flex items-center gap-4 text-lg text-white/90 drop-shadow-md">
          <span>{review.author}</span>
          <span>•</span>
          <span>{review.date}</span>
        </div>
      </div>
    </div>
  );
}
