import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SCENE_ASSETS } from '../../src/config.js';

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

describe('剧情背景资源契约', () => {
  test('当前启用的剧情背景均通过最低质量门禁', () => {
    for (const asset of SCENE_ASSETS) {
      const file = path.join(ROOT, 'public', asset.url);
      expect(fs.existsSync(file), `${asset.type} 背景文件不存在`).toBe(true);
      const content = fs.readFileSync(file);
      expect(content.length, `${asset.type} 背景体积异常`).toBeGreaterThan(50_000);
    }
  });

  test('四个专属重绘场景已引用新场景图', () => {
    const activeUrl = type => SCENE_ASSETS.find(asset => asset.type === type)?.url;
    expect(activeUrl('rental')).toContain('scene-rental-v2');
    expect(activeUrl('cafe')).toContain('scene-cafe-v2');
    expect(activeUrl('factory')).toContain('scene-factory-v2');
    expect(activeUrl('factory_door')).toContain('scene-factory_door-v2');
  });
});
