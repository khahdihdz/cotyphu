import { readFile, access, writeFile, mkdir, copyFile } from 'node:fs/promises';
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

// Đóng gói Three.js và OrbitControls vào chính frontend, không phụ thuộc CDN runtime.
const threeRoot = resolve(root, 'node_modules/three');
const vendorRoot = resolve(root, 'public/vendor/three');
const controlsDir = resolve(vendorRoot, 'examples/jsm/controls');
await mkdir(resolve(vendorRoot, 'build'), { recursive: true });
await mkdir(controlsDir, { recursive: true });
await copyFile(resolve(threeRoot, 'build/three.module.js'), resolve(vendorRoot, 'build/three.module.js'));
const controlsSource = await readFile(resolve(threeRoot, 'examples/jsm/controls/OrbitControls.js'), 'utf8');
const controlsLocal = controlsSource.replace(
  /from ['"]three['"]/g,
  "from '../../../build/three.module.js'"
);
if (controlsLocal === controlsSource) {
  throw new Error('BUILD CHECK FAILED: không tìm thấy import three trong OrbitControls.');
}
await writeFile(resolve(controlsDir, 'OrbitControls.js'), controlsLocal, 'utf8');
await copyFile(resolve(threeRoot, 'LICENSE'), resolve(vendorRoot, 'LICENSE'));
await access(resolve(vendorRoot, 'build/three.module.js'));
await access(resolve(controlsDir, 'OrbitControls.js'));
console.log('✓ Three.js 0.179.1 + OrbitControls được đóng gói local');

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
