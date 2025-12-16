import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Declare process manually as @types/node might be missing to satisfy TS
declare const process: any;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };

  return {
    base: './',
    plugins: [react()],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    server: {
      headers: headers,
    },
    preview: {
      headers: headers,
    },
  };
});