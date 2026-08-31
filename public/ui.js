// ui.js
// Toàn bộ thao tác DOM/hiển thị. Không chứa luật chơi — chỉ vẽ lại những gì
// game.js truyền vào. Tách riêng để dễ bảo trì và để offline/online dùng chung.
import { TILE_TYPES, MAX_HOUSE_LEVEL, mortgageValueOf, unmortgageCostOf } from './gameLogic.js';

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
  for (const id of Object.keys(tokenEls)) delete tokenEls[id];
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

// Giữ lại element token theo playerId qua nhiều lần render, để CSS transition
// (di chuyển mượt giữa các ô) có tác dụng thay vì bị xoá-vẽ-lại và "nhảy vọt".
const tokenEls = {};

function getOrCreateToken(player) {
  const layer = document.getElementById('token-layer');
  if (!layer) return null;
  let el = tokenEls[player.id];
  if (!el) {
    el = document.createElement('div');
    el.className = 'token';
    el.dataset.playerId = player.id;
    layer.appendChild(el);
    tokenEls[player.id] = el;
  }
  el.title = player.name;
  el.style.background = player.color;
  return el;
}

export function clearTileSignals() {
  document.querySelectorAll('.tile--incoming, .tile--passed, .tile--landed').forEach((el) => {
    el.classList.remove('tile--incoming', 'tile--passed', 'tile--landed');
  });
}

export function renderTokens(players) {
  const layer = document.getElementById('token-layer');
  if (!layer) return;

  // Dọn token của người chơi đã phá sản / không còn trong ván.
  const activeIds = new Set(players.filter((p) => !p.bankrupt).map((p) => p.id));
  for (const id of Object.keys(tokenEls)) {
    if (!activeIds.has(id)) {
      tokenEls[id].remove();
      delete tokenEls[id];
    }
  }

  const grouped = {};
  for (const p of players) {
    if (p.bankrupt) continue;
    grouped[p.position] = grouped[p.position] || [];
    grouped[p.position].push(p);
  }
  for (const [pos, group] of Object.entries(grouped)) {
    const { x, y } = tileCenterPercent(Number(pos));
    group.forEach((p, idx) => {
      const el = getOrCreateToken(p);
      if (!el) return;
      const offset = (idx - (group.length - 1) / 2) * 9;
      el.style.left = `calc(${x}% + ${offset}px - 8px)`;
      el.style.top = `calc(${y}% - 8px)`;
    });
  }
}

/**
 * Di chuyển quân cờ của 1 người chơi từng ô một dọc theo `path` (mảng id ô,
 * bắt đầu từ ô hiện tại) thay vì nhảy thẳng tới ô đích.
 * - Ô sắp đến được báo hiệu bằng viền/nền nhấp nháy (tile--incoming).
 * - Ô vừa đi qua được để lại một vệt sáng mờ dần (tile--passed).
 * - Dịch chuyển tức thời (thẻ bài/Cổng dịch chuyển) sẽ chớp hiệu ứng "teleport"
 *   thay vì bước từng ô, vì không có hành trình liên tục để hiển thị.
 */
export function animateTokenMove(playerId, path, { stepMs = 170, teleport = false } = {}) {
  return new Promise((resolve) => {
    const el = tokenEls[playerId];
    if (!el || !path || path.length < 2) { resolve(); return; }

    const destTileId = path[path.length - 1];

    if (teleport) {
      const startTileEl = document.querySelector(`[data-tile-id="${path[0]}"]`);
      if (startTileEl) startTileEl.classList.add('tile--incoming');
      el.classList.add('token--teleporting');
      setTimeout(() => {
        if (startTileEl) startTileEl.classList.remove('tile--incoming');
        const { x, y } = tileCenterPercent(destTileId);
        el.style.left = `calc(${x}% - 8px)`;
        el.style.top = `calc(${y}% - 8px)`;
        const destTileEl = document.querySelector(`[data-tile-id="${destTileId}"]`);
        if (destTileEl) {
          destTileEl.classList.add('tile--landed');
          setTimeout(() => destTileEl.classList.remove('tile--landed'), 600);
        }
        el.classList.remove('token--teleporting');
        resolve();
      }, 180);
      return;
    }

    const tileElAt = (tileId) => document.querySelector(`[data-tile-id="${tileId}"]`);
    let i = 1; // path[0] là ô xuất phát, quân cờ đã đứng sẵn ở đó

    const signalIncoming = (tileId) => {
      const t = tileElAt(tileId);
      if (t) t.classList.add('tile--incoming');
    };
    const markPassed = (tileId, isFinal) => {
      const t = tileElAt(tileId);
      if (!t) return;
      t.classList.remove('tile--incoming');
      if (isFinal) {
        t.classList.add('tile--landed');
        setTimeout(() => t.classList.remove('tile--landed'), 600);
      } else {
        t.classList.add('tile--passed');
        setTimeout(() => t.classList.remove('tile--passed'), 450);
      }
    };

    signalIncoming(path[1]);

    const step = () => {
      const tileId = path[i];
      const { x, y } = tileCenterPercent(tileId);
      el.style.left = `calc(${x}% - 8px)`;
      el.style.top = `calc(${y}% - 8px)`;
      const isFinal = i === path.length - 1;
      if (!isFinal) signalIncoming(path[i + 1]);
      setTimeout(() => {
        markPassed(tileId, isFinal);
        i += 1;
        if (i < path.length) step();
        else resolve();
      }, stepMs);
    };
    step();
  });
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

export function setRollButtonLabel(text) {
  document.getElementById('btn-roll').textContent = text;
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

/** Bảng hành động khi người chơi đang ở Nhà Giam và đến lượt mình. */
export function showJailPanel(player, onPayBail, onUseCard) {
  const html = `
    <div class="jail-panel">
      <p class="jail-panel__title">🚔 Bạn đang ở Nhà Giam (lượt ${player.jailTurns}/3)</p>
      <div class="jail-panel__actions">
        <button class="btn btn--secondary btn--small" id="jail-pay-bail">💸 Nộp phạt (50)</button>
        ${player.jailCards > 0 ? `<button class="btn btn--secondary btn--small" id="jail-use-card">🎫 Dùng thẻ ra tù (${player.jailCards})</button>` : ''}
      </div>
    </div>
  `;
  showDecisionPanel(html);
  document.getElementById('jail-pay-bail').onclick = onPayBail;
  const cardBtn = document.getElementById('jail-use-card');
  if (cardBtn) cardBtn.onclick = onUseCard;
}

/** Bảng đấu giá — hiển thị giá cao nhất hiện tại, và cho phép người chơi đấu giá/rút lui khi đến lượt. */
export function showAuctionPanel(state, myPlayerId, onBid, onPass) {
  const auction = state.auction;
  const tile = state.board.find((t) => t.id === auction.tileId);
  const bidderName = (id) => state.players.find((p) => p.id === id)?.name || '???';
  const isMyTurn = auction.currentTurnId === myPlayerId;
  const minNext = auction.highestBid + 1;

  const html = `
    <div class="auction-panel">
      <p class="auction-panel__title">🔨 Đấu giá: ${escapeHtml(tile?.name || '')}</p>
      <p class="auction-panel__bid">Giá cao nhất: <span class="auction-panel__amount">${
        auction.highestBid > 0 ? formatMoney(auction.highestBid) : 'chưa có'
      }</span>${auction.highestBidder ? ` — ${escapeHtml(bidderName(auction.highestBidder))}` : ''}</p>
      ${
        isMyTurn
          ? `<div class="auction-panel__form">
               <input id="auction-bid-input" type="number" min="${minNext}" step="1" placeholder="${minNext}" />
               <button class="btn btn--primary btn--small" id="auction-bid-btn">Đấu giá</button>
               <button class="btn btn--ghost btn--small" id="auction-pass-btn">Rút lui</button>
             </div>`
          : `<p class="auction-panel__waiting">Đang chờ ${escapeHtml(bidderName(auction.currentTurnId))} quyết định...</p>`
      }
    </div>
  `;
  showDecisionPanel(html);
  if (isMyTurn) {
    document.getElementById('auction-bid-btn').onclick = () => {
      const input = document.getElementById('auction-bid-input');
      onBid(input.value || minNext);
    };
    document.getElementById('auction-pass-btn').onclick = onPass;
  }
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

/* ---------------------------- Quản lý tài sản ---------------------------- */

let manageHandlers = null;
let manageBoard = null;
let manageListenerAttached = false;

function ensureManageListener() {
  if (manageListenerAttached) return;
  manageListenerAttached = true;
  document.getElementById('manage-body').addEventListener('click', (evt) => {
    const btn = evt.target.closest('[data-manage]');
    if (!btn || btn.disabled || !manageHandlers) return;
    const tileId = Number(btn.dataset.tile);
    const kind = btn.dataset.manage;
    if (kind === 'upgrade') manageHandlers.onUpgrade(tileId);
    else if (kind === 'downgrade') manageHandlers.onDowngrade(tileId);
    else if (kind === 'mortgage') manageHandlers.onMortgage(tileId);
    else if (kind === 'unmortgage') manageHandlers.onUnmortgage(tileId);
  });
}

function renderManageBody(player) {
  const body = document.getElementById('manage-body');
  if (!player || player.properties.length === 0) {
    body.innerHTML = '<p class="manage-empty">Bạn chưa sở hữu bất động sản nào.</p>';
    return;
  }
  const owned = manageBoard.filter((t) => player.properties.includes(t.id));
  body.innerHTML = owned
    .map((tile) => {
      const level = tile.level || 0;
      const mortgaged = !!tile.mortgaged;
      const groupTiles = manageBoard.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === tile.group);
      const ownsGroup = groupTiles.every((t) => player.properties.includes(t.id));
      const anyMortgagedInGroup = groupTiles.some((t) => t.mortgaged);
      const canUpgrade = ownsGroup && !mortgaged && !anyMortgagedInGroup && level < MAX_HOUSE_LEVEL - 1 && player.money >= tile.houseCost;
      const canDowngrade = level > 0;
      const canMortgage = !mortgaged && level === 0;
      const canUnmortgage = mortgaged;
      const mortgageValue = mortgageValueOf(tile);
      const unmortgageCost = unmortgageCostOf(tile);
      const statusText = mortgaged ? 'Đã thế chấp' : level > 0 ? `Cấp ${level}` : 'Đất trống';
      return `
        <div class="manage-row">
          <div class="manage-row__info">
            <strong>${escapeHtml(tile.name)}</strong>
            <span class="manage-row__meta ${mortgaged ? 'manage-row__meta--mortgaged' : ''}">${statusText}</span>
          </div>
          <div class="manage-row__actions">
            <button class="btn btn--ghost btn--small" data-manage="upgrade" data-tile="${tile.id}" ${canUpgrade ? '' : 'disabled'}>⬆️ Nâng cấp (${tile.houseCost})</button>
            <button class="btn btn--ghost btn--small" data-manage="downgrade" data-tile="${tile.id}" ${canDowngrade ? '' : 'disabled'}>⬇️ Bán nhà</button>
            <button class="btn btn--ghost btn--small" data-manage="mortgage" data-tile="${tile.id}" ${canMortgage ? '' : 'disabled'}>🏦 Thế chấp (+${mortgageValue})</button>
            <button class="btn btn--ghost btn--small" data-manage="unmortgage" data-tile="${tile.id}" ${canUnmortgage ? '' : 'disabled'}>💳 Chuộc lại (-${unmortgageCost})</button>
          </div>
        </div>
      `;
    })
    .join('');
}

export function showManageModal(board, player, handlers) {
  manageBoard = board;
  manageHandlers = handlers;
  ensureManageListener();
  document.getElementById('modal-manage').hidden = false;
  renderManageBody(player);
}

/** Vẽ lại nội dung modal quản lý tài sản nếu đang mở (gọi sau mỗi lần state thay đổi). */
export function updateManageModal(player) {
  const modal = document.getElementById('modal-manage');
  if (!modal || modal.hidden || !manageBoard) return;
  renderManageBody(player);
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
