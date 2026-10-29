// game/render/propertyRenderer.js
// Vẽ lớp phủ cho ô bất động sản: thanh nhóm màu, vòng màu chủ sở hữu, cấp nhà
// (1-4 nhà, 5 = khách sạn) và dấu thế chấp. Toàn bộ dữ liệu đến từ state đã được
// engine xác nhận (propertyStates + players) — module không tự suy ra luật.
import { CELL, GROUP_COLORS } from './boardLayout.js';

/** '#RRGGBB' → int cho Graphics của Phaser. */
export function cssToHex(cssColor) {
  if (typeof cssColor !== 'string' || cssColor[0] !== '#') return 0xffffff;
  const n = parseInt(cssColor.slice(1), 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

/** Vẽ thanh màu nhóm ở mép trên ô bất động sản. */
export function drawGroupBar(g, tile) {
  g.clear();
  if (tile.type !== 'PROPERTY') return;
  g.fillStyle(cssToHex(GROUP_COLORS[tile.group] || '#9aa5b5'), 1);
  g.fillRoundedRect(-CELL / 2 + 5, -CELL / 2 + 4, CELL - 10, 9, 3);
}

/** Vẽ vòng màu chủ sở hữu quanh mép ô (rõ ràng cả ở màn hình nhỏ). */
export function drawOwnerRing(g, ownerColor) {
  g.clear();
  if (!ownerColor) return;
  g.lineStyle(4, cssToHex(ownerColor), 1);
  g.strokeRoundedRect(-CELL / 2 + 3, -CELL / 2 + 3, CELL - 6, CELL - 6, 10);
}

/** Vẽ nhà/khách sạn: cấp 1-4 là các chấm nhà, cấp 5 là 1 khối khách sạn. */
export function drawBuildings(g, level) {
  g.clear();
  if (!Number.isFinite(level) || level <= 0) return;
  if (level >= 5) {
    g.fillStyle(0xf2b84b, 1);
    g.fillRoundedRect(-14, -CELL / 2 + 20, 28, 14, 3);
    g.lineStyle(2, 0x8a5f16, 1);
    g.strokeRoundedRect(-14, -CELL / 2 + 20, 28, 14, 3);
    return;
  }
  g.fillStyle(0x2fae59, 1);
  const dot = 9;
  const gap = 4;
  const total = level * dot + (level - 1) * gap;
  let startX = -total / 2;
  for (let i = 0; i < level; i += 1) {
    g.fillRoundedRect(startX, -CELL / 2 + 22, dot, dot, 2);
    startX += dot + gap;
  }
}

/** Vẽ hai vạch chéo dấu ô đang thế chấp. */
export function drawMortgageMarks(g, mortgaged) {
  g.clear();
  if (!mortgaged) return;
  g.lineStyle(3, 0x8d99ae, 0.9);
  g.beginPath();
  g.moveTo(-CELL / 2 + 10, CELL / 2 - 30);
  g.lineTo(CELL / 2 - 10, CELL / 2 - 10);
  g.strokePath();
  g.beginPath();
  g.moveTo(-CELL / 2 + 10, CELL / 2 - 10);
  g.lineTo(CELL / 2 - 10, CELL / 2 - 30);
  g.strokePath();
}
