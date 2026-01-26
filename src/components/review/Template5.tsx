import type { Review } from "@/domain/review/types";

interface Template5Props {
  review: Review;
  backgroundImage?: string;
}

export function Template5({ review, backgroundImage }: Template5Props) {
  return (
    <div
      className="relative flex h-[800px] w-[800px] items-center justify-center overflow-hidden rounded-lg"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : "rgb(240, 253, 244)" // green-50
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-800/30 to-transparent" />}

      {/* コンテンツ */}
      <div className="relative z-10 flex w-full max-w-[750px] flex-col gap-10 px-12">
        {/* 上部：評価と投稿者情報 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          <div className="rounded-full bg-white/90 px-6 py-3 shadow-lg">
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-800">
                {review.author}
              </div>
              <div className="text-xs text-gray-600">{review.date}</div>
            </div>
          </div>
        </div>

        {/* 中央：レビュー本文 */}
        <div className="flex-1">
          <p className="text-3xl font-medium leading-relaxed text-white drop-shadow-xl">
            {review.comment}
          </p>
        </div>
      </div>
    </div>
  );
}
