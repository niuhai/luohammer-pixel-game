// 测试环境全局 setup：每个测试前清空 localStorage，避免跨用例污染
import { beforeEach } from 'vitest';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch (e) {
    // 某些环境下 localStorage 不可用，忽略
  }
});
