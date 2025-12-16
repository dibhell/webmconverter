import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Declare process manually as @types/node might be missing to satisfy TS
declare const process: any;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    // base: './' is crucial for GitHub Pages deployment (handles subdirectories correctly)
    base: './',
    plugins: [react()],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    define: {
      // Replaces process.env.API_KEY in the code with the actual value during build
      // Checks both the loaded .env file (local dev) and system environment variables (GitHub Actions)
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
});