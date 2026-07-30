import { ALL_SKILLS, SKILL_TREES } from '../data/skillTree.js';

const SKILL_BY_ID = new Map(ALL_SKILLS.map(skill => [skill.id, skill]));

function skillName(skillId) {
  return SKILL_BY_ID.get(skillId)?.name || skillId;
}

export function getSkillPurchaseState(meta, skill) {
  const exp = meta.getExp();
  if (meta.isSkillUnlocked(skill.id)) {
    return {
      kind: 'unlocked',
      icon: '✓',
      label: '已解锁',
      reason: '永久生效'
    };
  }
  if (meta.isLockedByExclusion(skill.id)) {
    const selected = (skill.exclusiveWith || []).find(id => meta.isSkillUnlocked(id));
    return {
      kind: 'excluded',
      icon: '✕',
      label: '分支已锁',
      reason: selected ? `已选择「${skillName(selected)}」` : '互斥分支已选择'
    };
  }
  if (!meta.arePrerequisitesMet(skill.id)) {
    const missingRequired = (skill.requires || [])
      .filter(id => !meta.isSkillUnlocked(id))
      .map(skillName);
    const anyNames = (skill.requiresAny || []).map(skillName);
    const reason = missingRequired.length > 0
      ? `需先解锁「${missingRequired.join('」「')}」`
      : `需先解锁「${anyNames.join('」或「')}」之一`;
    return {
      kind: 'prerequisite',
      icon: '◒',
      label: '前置未满足',
      reason
    };
  }
  if (exp < skill.cost) {
    return {
      kind: 'insufficient',
      icon: '◇',
      label: `还差 ${skill.cost - exp} EXP`,
      reason: `需要 ${skill.cost} EXP · 当前 ${exp} EXP`
    };
  }
  return {
    kind: 'available',
    icon: '○',
    label: `可解锁 · ${skill.cost} EXP`,
    reason: `解锁后剩余 ${exp - skill.cost} EXP`,
    available: true
  };
}

export function getSkillTreeOpportunity(meta) {
  const candidates = ALL_SKILLS.map(skill => ({
    skill,
    state: getSkillPurchaseState(meta, skill)
  }));
  const available = candidates.filter(candidate => candidate.state.available);

  if (available.length > 0) {
    return {
      kind: 'available',
      count: available.length,
      title: `${available.length} 项技能可解锁`,
      detail: `可从「${available[0].skill.name}」开始`
    };
  }

  const remaining = candidates.filter(
    candidate => !['unlocked', 'excluded'].includes(candidate.state.kind)
  );
  if (remaining.length === 0) {
    return {
      kind: 'complete',
      count: 0,
      title: '可选成长已全部解锁',
      detail: '永久能力将在下一周目继续生效'
    };
  }

  const closest = remaining
    .filter(candidate => candidate.state.kind === 'insufficient')
    .sort((left, right) => left.skill.cost - right.skill.cost)[0];
  if (closest) {
    const gap = closest.skill.cost - meta.getExp();
    return {
      kind: 'insufficient',
      count: 0,
      title: `距离下一项还差 ${gap} EXP`,
      detail: `下一项「${closest.skill.name}」需要 ${closest.skill.cost} EXP`
    };
  }

  return {
    kind: 'prerequisite',
    count: 0,
    title: '下一层技能仍需前置',
    detail: remaining[0].state.reason
  };
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

export function showSkillTreePanel(options) {
  const {
    meta,
    expGained = 0,
    isNewEnding = false,
    audio = null,
    onPurchase = null,
    returnFocus = document.activeElement
  } = options;
  const existing = document.getElementById('ui-skill-tree-overlay');
  if (existing?._skillTreeDispose) existing._skillTreeDispose(false);
  else existing?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ui-skill-tree-overlay';
  overlay.className = 'skill-tree-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'skill-tree-title');
  overlay.setAttribute('aria-describedby', 'skill-tree-instructions');

  const panel = document.createElement('section');
  panel.className = 'skill-tree-panel';

  const header = document.createElement('header');
  header.className = 'skill-tree-header';
  const headingGroup = document.createElement('div');
  headingGroup.className = 'skill-tree-heading-group';
  const title = createTextElement('h2', 'skill-tree-title', '♣ 人生技能树');
  title.id = 'skill-tree-title';
  const instructions = createTextElement(
    'p',
    'skill-tree-instructions',
    'EXP 是跨周目永久资源。选择节点后会先显示消费确认。'
  );
  instructions.id = 'skill-tree-instructions';
  headingGroup.append(title, instructions);

  const balanceGroup = document.createElement('div');
  balanceGroup.className = 'skill-tree-balance-group';
  const expDisplay = createTextElement('strong', 'skill-tree-exp', '');
  expDisplay.id = 'skill-tree-exp';
  expDisplay.setAttribute('aria-live', 'polite');
  const gain = createTextElement(
    'span',
    'skill-tree-gain',
    expGained > 0
      ? `本局 +${expGained} EXP${isNewEnding ? ' · 新结局奖励' : ''}`
      : '跨周目永久生效'
  );
  balanceGroup.append(expDisplay, gain);

  const closeButton = createTextElement('button', 'skill-tree-close', '关闭');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭人生技能树');
  header.append(headingGroup, balanceGroup, closeButton);

  const scroll = document.createElement('div');
  scroll.className = 'skill-tree-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', '技能树内容，可上下滚动');
  const grid = document.createElement('div');
  grid.className = 'skill-tree-grid';
  scroll.appendChild(grid);

  const confirmation = document.createElement('footer');
  confirmation.className = 'skill-tree-confirm';
  confirmation.hidden = true;
  confirmation.setAttribute('role', 'status');
  confirmation.setAttribute('aria-live', 'polite');
  const confirmCopy = document.createElement('div');
  confirmCopy.className = 'skill-tree-confirm-copy';
  const confirmTitle = createTextElement('strong', 'skill-tree-confirm-title', '');
  const confirmDetail = createTextElement('span', 'skill-tree-confirm-detail', '');
  confirmCopy.append(confirmTitle, confirmDetail);
  const confirmActions = document.createElement('div');
  confirmActions.className = 'skill-tree-confirm-actions';
  const cancelButton = createTextElement('button', 'skill-tree-confirm-cancel', '再想想');
  cancelButton.type = 'button';
  const confirmButton = createTextElement(
    'button',
    'skill-tree-confirm-action',
    '确认解锁'
  );
  confirmButton.type = 'button';
  confirmActions.append(cancelButton, confirmButton);
  confirmation.append(confirmCopy, confirmActions);

  panel.append(header, scroll, confirmation);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let pendingSkill = null;
  let pendingButton = null;
  let closed = false;

  const updateBalance = () => {
    expDisplay.textContent = `${meta.getExp()} EXP`;
    expDisplay.setAttribute('aria-label', `当前可用人生经验 ${meta.getExp()} 点`);
  };

  const cancelConfirmation = ({ restoreFocus = true } = {}) => {
    confirmation.hidden = true;
    pendingSkill = null;
    const focusTarget = pendingButton;
    pendingButton = null;
    if (restoreFocus && focusTarget?.isConnected) {
      focusTarget.focus({ preventScroll: true });
    }
  };

  const openConfirmation = (skill, button) => {
    pendingSkill = skill;
    pendingButton = button;
    confirmTitle.textContent = `解锁「${skill.name}」？`;
    confirmDetail.textContent =
      `${skill.desc} · ${meta.getExp()} → ${meta.getExp() - skill.cost} EXP`;
    confirmButton.textContent = `确认解锁 · ${skill.cost} EXP`;
    confirmation.hidden = false;
    confirmButton.disabled = false;
    confirmButton.focus({ preventScroll: true });
  };

  const createSkillButton = skill => {
    const purchaseState = getSkillPurchaseState(meta, skill);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `skill-tree-node is-${purchaseState.kind}`;
    button.dataset.skillId = skill.id;
    button.setAttribute('aria-disabled', String(!purchaseState.available));

    const top = document.createElement('span');
    top.className = 'skill-tree-node-top';
    const name = createTextElement(
      'span',
      'skill-tree-node-name',
      `${purchaseState.icon} ${skill.name}`
    );
    const state = createTextElement(
      'span',
      'skill-tree-node-state',
      purchaseState.label
    );
    top.append(name, state);
    const description = createTextElement('span', 'skill-tree-node-desc', skill.desc);
    const reason = createTextElement('span', 'skill-tree-node-reason', purchaseState.reason);
    button.append(top, description, reason);

    if (purchaseState.available) {
      button.addEventListener('click', () => openConfirmation(skill, button));
    } else {
      button.addEventListener('click', event => {
        event.preventDefault();
      });
    }
    return button;
  };

  const renderTrees = focusSkillId => {
    grid.innerHTML = '';
    updateBalance();
    for (const tree of Object.values(SKILL_TREES)) {
      const branch = document.createElement('article');
      branch.className = 'skill-tree-branch';
      branch.dataset.treeId = tree.id;
      branch.style.setProperty('--skill-tree-color', tree.color);
      const branchHeader = document.createElement('header');
      branchHeader.className = 'skill-tree-branch-header';
      branchHeader.append(
        createTextElement('h3', 'skill-tree-branch-title', `${tree.icon} ${tree.name}`),
        createTextElement('p', 'skill-tree-branch-desc', tree.desc)
      );
      branch.appendChild(branchHeader);

      const renderedSkillIds = new Set();
      for (const skill of tree.skills) {
        if (renderedSkillIds.has(skill.id)) continue;
        if (skill.exclusiveWith) {
          const partner = tree.skills.find(candidate =>
            skill.exclusiveWith.includes(candidate.id)
          );
          const branchChoice = document.createElement('section');
          branchChoice.className = 'skill-tree-exclusive';
          branchChoice.setAttribute('aria-label', '第四级互斥分支，二选一');
          branchChoice.appendChild(
            createTextElement('div', 'skill-tree-exclusive-label', 'Lv4 · 二选一')
          );
          const row = document.createElement('div');
          row.className = 'skill-tree-exclusive-row';
          row.appendChild(createSkillButton(skill));
          if (partner) row.appendChild(createSkillButton(partner));
          branchChoice.appendChild(row);
          branch.appendChild(branchChoice);
          renderedSkillIds.add(skill.id);
          if (partner) renderedSkillIds.add(partner.id);
        } else {
          branch.appendChild(createSkillButton(skill));
          renderedSkillIds.add(skill.id);
        }
      }
      grid.appendChild(branch);
    }

    requestAnimationFrame(() => {
      const focusTarget = focusSkillId
        ? overlay.querySelector(`[data-skill-id="${focusSkillId}"]`)
        : overlay.querySelector('.skill-tree-node.is-available');
      (focusTarget || closeButton).focus({ preventScroll: true });
    });
  };

  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true;
    overlay.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    if (restoreFocus && returnFocus?.isConnected) {
      returnFocus.focus({ preventScroll: true });
    }
  };

  const getFocusable = () => [...overlay.querySelectorAll('button, [tabindex="0"]')]
    .filter(element => !element.closest('[hidden]'));
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!confirmation.hidden) cancelConfirmation();
      else close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  closeButton.addEventListener('click', () => close());
  cancelButton.addEventListener('click', () => cancelConfirmation());
  confirmButton.addEventListener('click', () => {
    if (!pendingSkill || confirmButton.disabled) return;
    confirmButton.disabled = true;
    const skillId = pendingSkill.id;
    if (meta.purchaseSkill(skillId)) {
      try { audio?.playAchievement?.(); } catch (error) {}
      confirmation.hidden = true;
      pendingSkill = null;
      pendingButton = null;
      renderTrees(skillId);
      try {
        onPurchase?.({
          skillId,
          exp: meta.getExp(),
          opportunity: getSkillTreeOpportunity(meta)
        });
      } catch (error) {}
      return;
    }
    confirmDetail.textContent = '状态已变化，未消费 EXP。请重新选择。';
    confirmButton.disabled = false;
  });
  overlay.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  overlay._skillTreeDispose = close;

  renderTrees();
  return { close };
}
