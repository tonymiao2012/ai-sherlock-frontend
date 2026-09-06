import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://api.aisherlock.vip',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    // 线上是同源 /admin/；本地 preview 两个端口，转发保持一致
    proxy: { '/admin': { target: 'http://localhost:4174', changeOrigin: true } },
  },
});
