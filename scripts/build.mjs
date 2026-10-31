import { readFile, access, writeFile } from 'node:fs/promises';
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

// URL của Worker là endpoint công khai, không phải secret. Chỉ nhận HTTPS.
const workerUrl = (process.env.CTP_WORKER_URL || '').trim().replace(/\/+$/, '');
if (workerUrl) {
  const parsed = new URL(workerUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('CTP_WORKER_URL phải là URL HTTPS hợp lệ, không chứa thông tin đăng nhập.');
  }
}
const runtimeConfig = `// Generated at build time. Do not put secrets in this file.\nwindow.CTP_CONFIG = window.CTP_CONFIG || ${JSON.stringify({ workerUrl })};\n`;
await writeFile(resolve(root, 'public/runtime-config.js'), runtimeConfig, 'utf8');
console.log(`✓ runtime-config.js: ${workerUrl ? 'đã cấu hình Worker endpoint' : 'dùng cùng origin (local/fallback)'}`);
console.log('✓ Cờ Tỷ Phú: kiểm tra production assets/data thành công.');
