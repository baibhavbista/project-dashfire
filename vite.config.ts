import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // ensure relative paths (needed for itch.io)
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
