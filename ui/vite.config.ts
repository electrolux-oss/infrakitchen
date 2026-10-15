import { resolve } from "path";

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const DEFAULT_PORT = "7777";
const port = process.env.VITE_PORT || DEFAULT_PORT;
const backendHost = process.env.BACKEND_HOST || "localhost";
const frontendLibSource = resolve(__dirname, "frontend-lib/src/index.ts");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@electrolux-oss/infrakitchen": frontendLibSource,
    },
  },
  server: {
    host: "0.0.0.0",
    port: parseInt(port, 10),
    proxy: {
      "/api": {
        target: `http://${backendHost}:8000`,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/oidc": {
        target: `http://${backendHost}:8000`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    minify: true,
    rollupOptions: {
      output: {
        // Only the runtime every page needs gets a named chunk. Everything else
        // is left to the bundler so libraries used by lazy routes (editors,
        // markdown, diff, graphs) load with those routes, not on first paint.
        manualChunks(id) {
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
