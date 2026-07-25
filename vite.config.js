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
        drop_debugger: true,
        // 多次压缩，让 terser 更激进地删除死代码与冗余分支
        passes: 2
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules') && id.includes('phaser')) {
            return 'phaser';
          }
          // 将体量较大的 story 数据拆为独立 chunk，减轻 index chunk 体积
          if (id.includes('src/data/story/')) {
            return 'story';
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000
  }
});
