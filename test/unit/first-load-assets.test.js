import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('标题首屏响应式资源契约', () => {
  test('preload 与标题图片共享同一组 720/1440/2304 候选', () => {
    const document = new DOMParser().parseFromString(read('index.html'), 'text/html');
    const preload = document.querySelector('link[rel="preload"][as="image"]');
    const image = document.getElementById('ui-boot-character');

    expect(preload?.getAttribute('href')).toContain('scene-stage-v2-1440.webp');
    expect(preload?.getAttribute('imagesizes')).toBe('100vw');
    expect(image?.getAttribute('sizes')).toBe('100vw');

    const preloadCandidates = preload?.getAttribute('imagesrcset') || '';
    const imageCandidates = image?.getAttribute('srcset') || '';
    for (const candidate of [
      'scene-stage-v2-720.webp 720w',
      'scene-stage-v2-1440.webp 1440w',
      'scene-stage-v2.webp 2304w'
    ]) {
      expect(preloadCandidates).toContain(candidate);
      expect(imageCandidates).toContain(candidate);
    }
  });

  test('较小候选真实存在且 Service Worker 提供高密度离线降级', () => {
    const assetDir = path.join(ROOT, 'public', 'assets', 'characters');
    const originalBytes = fs.statSync(path.join(assetDir, 'scene-stage-v2.webp')).size;
    const desktopBytes = fs.statSync(path.join(assetDir, 'scene-stage-v2-1440.webp')).size;
    const mobileBytes = fs.statSync(path.join(assetDir, 'scene-stage-v2-720.webp')).size;
    const serviceWorker = read('public/sw.js');

    expect(mobileBytes).toBeLessThan(desktopBytes);
    expect(desktopBytes).toBeLessThan(originalBytes);
    expect(serviceWorker).toContain("'./assets/characters/scene-stage-v2-720.webp'");
    expect(serviceWorker).toContain("'./assets/characters/scene-stage-v2-1440.webp'");
    expect(serviceWorker).toContain('if (titleFallback) return titleFallback');
  });
});
