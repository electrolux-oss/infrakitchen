import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({ include: ['src'] })],
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-router",
        "@emotion/react",
        "@emotion/styled",
        "@mui/material",
        "@mui/material/colors",
        "@mui/material/styles",
        "@mui/icons-material",
        "ansi-to-react",
        "graphql-ws",
        "zustand",
        "zustand/react/shallow",
        'react/jsx-runtime',
      ],
      output: {
        chunkFileNames: '[name].[format].js',
      },
    },
  }
})
