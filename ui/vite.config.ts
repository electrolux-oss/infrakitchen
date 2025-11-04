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
  }
});
