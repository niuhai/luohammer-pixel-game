import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TalentSystem } from '../../src/systems/TalentSystem.js';

const TALENTS = [
  { id: 'a', name: '天赋甲', rarity: 'common', icon: 'A', desc: '甲', effects: { pride: 1 } },
  { id: 'b', name: '天赋乙', rarity: 'rare', icon: 'B', desc: '乙', effects: { wealth: 1 } },
  { id: 'c', name: '天赋丙', rarity: 'common', icon: 'C', desc: '丙', effects: { trust: 1 } },
  { id: 'd', name: '天赋丁', rarity: 'common', icon: 'D', desc: '丁', effects: { reputation: 1 } },
  { id: 'e', name: '天赋戊', rarity: 'legendary', icon: 'E', desc: '戊', effects: { pressureMax: 1 } }
];

function mountTalentDom() {
  document.body.innerHTML = `
    <div id="ui-talent-overlay">
      <div class="ui-talent-subtitle"></div>
      <div class="ui-talent-hint"></div>
      <div id="ui-talent-cards"></div>
      <div class="ui-talent-actions">
        <div class="ui-talent-combo"></div>
        <button id="ui-talent-confirm" type="button"></button>
      </div>
    </div>
  `;
}

beforeEach(() => {
  vi.useFakeTimers();
  mountTalentDom();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('TalentSystem - 跨周目生命周期', () => {
  it('销毁旧实例后，第二周目刷新按钮只调用新回调', () => {
    const firstReroll = vi.fn(() => TALENTS);
    const firstSystem = new TalentSystem({});
    firstSystem.show(TALENTS, vi.fn(), { onReroll: firstReroll, rerollCount: 1 });
    expect(document.getElementById('ui-talent-reroll')).not.toBeNull();

    firstSystem.destroy();
    expect(document.getElementById('ui-talent-reroll')).toBeNull();

    const secondReroll = vi.fn(() => TALENTS);
    const secondSystem = new TalentSystem({});
    secondSystem.show(TALENTS, vi.fn(), { onReroll: secondReroll, rerollCount: 1 });
    document.getElementById('ui-talent-reroll').click();

    expect(firstReroll).not.toHaveBeenCalled();
    expect(secondReroll).toHaveBeenCalledOnce();
    expect(document.getElementById('ui-talent-reroll').style.display).toBe('none');
  });

  it('确认按钮只在选满两个天赋后启用', () => {
    const system = new TalentSystem({});
    system.show(TALENTS, vi.fn());
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    const confirm = document.getElementById('ui-talent-confirm');

    expect(confirm.disabled).toBe(true);
    expect(document.querySelector('.ui-talent-hint').textContent).toContain('5 选 2');
    expect(cards.map(card => card.dataset.position)).toEqual(['1/5', '2/5', '3/5', '4/5', '5/5']);
    cards[0].click();
    expect(confirm.disabled).toBe(true);
    expect(document.querySelector('.ui-talent-combo').textContent).toContain('再选择 1 个');
    cards[1].click();
    expect(confirm.disabled).toBe(false);
    expect(confirm.textContent).toContain('2 个天赋');
    expect(document.querySelector('.ui-talent-combo').textContent).toContain('天赋甲 × 天赋乙');
  });
});
