import { defineConfig } from 'vite';

export default defineConfig({
  base: '/luohammer-pixel-game/',
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        // 仅移除 console.log，保留 error/warn 用于生产环境调试
        pure_funcs: ['console.log'],
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    },
    chunkSizeWarningLimit: 2000
  }
});
