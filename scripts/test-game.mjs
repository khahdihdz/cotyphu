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
} from '../src/gameLogic.js';
import { GAME_CARDS } from '../src/cards.js';

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
const started = startGame(state);
assert.equal(started.ok, true, 'Ván 2 người phải khởi động được');
assert.equal(state.phase, 'PLAYING');
assert.equal(state.turnNumber, 1);
assert.equal(state.players.length, 2);
assert.ok(state.players.every((player) => player.money === START_MONEY));

for (let i = 0; i < 100; i += 1) {
  const [a, b] = rollTwoDice();
  assert.ok(a >= 1 && a <= 6, 'Xúc xắc 1 phải nằm trong 1..6');
  assert.ok(b >= 1 && b <= 6, 'Xúc xắc 2 phải nằm trong 1..6');
}

const property = BOARD.find((tile) => tile.type === 'PROPERTY' && tile.group !== 'STATION');
assert.ok(property, 'Phải có ô bất động sản');
assert.equal(mortgageValueOf(property), Math.floor(property.price / 2));
assert.equal(unmortgageCostOf(property), mortgageValueOf(property) + Math.ceil(mortgageValueOf(property) * 0.1));

for (let count = 2; count <= 6; count += 1) {
  const roster = Array.from({ length: count }, (_, i) =>
    createPlayer({ id: `p${count}-${i}`, name: `P${i + 1}`, color: '#F2B84B' }),
  );
  const room = createInitialState(`TEST-${count}`, roster);
  assert.equal(startGame(room).ok, true, `Ván ${count} người phải khởi động được`);
}

console.log('✓ 40 ô bàn cờ');
console.log('✓ 30 thẻ sự kiện');
console.log('✓ Luật tiền và thế chấp cơ bản');
console.log('✓ Xúc xắc 1..6');
console.log('✓ Khởi động ván 2..6 người');
console.log('✓ Tất cả kiểm thử engine cơ bản PASS');
