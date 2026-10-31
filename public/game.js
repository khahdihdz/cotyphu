// game.js
// "Nhạc trưởng" của app: nối các hành động UI với hoặc là engine offline
// (gameLogic.js + ai.js chạy thẳng trên trình duyệt) hoặc kết nối online
// (websocket.js nói chuyện với Cloudflare Worker/Durable Object).
import * as Game from './gameLogic.js';
import * as AI from './ai.js';
import { C2S, S2C } from './protocol.js';
import { RoomConnection } from './websocket.js';
import * as UI from './ui.js';

let board3dInstance = null;\nlet board3dLoadPromise = null;\nlet board3dUnavailableNotified = false;\n\nconst LS_KEYS = { settings: 'ctp_settings_v1', save: 'ctp_offline_save_v1' };

const App = {
  mode: null, // 'offline' | 'online'
  state: null, // game state hiện tại (giống nhau về hình dạng ở cả 2 chế độ)
  myPlayerId: null,
  roomId: null,
  conn: null,
  aiRunningOffline: false,
  auctionRunningOffline: false,
  settings: loadSettings(),
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.settings)) || { sound: true, lang: 'vi' };
  } catch (_err) {
    return { sound: true, lang: 'vi' };
  }
}
function saveSettings() {
  localStorage.setItem(LS_KEYS.settings, JSON.stringify(App.settings));
}

/* ============================== NAVIGATION ============================== */

document.addEventListener('click', (evt) => {
  const btn = evt.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const handler = ACTIONS[action];
  if (handler) handler(btn);
});

const ACTIONS = {
  'go-home': () => UI.navigateTo('screen-home'),
  'show-offline-setup': () => UI.navigateTo('screen-offline-setup'),
  'show-create-room': () => UI.navigateTo('screen-create-room'),
  'show-join-room': () => UI.navigateTo('screen-join-room'),
  'show-guide': () => UI.navigateTo('screen-guide'),
  'show-settings': () => UI.navigateTo('screen-settings'),
  'start-offline': startOffline,
  'do-create-room': doCreateRoom,
  'do-join-room': doJoinRoom,
  'toggle-ready': toggleReady,
  'start-online-game': startOnlineGame,
  'leave-room': leaveRoom,
  'roll-dice': rollDice,
  'buy-property': () => decideProperty('BUY'),
  'skip-property': () => decideProperty('SKIP'),
  'pay-bail': payBail,
  'use-jail-card': useJailCard,
  'open-manage': openManageModal,
  'close-manage': () => UI.hideModal('modal-manage'),
  'end-turn': endTurn,
  'toggle-chat': () => UI.toggleChatPanel(),
  'open-trade': openTradeModal,
  'close-trade': () => UI.hideModal('modal-trade'),
  'send-trade': sendTrade,
};

document.getElementById('setting-sound').addEventListener('change', (e) => {
  App.settings.sound = e.target.checked;
  UI.setSoundEnabled(App.settings.sound);
  saveSettings();
});
document.getElementById('setting-lang').addEventListener('change', (e) => {
  App.settings.lang = e.target.value;
  saveSettings();
});
document.getElementById('setting-sound').checked = App.settings.sound;
document.getElementById('setting-lang').value = App.settings.lang;
UI.setSoundEnabled(App.settings.sound);

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.CHAT, text });
  } else {
    UI.addChatLine('Bạn', text);
  }
  input.value = '';
});

/* =============================== OFFLINE =============================== */

function startOffline() {
  const name = document.getElementById('offline-name').value.trim() || 'Người chơi';
  const aiCount = Number(document.getElementById('offline-ai-count').value);
  const humanId = 'human';
  const players = [Game.createPlayer({ id: humanId, name, color: Game.PLAYER_COLORS[0] })];
  const personalities = ['CAUTIOUS', 'AGGRESSIVE', 'GREEDY', 'STRATEGIST'];
  for (let i = 0; i < aiCount; i += 1) {
    players.push(
      Game.createPlayer({
        id: `ai-${i}`,
        name: `AI ${personalities[i % personalities.length]}`,
        isAI: true,
        personality: personalities[i % personalities.length],
        color: Game.PLAYER_COLORS[i + 1],
      })
    );
  }
  App.mode = 'offline';
  App.myPlayerId = humanId;
  App.state = Game.createInitialState('OFFLINE', players);
  Game.startGame(App.state);
  enterBoardScreen();
  runOfflineAILoopIfNeeded();
}

function persistOfflineSave() {
  if (App.mode !== 'offline') return;
  try {
    localStorage.setItem(LS_KEYS.save, JSON.stringify({ state: App.state, myPlayerId: App.myPlayerId }));
  } catch (_err) {
    /* bỏ qua nếu storage đầy */
  }
}

async function runOfflineAILoopIfNeeded() {
  if (App.aiRunningOffline) return;
  App.aiRunningOffline = true;
  try {
    while (App.mode === 'offline' && App.state && App.state.phase === 'PLAYING') {
      const player = App.state.players[App.state.turnIndex];
      if (!player || !player.isAI) break;
      // Người chơi vừa phá sản trong lượt của chính mình vẫn cần gọi endTurn() một
      // lần cuối để nhường lượt — nếu không turnIndex sẽ mắc kẹt mãi mãi.
      if (player.bankrupt && App.state.turnPhase !== 'TURN_DONE') break;
      UI.setAIThinking(true);
      await sleep(AI.getThinkingDelay(player.personality));
      UI.setAIThinking(false);

      if (App.state.turnPhase === 'AWAITING_ROLL' && player.inJail) {
        const jailAction = AI.decideJailAction(App.state, player);
        let res;
        if (jailAction === 'PAY_BAIL') res = Game.payBail(App.state, player.id);
        else if (jailAction === 'USE_CARD') res = Game.useJailCard(App.state, player.id);
        else res = Game.rollDice(App.state, player.id);
        await applyEvents(res.events);
      } else if (App.state.turnPhase === 'AWAITING_ROLL') {
        const res = Game.rollDice(App.state, player.id);
        await applyEvents(res.events);
      } else if (App.state.turnPhase === 'AWAITING_PROPERTY_DECISION') {
        const tile = Game.BOARD.find((t) => t.id === App.state.pendingTileId);
        await sleep(400);
        const decision = tile ? AI.decideBuy(App.state, player, tile) : 'SKIP';
        const res = Game.buyProperty(App.state, player.id, decision);
        await applyEvents(res.events);
        renderAll();
        persistOfflineSave();
        if (App.state.turnPhase === 'AWAITING_AUCTION') {
          App.aiRunningOffline = false; // nhường quyền cho vòng lặp đấu giá riêng
          await runOfflineAuctionAILoopIfNeeded();
          App.aiRunningOffline = true;
        }
        continue;
      } else if (App.state.turnPhase === 'TURN_DONE') {
        const upgrades = AI.decideUpgrades(App.state, player);
        for (const tileId of upgrades) {
          const res = Game.upgradeProperty(App.state, player.id, tileId);
          await applyEvents(res.events);
          await sleep(250);
        }
        AI.updateAIMemory(App.state);
        const endRes = Game.endTurn(App.state, player.id);
        await applyEvents(endRes.events);
        if (App.state.phase === 'ENDED') {
          UI.showGameOverModal(gameOverText());
          break;
        }
      } else {
        break;
      }
      renderAll();
      persistOfflineSave();
    }
  } finally {
    App.aiRunningOffline = false;
  }
}

/**
 * Vòng lặp đấu giá offline: tự động xử lý các lượt đấu giá của AI cho đến khi
 * đến lượt người chơi thật hoặc phiên đấu giá kết thúc.
 */
async function runOfflineAuctionAILoopIfNeeded() {
  if (App.mode !== 'offline' || App.auctionRunningOffline) return;
  App.auctionRunningOffline = true;
  try {
    while (App.state && App.state.turnPhase === 'AWAITING_AUCTION' && App.state.auction) {
      const actor = App.state.players.find((p) => p.id === App.state.auction.currentTurnId);
      if (!actor || !actor.isAI) break;
      UI.setAIThinking(true);
      await sleep(AI.getThinkingDelay(actor.personality));
      UI.setAIThinking(false);
      const decision = AI.decideAuctionAction(App.state, actor, App.state.auction);
      const res =
        decision && decision.action === 'BID'
          ? Game.auctionBid(App.state, actor.id, decision.amount)
          : Game.auctionPass(App.state, actor.id);
      await applyEvents(res.events);
      renderAll();
      persistOfflineSave();
    }
  } finally {
    App.auctionRunningOffline = false;
  }
  if (App.state && App.state.turnPhase === 'TURN_DONE') {
    runOfflineAILoopIfNeeded();
  }
}

/* ================================ ONLINE ================================ */

async function doCreateRoom() {
  const name = document.getElementById('create-name').value.trim() || 'Người chơi';
  try {
    const workerUrl = window.CTP_CONFIG?.workerUrl || '';\n    const apiUrl = `${workerUrl.replace(/\/$/, '')}/api/create-room`;\n    const res = await fetch(apiUrl);\n    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    connectOnline({ room: data.roomId, name, action: 'create' });
  } catch (_err) {
    UI.showToast('Không thể tạo phòng, kiểm tra kết nối mạng.', 'error');
  }
}

function doJoinRoom() {
  const name = document.getElementById('join-name').value.trim() || 'Người chơi';
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) {
    UI.showToast('Vui lòng nhập mã phòng.', 'error');
    return;
  }
  connectOnline({ room: code, name });
}

function connectOnline({ room, name, action }) {
  App.mode = 'online';
  App.roomId = room;
  App.conn = new RoomConnection({
    onOpen: () => UI.setReconnectBanner(false),
    onClose: () => {},
    onReconnecting: () => UI.setReconnectBanner(true),
    onMessage: handleServerMessage,
  });
  App.conn.connect({ room, name, action });
}

async function handleServerMessage(msg) {
  switch (msg.type) {
    case S2C.ROOM_CREATED:
      App.myPlayerId = msg.playerId;
      App.state = msg.state;
      UI.navigateTo('screen-lobby');
      UI.renderLobby(App.state, App.myPlayerId, App.roomId);
      break;

    case S2C.ROOM_UPDATED:
      App.state = msg.state;
      if (App.state.phase === 'LOBBY') {
        UI.renderLobby(App.state, App.myPlayerId, App.roomId);
      }
      break;

    case S2C.GAME_STARTED:
      App.state = msg.state;
      enterBoardScreen();
      break;

    case S2C.GAME_STATE:
      App.state = msg.state;
      if (msg.events) await applyEvents(msg.events);
      renderAll();
      break;

    case S2C.AI_THINKING:
      UI.setAIThinking(true);
      break;

    case S2C.CHAT_MESSAGE:
      UI.addChatLine(msg.name, msg.text);
      break;

    case S2C.TRADE_PROPOSED:
      if (msg.fromId !== App.myPlayerId && App.state?.pendingOffer?.toId === App.myPlayerId) {
        promptIncomingTrade(App.state.pendingOffer);
      }
      break;

    case S2C.GAME_OVER:
      App.state = msg.state || App.state;
      UI.showGameOverModal(gameOverText());
      break;

    case S2C.PLAYER_JOINED:
    case S2C.PLAYER_LEFT:
      // ROOM_UPDATED / GAME_STATE theo sau sẽ vẽ lại toàn bộ danh sách.
      break;

    case S2C.ERROR:
      UI.showToast(msg.message, 'error');
      UI.setAIThinking(false);
      break;

    default:
      break;
  }
}

function toggleReady() {
  const p = App.state.players.find((pl) => pl.id === App.myPlayerId);
  App.conn.send({ type: C2S.READY, ready: !(p && p.ready) });
}

function startOnlineGame() {
  const fillAI = document.getElementById('lobby-fill-ai').checked;
  App.conn.send({ type: C2S.START_GAME, fillAI });
}

function leaveRoom() {
  if (App.conn) App.conn.disconnect();
  App.conn = null;
  App.mode = null;
  App.state = null;
  UI.navigateTo('screen-home');
}

/* ============================ HÀNH ĐỘNG CHUNG ============================ */

async function rollDice() {
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.ROLL_DICE });
    return;
  }
  const player = App.state.players[App.state.turnIndex];
  if (player.id !== App.myPlayerId) return;
  const res = Game.rollDice(App.state, App.myPlayerId);
  if (!res.ok) {
    UI.showToast('Không thể tung xúc xắc lúc này.', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
  if (App.state.turnPhase === 'TURN_DONE' || App.state.phase === 'ENDED') {
    // để người chơi tự bấm "Kết thúc lượt"
  }
}

async function decideProperty(decision) {
  if (App.mode === 'online') {
    App.conn.send({ type: decision === 'BUY' ? C2S.BUY_PROPERTY : C2S.SKIP_PROPERTY });
    return;
  }
  const res = Game.buyProperty(App.state, App.myPlayerId, decision);
  if (res.ok) await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
  if (App.state.turnPhase === 'AWAITING_AUCTION') {
    runOfflineAuctionAILoopIfNeeded();
  }
}

async function payBail() {
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.PAY_BAIL });
    return;
  }
  const res = Game.payBail(App.state, App.myPlayerId);
  if (!res.ok) {
    UI.showToast('Không thể nộp phạt lúc này.', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
}

async function useJailCard() {
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.USE_JAIL_CARD });
    return;
  }
  const res = Game.useJailCard(App.state, App.myPlayerId);
  if (!res.ok) {
    UI.showToast('Bạn không có Thẻ Ra Tù Miễn Phí.', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
}

async function submitAuctionBid(amount) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    UI.showToast('Nhập một mức giá hợp lệ.', 'error');
    return;
  }
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.AUCTION_BID, amount: amt });
    return;
  }
  const res = Game.auctionBid(App.state, App.myPlayerId, amt);
  if (!res.ok) {
    UI.showToast('Giá đấu không hợp lệ (phải cao hơn giá hiện tại và trong khả năng chi trả).', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
  runOfflineAuctionAILoopIfNeeded();
  if (App.state.phase === 'ENDED') UI.showGameOverModal(gameOverText());
}

async function submitAuctionPass() {
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.AUCTION_PASS });
    return;
  }
  const res = Game.auctionPass(App.state, App.myPlayerId);
  if (!res.ok) {
    UI.showToast('Không thể rút khỏi đấu giá lúc này.', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
  runOfflineAuctionAILoopIfNeeded();
  if (App.state.phase === 'ENDED') UI.showGameOverModal(gameOverText());
}

function openManageModal() {
  if (!App.state) return;
  const me = App.state.players.find((p) => p.id === App.myPlayerId);
  if (!me) return;
  UI.showManageModal(Game.BOARD, me, {
    onUpgrade: (tileId) => manageAction(() => Game.upgradeProperty(App.state, App.myPlayerId, tileId), C2S.UPGRADE_PROPERTY, tileId),
    onDowngrade: (tileId) => manageAction(() => Game.downgradeProperty(App.state, App.myPlayerId, tileId), C2S.DOWNGRADE_PROPERTY, tileId),
    onMortgage: (tileId) => manageAction(() => Game.mortgageProperty(App.state, App.myPlayerId, tileId), C2S.MORTGAGE_PROPERTY, tileId),
    onUnmortgage: (tileId) => manageAction(() => Game.unmortgageProperty(App.state, App.myPlayerId, tileId), C2S.UNMORTGAGE_PROPERTY, tileId),
  });
}

async function manageAction(offlineFn, onlineType, tileId) {
  if (App.mode === 'online') {
    App.conn.send({ type: onlineType, tileId });
    return;
  }
  const res = offlineFn();
  if (!res.ok) {
    UI.showToast('Không thể thực hiện thao tác này lúc này.', 'error');
    return;
  }
  await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
}

async function endTurn() {
  if (App.mode === 'online') {
    App.conn.send({ type: C2S.END_TURN });
    return;
  }
  const res = Game.endTurn(App.state, App.myPlayerId);
  if (res.ok) await applyEvents(res.events);
  renderAll();
  persistOfflineSave();
  if (App.state.phase === 'ENDED') {
    UI.showGameOverModal(gameOverText());
  } else {
    runOfflineAILoopIfNeeded();
  }
}

function openTradeModal() {
  if (!App.state || App.state.phase !== 'PLAYING') return;
  const me = App.state.players.find((p) => p.id === App.myPlayerId);
  const others = App.state.players.filter((p) => p.id !== App.myPlayerId && !p.bankrupt);
  if (!me || others.length === 0) {
    UI.showToast('Không có đối tác nào để giao dịch.', 'error');
    return;
  }
  const form = document.getElementById('trade-form');
  const propOption = (id) => {
    const t = Game.BOARD.find((b) => b.id === id);
    return `<option value="${id}">${t?.name || id}</option>`;
  };
  form.innerHTML = `
    <div class="trade-col">
      <label>Giao dịch với</label>
      <select id="trade-target">${others.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
    </div>
    <div class="trade-col">
      <label>Bạn đưa (bất động sản, giữ Ctrl để chọn nhiều)</label>
      <select id="trade-give-props" multiple size="4">${me.properties.map(propOption).join('') || '<option disabled>Không có</option>'}</select>
      <label>Bạn đưa thêm tiền</label>
      <input id="trade-give-money" type="number" min="0" value="0" />
    </div>
    <div class="trade-col">
      <label>Bạn muốn nhận (bất động sản)</label>
      <select id="trade-want-props" multiple size="4"></select>
      <label>Bạn muốn nhận thêm tiền</label>
      <input id="trade-want-money" type="number" min="0" value="0" />
    </div>
  `;
  const targetSelect = document.getElementById('trade-target');
  const wantPropsSelect = document.getElementById('trade-want-props');
  const refreshWantProps = () => {
    const target = App.state.players.find((p) => p.id === targetSelect.value);
    wantPropsSelect.innerHTML = target ? target.properties.map(propOption).join('') || '<option disabled>Không có</option>' : '';
  };
  targetSelect.addEventListener('change', refreshWantProps);
  refreshWantProps();
  document.getElementById('modal-trade').hidden = false;
}

function sendTrade() {
  const toId = document.getElementById('trade-target').value;
  const giveProperties = Array.from(document.getElementById('trade-give-props').selectedOptions).map((o) => Number(o.value));
  const wantProperties = Array.from(document.getElementById('trade-want-props').selectedOptions).map((o) => Number(o.value));
  const giveMoney = Number(document.getElementById('trade-give-money').value) || 0;
  const wantMoney = Number(document.getElementById('trade-want-money').value) || 0;
  const offer = { toId, giveProperties, giveMoney, wantProperties, wantMoney };

  UI.hideModal('modal-trade');

  if (App.mode === 'online') {
    App.conn.send({ type: C2S.TRADE_OFFER, ...offer });
    return;
  }

  const res = Game.proposeTrade(App.state, App.myPlayerId, offer);
  if (!res.ok) {
    UI.showToast('Đề nghị giao dịch không hợp lệ.', 'error');
    return;
  }
  const target = App.state.players.find((p) => p.id === toId);
  if (target?.isAI) {
    setTimeout(async () => {
      const accept = AI.decideTradeResponse(App.state, target, App.state.pendingOffer);
      const respondRes = Game.respondTrade(App.state, target.id, accept);
      await applyEvents(respondRes.events);
      renderAll();
      persistOfflineSave();
    }, AI.getThinkingDelay(target.personality));
  }
}

function promptIncomingTrade(offer) {
  const from = App.state.players.find((p) => p.id === offer.fromId);
  const giveNames = offer.giveProperties.map((id) => Game.BOARD.find((t) => t.id === id)?.name).join(', ') || 'không có';
  const wantNames = offer.wantProperties.map((id) => Game.BOARD.find((t) => t.id === id)?.name).join(', ') || 'không có';
  const text = `${from?.name} đề nghị đưa [${giveNames}] + ${offer.giveMoney || 0} tiền, đổi lấy [${wantNames}] + ${offer.wantMoney || 0} tiền của bạn.`;
  UI.showTradeIncoming(
    text,
    () => App.conn.send({ type: C2S.TRADE_RESPONSE, accept: true }),
    () => App.conn.send({ type: C2S.TRADE_RESPONSE, accept: false })
  );
}

async function ensureBoard3D() {
  if (board3dInstance) { board3dInstance.update(App.state); return; }
  if (board3dLoadPromise) return board3dLoadPromise;
  board3dLoadPromise = (async () => {
    try {
      const module = await import('./board3d.js');
      const host = document.getElementById('board-3d-scene');
      if (!host) return;
      board3dInstance = new module.Board3D();
      board3dInstance.mount(host, Game.BOARD);
      document.querySelector('.board-wrap')?.classList.add('is-3d-enabled');
      board3dInstance.update(App.state);
    } catch (error) {
      console.warn('Three.js unavailable; keeping the HTML board.', error);
      if (!board3dUnavailableNotified) {
        UI.showToast('Không tải được thư viện 3D. Bàn cờ dự phòng vẫn hoạt động.', 'error');
        board3dUnavailableNotified = true;
      }
    }
  })();
  return board3dLoadPromise;
}

/* ============================== RENDER LOOP ============================== */

function enterBoardScreen() {
  UI.navigateTo('screen-board');
  UI.initBoard(Game.BOARD);
  ensureBoard3D();
  renderAll();
}

function renderAll() {
  if (!App.state) return;
  board3dInstance?.update(App.state);
  UI.renderOwnership(Game.BOARD, App.state.players);
  UI.renderTokens(App.state.players);
  UI.renderHUD(App.state, App.myPlayerId);
  UI.renderTicker(App.state.players);

  const current = App.state.players[App.state.turnIndex];
  const isMyTurn = current && current.id === App.myPlayerId;
  UI.setTurnIndicator(current ? `Lượt của ${current.name}${current.isAI ? ' 🤖' : ''}` : '');
  if (App.state.lastDice) UI.renderDice(App.state.lastDice);
  if (!current || !current.isAI) UI.setAIThinking(false);

  UI.setRollButtonVisible(isMyTurn && App.state.turnPhase === 'AWAITING_ROLL');
  UI.setEndTurnButtonVisible(isMyTurn && App.state.turnPhase === 'TURN_DONE');
  if (isMyTurn && App.state.turnPhase === 'AWAITING_ROLL') {
    UI.setRollButtonLabel(current.inJail ? '🎲 Thử đổ đôi (thoát Nhà Giam)' : '🎲 Tung xúc xắc');
  }

  if (isMyTurn && App.state.turnPhase === 'AWAITING_PROPERTY_DECISION') {
    const tile = Game.BOARD.find((t) => t.id === App.state.pendingTileId);
    if (tile) UI.showBuyModal(tile, () => decideProperty('BUY'), () => decideProperty('SKIP'));
  } else {
    UI.hideModal('modal-buy');
  }

  if (App.state.turnPhase === 'AWAITING_AUCTION' && App.state.auction) {
    UI.showAuctionPanel(App.state, App.myPlayerId, submitAuctionBid, submitAuctionPass);
  } else if (isMyTurn && App.state.turnPhase === 'AWAITING_ROLL' && current && current.inJail) {
    UI.showJailPanel(current, payBail, useJailCard);
  } else {
    UI.hideDecisionPanel();
  }

  UI.updateManageModal(App.state.players.find((p) => p.id === App.myPlayerId));
}

/**
 * Xây dựng hành trình từng ô (mảng id ô) để quân cờ đi qua lần lượt, thay vì
 * nhảy thẳng từ `from` đến `to`. Hướng đi (tiến/lùi) suy ra từ `steps` khi có
 * (thẻ bài có thể lùi quân), mặc định là tiến (tung xúc xắc luôn tiến, kể cả
 * khi đi vòng qua ô xuất phát).
 */
function buildMovePath(from, to, steps) {
  const size = Game.BOARD_SIZE;
  if (from === to) return [from, to];
  const direction = typeof steps === 'number' && steps < 0 ? -1 : 1;
  const path = [from];
  let cur = from;
  for (let i = 0; i < size; i += 1) {
    cur = (cur + direction + size) % size;
    path.push(cur);
    if (cur === to) break;
  }
  return path;
}

async function applyEvents(events) {
  if (!events) return;
  for (const evt of events) {
    switch (evt.type) {
      case 'DICE_RESULT':
        await UI.renderDice(evt.dice, { rolling: true });
        UI.addGameLog(`🎲 ${playerName(evt.playerId)} đổ được ${evt.dice[0]} + ${evt.dice[1]}.`);
        break;
      case 'PLAYER_MOVED': {
        UI.addGameLog(`${playerName(evt.playerId)} di chuyển tới ${Game.BOARD[evt.to]?.name}.`);
        const path = evt.teleport ? [evt.from, evt.to] : buildMovePath(evt.from, evt.to, evt.steps);
        await UI.animateTokenMove(evt.playerId, path, { teleport: !!evt.teleport });
        break;
      }
      case 'MONEY_CHANGED':
        if (evt.delta) UI.showToast(`${playerName(evt.playerId)} ${evt.delta > 0 ? '+' : ''}${evt.delta} 💰`, evt.delta > 0 ? 'money-up' : 'error');
        break;
      case 'PROPERTY_PURCHASED':
        UI.addGameLog(`🏠 ${playerName(evt.playerId)} đã mua ${Game.BOARD.find((t) => t.id === evt.tileId)?.name}.`);
        break;
      case 'RENT_PAID':
        UI.addGameLog(`💰 ${playerName(evt.from)} trả ${evt.amount} tiền thuê cho ${playerName(evt.to)}.`);
        break;
      case 'PROPERTY_UPGRADED':
        UI.addGameLog(`⬆️ ${playerName(evt.playerId)} nâng cấp ${Game.BOARD.find((t) => t.id === evt.tileId)?.name} lên cấp ${evt.level}.`);
        break;
      case 'PROPERTY_DOWNGRADED':
        UI.addGameLog(`⬇️ ${playerName(evt.playerId)} bán bớt nhà tại ${Game.BOARD.find((t) => t.id === evt.tileId)?.name}, nhận lại ${evt.refund}.`);
        break;
      case 'PROPERTY_MORTGAGED':
        UI.addGameLog(`🏦 ${playerName(evt.playerId)} thế chấp ${Game.BOARD.find((t) => t.id === evt.tileId)?.name}, nhận ${evt.value}.`);
        break;
      case 'PROPERTY_UNMORTGAGED':
        UI.addGameLog(`💳 ${playerName(evt.playerId)} chuộc lại ${Game.BOARD.find((t) => t.id === evt.tileId)?.name}, trả ${evt.cost}.`);
        break;
      case 'SENT_TO_JAIL':
        UI.showToast(`🚔 ${playerName(evt.playerId)} bị đưa vào Nhà Giam!`, 'error');
        UI.addGameLog(`🚔 ${playerName(evt.playerId)} vào Nhà Giam (${evt.reason}).`);
        break;
      case 'JAIL_BAIL_PAID':
        UI.addGameLog(`💸 ${playerName(evt.playerId)} nộp phạt ${evt.amount} để ra khỏi Nhà Giam.`);
        break;
      case 'JAIL_CARD_USED':
        UI.addGameLog(`🎫 ${playerName(evt.playerId)} dùng Thẻ Ra Tù Miễn Phí.`);
        break;
      case 'JAIL_CARD_RECEIVED':
        UI.addGameLog(`🎫 ${playerName(evt.playerId)} nhận được Thẻ Ra Tù Miễn Phí.`);
        break;
      case 'AUCTION_STARTED':
        UI.addGameLog(`🔨 Đấu giá ${Game.BOARD.find((t) => t.id === evt.tileId)?.name} bắt đầu.`);
        break;
      case 'AUCTION_BID_PLACED':
        UI.addGameLog(`🔨 ${playerName(evt.playerId)} đấu giá ${evt.amount}.`);
        break;
      case 'AUCTION_PLAYER_PASSED':
        UI.addGameLog(`🔨 ${playerName(evt.playerId)} rút khỏi đấu giá.`);
        break;
      case 'AUCTION_ENDED':
        if (evt.winnerId) {
          UI.showToast(`🔨 ${playerName(evt.winnerId)} thắng đấu giá với giá ${evt.amount}.`, 'money-up');
          UI.addGameLog(`🔨 ${playerName(evt.winnerId)} thắng đấu giá ${Game.BOARD.find((t) => t.id === evt.tileId)?.name} với giá ${evt.amount}.`);
        } else {
          UI.addGameLog(`🔨 Không ai đấu giá ${Game.BOARD.find((t) => t.id === evt.tileId)?.name}.`);
        }
        break;
      case 'EVENT_TRIGGERED':
        UI.showToast(`${playerName(evt.playerId)}: ${evt.text}`);
        UI.addGameLog(`🃏 ${evt.text}`);
        break;
      case 'BANKRUPT':
        UI.showToast(`💥 ${playerName(evt.playerId)} đã phá sản!`, 'error');
        break;
      case 'TRADE_RESOLVED':
        UI.addGameLog(evt.accepted ? `🤝 Giao dịch giữa ${playerName(evt.fromId)} và ${playerName(evt.toId)} thành công.` : `❌ Giao dịch bị từ chối.`);
        break;
      case 'GAME_OVER':
        UI.showGameOverModal(gameOverText());
        break;
      default:
        break;
    }
  }
}

function playerName(playerId) {
  return App.state?.players.find((p) => p.id === playerId)?.name || '???';
}

function gameOverText() {
  const winner = App.state?.players.find((p) => p.id === App.state.winnerId);
  return winner ? `${winner.name} đã chiến thắng ván chơi!` : 'Ván chơi đã kết thúc.';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Nếu có ván offline đã lưu dở, hiện thêm nút "Tiếp tục" trên màn hình chính. */
window.addEventListener('load', () => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEYS.save));
  } catch (_err) {
    saved = null;
  }
  if (saved && saved.state && saved.state.phase === 'PLAYING') {
    const menu = document.querySelector('.home__menu');
    const btn = document.createElement('button');
    btn.className = 'btn btn--secondary';
    btn.textContent = 'TIẾP TỤC VÁN OFFLINE';
    btn.addEventListener('click', () => {
      App.mode = 'offline';
      App.state = saved.state;
      App.myPlayerId = saved.myPlayerId;
      enterBoardScreen();
      runOfflineAILoopIfNeeded();
    });
    menu.insertBefore(btn, menu.firstChild);
  }
});
