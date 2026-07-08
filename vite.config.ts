import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Builds a static SPA into `build/` so the existing Dockerfile + nginx.conf
// (which serve /usr/share/nginx/html from the `build` dir) keep working.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Reuse the existing static asset folder (dancer.gif, favicon.svg, background image).
  publicDir: 'static',
  build: {
    outDir: 'build',
    emptyOutDir: true
  }
});
