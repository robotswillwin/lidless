import { defineConfig } from 'vite';

// Relative base so the same build runs from a subpath, from file:// in tests, and inside Capacitor and Tauri.
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
