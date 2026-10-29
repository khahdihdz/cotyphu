// game/render/boardRenderer.js
// Vẽ 40 ô bàn cờ bằng Phaser, suy ra toàn bộ nội dung hiển thị từ BOARD
// (id, thứ tự, tên, loại ô, nhóm màu, giá) — không có bản board song song.
// Cấp nhà, chủ sở hữu, thế chấp chỉ được cập nhật từ state engine gửi xuống
// qua applyOwnership()/applyOwnership(); hiệu ứng highlight chỉ là hình ảnh.
import {
  CELL,
  tileCenter,
  compactMoney,
  CORNER_IDS,
} from './boardLayout.js';
import {
  cssToHex,
  drawGroupBar,
  drawOwnerRing,
  drawBuildings,
  drawMortgageMarks,
} from './propertyRenderer.js';

// Giá trị string khớp TILE_TYPES trong gameLogic.js (nhập trực tiếp vào sẽ
// khiến module render phụ thuộc vào engine — cố tình tránh).
const TYPE_ICON_FALLBACK = {
  START: '🚩', TAX: '💸', CHANCE: '🎴', EVENT: '✨', BONUS: '🎁',
  REST: '🅿️', JAIL: '🔒', TELEPORT: '🌀', GO_TO_JAIL: '🚓',
};

export function createBoardRenderer(scene, board) {
  const tiles = new Map(); // id -> refs

  board.forEach((tile, index) => {
    const id = typeof tile.id === 'number' ? tile.id : index;
    const center = tileCenter(id);
    const isCorner = CORNER_IDS.includes(id);

    const container = scene.add.container(center.x, center.y);
    container.setDepth(2);

    // --- nền ô ---
    const base = scene.add.graphics();
    base.fillStyle(isCorner ? 0xffe9ae : 0xfffdf6, 1);
    base.fillRoundedRect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4, 10);
    base.lineStyle(2, 0xd9e2ef, 1);
    base.strokeRoundedRect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4, 10);
    container.add(base);

    // --- thanh màu nhóm (bất động sản) ---
    const bar = scene.add.graphics();
    drawGroupBar(bar, tile);
    container.add(bar);

    // --- chữ ---
    const isProperty = tile.type === 'PROPERTY';
    const corner = isCorner;
    const nameSize = corner ? 14 : 12;
    const nameText = scene.add.text(0, -18, String(tile.name || ''), {
      fontFamily: '"Be Vietnam Pro", system-ui, sans-serif',
      fontStyle: 'bold',
      fontSize: `${nameSize}px`,
      color: '#172033',
      align: 'center',
      wordWrap: { width: CELL - 12 },
    });
    nameText.setOrigin(0.5, 0.5);
    container.add(nameText);

    if (isProperty) {
      const priceText = scene.add.text(0, 24, `${compactMoney(tile.price)}₫`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#075985',
      });
      priceText.setOrigin(0.5, 0.5);
      container.add(priceText);
    } else if (tile.type === 'TAX') {
      const taxText = scene.add.text(0, 22, `-${compactMoney(tile.amount)}₫`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#b3261e',
      });
      taxText.setOrigin(0.5, 0.5);
      container.add(taxText);
      const iconText = scene.add.text(0, -6, tileIcon(tile), { fontSize: '24px' });
      iconText.setOrigin(0.5, 0.5);
      container.add(iconText);
    } else {
      const iconText = scene.add.text(0, -8, tileIcon(tile), { fontSize: corner ? '28px' : '24px' });
      iconText.setOrigin(0.5, 0.5);
      container.add(iconText);
    }

    // --- lớp chủ sở hữu / nhà / thế chấp ---
    const ownerRing = scene.add.graphics();
    const buildings = scene.add.graphics();
    const mortgage = scene.add.graphics();
    container.add([ownerRing, buildings, mortgage]);
    ownerRing.setDepth(1);
    buildings.setDepth(1);
    mortgage.setDepth(2);

    tiles.set(id, {
      container,
      tile,
      bar,
      ownerRing,
      buildings,
      mortgage,
    });
  });

  /**
   * Cập nhật chủ sở hữu/nhà/thế chấp cho toàn bộ bất động sản từ state engine.
   * players: [{ id, color, properties:[id] }], propertyStates: { [id]: {level, mortgaged} }
   */
  function applyOwnership(players, propertyStates) {
    const states = propertyStates || {};
    tiles.forEach((refs, id) => {
      if (refs.tile.type !== 'PROPERTY') return;
      const state = states[String(id)] || {};
      const owner = (players || []).find((p) => Array.isArray(p.properties) && p.properties.includes(id));
      drawOwnerRing(refs.ownerRing, owner ? owner.color : null);
      drawBuildings(refs.buildings, Number(state.level) || 0);
      drawMortgageMarks(refs.mortgage, !!state.mortgaged);
    });
  }

  // --- hiệu ứng "ô vừa dừng / vừa đi qua" (chỉ hình ảnh, không state) ---
  const signalRects = new Set();

  function flashTile(id, style = 'landed') {
    const refs = tiles.get(id);
    if (!refs || !scene.add.tween) return;
    const g = scene.add.graphics();
    g.lineStyle(style === 'landed' ? 5 : 3, 0xf2b84b, 1);
    g.strokeRoundedRect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4, 10);
    g.setX(refs.container.x);
    g.setY(refs.container.y);
    g.setDepth(4);
    scene.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0 },
      duration: style === 'landed' ? 550 : 380,
      onComplete: () => {
        signalRects.delete(g);
        g.destroy();
      },
    });
    signalRects.add(g);
  }

  function clearSignals() {
    signalRects.forEach((g) => g && g.destroy());
    signalRects.clear();
  }

  function tilePoint(id) {
    return tileCenter(id);
  }

  return { applyOwnership, flashTile, clearSignals, tilePoint, tiles };
}

function tileIcon(tile) {
  return tile.icon || TYPE_ICON_FALLBACK[tile.type] || '';
}
