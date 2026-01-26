import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // 環境変数を読み込む（process.envを優先、次にloadEnv）
  // process.envはビルド時に直接設定された環境変数を取得
  const env = loadEnv(mode, process.cwd(), "");
  
  // baseパスを環境変数から取得（process.envを優先、次に.envファイル、最後にデフォルト）
  // 開発環境では / を使用、本番環境では /simulator/ をデフォルトとする
  const defaultBasePath = mode === "development" ? "/" : "/simulator/";
  const basePath = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || defaultBasePath;
  
  // デバッグ用（本番環境では表示されない）
  if (process.env.NODE_ENV !== 'production') {
    console.log('Vite base path:', basePath);
  }
  
  return {
    plugins: [react()],
    server: {
      open: true,
      port: 5174,
      strictPort: true
    },
    build: {
      minify: "esbuild",
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            pdf: ["pdf-lib"]
          }
        }
      }
    },
    resolve: {
      alias: {
        "@": "/src"
      }
    },
    // 本番環境でのbaseパス（環境変数から読み取る）
    // 統合用ビルド時は /simulator/ を設定
    base: basePath
  };
});
