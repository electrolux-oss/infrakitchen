import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_PORT = '7777';
const port = process.env.VITE_PORT || DEFAULT_PORT;
const backendHost = process.env.BACKEND_HOST || 'localhost';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(port, 10),
    proxy: {
      '/api': {
        target: `http://${backendHost}:8000`,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // TreeView — no cycle with material core, page-specific
            if (id.includes('@mui/x-tree-view')) {
              return 'vendor-mui-treeview';
            }
            // Icons — largest by source, kept separate for cache granularity
            if (id.includes('@mui/icons-material')) {
              return 'vendor-mui-icons';
            }
            // MUI core: material + system + x-data-grid (datagrid imports material internally,
            // splitting it causes a circular chunk)
            if (id.includes('@mui/')) {
              return 'vendor-mui';
            }
            // CodeMirror — editor only used on specific pages
            if (id.includes('@codemirror/') || id.includes('@uiw/react-codemirror') || id.includes('@lezer/')) {
              return 'vendor-codemirror';
            }
            // date-fns — large locale data, kept separate
            if (id.includes('node_modules/date-fns/')) {
              return 'vendor-date-fns';
            }
            if (id.includes('@emotion/')) {
              return 'vendor-react';
            }
            if (id.includes('react-router') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
            if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
