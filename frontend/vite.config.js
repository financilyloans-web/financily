import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite builds the static frontend as a multi-page app.
// base: './' keeps asset URLs relative so the output works on Vercel and any
// static host (including subpaths).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        application: resolve(__dirname, 'application.html'),
        admin: resolve(__dirname, 'admin.html'),
        privacy: resolve(__dirname, 'privacy.html')
      }
    }
  }
});
