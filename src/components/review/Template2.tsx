import type { Review } from "@/domain/review/types";

interface Template2Props {
  review: Review;
  backgroundImage?: string;
}

export function Template2({ review, backgroundImage }: Template2Props) {
  return (
    <div
      className="relative flex h-[800px] w-[800px] items-center justify-center overflow-hidden rounded-lg"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : "rgb(219, 234, 254)" // blue-100
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 to-blue-900/60" />}

      {/* 白いカード */}
      <div className="relative z-10 w-full max-w-[650px] rounded-3xl bg-white/95 p-10 shadow-2xl">
        <div className="flex flex-col gap-6">
          {/* 評価 */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-3xl ${
                  i < review.rating ? "text-yellow-400" : "text-gray-300"
                }`}
              >
                ★
              </span>
            ))}
            <span className="ml-3 text-xl font-bold text-gray-800">
              {review.rating}
            </span>
          </div>

          {/* レビュー本文 */}
          <p className="text-center text-xl leading-relaxed text-gray-800">
            {review.comment}
          </p>

          {/* 投稿者・日付 */}
          <div className="flex items-center justify-center gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600">
            <span>{review.author}</span>
            <span>•</span>
            <span>{review.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
