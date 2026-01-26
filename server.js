import express from "express";
import path from "path";
import compression from "compression";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 圧縮を有効化
app.use(compression());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, "dist"), {
  maxAge: "1y",
  etag: true
}));

// SPAのため、すべてのルートをindex.htmlにリダイレクト
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`本番環境: ${process.env.NODE_ENV || "development"}`);
});
