import assert from 'node:assert/strict';
import {
  BOARD,
  BOARD_SIZE,
  MAX_HOUSE_LEVEL,
  START_MONEY,
  PASS_START_BONUS,
  createPlayer,
  createInitialState,
  startGame,
  rollTwoDice,
  mortgageValueOf,
  unmortgageCostOf,
  upgradeProperty,
  getPropertyState,
} from '../src/gameLogic.js';
import { GAME_CARDS } from '../src/cards.js';
import {
  payBail,
  useJailCard,
  rollDice,
  buyProperty,
  auctionBid,
  auctionPass,
  endTurn,
  mortgageProperty,
  unmortgageProperty,
} from '../src/gameLogic.js';

assert.equal(BOARD_SIZE, 40, 'Bàn cờ phải có đúng 40 ô');
assert.equal(BOARD.length, 40, 'BOARD phải có đúng 40 ô');
assert.equal(MAX_HOUSE_LEVEL, 5, 'Cấp công trình tối đa phải là khách sạn cấp 5');
assert.equal(PASS_START_BONUS, 200_000, 'Thưởng qua Xuất Phát phải là 200.000 ₫');
assert.equal(GAME_CARDS.length, 30, 'Bộ thẻ sự kiện phải có đúng 30 thẻ');
assert.deepEqual(GAME_CARDS.map((card) => card.id), Array.from({ length: 30 }, (_, i) => i + 1));

const players = [
  createPlayer({ id: 'p1', name: 'Người chơi 1', color: '#F2B84B' }),
  createPlayer({ id: 'p2', name: 'Người chơi 2', color: '#3FC1C9' }),
];
const state = createInitialState('TEST', players);
assert.equal(state.cardDeck.CHANCE.length, 30, 'Deck Cơ Hội phải có 30 thẻ');
assert.equal(state.cardDeck.EVENT.length, 30, 'Deck Sự Kiện phải có 30 thẻ');
const started = startGame(state);
assert.equal(started.ok, true, 'Ván 2 người phải khởi động được');
assert.equal(state.phase, 'PLAYING');
assert.equal(state.turnNumber, 1);
assert.equal(state.players.length, 2);
assert.ok(state.players.every((player) => player.money === START_MONEY));
assert.equal(state.cardDeck.CHANCE.length, 30, 'Start game phải reset bộ thẻ Cơ Hội');
assert.equal(state.cardDeck.EVENT.length, 30, 'Start game phải reset bộ thẻ Sự Kiện');

for (let i = 0; i < 100; i += 1) {
  const [a, b] = rollTwoDice();
  assert.ok(a >= 1 && a <= 6, 'Xúc xắc 1 phải nằm trong 1..6');
  assert.ok(b >= 1 && b <= 6, 'Xúc xắc 2 phải nằm trong 1..6');
}

const property = BOARD.find((tile) => tile.type === 'PROPERTY' && tile.group !== 'STATION');
assert.ok(property, 'Phải có ô bất động sản');
assert.equal(mortgageValueOf(property), Math.floor(property.price / 2));
assert.equal(unmortgageCostOf(property), mortgageValueOf(property) + Math.ceil(mortgageValueOf(property) * 0.1));

// Kiểm tra đầy đủ chuỗi 1→4 nhà→khách sạn (cấp 5).
state.turnPhase = 'TURN_DONE';
state.players[0].properties = [1, 3];
for (let level = 1; level <= MAX_HOUSE_LEVEL; level += 1) {
  const res = upgradeProperty(state, 'p1', 1);
  assert.equal(res.ok, true, `Nâng ô 1 lên cấp ${level} phải thành công`);
  assert.equal(getPropertyState(state, 1).level, level);
}
assert.equal(getPropertyState(state, 1).level, 5, 'Cấp 5 phải là khách sạn');
assert.equal(upgradeProperty(state, 'p1', 1).ok, false, 'Không được xây vượt khách sạn');

// Chuộc/thế chấp cơ bản trong một state tách riêng.
{
  const chain = createInitialState('TEST-CHAIN', [
    createPlayer({ id: 'a0', name: 'A0', color: '#F2B84B' }),
    createPlayer({ id: 'b0', name: 'B0', color: '#3FC1C9' }),
  ]);
  startGame(chain);
  chain.turnPhase = 'TURN_DONE';
  chain.players[0].properties = [1, 3];
  assert.equal(mortgageProperty(chain, 'a0', 1).ok, true, 'Thế chấp ô 1 thành công');
  assert.equal(unmortgageProperty(chain, 'a0', 1).ok, true, 'Chuộc lại ô 1 thành công');
  assert.equal(unmortgageProperty(chain, 'a0', 1).ok, false, 'Không chuộc lại hai lần');
}

for (let count = 2; count <= 6; count += 1) {
  const roster = Array.from({ length: count }, (_, i) =>
    createPlayer({ id: `p${count}-${i}`, name: `P${i + 1}`, color: '#F2B84B' }),
  );
  const room = createInitialState(`TEST-${count}`, roster);
  assert.equal(startGame(room).ok, true, `Ván ${count} người phải khởi động được`);
}

/* ====== Test bổ sung: đồng bộ bản sao public/ + dữ liệu render + smoke test AI offline ====== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const readRepo = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// 1) Bản sao trong public/ phải giống hệt src/ hàng byte (nguồn duy nhất, README yêu cầu).
const SYNC_PAIRS = [
  ['src/gameLogic.js', 'public/gameLogic.js'],
  ['src/ai.js', 'public/ai.js'],
  ['src/protocol.js', 'public/protocol.js'],
  ['src/cards.js', 'public/cards.js'],
];
for (const [a, b] of SYNC_PAIRS) {
  assert.equal(readRepo(a), readRepo(b), `${b} phải đồng bộ với ${a} (engine/protocol là nguồn duy nhất)`);
}

// 2) public/data/board.json phải khớp BOARD (số ô, thứ tự, tên, loại, giá) — renderer dùng dữ liệu này.
const boardJson = JSON.parse(readFileSync(resolve(repoRoot, 'public/data/board.json'), 'utf8'));
assert.equal(boardJson.length, BOARD.length, 'board.json phải có đúng số ô như BOARD');
boardJson.forEach((tile, index) => {
  const source = BOARD[index];
  assert.equal(tile.id, source.id, `board.json ô thứ ${index}: id lệch BOARD`);
  assert.equal(tile.name, source.name, `board.json ô ${tile.id}: tên lệch BOARD`);
  assert.equal(tile.type, source.type, `board.json ô ${tile.id}: loại ô lệch BOARD`);
  assert.equal(tile.group, source.group, `board.json ô ${tile.id}: nhóm màu lệch BOARD`);
  if (source.type === 'PROPERTY') assert.equal(tile.price, source.price, `board.json ô ${tile.id}: giá lệch BOARD`);
});

// 3) Regression: không nâng cấp được khi đất khác trong nhóm vẫn còn thế chấp.
{
  const a = createPlayer({ id: 'a', name: 'A', color: '#F2B84B' });
  const b = createPlayer({ id: 'b', name: 'B', color: '#3FC1C9' });
  const mortgageState = createInitialState('TEST-MORTGAGE-GROUP', [a, b]);
  startGame(mortgageState);
  mortgageState.turnPhase = 'TURN_DONE';
  mortgageState.players[0].properties = [1, 3];
  assert.equal(mortgageProperty(mortgageState, 'a', 3).ok, true, 'Phải thế chấp được ô 3 (đất trống, đủ quyền)');
  const blocked = upgradeProperty(mortgageState, 'a', 1);
  assert.equal(blocked.ok, false, 'Nâng cấp phải bị chặn khi đất khác trong nhóm còn thế chấp');
  assert.equal(unmortgageProperty(mortgageState, 'a', 3).ok, true, 'Chuộc lại phải thành công');
  assert.equal(upgradeProperty(mortgageState, 'a', 1).ok, true, 'Chuộc lại xong phải nâng cấp được');
}

// 4) Smoke test offline AI: mô phỏng như vòng lặp AI trong game.js/gameRoom.js để chắc
//    chắn loop không treo (turnIndex vẫn nhích lên hoặc ván kết thúc).
import * as AI from '../src/ai.js';
{
  const roster = [
    createPlayer({ id: 'p1', name: 'AI One', isAI: true, personality: 'CAUTIOUS', color: '#F2B84B' }),
    createPlayer({ id: 'p2', name: 'AI Two', isAI: true, personality: 'AGGRESSIVE', color: '#3FC1C9' }),
    createPlayer({ id: 'p3', name: 'AI Three', isAI: true, personality: 'GREEDY', color: '#E85A4F' }),
    createPlayer({ id: 'p4', name: 'AI Four', isAI: true, personality: 'STRATEGIST', color: '#9B8CF2' }),
  ];
  const aiGame = createInitialState('TEST-OFFLINE-AI', roster);
  assert.equal(startGame(aiGame).ok, true, 'Khởi động ván offline AI thành công');
  // Game dài là hợp lệ (README có ghi chú) — bất biến cần kiểm là KHÔNG stall:
  // turnNumber phải nhích lên trước khi quá 300 hành động liên tiếp mà không đổi.
  const guard = 60000; // chặn trên tuyệt đối để test không chạy vô hạn
  const STALL_LIMIT = 300;
  let iterations = 0;
  let stall = 0;
  const startTurnNumber = aiGame.turnNumber;
  let lastTurnNumber = startTurnNumber;
  while (aiGame.phase === 'PLAYING' && iterations < guard) {
    iterations += 1;
    if (aiGame.turnNumber !== lastTurnNumber) {
      lastTurnNumber = aiGame.turnNumber;
      stall = 0;
    } else {
      stall += 1;
      assert.ok(stall < STALL_LIMIT, `Vòng lặp AI offline bị treo (turnNumber đứng yên ${STALL_LIMIT} bước liên tiếp)`);
    }
    const player = aiGame.players[aiGame.turnIndex];
    if (!player.isAI) break; // tới người thật thì dừng (hệ thống chơi vòng lặp tiếp)
    if (player.bankrupt && aiGame.turnPhase !== 'TURN_DONE') break;
    if (aiGame.turnPhase === 'AWAITING_ROLL' && player.inJail) {
      const jailAction = AI.decideJailAction(aiGame, player);
      const res =
        jailAction === 'PAY_BAIL' ? payBail(aiGame, player.id)
        : jailAction === 'USE_CARD' ? useJailCard(aiGame, player.id)
        : rollDice(aiGame, player.id);
      if (!res.ok) throw new Error(`AI nhà giam vấp lỗi: ${res.error}`);
    } else if (aiGame.turnPhase === 'AWAITING_ROLL') {
      const res = rollDice(aiGame, player.id);
      if (!res.ok) throw new Error(`AI tung xúc xắc vấp lỗi: ${res.error}`);
    } else if (aiGame.turnPhase === 'AWAITING_PROPERTY_DECISION') {
      const tile = BOARD.find((t) => t.id === aiGame.pendingTileId);
      const decision = tile ? AI.decideBuy(aiGame, player, tile) : 'SKIP';
      const res = buyProperty(aiGame, player.id, decision);
      if (!res.ok) throw new Error(`AI mua đất vấp lỗi: ${res.error}`);
      if (aiGame.turnPhase === 'AWAITING_AUCTION') {
        while (aiGame.turnPhase === 'AWAITING_AUCTION' && aiGame.auction) {
          const actor = aiGame.players.find((p) => p.id === aiGame.auction.currentTurnId);
          if (!actor?.isAI) break;
          const decision = AI.decideAuctionAction(aiGame, actor, aiGame.auction);
          const res = decision?.action === 'BID'
            ? auctionBid(aiGame, actor.id, decision.amount)
            : auctionPass(aiGame, actor.id);
          if (!res.ok) throw new Error(`AI đấu giá vấp lỗi: ${res.error}`);
        }
      }
    } else if (aiGame.turnPhase === 'TURN_DONE') {
      for (const tileId of AI.decideUpgrades(aiGame, player)) {
        const res = upgradeProperty(aiGame, player.id, tileId);
        if (!res.ok && res.error !== 'INVALID_ACTION') throw new Error(`AI nâng cấp vấp lỗi: ${res.error}`);
      }
      AI.updateAIMemory(aiGame);
      const endRes = endTurn(aiGame, player.id);
      if (!endRes.ok) throw new Error(`AI kết thúc lượt vấp lỗi: ${endRes.error}`);
    } else {
      throw new Error(`turnPhase lạ trong vòng lặp AI: ${aiGame.turnPhase}`);
    }
  }
  if (iterations >= guard) {
    // Ván dài là đặc tính luật (README: ván có thể rất dài); guard chỉ để bound thời gian test.
    console.log('! Ván 4 AI vượt guard 60k bước (nếu stall thì assert <300 bên trên đã chặn trước)');
    console.log('! Bỏ qua assert tiến triển cuối vì chưa kết thúc trong guard');
  } else {
    assert.ok(
      aiGame.phase === 'ENDED' || aiGame.turnNumber > startTurnNumber || aiGame.turnIndex !== 0,
      'Vòng lặp AI offline phải có tiến triển lượt chơi',
    );
  }
}

console.log('✓ 40 ô bàn cờ');
console.log('✓ 30 thẻ sự kiện thật + 2 deck runtime');
console.log('✓ Luật tiền và thế chấp cơ bản');
console.log('✓ Xúc xắc 1..6');
console.log('✓ Chuỗi nâng cấp 1→4 nhà→khách sạn cấp 5');
console.log('✓ Khởi động ván 2..6 người');
console.log('✓ Bản sao public/ (gameLogic/ai/protocol/cards) đồng bộ src/');
console.log('✓ board.json khớp BOARD (id/tên/loại/nhóm/giá)');
console.log('✓ Chặn nâng cấp khi đất nhóm còn thế chấp + thế chấp/chuộc hợp lệ');
console.log('✓ Vòng lặp AI offline không treo (4 AI, đầy đủ nhánh luật)');
console.log('✓ Tất cả kiểm thử engine cơ bản PASS');
