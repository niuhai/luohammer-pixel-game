// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SW_SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://example.test';

class FakeResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
  }

  clone() {
    return new FakeResponse(this.body, this.status);
  }

  async text() {
    return this.body;
  }

  static error() {
    return new FakeResponse('', 0);
  }
}

function createHarness() {
  const listeners = new Map();
  const entries = new Map();
  const keyOf = (request) => typeof request === 'string' ? request : request.url;
  const cache = {
    addAll: vi.fn(),
    match: vi.fn(async (request) => entries.get(keyOf(request))),
    put: vi.fn(async (request, response) => {
      entries.set(keyOf(request), response);
    })
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true)
  };
  const fetchMock = vi.fn();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) }
  };

  vm.runInNewContext(SW_SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    URL,
    Response: FakeResponse,
    console
  });

  async function dispatchFetch(request) {
    let responsePromise;
    const background = [];
    listeners.get('fetch')({
      request,
      respondWith: (promise) => { responsePromise = promise; },
      waitUntil: (promise) => background.push(promise)
    });
    const response = await responsePromise;
    await Promise.all(background);
    return response;
  }

  async function dispatchLifecycle(type) {
    const promises = [];
    listeners.get(type)({
      waitUntil: (promise) => promises.push(promise)
    });
    await Promise.all(promises);
  }

  return { cache, entries, fetchMock, dispatchFetch, dispatchLifecycle };
}

describe('Service Worker - 评委访问版本新鲜度', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('首次安装会从构建后的 HTML 发现并预缓存哈希入口', async () => {
    harness.fetchMock.mockResolvedValue(new FakeResponse(`
      <link rel="stylesheet" href="/luohammer-pixel-game/assets/index-STYLE123.css">
      <script type="module" src="/luohammer-pixel-game/assets/index-SCRIPT99.js"></script>
      <script type="module" src="/luohammer-pixel-game/assets/phaser-ENGINE88.js"></script>
    `));

    await harness.dispatchLifecycle('install');

    expect(harness.cache.put).toHaveBeenCalledWith(
      './index.html',
      expect.objectContaining({ body: expect.stringContaining('index-SCRIPT99.js') })
    );
    expect(harness.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining([
      '/luohammer-pixel-game/assets/index-STYLE123.css',
      '/luohammer-pixel-game/assets/index-SCRIPT99.js',
      '/luohammer-pixel-game/assets/phaser-ENGINE88.js'
    ]));
  });

  it('导航请求优先联网并刷新离线首页，而不是返回旧缓存', async () => {
    harness.entries.set('./index.html', new FakeResponse('old build'));
    harness.fetchMock.mockResolvedValue(new FakeResponse('current build'));

    const response = await harness.dispatchFetch({
      method: 'GET',
      mode: 'navigate',
      url: `${ORIGIN}/luohammer-pixel-game/?judge=1`
    });

    expect(response.body).toBe('current build');
    expect(harness.entries.get('./index.html').body).toBe('current build');
    expect(harness.fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'navigate' }),
      { cache: 'no-store' }
    );
  });

  it('离线导航仍回退到最近一次成功缓存的首页', async () => {
    harness.entries.set('./index.html', new FakeResponse('offline build'));
    harness.fetchMock.mockRejectedValue(new Error('offline'));

    const response = await harness.dispatchFetch({
      method: 'GET',
      mode: 'navigate',
      url: `${ORIGIN}/luohammer-pixel-game/`
    });

    expect(response.body).toBe('offline build');
  });

  it('Vite 内容哈希资源保持 cache-first，避免重复下载大包', async () => {
    const url = `${ORIGIN}/luohammer-pixel-game/assets/index-ABC12345.js`;
    harness.entries.set(url, new FakeResponse('cached js'));

    const response = await harness.dispatchFetch({
      method: 'GET',
      mode: 'cors',
      url
    });

    expect(response.body).toBe('cached js');
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it('固定文件名资源先返回缓存并在后台更新', async () => {
    const url = `${ORIGIN}/luohammer-pixel-game/assets/characters/scene-stage-v2.webp`;
    harness.entries.set(url, new FakeResponse('old image'));
    harness.fetchMock.mockResolvedValue(new FakeResponse('new image'));

    const response = await harness.dispatchFetch({
      method: 'GET',
      mode: 'cors',
      url
    });

    expect(response.body).toBe('old image');
    expect(harness.entries.get(url).body).toBe('new image');
  });
});
