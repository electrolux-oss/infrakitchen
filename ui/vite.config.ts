import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_PORT = "7777";
const port = process.env.VITE_PORT || DEFAULT_PORT;
const backendHost = process.env.BACKEND_HOST || "localhost";

const appVersion = readFileSync(
  resolve(__dirname, "../VERSION"),
  "utf-8",
).trim();
const gitCommitHash = execSync("git rev-parse --short HEAD").toString().trim();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT_HASH__: JSON.stringify(gitCommitHash),
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
    },
  },
  build: {
    minify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("date-fns") || id.includes("jwt-decode")) {
              return "vendor-utils";
            }
            if (
              id.includes("react-router") ||
              id.includes("@remix-run") ||
              id.includes("@react-router")
            ) {
              return "vendor-router";
            }
            if (
              id.includes("@xyflow/") ||
              id.includes("elkjs") ||
              id.includes("d3-")
            ) {
              return "vendor-xyflow";
            }
            if (
              id.includes("codemirror") ||
              id.includes("@codemirror/") ||
              id.includes("@uiw/react-codemirror") ||
              id.includes("@lezer/")
            ) {
              return "vendor-codemirror";
            }
            if (id.includes("@mui/icons-material")) {
              return "vendor-mui-icons";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
