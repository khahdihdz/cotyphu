// gameLogic.js
// Bộ luật chơi thuần (pure logic), KHÔNG phụ thuộc WebSocket / Durable Object.
// Được dùng bởi:
//   - src/gameRoom.js (server, chế độ online, đây là nguồn sự thật duy nhất)
//   - public/game.js  (chế độ offline, chạy y hệt logic này ngay trên trình duyệt)
// Mọi hàm ở đây nhận vào `state` và trả về danh sách `events` mô tả chuyện gì đã
// xảy ra, để tầng gọi (server hoặc client offline) tự quyết định cách hiển thị.

export const TILE_TYPES = Object.freeze({
  START: 'START',
  PROPERTY: 'PROPERTY',
  TAX: 'TAX',
  CHANCE: 'CHANCE',
  EVENT: 'EVENT',
  BONUS: 'BONUS',
  REST: 'REST',
  JAIL: 'JAIL',
  TELEPORT: 'TELEPORT',
});

export const START_MONEY = 1500;
export const PASS_START_BONUS = 200;
export const MAX_HOUSE_LEVEL = 5; // 0..4 nhà + 1 khách sạn = level 5
export const JAIL_TILE_ID = 10;
export const MAX_JAIL_TURNS = 3;

export const PLAYER_COLORS = ['#F2B84B', '#3FC1C9', '#E85A4F', '#9B8CF2'];

export const BOARD = Object.freeze([
  { id: 0, type: TILE_TYPES.START, name: 'Xuất Phát' },
  { id: 1, type: TILE_TYPES.PROPERTY, name: 'Phố Ánh Sao', group: 'A', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { id: 2, type: TILE_TYPES.EVENT, name: 'Cơ Hội' },
  { id: 3, type: TILE_TYPES.PROPERTY, name: 'Phố Hoa Anh Đào', group: 'A', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { id: 4, type: TILE_TYPES.TAX, name: 'Thuế Thu Nhập', amount: 200 },
  { id: 5, type: TILE_TYPES.PROPERTY, name: 'Ga Trung Tâm', group: 'STATION', price: 200, houseCost: 100, rent: [25, 50, 100, 200] },
  { id: 6, type: TILE_TYPES.PROPERTY, name: 'Phố Biển Xanh', group: 'B', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 7, type: TILE_TYPES.CHANCE, name: 'Vận May' },
  { id: 8, type: TILE_TYPES.PROPERTY, name: 'Phố Rừng Thông', group: 'B', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 9, type: TILE_TYPES.PROPERTY, name: 'Phố Hoàng Hôn', group: 'B', price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { id: 10, type: TILE_TYPES.JAIL, name: 'Nhà Giam' },
  { id: 11, type: TILE_TYPES.PROPERTY, name: 'Phố Kim Cương', group: 'C', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { id: 12, type: TILE_TYPES.BONUS, name: 'Ô May Mắn' },
  { id: 13, type: TILE_TYPES.PROPERTY, name: 'Phố Ngọc Bích', group: 'C', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { id: 14, type: TILE_TYPES.PROPERTY, name: 'Ga Đông', group: 'STATION', price: 200, houseCost: 100, rent: [25, 50, 100, 200] },
  { id: 15, type: TILE_TYPES.PROPERTY, name: 'Phố Hồng Ngọc', group: 'C', price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { id: 16, type: TILE_TYPES.REST, name: 'Trạm Nghỉ' },
  { id: 17, type: TILE_TYPES.PROPERTY, name: 'Phố Thạch Anh', group: 'D', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { id: 18, type: TILE_TYPES.EVENT, name: 'Sự Kiện' },
  { id: 19, type: TILE_TYPES.PROPERTY, name: 'Phố Lưu Ly', group: 'D', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { id: 20, type: TILE_TYPES.PROPERTY, name: 'Phố Hoàng Gia', group: 'D', price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { id: 21, type: TILE_TYPES.TELEPORT, name: 'Cổng Dịch Chuyển' },
  { id: 22, type: TILE_TYPES.PROPERTY, name: 'Phố Tường Vy', group: 'E', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 23, type: TILE_TYPES.CHANCE, name: 'Vận May' },
  { id: 24, type: TILE_TYPES.PROPERTY, name: 'Phố Lan Tím', group: 'E', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 25, type: TILE_TYPES.PROPERTY, name: 'Ga Tây', group: 'STATION', price: 200, houseCost: 100, rent: [25, 50, 100, 200] },
  { id: 26, type: TILE_TYPES.PROPERTY, name: 'Phố Cẩm Tú', group: 'E', price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { id: 27, type: TILE_TYPES.TAX, name: 'Thuế Xa Xỉ', amount: 100 },
  { id: 28, type: TILE_TYPES.PROPERTY, name: 'Phố Hoàng Kim', group: 'F', price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { id: 29, type: TILE_TYPES.EVENT, name: 'Sự Kiện' },
  { id: 30, type: TILE_TYPES.PROPERTY, name: 'Phố Kim Tự Tháp', group: 'F', price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
  { id: 31, type: TILE_TYPES.BONUS, name: 'Phần Thưởng' },
]);

export const BOARD_SIZE = BOARD.length;

const CHANCE_CARDS = [
  { text: 'Bạn trúng vé số! Nhận 200', money: 200 },
  { text: 'Bạn bị phạt vi phạm giao thông. Mất 100', money: -100 },
  { text: 'Cổ tức đầu tư về tay. Nhận 150', money: 150 },
  { text: 'Tiến 3 ô về phía trước', move: 3 },
  { text: 'Lùi 2 ô', move: -2 },
  { text: 'Được miễn thuế kỳ này', money: 0 },
  { text: 'Bảo trì nhà cửa. Mất 75', money: -75 },
  { text: 'Nhận thưởng cuối năm. Nhận 300', money: 300 },
];

const EVENT_CARDS = [
  { text: 'Thị trường sốt đất! Nhận 250', money: 250 },
  { text: 'Khủng hoảng nhỏ. Mất 150', money: -150 },
  { text: 'Bạn được mời dự tiệc, quen biết đối tác mới. Nhận 100', money: 100 },
  { text: 'Sửa đường ống nước. Mất 120', money: -120 },
  { text: 'Dịch chuyển ngẫu nhiên!', teleport: true },
];

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollTwoDice() {
  return [randInt(1, 6), randInt(1, 6)];
}

export function createPlayer({ id, name, isAI = false, personality = null, color }) {
  return {
    id,
    name,
    isAI,
    personality: isAI ? (personality || pickRandomPersonality()) : null,
    money: START_MONEY,
    position: 0,
    properties: [],
    color,
    bankrupt: false,
    inJail: false,
    jailTurns: 0,
    connected: true,
  };
}

const PERSONALITIES = ['CAUTIOUS', 'AGGRESSIVE', 'GREEDY', 'STRATEGIST', 'RANDOM'];
export function pickRandomPersonality() {
  return PERSONALITIES[randInt(0, PERSONALITIES.length - 1)];
}

export function createInitialState(roomId, players) {
  return {
    roomId,
    phase: 'LOBBY', // LOBBY | PLAYING | ENDED
    board: BOARD,
    players,
    turnIndex: 0,
    turnPhase: 'AWAITING_ROLL', // AWAITING_ROLL | AWAITING_PROPERTY_DECISION | AWAITING_UPGRADE | TURN_DONE
    lastDice: null,
    doublesStreak: 0,
    pendingTileId: null,
    pendingOffer: null,
    winnerId: null,
    log: [],
    aiMemory: {},
    turnNumber: 0,
  };
}

function currentPlayer(state) {
  return state.players[state.turnIndex];
}

function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}

function findTile(tileId) {
  return BOARD[tileId];
}

function ownerOf(state, tileId) {
  return state.players.find((p) => p.properties.includes(tileId));
}

function pushLog(state, text) {
  state.log.push({ text, turn: state.turnNumber, at: Date.now() });
  if (state.log.length > 200) state.log.shift();
}

export function startGame(state) {
  if (state.phase !== 'LOBBY') {
    return { ok: false, error: 'WRONG_PHASE' };
  }
  if (state.players.length < 2) {
    return { ok: false, error: 'INVALID_ACTION' };
  }
  state.phase = 'PLAYING';
  state.turnIndex = 0;
  state.turnNumber = 1;
  state.turnPhase = 'AWAITING_ROLL';
  for (const p of state.players) {
    state.aiMemory[p.id] = { knownRich: [], dangerZones: [], badInvestments: [], tradeHistory: [] };
  }
  pushLog(state, `Ván chơi bắt đầu với ${state.players.length} người chơi.`);
  return { ok: true, events: [{ type: 'GAME_STARTED' }] };
}

export function rollDice(state, playerId) {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (player.bankrupt) return { ok: false, error: 'INVALID_ACTION' };
  if (state.turnPhase !== 'AWAITING_ROLL') return { ok: false, error: 'WRONG_PHASE' };

  const events = [];
  const dice = rollTwoDice();
  state.lastDice = dice;
  const isDouble = dice[0] === dice[1];
  events.push({ type: 'DICE_RESULT', playerId, dice });

  if (player.inJail) {
    if (isDouble) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(state, `${player.name} tung được đôi và thoát khỏi Nhà Giam.`);
    } else {
      player.jailTurns += 1;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        player.inJail = false;
        player.jailTurns = 0;
        player.money -= 50;
        pushLog(state, `${player.name} nộp phạt 50 để ra khỏi Nhà Giam.`);
        events.push({ type: 'MONEY_CHANGED', playerId, delta: -50, reason: 'JAIL_FINE' });
      } else {
        pushLog(state, `${player.name} vẫn còn trong Nhà Giam (${player.jailTurns}/${MAX_JAIL_TURNS}).`);
        state.turnPhase = 'TURN_DONE';
        return { ok: true, events };
      }
    }
  }

  const steps = dice[0] + dice[1];
  const fromPos = player.position;
  const passedStart = fromPos + steps >= BOARD_SIZE;
  const toPos = (fromPos + steps) % BOARD_SIZE;
  player.position = toPos;
  events.push({ type: 'PLAYER_MOVED', playerId, from: fromPos, to: toPos, steps });

  if (passedStart) {
    player.money += PASS_START_BONUS;
    pushLog(state, `${player.name} đi qua Xuất Phát, nhận ${PASS_START_BONUS}.`);
    events.push({ type: 'MONEY_CHANGED', playerId, delta: PASS_START_BONUS, reason: 'PASS_START' });
  }

  if (isDouble) {
    state.doublesStreak += 1;
  } else {
    state.doublesStreak = 0;
  }

  const tileEvents = resolveTile(state, player);
  events.push(...tileEvents);

  checkBankruptcy(state, player, events);

  return { ok: true, events, isDouble };
}

function resolveTile(state, player) {
  const events = [];
  const tile = findTile(player.position);

  switch (tile.type) {
    case TILE_TYPES.PROPERTY: {
      const owner = ownerOf(state, tile.id);
      if (!owner) {
        state.pendingTileId = tile.id;
        state.turnPhase = 'AWAITING_PROPERTY_DECISION';
        events.push({ type: 'PROPERTY_OFFER', tileId: tile.id, playerId: player.id, price: tile.price });
      } else if (owner.id !== player.id) {
        const level = ownedGroupLevel(state, owner, tile);
        const rent = tile.rent[Math.min(level, tile.rent.length - 1)];
        const paid = Math.min(rent, Math.max(player.money, 0));
        player.money -= rent;
        owner.money += rent;
        pushLog(state, `${player.name} trả ${rent} tiền thuê cho ${owner.name} tại ${tile.name}.`);
        events.push({ type: 'RENT_PAID', from: player.id, to: owner.id, tileId: tile.id, amount: rent });
        state.turnPhase = 'TURN_DONE';
      } else {
        state.turnPhase = 'TURN_DONE';
      }
      break;
    }
    case TILE_TYPES.TAX: {
      player.money -= tile.amount;
      pushLog(state, `${player.name} nộp ${tile.name}: -${tile.amount}.`);
      events.push({ type: 'MONEY_CHANGED', playerId: player.id, delta: -tile.amount, reason: 'TAX' });
      state.turnPhase = 'TURN_DONE';
      break;
    }
    case TILE_TYPES.CHANCE:
    case TILE_TYPES.EVENT: {
      const deck = tile.type === TILE_TYPES.CHANCE ? CHANCE_CARDS : EVENT_CARDS;
      const card = deck[randInt(0, deck.length - 1)];
      const cardEvents = applyCard(state, player, card);
      events.push({ type: 'EVENT_TRIGGERED', playerId: player.id, text: card.text });
      events.push(...cardEvents);
      if (state.turnPhase !== 'AWAITING_PROPERTY_DECISION') {
        state.turnPhase = 'TURN_DONE';
      }
      break;
    }
    case TILE_TYPES.BONUS: {
      const bonus = randInt(50, 200);
      player.money += bonus;
      pushLog(state, `${player.name} nhận Ô May Mắn: +${bonus}.`);
      events.push({ type: 'MONEY_CHANGED', playerId: player.id, delta: bonus, reason: 'BONUS' });
      state.turnPhase = 'TURN_DONE';
      break;
    }
    case TILE_TYPES.TELEPORT: {
      const newPos = randInt(0, BOARD_SIZE - 1);
      const from = player.position;
      player.position = newPos;
      pushLog(state, `${player.name} bị dịch chuyển tới ${findTile(newPos).name}.`);
      events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: newPos, steps: null, teleport: true });
      events.push(...resolveTile(state, player));
      break;
    }
    case TILE_TYPES.JAIL: {
      // Chỉ đi ngang qua Nhà Giam thì không sao, chỉ bị giam nếu có lá bài/luật đưa vào.
      state.turnPhase = 'TURN_DONE';
      break;
    }
    case TILE_TYPES.REST:
    case TILE_TYPES.START:
    default: {
      state.turnPhase = 'TURN_DONE';
      break;
    }
  }
  return events;
}

function applyCard(state, player, card) {
  const events = [];
  if (typeof card.money === 'number' && card.money !== 0) {
    player.money += card.money;
    events.push({ type: 'MONEY_CHANGED', playerId: player.id, delta: card.money, reason: 'CARD' });
  }
  if (typeof card.move === 'number') {
    const from = player.position;
    let to = (from + card.move) % BOARD_SIZE;
    if (to < 0) to += BOARD_SIZE;
    player.position = to;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to, steps: card.move });
    events.push(...resolveTile(state, player));
  }
  if (card.teleport) {
    const from = player.position;
    const to = randInt(0, BOARD_SIZE - 1);
    player.position = to;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to, teleport: true });
    events.push(...resolveTile(state, player));
  }
  return events;
}

export function ownedGroupLevel(state, owner, tile) {
  // Cấp thuê dựa trên số nhà đã xây trên chính ô đó (đơn giản hoá "cấp tài sản").
  return tile.level || 0;
}

export function buyProperty(state, playerId, decision) {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (state.turnPhase !== 'AWAITING_PROPERTY_DECISION') return { ok: false, error: 'WRONG_PHASE' };
  const tile = BOARD.find((t) => t.id === state.pendingTileId);
  if (!tile) return { ok: false, error: 'PROPERTY_NOT_FOUND' };

  const events = [];
  if (decision === 'BUY') {
    if (player.money < tile.price) return { ok: false, error: 'INSUFFICIENT_FUNDS' };
    player.money -= tile.price;
    player.properties.push(tile.id);
    pushLog(state, `${player.name} mua ${tile.name} với giá ${tile.price}.`);
    events.push({ type: 'PROPERTY_PURCHASED', playerId, tileId: tile.id, price: tile.price });
  } else {
    pushLog(state, `${player.name} bỏ qua ${tile.name}.`);
  }
  state.pendingTileId = null;
  state.turnPhase = 'TURN_DONE';
  return { ok: true, events };
}

export function upgradeProperty(state, playerId, tileId) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, error: 'INVALID_ACTION' };
  const tile = BOARD.find((t) => t.id === tileId);
  if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!player.properties.includes(tileId)) return { ok: false, error: 'INVALID_ACTION' };

  const groupTiles = BOARD.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === tile.group);
  const ownsGroup = groupTiles.every((t) => player.properties.includes(t.id));
  if (!ownsGroup) return { ok: false, error: 'INVALID_ACTION' };

  const level = tile.level || 0;
  if (level >= MAX_HOUSE_LEVEL - 1) return { ok: false, error: 'INVALID_ACTION' };
  if (player.money < tile.houseCost) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  player.money -= tile.houseCost;
  tile.level = level + 1;
  pushLog(state, `${player.name} nâng cấp ${tile.name} lên cấp ${tile.level}.`);
  return { ok: true, events: [{ type: 'PROPERTY_UPGRADED', playerId, tileId, level: tile.level }] };
}

export function proposeTrade(state, fromId, offer) {
  // offer: { toId, giveProperties: [tileId], giveMoney, wantProperties: [tileId], wantMoney }
  const from = findPlayer(state, fromId);
  const to = findPlayer(state, offer.toId);
  if (!from || !to) return { ok: false, error: 'INVALID_ACTION' };
  if (!offer.giveProperties.every((id) => from.properties.includes(id))) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!offer.wantProperties.every((id) => to.properties.includes(id))) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (from.money < (offer.giveMoney || 0)) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  state.pendingOffer = { fromId, ...offer, createdAt: Date.now() };
  return { ok: true, events: [{ type: 'TRADE_PROPOSED', fromId, offer }] };
}

export function respondTrade(state, playerId, accept) {
  const offer = state.pendingOffer;
  if (!offer || offer.toId !== playerId) return { ok: false, error: 'INVALID_ACTION' };
  const from = findPlayer(state, offer.fromId);
  const to = findPlayer(state, offer.toId);
  const events = [];

  if (accept) {
    const giveMoney = offer.giveMoney || 0;
    const wantMoney = offer.wantMoney || 0;
    if (from.money < giveMoney || to.money < wantMoney) {
      state.pendingOffer = null;
      return { ok: false, error: 'INSUFFICIENT_FUNDS' };
    }
    from.properties = from.properties.filter((id) => !offer.giveProperties.includes(id));
    to.properties.push(...offer.giveProperties);
    to.properties = to.properties.filter((id) => !offer.wantProperties.includes(id));
    from.properties.push(...offer.wantProperties);
    from.money = from.money - giveMoney + wantMoney;
    to.money = to.money + giveMoney - wantMoney;
    pushLog(state, `${from.name} và ${to.name} đã hoàn tất giao dịch.`);
    events.push({ type: 'TRADE_RESOLVED', accepted: true, fromId: from.id, toId: to.id });
  } else {
    pushLog(state, `${to.name} đã từ chối đề nghị giao dịch từ ${from.name}.`);
    events.push({ type: 'TRADE_RESOLVED', accepted: false, fromId: from.id, toId: to.id });
  }
  state.pendingOffer = null;
  return { ok: true, events };
}

export function checkBankruptcy(state, player, events) {
  if (player.bankrupt) return;
  if (player.money < 0) {
    // Bán bớt nhà trước khi tuyên bố phá sản, để giữ cảm giác hợp lý.
    const owned = BOARD.filter((t) => player.properties.includes(t.id) && (t.level || 0) > 0);
    for (const tile of owned) {
      if (player.money >= 0) break;
      const refund = Math.floor((tile.houseCost * tile.level) / 2);
      player.money += refund;
      tile.level = 0;
    }
  }
  if (player.money < 0) {
    player.bankrupt = true;
    for (const tileId of player.properties) {
      const t = BOARD.find((b) => b.id === tileId);
      if (t) t.level = 0;
    }
    player.properties = [];
    pushLog(state, `${player.name} đã phá sản!`);
    events.push({ type: 'BANKRUPT', playerId: player.id });
  }
}

export function checkWinner(state) {
  const alive = state.players.filter((p) => !p.bankrupt);
  if (alive.length === 1 && state.players.length > 1) {
    state.phase = 'ENDED';
    state.winnerId = alive[0].id;
    pushLog(state, `${alive[0].name} chiến thắng!`);
    return alive[0].id;
  }
  return null;
}

export function endTurn(state, playerId) {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (state.turnPhase !== 'TURN_DONE') return { ok: false, error: 'WRONG_PHASE' };

  const winnerId = checkWinner(state);
  if (winnerId) {
    return { ok: true, events: [{ type: 'GAME_OVER', winnerId }] };
  }

  const keepTurn = state.doublesStreak > 0 && state.doublesStreak < 3 && !player.bankrupt;
  if (!keepTurn) {
    advanceTurnIndex(state);
    state.doublesStreak = 0;
  } else {
    pushLog(state, `${player.name} đổ được đôi, được đi tiếp!`);
  }
  state.turnPhase = 'AWAITING_ROLL';
  state.turnNumber += 1;
  const next = currentPlayer(state);
  return { ok: true, events: [{ type: 'TURN_STARTED', playerId: next.id }] };
}

function advanceTurnIndex(state) {
  const n = state.players.length;
  let next = (state.turnIndex + 1) % n;
  let guard = 0;
  while (state.players[next].bankrupt && guard < n) {
    next = (next + 1) % n;
    guard += 1;
  }
  state.turnIndex = next;
}

export function getPublicState(state) {
  // Giống hệt state nội bộ vì game này không có thông tin ẩn (không có bài úp riêng).
  return state;
}

export function serializeBoard() {
  return BOARD.map((t) => ({ ...t }));
}
