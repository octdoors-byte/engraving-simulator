// レビューデータの型定義
export interface Review {
  id: string; // 一意のID（行番号ベース）
  rating: number; // 1-5の評価
  comment: string; // レビュー本文
  author: string; // 投稿者名（未指定時は"名無し"）
  date: string; // YYYY/MM/DD形式
  productName?: string; // 商品名（任意）
  productId?: string; // 商品ID（任意）
  rowNumber: number; // CSVの行番号
}

// 抽出条件
export interface ExtractCondition {
  minRating: number; // ★下限（1-5）
  maxCount: number; // 最大件数
  sortBy: "rating-desc" | "rating-asc" | "date-desc" | "date-asc"; // 並び順
}

// テンプレートID
export type TemplateId = "template-1" | "template-2" | "template-3" | "template-4" | "template-5";
