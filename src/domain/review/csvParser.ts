import Papa from "papaparse";
import type { Review } from "./types";

/**
 * CSVファイルを読み込んでレビュー配列に変換
 */
export async function parseReviewCSV(
  file: File,
  encoding: "shift_jis" | "utf-8" = "shift_jis"
): Promise<Review[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let decodedText: string;

        if (encoding === "shift_jis") {
          // ArrayBufferからShift-JISをデコード
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const decoder = new TextDecoder("shift_jis");
          decodedText = decoder.decode(arrayBuffer);
        } else {
          // UTF-8の場合は文字列として読み込む
          decodedText = e.target?.result as string;
        }

        // CSVパース
        Papa.parse(decodedText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const reviews: Review[] = [];
            const data = results.data as Record<string, string>[];

            data.forEach((row, index) => {
              const review = parseRowToReview(row, index + 2); // ヘッダー行を考慮して+2
              if (review) {
                reviews.push(review);
              }
            });

            resolve(reviews);
          },
          error: (error) => {
            reject(new Error(`CSVパースエラー: ${error.message}`));
          }
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("ファイル読み込みエラー"));
    };

    // エンコーディングに応じて読み込み方法を変更
    if (encoding === "shift_jis") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "utf-8");
    }
  });
}

/**
 * CSVの1行をReviewオブジェクトに変換
 */
function parseRowToReview(row: Record<string, string>, rowNumber: number): Review | null {
  // 評価（rating）の取得
  const rating = parseRating(row);
  if (rating === 0) {
    return null; // 評価が取得できない場合はスキップ
  }

  // レビュー本文の取得
  const comment = parseComment(row);
  if (!comment || comment.trim().length === 0) {
    return null; // 本文がない場合はスキップ
  }

  // 投稿者名の取得
  const author = parseAuthor(row);

  // 日付の取得
  const date = parseDate(row);

  // 商品名の取得（任意）
  const productName = parseProductName(row);

  // 商品IDの取得（任意）
  const productId = parseProductId(row);

  return {
    id: `review-${rowNumber}`,
    rating,
    comment: comment.trim(),
    author,
    date,
    productName,
    productId,
    rowNumber
  };
}

function parseRating(row: Record<string, string>): number {
  const keys = ["評価", "rating", "score", "star", "stars"];
  for (const key of keys) {
    const value = row[key];
    if (value) {
      const num = parseInt(value, 10);
      if (num >= 1 && num <= 5) {
        return num;
      }
    }
  }
  return 0;
}

function parseComment(row: Record<string, string>): string {
  const keys = ["レビュー本文", "レビュー", "comment", "text", "内容"];
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function parseAuthor(row: Record<string, string>): string {
  const keys = ["投稿者", "author", "名前", "name", "ユーザー名"];
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "名無し";
}

function parseDate(row: Record<string, string>): string {
  const keys = ["投稿時間", "投稿日", "date", "created_at", "日付"];
  for (const key of keys) {
    const value = row[key];
    if (value) {
      // YYYY/MM/DD形式に変換
      const dateStr = normalizeDate(value);
      if (dateStr) {
        return dateStr;
      }
    }
  }
  return new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).replace(/\//g, "/");
}

function normalizeDate(dateStr: string): string | null {
  // YYYY/MM/DD HH:mm:ss や YYYY-MM-DD などの形式を YYYY/MM/DD に変換
  const match = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, "0");
    const day = match[3].padStart(2, "0");
    return `${year}/${month}/${day}`;
  }
  return null;
}

function parseProductName(row: Record<string, string>): string | undefined {
  const keys = ["商品名", "productName", "product_name", "商品"];
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseProductId(row: Record<string, string>): string | undefined {
  // 商品IDは \d+_\d+ 形式を探す
  for (const value of Object.values(row)) {
    if (typeof value === "string") {
      const match = value.match(/\d+_\d+/);
      if (match) {
        return match[0];
      }
    }
  }
  return undefined;
}
