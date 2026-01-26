import type { Review } from "@/domain/review/types";

interface Template3Props {
  review: Review;
  backgroundImage?: string;
}

export function Template3({ review, backgroundImage }: Template3Props) {
  return (
    <div
      className="relative flex h-[800px] w-[800px] items-center justify-center overflow-hidden rounded-lg"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : "rgb(254, 242, 242)" // rose-50
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-gradient-to-t from-rose-900/50 to-transparent" />}

      {/* コンテンツ */}
      <div className="relative z-10 flex w-full max-w-[720px] flex-col gap-8 px-10 pb-16">
        {/* 評価 */}
        <div className="flex items-center gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`text-5xl ${
                i < review.rating ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              ★
            </span>
          ))}
        </div>

        {/* レビュー本文 */}
        <p className="text-3xl font-medium leading-relaxed text-white drop-shadow-xl">
          {review.comment}
        </p>

        {/* 投稿者・日付（下部固定） */}
        <div className="mt-auto flex items-center gap-4 text-xl text-white/95 drop-shadow-lg">
          <span className="font-semibold">{review.author}</span>
          <span>•</span>
          <span>{review.date}</span>
        </div>
      </div>
    </div>
  );
}
