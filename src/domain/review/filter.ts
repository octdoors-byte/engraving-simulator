import type { Review, ExtractCondition } from "./types";

/**
 * レビューを抽出条件に基づいてフィルタリング・ソート
 */
export function filterAndSortReviews(
  reviews: Review[],
  condition: ExtractCondition
): Review[] {
  // 評価下限でフィルタ
  let filtered = reviews.filter((r) => r.rating >= condition.minRating);

  // ソート
  filtered.sort((a, b) => {
    switch (condition.sortBy) {
      case "rating-desc":
        return b.rating - a.rating;
      case "rating-asc":
        return a.rating - b.rating;
      case "date-desc":
        return compareDate(b.date, a.date);
      case "date-asc":
        return compareDate(a.date, b.date);
      default:
        return 0;
    }
  });

  // 件数制限
  return filtered.slice(0, condition.maxCount);
}

function compareDate(dateStr1: string, dateStr2: string): number {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  if (!d1 || !d2) return 0;
  return d1.getTime() - d2.getTime();
}

function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  return null;
}
