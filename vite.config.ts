import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), cloudflare()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        // MPA: index.html（メインアプリ）と experience/index.html（3Dページ）を
        // それぞれ独立したエントリとしてビルドする
        input: {
          main: path.resolve(__dirname, 'index.html'),
          experience: path.resolve(__dirname, 'experience/index.html'),
        },
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-motion': ['motion/react'],
            'vendor-three': ['three'],
            'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
            'vendor-postprocessing': ['postprocessing'],
            'vendor-troika': ['troika-three-text'],
            'vendor-spline': ['@splinetool/runtime'],
            'vendor-rive': ['@rive-app/react-canvas'],
            'vendor-theatre': ['@theatre/core'],
          },
        },
      },
    },    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});