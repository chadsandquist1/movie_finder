import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        diagnostic: resolve(__dirname, 'diagnostic/index.html'),
      },
    },
  },
  server: {
    port: 8080,
  },
});
