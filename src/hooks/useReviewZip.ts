import { useState } from "react";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import type { Review } from "@/domain/review/types";

export function useReviewZip() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const generateZip = async (
    reviews: Review[],
    templateId: string,
    backgroundImage?: string
  ): Promise<void> => {
    setIsGenerating(true);
    setProgress({ current: 0, total: reviews.length });

    const zip = new JSZip();

    try {
      // 各レビューの画像を生成
      for (let i = 0; i < reviews.length; i++) {
        const review = reviews[i];
        setProgress({ current: i + 1, total: reviews.length });

        // テンプレート要素を探す（data-review-id属性で識別）
        const element = document.querySelector(
          `[data-review-id="${review.id}"]`
        ) as HTMLElement;

        if (!element) {
          console.warn(`Review element not found: ${review.id}`);
          continue;
        }

        // 画像化（800x800、高解像度）
        const dataUrl = await toPng(element, {
          width: 800,
          height: 800,
          pixelRatio: 2,
          quality: 1.0
        });

        // ZIPに追加
        zip.file(`review_${i + 1}.png`, dataUrl.split(",")[1], {
          base64: true
        });
      }

      // selected_reviews.csvを作成
      const csvRows = [
        ["日付", "評価", "本文", "商品名", "行番号"].join(",")
      ];

      reviews.forEach((review) => {
        const row = [
          review.date,
          review.rating.toString(),
          `"${review.comment.replace(/"/g, '""')}"`, // CSVエスケープ
          review.productName || "",
          review.rowNumber.toString()
        ];
        csvRows.push(row.join(","));
      });

      zip.file("selected_reviews.csv", csvRows.join("\n"));

      // ZIPをダウンロード
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reviews.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("ZIP生成エラー:", error);
      throw error;
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return {
    generateZip,
    isGenerating,
    progress
  };
}
