import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const aiProxyPort = Number(process.env.AI_PROXY_PORT || 8788);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${aiProxyPort}`,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
