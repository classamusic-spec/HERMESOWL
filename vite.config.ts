import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { hermesActivityPlugin } from './scripts/hermes-activity-plugin.ts';

export default defineConfig({
  plugins: [react(), hermesActivityPlugin()],
  build: { target: 'es2022', sourcemap: true },
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
  preview: { host: '127.0.0.1', port: 5178, strictPort: true },
});
