import { readFile, access } from 'node:fs/promises';
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
  ['12 token', manifest.tokens.length === 12],
  ['5 cấp công trình', manifest.buildings.length === 5],
  ['không dùng asset ngoài', manifest.externalAssets === false],
];
for (const [name, ok] of checks) {
  if (!ok) throw new Error(`BUILD CHECK FAILED: ${name}`);
  console.log(`✓ ${name}`);
}

const assetPaths = [...manifest.board, ...manifest.characters, ...manifest.tokens, ...manifest.buildings, ...manifest.cards, ...manifest.effects];
for (const relative of assetPaths) {
  await access(resolve(root, 'public/assets', relative));
}
console.log(`✓ ${assetPaths.length} manifest asset entries tồn tại`);
console.log('✓ Cờ Tỷ Phú: kiểm tra production assets/data thành công. Frontend được phục vụ từ public/.');
