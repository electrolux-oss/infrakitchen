import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({ include: ['src'] })],
  build: {
    minify: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: (id) => {
        // Bundle only our own source code; externalize everything else
        if (id.startsWith('.') || id.startsWith('/') || id.startsWith('src/')) {
          return false;
        }
        return true;
      },
      output: {
        chunkFileNames: '[name].[format].js',
      },
    },
  }
})
