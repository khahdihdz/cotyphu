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
export const JAIL_BAIL_AMOUNT = 50;
export const MORTGAGE_INTEREST_RATE = 0.1; // 10% lãi khi chuộc lại tài sản đã thế chấp
export const DOUBLES_TO_JAIL = 3; // đổ đôi 3 lần liên tiếp thì vào Nhà Giam

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

// Giá trị thế chấp = một nửa giá mua (làm tròn xuống), theo luật board-game đầu tư kinh điển.
export function mortgageValueOf(tile) {
  return Math.floor(tile.price / 2);
}

// Chi phí chuộc lại = giá trị thế chấp + lãi suất (làm tròn lên).
export function unmortgageCostOf(tile) {
  const value = mortgageValueOf(tile);
  return value + Math.ceil(value * MORTGAGE_INTEREST_RATE);
}

const CHANCE_CARDS = [
  { text: 'Bạn trúng vé số! Nhận 200', money: 200 },
  { text: 'Bạn bị phạt vi phạm giao thông. Mất 100', money: -100 },
  { text: 'Cổ tức đầu tư về tay. Nhận 150', money: 150 },
  { text: 'Tiến 3 ô về phía trước', move: 3 },
  { text: 'Lùi 2 ô', move: -2 },
  { text: 'Được miễn thuế kỳ này', money: 0 },
  { text: 'Bảo trì nhà cửa. Mất 75', money: -75 },
  { text: 'Nhận thưởng cuối năm. Nhận 300', money: 300 },
  { text: 'Bạn bị bắt vì đầu cơ đất! Vào thẳng Nhà Giam', toJail: true },
  { text: 'Bạn nhận được Thẻ Ra Tù Miễn Phí, giữ để dùng khi cần', jailCard: true },
];

const EVENT_CARDS = [
  { text: 'Thị trường sốt đất! Nhận 250', money: 250 },
  { text: 'Khủng hoảng nhỏ. Mất 150', money: -150 },
  { text: 'Bạn được mời dự tiệc, quen biết đối tác mới. Nhận 100', money: 100 },
  { text: 'Sửa đường ống nước. Mất 120', money: -120 },
  { text: 'Dịch chuyển ngẫu nhiên!', teleport: true },
  { text: 'Thanh tra thuế phát hiện sai phạm! Vào thẳng Nhà Giam', toJail: true },
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
    jailCards: 0,
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
    turnPhase: 'AWAITING_ROLL', // AWAITING_ROLL | AWAITING_PROPERTY_DECISION | AWAITING_AUCTION | TURN_DONE
    lastDice: null,
    doublesStreak: 0,
    pendingTileId: null,
    pendingOffer: null,
    auction: null,
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

function sendToJail(state, player, events, reason) {
  player.position = JAIL_TILE_ID;
  player.inJail = true;
  player.jailTurns = 0;
  state.doublesStreak = 0;
  pushLog(state, `${player.name} bị đưa vào Nhà Giam${reason ? ` (${reason})` : ''}.`);
  events.push({ type: 'SENT_TO_JAIL', playerId: player.id, reason: reason || 'CARD' });
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

  const wasInJail = player.inJail;
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
        player.money -= JAIL_BAIL_AMOUNT;
        pushLog(state, `${player.name} nộp phạt ${JAIL_BAIL_AMOUNT} để ra khỏi Nhà Giam.`);
        events.push({ type: 'MONEY_CHANGED', playerId, delta: -JAIL_BAIL_AMOUNT, reason: 'JAIL_FINE' });
      } else {
        pushLog(state, `${player.name} vẫn còn trong Nhà Giam (${player.jailTurns}/${MAX_JAIL_TURNS}).`);
        state.turnPhase = 'TURN_DONE';
        return { ok: true, events };
      }
    }
  }

  // Đôi 3 lần liên tiếp thì bị bắt vào Nhà Giam ngay, không được di chuyển theo xúc xắc.
  // Chuỗi đôi được tính lại từ đầu mỗi khi vừa ra khỏi Nhà Giam (dù thoát bằng đôi hay nộp phạt).
  if (wasInJail) {
    state.doublesStreak = 0;
  }
  if (isDouble) {
    state.doublesStreak += 1;
  } else {
    state.doublesStreak = 0;
  }
  if (!wasInJail && state.doublesStreak >= DOUBLES_TO_JAIL) {
    state.doublesStreak = 0;
    state.turnPhase = 'TURN_DONE';
    sendToJail(state, player, events, 'Đổ đôi 3 lần liên tiếp');
    checkBankruptcy(state, player, events);
    return { ok: true, events, isDouble, sentToJail: true };
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

  const tileEvents = resolveTile(state, player);
  events.push(...tileEvents);

  checkBankruptcy(state, player, events);

  return { ok: true, events, isDouble };
}

/** Người chơi tự nguyện nộp phạt để ra khỏi Nhà Giam ngay khi đến lượt, thay vì thử đổ đôi. */
export function payBail(state, playerId) {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (state.turnPhase !== 'AWAITING_ROLL') return { ok: false, error: 'WRONG_PHASE' };
  if (!player.inJail) return { ok: false, error: 'NOT_IN_JAIL' };
  if (player.money < JAIL_BAIL_AMOUNT) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  player.money -= JAIL_BAIL_AMOUNT;
  player.inJail = false;
  player.jailTurns = 0;
  pushLog(state, `${player.name} tự nguyện nộp phạt ${JAIL_BAIL_AMOUNT} để ra khỏi Nhà Giam.`);
  const events = [
    { type: 'JAIL_BAIL_PAID', playerId, amount: JAIL_BAIL_AMOUNT },
    { type: 'MONEY_CHANGED', playerId, delta: -JAIL_BAIL_AMOUNT, reason: 'JAIL_FINE' },
  ];
  return { ok: true, events };
}

/** Dùng Thẻ Ra Tù Miễn Phí để thoát khỏi Nhà Giam ngay khi đến lượt. */
export function useJailCard(state, playerId) {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (state.turnPhase !== 'AWAITING_ROLL') return { ok: false, error: 'WRONG_PHASE' };
  if (!player.inJail) return { ok: false, error: 'NOT_IN_JAIL' };
  if (!player.jailCards || player.jailCards < 1) return { ok: false, error: 'NO_JAIL_CARD' };

  player.jailCards -= 1;
  player.inJail = false;
  player.jailTurns = 0;
  pushLog(state, `${player.name} dùng Thẻ Ra Tù Miễn Phí.`);
  return { ok: true, events: [{ type: 'JAIL_CARD_USED', playerId }] };
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
        if (tile.mortgaged) {
          pushLog(state, `${tile.name} đang bị thế chấp, ${owner.name} không thu được tiền thuê.`);
          state.turnPhase = 'TURN_DONE';
        } else {
          const level = ownedGroupLevel(state, owner, tile);
          const rent = tile.rent[Math.min(level, tile.rent.length - 1)];
          player.money -= rent;
          owner.money += rent;
          pushLog(state, `${player.name} trả ${rent} tiền thuê cho ${owner.name} tại ${tile.name}.`);
          events.push({ type: 'RENT_PAID', from: player.id, to: owner.id, tileId: tile.id, amount: rent });
          state.turnPhase = 'TURN_DONE';
        }
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
  if (card.toJail) {
    sendToJail(state, player, events, 'Rút phải thẻ vào tù');
  }
  if (card.jailCard) {
    player.jailCards = (player.jailCards || 0) + 1;
    events.push({ type: 'JAIL_CARD_RECEIVED', playerId: player.id });
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
    state.pendingTileId = null;
    state.turnPhase = 'TURN_DONE';
  } else {
    pushLog(state, `${player.name} bỏ qua ${tile.name}, tài sản được đưa ra đấu giá.`);
    state.pendingTileId = null;
    events.push(...startAuction(state, tile.id));
  }
  return { ok: true, events };
}

export function upgradeProperty(state, playerId, tileId) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, error: 'INVALID_ACTION' };
  const tile = BOARD.find((t) => t.id === tileId);
  if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!player.properties.includes(tileId)) return { ok: false, error: 'INVALID_ACTION' };
  if (tile.mortgaged) return { ok: false, error: 'ALREADY_MORTGAGED' };

  const groupTiles = BOARD.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === tile.group);
  const ownsGroup = groupTiles.every((t) => player.properties.includes(t.id));
  if (!ownsGroup) return { ok: false, error: 'INVALID_ACTION' };
  const anyMortgagedInGroup = groupTiles.some((t) => t.mortgaged);
  if (anyMortgagedInGroup) return { ok: false, error: 'ALREADY_MORTGAGED' };

  const level = tile.level || 0;
  if (level >= MAX_HOUSE_LEVEL - 1) return { ok: false, error: 'INVALID_ACTION' };
  if (player.money < tile.houseCost) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  player.money -= tile.houseCost;
  tile.level = level + 1;
  pushLog(state, `${player.name} nâng cấp ${tile.name} lên cấp ${tile.level}.`);
  return { ok: true, events: [{ type: 'PROPERTY_UPGRADED', playerId, tileId, level: tile.level }] };
}

/** Bán bớt một cấp nhà đã xây, hoàn lại một nửa chi phí xây (làm tròn xuống). */
export function downgradeProperty(state, playerId, tileId) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, error: 'INVALID_ACTION' };
  const tile = BOARD.find((t) => t.id === tileId);
  if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!player.properties.includes(tileId)) return { ok: false, error: 'INVALID_ACTION' };

  const level = tile.level || 0;
  if (level <= 0) return { ok: false, error: 'INVALID_ACTION' };

  const refund = Math.floor(tile.houseCost / 2);
  tile.level = level - 1;
  player.money += refund;
  pushLog(state, `${player.name} bán bớt nhà tại ${tile.name}, nhận lại ${refund}.`);
  return { ok: true, events: [{ type: 'PROPERTY_DOWNGRADED', playerId, tileId, level: tile.level, refund }] };
}

/** Thế chấp một bất động sản (chưa xây nhà) để nhận tiền mặt ngay. */
export function mortgageProperty(state, playerId, tileId) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, error: 'INVALID_ACTION' };
  const tile = BOARD.find((t) => t.id === tileId);
  if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!player.properties.includes(tileId)) return { ok: false, error: 'INVALID_ACTION' };
  if (tile.mortgaged) return { ok: false, error: 'ALREADY_MORTGAGED' };
  if ((tile.level || 0) > 0) return { ok: false, error: 'HAS_BUILDINGS' };

  const value = mortgageValueOf(tile);
  tile.mortgaged = true;
  player.money += value;
  pushLog(state, `${player.name} thế chấp ${tile.name}, nhận ${value}.`);
  return { ok: true, events: [{ type: 'PROPERTY_MORTGAGED', playerId, tileId, value }] };
}

/** Chuộc lại một bất động sản đã thế chấp (trả giá trị thế chấp + lãi suất). */
export function unmortgageProperty(state, playerId, tileId) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, error: 'INVALID_ACTION' };
  const tile = BOARD.find((t) => t.id === tileId);
  if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { ok: false, error: 'PROPERTY_NOT_FOUND' };
  if (!player.properties.includes(tileId)) return { ok: false, error: 'INVALID_ACTION' };
  if (!tile.mortgaged) return { ok: false, error: 'NOT_MORTGAGED' };

  const cost = unmortgageCostOf(tile);
  if (player.money < cost) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  player.money -= cost;
  tile.mortgaged = false;
  pushLog(state, `${player.name} chuộc lại ${tile.name} với giá ${cost}.`);
  return { ok: true, events: [{ type: 'PROPERTY_UNMORTGAGED', playerId, tileId, cost }] };
}

/* --------------------------------- Đấu giá --------------------------------- */

function nextAuctionActor(auction) {
  const stillIn = auction.turnOrder.filter((id) => !auction.passed.includes(id));
  if (stillIn.length <= 1) return null;
  const candidates = stillIn.filter((id) => id !== auction.highestBidder);
  if (candidates.length === 0) return null;
  const startIdx = auction.turnOrder.indexOf(auction.currentTurnId);
  for (let i = 1; i <= auction.turnOrder.length; i += 1) {
    const idx = (startIdx + i) % auction.turnOrder.length;
    const candidate = auction.turnOrder[idx];
    if (candidates.includes(candidate)) return candidate;
  }
  return candidates[0];
}

function startAuction(state, tileId) {
  const n = state.players.length;
  const order = [];
  for (let i = 1; i <= n; i += 1) {
    const idx = (state.turnIndex + i) % n;
    const p = state.players[idx];
    if (p && !p.bankrupt) order.push(p.id);
  }
  const events = [];
  if (order.length === 0) {
    state.turnPhase = 'TURN_DONE';
    return events;
  }
  state.auction = {
    tileId,
    turnOrder: order,
    passed: [],
    highestBid: 0,
    highestBidder: null,
    currentTurnId: order[0],
  };
  state.turnPhase = 'AWAITING_AUCTION';
  const tile = BOARD.find((t) => t.id === tileId);
  pushLog(state, `Đấu giá ${tile?.name} bắt đầu.`);
  events.push({ type: 'AUCTION_STARTED', tileId, turnOrder: order, currentTurnId: order[0] });
  return events;
}

function endAuction(state) {
  const auction = state.auction;
  const tile = BOARD.find((t) => t.id === auction.tileId);
  const events = [];
  const stillIn = auction.turnOrder.filter((id) => !auction.passed.includes(id));
  const candidateWinner = stillIn.find((id) => id === auction.highestBidder) || stillIn[0] || null;
  const winnerId = auction.highestBid > 0 && candidateWinner ? candidateWinner : null;

  if (winnerId) {
    const winner = findPlayer(state, winnerId);
    winner.money -= auction.highestBid;
    winner.properties.push(tile.id);
    pushLog(state, `${winner.name} thắng đấu giá ${tile.name} với giá ${auction.highestBid}.`);
    events.push({ type: 'AUCTION_ENDED', tileId: tile.id, winnerId, amount: auction.highestBid });
    events.push({ type: 'PROPERTY_PURCHASED', playerId: winnerId, tileId: tile.id, price: auction.highestBid, viaAuction: true });
    checkBankruptcy(state, winner, events);
  } else {
    pushLog(state, `Không ai đấu giá ${tile.name}, bất động sản vẫn bỏ trống.`);
    events.push({ type: 'AUCTION_ENDED', tileId: tile.id, winnerId: null, amount: 0 });
  }

  state.auction = null;
  state.turnPhase = 'TURN_DONE';
  return events;
}

export function auctionBid(state, playerId, amount) {
  const auction = state.auction;
  if (!auction || state.turnPhase !== 'AWAITING_AUCTION') return { ok: false, error: 'NOT_IN_AUCTION' };
  if (auction.currentTurnId !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (auction.passed.includes(playerId)) return { ok: false, error: 'NOT_IN_AUCTION' };

  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= auction.highestBid) return { ok: false, error: 'BID_TOO_LOW' };
  const player = findPlayer(state, playerId);
  if (!player || player.money < amt) return { ok: false, error: 'INSUFFICIENT_FUNDS' };

  auction.highestBid = amt;
  auction.highestBidder = playerId;
  pushLog(state, `${player.name} đấu giá ${amt}.`);
  const events = [{ type: 'AUCTION_BID_PLACED', playerId, amount: amt, tileId: auction.tileId }];

  const stillIn = auction.turnOrder.filter((id) => !auction.passed.includes(id));
  if (stillIn.length <= 1) {
    events.push(...endAuction(state));
  } else {
    const next = nextAuctionActor(auction);
    auction.currentTurnId = next || auction.currentTurnId;
    if (!next) events.push(...endAuction(state));
  }
  return { ok: true, events };
}

export function auctionPass(state, playerId) {
  const auction = state.auction;
  if (!auction || state.turnPhase !== 'AWAITING_AUCTION') return { ok: false, error: 'NOT_IN_AUCTION' };
  if (auction.currentTurnId !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (auction.passed.includes(playerId)) return { ok: false, error: 'NOT_IN_AUCTION' };

  const player = findPlayer(state, playerId);
  auction.passed.push(playerId);
  pushLog(state, `${player?.name || '???'} rút khỏi đấu giá.`);
  const events = [{ type: 'AUCTION_PLAYER_PASSED', playerId, tileId: auction.tileId }];

  const stillIn = auction.turnOrder.filter((id) => !auction.passed.includes(id));
  if (stillIn.length <= 1) {
    events.push(...endAuction(state));
  } else {
    const next = nextAuctionActor(auction);
    auction.currentTurnId = next || auction.currentTurnId;
    if (!next) events.push(...endAuction(state));
  }
  return { ok: true, events };
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
    // Bước 1: bán bớt nhà trên các tài sản đang sở hữu, để giữ cảm giác hợp lý.
    const owned = BOARD.filter((t) => player.properties.includes(t.id) && (t.level || 0) > 0);
    for (const tile of owned) {
      if (player.money >= 0) break;
      const refund = Math.floor((tile.houseCost * tile.level) / 2);
      player.money += refund;
      tile.level = 0;
    }
  }
  if (player.money < 0) {
    // Bước 2: thế chấp các tài sản còn lại (đã hết nhà) để vay thêm tiền mặt.
    const unmortgaged = BOARD.filter((t) => player.properties.includes(t.id) && !t.mortgaged);
    for (const tile of unmortgaged) {
      if (player.money >= 0) break;
      tile.mortgaged = true;
      player.money += mortgageValueOf(tile);
      events.push({ type: 'PROPERTY_MORTGAGED', playerId: player.id, tileId: tile.id, value: mortgageValueOf(tile), auto: true });
    }
  }
  if (player.money < 0) {
    player.bankrupt = true;
    for (const tileId of player.properties) {
      const t = BOARD.find((b) => b.id === tileId);
      if (t) {
        t.level = 0;
        t.mortgaged = false;
      }
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

  // Lưu ý: nếu đổ đôi 3 lần liên tiếp, rollDice() đã đưa người chơi vào Nhà Giam và
  // reset doublesStreak về 0 ngay lúc đó, nên tới đây streak không bao giờ đạt 3.
  const keepTurn = state.doublesStreak > 0 && !player.bankrupt;
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
