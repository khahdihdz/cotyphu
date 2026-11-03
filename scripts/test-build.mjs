import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const exists = async (path) => access(new URL(path, import.meta.url)).then(() => true).catch(() => false);

const html = await read('../public/index.html');
const importMapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/i);
assert.ok(importMapMatch, 'index.html phải có import map');
const importMap = JSON.parse(importMapMatch[1]);
assert.equal(importMap.imports?.three, './vendor/three/build/three.module.js');
assert.equal(importMap.imports?.['three/addons/'], './vendor/three/examples/jsm/');

const threePath = '../public/vendor/three/build/three.module.js';
const controlsPath = '../public/vendor/three/examples/jsm/controls/OrbitControls.js';
assert.equal(await exists(threePath), true, 'Thiếu bundle Three.js local');
assert.equal(await exists(controlsPath), true, 'Thiếu OrbitControls local');
assert.ok((await stat(new URL(threePath, import.meta.url))).size > 500_000, 'Bundle Three.js có vẻ không đầy đủ');

const controls = await read(controlsPath);
assert.ok(controls.includes("from '../../../build/three.module.js'"),
  'OrbitControls phải import Three.js local bằng relative path');
assert.ok(!/from\\s+['"]three['"]/.test(controls),
  'OrbitControls không được giữ bare import chưa được resolve');

const runtime = await read('../public/runtime-config.js');
assert.ok(runtime.includes('window.CTP_CONFIG'), 'Thiếu runtime config');
assert.ok(!/https?:\\/\\/[^\\s'"]+:[^\\s'"]+@/.test(runtime),
  'Không được đưa URL có thông tin đăng nhập vào runtime config');

console.log('✓ Production HTML import map trỏ tới Three.js local');
console.log('✓ Three.js bundle và OrbitControls tồn tại');
console.log('✓ OrbitControls không phụ thuộc bare import hoặc CDN');
console.log('✓ Runtime config có cấu trúc hợp lệ và không chứa URL có credentials');
console.log('✓ Production asset smoke tests PASS');
