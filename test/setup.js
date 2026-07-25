// 测试环境全局 setup：每个测试前清空 localStorage，避免跨用例污染
import { beforeEach } from 'vitest';

// Canvas mock：jsdom 不提供原生 canvas，Phaser 初始化时 CanvasFeatures.checkInverseAlpha
// 会创建 canvas 获取 2d context，此处提供最小 mock 避免 TypeError: Cannot set properties of null
// 注意：service-worker.test.js 等非 jsdom 环境无 document，需跳过
if (typeof document !== 'undefined') {
(function installCanvasMock() {
  const originalCreateElement = document.createElement.bind(document);
  const mockCtx = new Proxy(
    {
      fillStyle: '#000',
      strokeStyle: '#000',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      canvas: null,
      fillRect() {},
      clearRect() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
      putImageData() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
      beginPath() {},
      closePath() {},
      arc() {},
      fill() {},
      stroke() {},
      measureText() { return { width: 10 }; },
      fillText() {},
      strokeText() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createPattern() { return {}; },
    },
    {
      set(target, prop, value) { target[prop] = value; return true; },
      get(target, prop) { return prop in target ? target[prop] : (typeof target[prop] === 'function' ? () => {} : undefined); },
    }
  );
  const mockCanvas = {
    getContext(/* type */) { return mockCtx; },
    toDataURL() { return ''; },
    width: 300,
    height: 150,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
  };
  mockCtx.canvas = mockCanvas;
  document.createElement = function(tagName) {
    if (tagName === 'canvas') return { ...mockCanvas };
    return originalCreateElement(tagName);
  };
})();
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch (e) {
    // 某些环境下 localStorage 不可用，忽略
  }
});
