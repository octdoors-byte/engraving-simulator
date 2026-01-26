import type { Review } from "@/domain/review/types";

interface Template4Props {
  review: Review;
  backgroundImage?: string;
}

export function Template4({ review, backgroundImage }: Template4Props) {
  return (
    <div
      className="relative flex h-[800px] w-[800px] items-center justify-center overflow-hidden rounded-lg"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : "rgb(245, 243, 255)" // violet-50
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-violet-900/30" />}

      {/* 中央のカード */}
      <div className="relative z-10 w-full max-w-[680px] rounded-[40px] bg-white/98 p-12 shadow-2xl">
        <div className="flex flex-col gap-8">
          {/* 評価と数値 */}
          <div className="flex items-center justify-between">
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
            </div>
            <div className="text-4xl font-bold text-violet-600">
              {review.rating}
            </div>
          </div>

          {/* レビュー本文 */}
          <p className="min-h-[200px] text-2xl leading-relaxed text-gray-800">
            {review.comment}
          </p>

          {/* 投稿者・日付 */}
          <div className="flex items-center justify-between border-t-2 border-violet-100 pt-6">
            <span className="text-lg font-semibold text-violet-700">
              {review.author}
            </span>
            <span className="text-lg text-gray-600">{review.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
