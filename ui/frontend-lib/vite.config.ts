import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
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
        'react/jsx-runtime',
      ],
      output: {
        chunkFileNames: '[name].[format].js',
      },
    },
  }
})
