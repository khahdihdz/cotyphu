import { readFile, access, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const readJson = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));
const board = await readJson('public/data/board.json');
const characters = await readJson('public/data/characters.json');
const events = await readJson('public/data/events.json');
const manifest = await readJson('public/assets/manifest.json');

const checks = [
  ['40 ô bàn cờ', board.length === 40],
  ['8 nhân vật', characters.length === 8],
  ['30 thẻ sự kiện', events.length === 30],
  ['30 thẻ sự kiện authoritative source', await access(resolve(root, 'src/cards.js')).then(() => true).catch(() => false)],
  ['12 token', manifest.tokens.length === 12],
  ['5 cấp công trình', manifest.buildings.length === 5],
  ['8 nhóm asset bàn cờ', manifest.board.length === 8],
  ['UI asset sheet', manifest.ui?.length === 1],
  ['không dùng asset ngoài', manifest.externalAssets === false],
];
for (const [name, ok] of checks) {
  if (!ok) throw new Error(`BUILD CHECK FAILED: ${name}`);
  console.log(`✓ ${name}`);
}

const assetPaths = [...manifest.board, ...manifest.characters, ...manifest.tokens, ...manifest.buildings, ...manifest.cards, ...manifest.effects, ...manifest.ui];
for (const relative of assetPaths) {
  await access(resolve(root, 'public/assets', relative));
}
console.log(`✓ ${assetPaths.length} manifest asset entries tồn tại`);

// Kiểm tra gói view Phaser 3 vendor-local (không CDN) + các module hiển thị mới.
const PHASER_FILE = 'public/vendor/phaser.esm.min.js';
const phaserSource = await readFile(resolve(root, PHASER_FILE), 'utf8');
const phaserSize = (await stat(resolve(root, PHASER_FILE))).size;
if (phaserSize < 400_000 || phaserSize > 3_000_000) throw new Error(`BUILD CHECK FAILED: Phaser bundle có kích thước bất thường (${phaserSize} bytes)`);
if (!phaserSource.includes('Phaser')) throw new Error('BUILD CHECK FAILED: Phaser bundle không đúng gói Phaser');
console.log(`✓ Phaser 3 vendor-local (${Math.round(phaserSize / 1024)} KB) tồn tại`);
const GAME_MODULES = [
  'public/game/gameAdapter.js',
  'public/game/phaserGame.js',
  'public/game/scenes/bootScene.js',
  'public/game/scenes/boardScene.js',
  'public/game/render/boardLayout.js',
  'public/game/render/boardRenderer.js',
  'public/game/render/propertyRenderer.js',
  'public/game/render/pawnRenderer.js',
];
for (const modulePath of GAME_MODULES) {
  await access(resolve(root, modulePath));
}
console.log(`✓ ${GAME_MODULES.length} module hiển thị Phaser tồn tại`);
console.log('✓ Cờ Tỷ Phú: kiểm tra production assets/data thành công. Frontend được phục vụ từ public/.');
