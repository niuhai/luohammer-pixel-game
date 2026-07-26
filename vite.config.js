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
          // 剧情随动态导入的 GameScene 自动拆分，不能强制 manual chunk：
          // 否则 Rollup 会把 config/stages 等首屏共享依赖一并吸入 story，
          // 导致标题页仍然预加载整份剧情。
        }
      }
    },
    chunkSizeWarningLimit: 2000
  }
});
