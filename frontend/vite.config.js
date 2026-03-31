import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // WASM-Dateien korrekt verarbeiten
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['opencascade.js'],
  },
  build: {
    rollupOptions: {
      output: {
        // Three.js als separaten Chunk laden (nur bei Bedarf)
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
