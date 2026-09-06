import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Uses the existing generated routes and components, with no SSR server in the APK.
export default defineConfig({
  plugins: [react(),tailwind()],
  resolve: { alias: { '@':fileURLToPath(new URL('./src',import.meta.url)) } },
  define: { 'import.meta.env.VITE_SAHARA_MOBILE': JSON.stringify('true') },
  build: { outDir:'mobile-dist', rolldownOptions: { input: 'mobile.html' } },
});
