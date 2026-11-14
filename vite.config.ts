import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The Orbi chat backend (server/index.ts) runs on its own port and keeps the API key server-side.
  server: {proxy: {'/api': 'http://localhost:8787'}},
  preview: {proxy: {'/api': 'http://localhost:8787'}},
});
