import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer} from 'vite';
import analyzeHandler from './api/analyze';

function localAnalyzeApiPlugin(): Plugin {
  const mountAnalyzeApi = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/analyze', (req, res) => {
      analyzeHandler(req, res);
    });
  };

  return {
    name: 'local-analyze-api',
    configureServer: mountAnalyzeApi,
    configurePreviewServer: mountAnalyzeApi,
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  return {
    // GitHub Pages 子路径部署时设置 VITE_BASE_URL 为仓库名，如 '/nutriscan-ai/'
    // 本地开发不需要设置，默认 '/'
    base: env.VITE_BASE_URL || '/',
    plugins: [react(), tailwindcss(), localAnalyzeApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
