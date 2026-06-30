import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/data/effects.js', 'src/data/endings.js', 'src/systems/MetaProgression.js', 'src/systems/SaveSystem.js', 'src/data/talents.js', 'src/data/skillTree.js']
    }
  }
});
