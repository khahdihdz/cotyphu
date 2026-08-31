// ai.js
// AI chạy hoàn toàn ở server-side (bên trong Durable Object) hoặc trong chế độ
// offline (chạy trên máy người chơi nhưng KHÔNG được nhìn trước xúc xắc/sự kiện
// tương lai — chỉ hành động dựa trên state hiện tại, giống một người chơi thật).
import { BOARD, TILE_TYPES, randInt, MAX_JAIL_TURNS, JAIL_BAIL_AMOUNT } from './gameLogic.js';

const RISK_TOLERANCE = {
  CAUTIOUS: 0.25,
  AGGRESSIVE: 0.85,
  GREEDY: 0.6,
  STRATEGIST: 0.55,
  RANDOM: 0.5,
};

const RESERVE_RATIO = {
  CAUTIOUS: 0.5, // luôn giữ lại 50% tiền mặt làm quỹ dự phòng
  AGGRESSIVE: 0.1,
  GREEDY: 0.3,
  STRATEGIST: 0.3,
  RANDOM: 0.2,
};

export function getThinkingDelay(personality) {
  const base = randInt(800, 2500);
  if (personality === 'STRATEGIST') return base + 400; // suy nghĩ lâu hơn một chút
  return base;
}

function groupTilesOf(tile) {
  return BOARD.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === tile.group);
}

function monopolyPotential(tile, player) {
  const group = groupTilesOf(tile);
  const ownedInGroup = group.filter((t) => player.properties.includes(t.id)).length;
  return ownedInGroup / group.length; // 0..1, càng gần 1 càng gần độc quyền nhóm
}

function estimateFutureRent(tile) {
  // Ước lượng tiền thuê trung bình trong vòng đời tài sản (đơn giản hoá).
  const avg = tile.rent.reduce((a, b) => a + b, 0) / tile.rent.length;
  return avg;
}

function strategicPosition(tile) {
  // Ô càng gần các ga/khu vực đắt tiền được coi là vị trí chiến lược hơn.
  if (tile.group === 'STATION') return 0.7;
  if (tile.group === 'F') return 0.9;
  if (tile.group === 'E' || tile.group === 'D') return 0.6;
  return 0.4;
}

function evaluatePurchase(state, player, tile, memory) {
  const propertyValue = tile.price;
  const futureRent = estimateFutureRent(tile);
  const monopoly = monopolyPotential(tile, player) * 500; // trọng số
  const strategic = strategicPosition(tile) * 200;
  const cashFlow = player.money - tile.price;
  const bankruptcyRisk = cashFlow < 100 ? (100 - cashFlow) * 3 : 0;
  const liquidityRisk = memory.badInvestments.includes(tile.group) ? 150 : 0;

  const score =
    propertyValue * 0.3 +
    futureRent * 1.5 +
    monopoly +
    strategic -
    tile.price -
    bankruptcyRisk -
    liquidityRisk;

  return score;
}

/**
 * Quyết định AI có nên mua tài sản đang đứng hay không.
 * Trả về 'BUY' | 'SKIP'.
 */
export function decideBuy(state, player, tile) {
  const memory = state.aiMemory[player.id] || { badInvestments: [], dangerZones: [], knownRich: [], tradeHistory: [] };
  const personality = player.personality || 'RANDOM';
  const reserve = computeReserve(state, player, personality);

  if (player.money - tile.price < reserve) {
    return 'SKIP';
  }

  const score = evaluatePurchase(state, player, tile, memory);
  const risk = RISK_TOLERANCE[personality] ?? 0.5;
  const threshold = 300 * (1 - risk); // AI rủi ro cao thì ngưỡng thấp hơn, dễ mua hơn
  const randomness = (Math.random() - 0.5) * 200 * (personality === 'RANDOM' ? 2 : 0.6);

  const finalScore = score - threshold + randomness;
  return finalScore > 0 ? 'BUY' : 'SKIP';
}

function computeReserve(state, player, personality) {
  const ratio = RESERVE_RATIO[personality] ?? 0.2;
  return Math.round(300 * ratio + player.properties.length * 20);
}

/**
 * AI đang trong Nhà Giam, đến lượt mình — quyết định trả tự do bằng cách nào.
 * Trả về 'PAY_BAIL' | 'USE_CARD' | 'ROLL'.
 */
export function decideJailAction(state, player) {
  if (!player.inJail) return 'ROLL';
  const personality = player.personality || 'RANDOM';
  if (player.jailCards > 0) return 'USE_CARD';
  const reserve = computeReserve(state, player, personality);
  const risk = RISK_TOLERANCE[personality] ?? 0.5;
  // Cá tính rủi ro thấp (CAUTIOUS) hoặc đang có nhiều đất cần triển khai thì trả tiền ra sớm
  // để tranh thủ thời gian; cá tính rủi ro cao thì thử vận may đổ đôi trước, tiết kiệm tiền.
  const eagerToPay = risk < 0.5 || player.jailTurns >= MAX_JAIL_TURNS - 1;
  if (eagerToPay && player.money - JAIL_BAIL_AMOUNT >= reserve) return 'PAY_BAIL';
  return 'ROLL';
}

/**
 * AI đang tham gia một phiên đấu giá — quyết định đấu giá tiếp hay rút lui.
 * Trả về { action: 'BID', amount } hoặc { action: 'PASS' }.
 */
export function decideAuctionAction(state, player, auction) {
  const tile = BOARD.find((t) => t.id === auction.tileId);
  if (!tile) return { action: 'PASS' };
  const personality = player.personality || 'RANDOM';
  const reserve = computeReserve(state, player, personality);
  const memory = state.aiMemory[player.id] || { badInvestments: [], dangerZones: [], knownRich: [], tradeHistory: [] };
  const baseScore = evaluatePurchase(state, player, tile, memory);
  const risk = RISK_TOLERANCE[personality] ?? 0.5;

  // Sẵn sàng trả tối đa: kết hợp giá gốc, mức độ mạo hiểm và điểm đánh giá chiến lược.
  const maxWillingBid = Math.max(0, Math.round(tile.price * (0.4 + risk * 0.8) + baseScore * 0.3));
  const increment = Math.max(5, Math.round(tile.price * 0.05));
  const nextBid = auction.highestBid + increment;
  const affordable = player.money - nextBid >= reserve;

  if (nextBid <= maxWillingBid && affordable) {
    return { action: 'BID', amount: nextBid };
  }
  return { action: 'PASS' };
}

/**
 * Sau khi kết thúc di chuyển/xử lý ô, AI xem xét có nên nâng cấp tài sản không.
 * Trả về danh sách tileId nên nâng cấp (theo thứ tự ưu tiên), hoặc [].
 */
export function decideUpgrades(state, player) {
  const personality = player.personality || 'RANDOM';
  const reserve = computeReserve(state, player, personality);
  const candidates = [];

  const groups = {};
  for (const tileId of player.properties) {
    const tile = BOARD.find((t) => t.id === tileId);
    if (!tile || tile.type !== TILE_TYPES.PROPERTY || tile.group === 'STATION') continue;
    groups[tile.group] = groups[tile.group] || [];
    groups[tile.group].push(tile);
  }

  for (const group of Object.values(groups)) {
    const allTilesInGroup = groupTilesOf(group[0]);
    const ownsAll = allTilesInGroup.every((t) => player.properties.includes(t.id));
    if (!ownsAll) continue;
    for (const tile of group) {
      const level = tile.level || 0;
      if (level < 4) {
        candidates.push({ tile, cost: tile.houseCost, priority: estimateFutureRent(tile) - tile.houseCost });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const chosen = [];
  let spendable = player.money - reserve;
  for (const c of candidates) {
    if (spendable - c.cost < 0) continue;
    // Cá tính RANDOM có thể bỏ qua nâng cấp một cách ngẫu nhiên để tạo cảm giác khó đoán.
    if (personality === 'RANDOM' && Math.random() < 0.4) continue;
    chosen.push(c.tile.id);
    spendable -= c.cost;
  }
  return chosen;
}

/**
 * AI nhận được một đề nghị giao dịch — quyết định đồng ý hay từ chối dựa trên
 * so sánh giá trị ước lượng của hai bên, có tính đến độ mạo hiểm theo cá tính.
 */
export function decideTradeResponse(state, toPlayer, offer) {
  const personality = toPlayer.personality || 'RANDOM';
  const valueOf = (tileIds) => tileIds.reduce((sum, id) => {
    const t = BOARD.find((b) => b.id === id);
    return sum + (t ? t.price + estimateFutureRent(t) : 0);
  }, 0);

  const gains = valueOf(offer.giveProperties) + (offer.giveMoney || 0);
  const costs = valueOf(offer.wantProperties) + (offer.wantMoney || 0);
  const risk = RISK_TOLERANCE[personality] ?? 0.5;
  const tolerance = 1 - risk * 0.3; // AI mạo hiểm hơn thì dễ chấp nhận giao dịch hơi lỗ một chút

  if (toPlayer.money - (offer.wantMoney || 0) < 0) return false;
  return gains >= costs * tolerance;
}

/**
 * Cập nhật trí nhớ của AI dựa trên diễn biến ván chơi (gọi mỗi khi kết thúc lượt).
 */
export function updateAIMemory(state) {
  for (const observer of state.players) {
    if (!observer.isAI) continue;
    const memory = state.aiMemory[observer.id] || { knownRich: [], dangerZones: [], badInvestments: [], tradeHistory: [] };

    const sorted = [...state.players].filter((p) => p.id !== observer.id && !p.bankrupt).sort((a, b) => b.money - a.money);
    memory.knownRich = sorted.slice(0, 2).map((p) => p.id);

    memory.dangerZones = BOARD.filter((t) => {
      if (t.type !== TILE_TYPES.PROPERTY) return false;
      const owner = state.players.find((p) => p.properties.includes(t.id));
      return owner && owner.id !== observer.id && (t.level || 0) >= 3;
    }).map((t) => t.id);

    state.aiMemory[observer.id] = memory;
  }
}

/**
 * Ghi nhớ một khoản đầu tư gây thiệt hại lớn (ví dụ vừa mua xong thì bị mất nhiều tiền
 * vì thuế/sự kiện ngay sau đó), để AI thận trọng hơn với nhóm tài sản đó về sau.
 */
export function noteBadInvestment(state, playerId, group) {
  const memory = state.aiMemory[playerId];
  if (memory && !memory.badInvestments.includes(group)) {
    memory.badInvestments.push(group);
  }
}
