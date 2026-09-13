import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  }
});
