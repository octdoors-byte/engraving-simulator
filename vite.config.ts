import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    port: 5174,
    strictPort: true
  },
  build: {
    minify: "terser"
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  }
});
