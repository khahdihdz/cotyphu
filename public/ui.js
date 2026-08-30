// ui.js
// Toàn bộ thao tác DOM/hiển thị. Không chứa luật chơi — chỉ vẽ lại những gì
// game.js truyền vào. Tách riêng để dễ bảo trì và để offline/online dùng chung.
import { TILE_TYPES } from './gameLogic.js';

const GROUP_COLORS = {
  A: '#E85A4F', B: '#F2B84B', C: '#3FC1C9', D: '#9B8CF2',
  E: '#5EC97A', F: '#F27DB0', STATION: '#8C97B8',
};

export function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('screen--active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('screen--active');
}

export function showToast(text, variant = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${variant ? `toast--${variant}` : ''}`.trim();
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function setReconnectBanner(visible) {
  document.getElementById('reconnect-banner').hidden = !visible;
}

/* ------------------------------- Board -------------------------------- */

function tileGridPosition(i) {
  const n = 9;
  if (i <= 8) return { row: n, col: n - i };
  if (i <= 16) return { row: n - (i - 8), col: 1 };
  if (i <= 24) return { row: 1, col: 1 + (i - 16) };
  return { row: 1 + (i - 24), col: n };
}

function tileCenterPercent(i) {
  const { row, col } = tileGridPosition(i);
  return { x: ((col - 0.5) / 9) * 100, y: ((row - 0.5) / 9) * 100 };
}

function tileIcon(tile) {
  switch (tile.type) {
    case TILE_TYPES.START: return '🚀';
    case TILE_TYPES.TAX: return '💸';
    case TILE_TYPES.CHANCE: return '❓';
    case TILE_TYPES.EVENT: return '⚡';
    case TILE_TYPES.BONUS: return '🎁';
    case TILE_TYPES.REST: return '☕';
    case TILE_TYPES.JAIL: return '🚔';
    case TILE_TYPES.TELEPORT: return '🌀';
    default: return '';
  }
}

export function initBoard(board) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (const tile of board) {
    const { row, col } = tileGridPosition(tile.id);
    const div = document.createElement('div');
    div.className = `tile tile--${tile.type}`;
    div.dataset.tileId = String(tile.id);
    div.style.gridRow = String(row);
    div.style.gridColumn = String(col);

    if (tile.type === TILE_TYPES.PROPERTY) {
      const bar = document.createElement('div');
      bar.className = 'tile__bar';
      bar.style.background = GROUP_COLORS[tile.group] || '#888';
      div.appendChild(bar);
    }

    const name = document.createElement('div');
    name.className = 'tile__name';
    name.textContent = tile.type === TILE_TYPES.PROPERTY || tile.type === TILE_TYPES.TAX ? tile.name : `${tileIcon(tile)} ${tile.name}`;
    div.appendChild(name);

    if (tile.type === TILE_TYPES.PROPERTY) {
      const price = document.createElement('div');
      price.className = 'tile__price';
      price.textContent = tile.price;
      div.appendChild(price);
      const level = document.createElement('div');
      level.className = 'tile__level';
      level.dataset.levelFor = String(tile.id);
      div.appendChild(level);
      const ownerDot = document.createElement('div');
      ownerDot.className = 'tile__owner-dot';
      ownerDot.dataset.ownerFor = String(tile.id);
      ownerDot.style.background = 'transparent';
      div.appendChild(ownerDot);
    }
    if (tile.type === TILE_TYPES.TAX) {
      const amt = document.createElement('div');
      amt.className = 'tile__price';
      amt.textContent = `-${tile.amount}`;
      div.appendChild(amt);
    }

    boardEl.appendChild(div);
  }

  const tokenLayer = document.createElement('div');
  tokenLayer.className = 'token-layer';
  tokenLayer.id = 'token-layer';
  boardEl.appendChild(tokenLayer);
}

export function renderOwnership(board, players) {
  for (const tile of board) {
    if (tile.type !== TILE_TYPES.PROPERTY) continue;
    const owner = players.find((p) => p.properties.includes(tile.id));
    const dot = document.querySelector(`[data-owner-for="${tile.id}"]`);
    if (dot) dot.style.background = owner ? owner.color : 'transparent';
    const levelEl = document.querySelector(`[data-level-for="${tile.id}"]`);
    if (levelEl) {
      const lvl = tile.level || 0;
      levelEl.textContent = lvl > 0 ? '🏠'.repeat(Math.min(lvl, 4)) + (lvl >= 5 ? '🏨' : '') : '';
    }
  }
}

export function renderTokens(players) {
  const layer = document.getElementById('token-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const grouped = {};
  for (const p of players) {
    if (p.bankrupt) continue;
    grouped[p.position] = grouped[p.position] || [];
    grouped[p.position].push(p);
  }
  for (const [pos, group] of Object.entries(grouped)) {
    const { x, y } = tileCenterPercent(Number(pos));
    group.forEach((p, idx) => {
      const el = document.createElement('div');
      el.className = 'token';
      el.title = p.name;
      el.style.background = p.color;
      const offset = (idx - (group.length - 1) / 2) * 9;
      el.style.left = `calc(${x}% + ${offset}px - 8px)`;
      el.style.top = `calc(${y}% - 8px)`;
      layer.appendChild(el);
    });
  }
}

/* -------------------------------- HUD ---------------------------------- */

export function renderHUD(state, myPlayerId) {
  const hud = document.getElementById('player-hud');
  hud.innerHTML = '';
  state.players.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'hud__card';
    if (idx === state.turnIndex && state.phase === 'PLAYING') card.classList.add('hud__card--active');
    if (p.bankrupt) card.classList.add('hud__card--bankrupt');
    card.innerHTML = `
      <div class="hud__name"><span class="hud__dot" style="background:${p.color}"></span>${escapeHtml(p.name)}${p.isAI ? ' 🤖' : ''}${p.id === myPlayerId ? ' (Bạn)' : ''}</div>
      <div class="hud__money">${formatMoney(p.money)}</div>
      <div style="font-size:0.72rem;color:var(--text-dim)">${p.properties.length} BĐS${p.bankrupt ? ' · Phá sản' : ''}</div>
    `;
    hud.appendChild(card);
  });
}

export function renderTicker(players) {
  const ticker = document.getElementById('money-ticker');
  const items = players
    .map((p) => `<span class="ticker__item ${p.money < 0 ? 'negative' : ''}">${escapeHtml(p.name)}: ${formatMoney(p.money)}</span>`)
    .join('');
  ticker.innerHTML = `<div class="ticker__track">${items}${items}</div>`;
}

export function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toLocaleString('vi-VN')} 💰`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* -------------------------------- Dice ---------------------------------- */

export function renderDice(dice, { rolling = false } = {}) {
  const d1 = document.getElementById('die-1');
  const d2 = document.getElementById('die-2');
  if (rolling) {
    d1.classList.add('rolling');
    d2.classList.add('rolling');
    setTimeout(() => {
      d1.classList.remove('rolling');
      d2.classList.remove('rolling');
    }, 500);
  }
  if (dice) {
    d1.textContent = dice[0];
    d2.textContent = dice[1];
  }
}

export function setTurnIndicator(text) {
  document.getElementById('turn-indicator').textContent = text;
}

export function setAIThinking(visible) {
  document.getElementById('ai-thinking-indicator').hidden = !visible;
}

export function setRollButtonVisible(visible) {
  document.getElementById('btn-roll').hidden = !visible;
}

export function setEndTurnButtonVisible(visible) {
  document.getElementById('btn-end-turn').hidden = !visible;
}

export function showDecisionPanel(html) {
  const panel = document.getElementById('decision-panel');
  panel.innerHTML = html;
  panel.hidden = false;
}

export function hideDecisionPanel() {
  const panel = document.getElementById('decision-panel');
  panel.hidden = true;
  panel.innerHTML = '';
}

/* -------------------------------- Modals --------------------------------- */

export function showBuyModal(tile, onBuy, onSkip) {
  const modal = document.getElementById('modal-buy');
  document.getElementById('modal-buy-name').textContent = tile.name;
  document.getElementById('modal-buy-price').textContent = tile.price;
  modal.hidden = false;
  const buyBtn = modal.querySelector('[data-action="buy-property"]');
  const skipBtn = modal.querySelector('[data-action="skip-property"]');
  buyBtn.onclick = () => { modal.hidden = true; onBuy(); };
  skipBtn.onclick = () => { modal.hidden = true; onSkip(); };
}

export function hideModal(id) {
  document.getElementById(id).hidden = true;
}

export function showGameOverModal(text) {
  document.getElementById('gameover-text').textContent = text;
  document.getElementById('modal-gameover').hidden = false;
}

export function showTradeIncoming(text, onAccept, onDecline) {
  const modal = document.getElementById('modal-trade-incoming');
  document.getElementById('trade-incoming-text').textContent = text;
  modal.hidden = false;
  modal.querySelector('[data-action="accept-trade"]').onclick = () => { modal.hidden = true; onAccept(); };
  modal.querySelector('[data-action="decline-trade"]').onclick = () => { modal.hidden = true; onDecline(); };
}

/* -------------------------------- Chat ---------------------------------- */

export function toggleChatPanel(force) {
  const panel = document.getElementById('chat-panel');
  const open = force === undefined ? !panel.classList.contains('chat-panel--open') : force;
  panel.classList.toggle('chat-panel--open', open);
}

export function addChatLine(name, text) {
  const log = document.getElementById('chat-log');
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.innerHTML = `<strong>${escapeHtml(name)}:</strong> ${escapeHtml(text)}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

export function addGameLog(text) {
  const log = document.getElementById('game-log');
  const line = document.createElement('div');
  line.textContent = `· ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 60) log.removeChild(log.firstChild);
}

/* -------------------------------- Lobby ---------------------------------- */

export function renderLobby(state, myPlayerId, roomId) {
  document.getElementById('lobby-room-code').textContent = roomId;
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'lobby__player';
    li.innerHTML = `
      <span class="lobby__player-dot" style="background:${p.color}"></span>
      <span class="lobby__player-name">${escapeHtml(p.name)}${p.id === myPlayerId ? ' (Bạn)' : ''}${p.isAI ? ' 🤖' : ''}</span>
      <span class="lobby__player-tag">${p.ready || p.isAI ? '✅ Sẵn sàng' : 'Đang chờ'}</span>
    `;
    list.appendChild(li);
  });
  document.getElementById('lobby-count').textContent = `${state.players.length}/4 người chơi`;
  const isHost = state.players[0]?.id === myPlayerId;
  document.getElementById('lobby-start-btn').hidden = !isHost;
}
