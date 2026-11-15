import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The Go backend (backend/) serves /api. In production VITE_API_URL points to it (Railway).
  server: {proxy: {'/api': process.env.API_PROXY ?? 'http://localhost:8080'}},
  preview: {proxy: {'/api': process.env.API_PROXY ?? 'http://localhost:8080'}},
});
