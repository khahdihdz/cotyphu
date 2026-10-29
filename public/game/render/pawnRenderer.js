// game/render/pawnRenderer.js
// Token người chơi trên nền Phaser: dùng ảnh token SVG gốc (/assets/tokens) khi
// WebGL rasterize được, fallback là hình tròn màu cùng tone. Token cùng một ô
// được lệch ngang dọc nhỏ để không che hoàn toàn nhau. Hoạt ảnh di chuyển đi
// theo "đường đi" các id ô đã nhận từ event engine (PLAYER_MOVED.path) của
// game.js — module không tự quyết định đích đến.
import { CELL, tileCenter } from './boardLayout.js';

const TOKEN_STEPS_MS = 150;      // thời gian mỗi bước đi (không phải engine timing)
const TOKEN_STEPS_REDUCED_MS = 60;

export const FALLBACK_TOKEN_COLORS = [
  '#F2B84B', '#3FC1C9', '#E85A4F', '#9B8CF2', '#6FCF97', '#F2994A',
];

export function createPawnRenderer(scene, { useTextures = false } = {}) {
  const pawns = new Map(); // playerId -> { obj, color }
  let groupCounter = 0;

  function slotOffsets(count, index) {
    // Bản dịch của cách xếp token trong ui.js: lệch ngang quanh tâm, hai hàng.
    const row = Math.floor(index / 3) - (count > 3 ? 0.5 : 0);
    const lateral = index % 3 - 1;
    return { dx: lateral * CELL * 0.16, dy: (row || 0) * CELL * 0.14 };
  }

  function makePawn(index, color) {
    const key = `ctp-token-${index}`;
    let obj;
    if (useTextures && scene.textures.exists(key)) {
      obj = scene.add.image(0, 0, key).setDisplaySize(CELL * 0.36, CELL * 0.36);
      obj.setOrigin(0.5, 0.62);
    } else {
      const g = scene.add.graphics();
      const hex = cssToHex(color);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 2, CELL * 0.19);
      g.fillStyle(hex, 1);
      g.fillCircle(0, 0, CELL * 0.16);
      g.lineStyle(3, 0x2b3648, 0.35);
      g.strokeCircle(0, 0, CELL * 0.16);
      obj = scene.add.container(0, 0);
      obj.add(g);
    }
    obj.setDepth(5);
    return obj;
  }

  /**
   * Đồng bộ danh sách token với danh sách người chơi (sự thật engine).
   * players: [{ id, color, position, bankrupt }] — thứ tự mảng là thứ tự token.
   */
  function sync(players) {
    const list = players || [];
    const seen = new Set();
    list.forEach((player, index) => {
      seen.add(player.id);
      let pawn = pawns.get(player.id);
      if (!pawn) {
        pawn = {
          obj: makePawn(index, player.color || FALLBACK_TOKEN_COLORS[index % FALLBACK_TOKEN_COLORS.length]),
        };
        pawns.set(player.id, pawn);
      }
      pawn.obj.setVisible(!player.bankrupt);
      if (!player.bankrupt) {
        const { dx, dy } = slotOffsets(list.length, index);
        const c = tileCenter(Number(player.position) || 0);
        pawn.obj.setPosition(c.x + dx, c.y + dy - CELL * 0.3);
      }
    });
    pawns.forEach((pawn, id) => {
      if (!seen.has(id)) {
        pawn.obj.destroy();
        pawns.delete(id);
      }
    });
    groupCounter = list.length;
  }

  /** Di chuyển token từng bước theo mảng id ô (path) — Promise khi xong. */
  function moveAlong(playerId, path, { reducedMotion = false } = {}) {
    const pawn = pawns.get(playerId);
    if (!pawn || !Array.isArray(path) || path.length < 2 || reducedMotion) {
      // reduced motion hoặc dữ liệu thiếu: đặt trực tiếp vị trí đích, không tween
      if (pawn && Array.isArray(path) && path.length) {
        const c = tileCenter(path[path.length - 1]);
        pawn.obj.setPosition(c.x, c.y - CELL * 0.3);
      }
      return Promise.resolve();
    }
    const stepMs = TOKEN_STEPS_MS;
    return new Promise((resolve) => {
      let i = 1;
      const step = () => {
        const c = tileCenter(path[i]);
        scene.tweens.add({
          targets: pawn.obj,
          x: c.x,
          y: c.y - CELL * 0.3,
          duration: stepMs,
          ease: 'Sine.InOut',
          onComplete: () => {
            i += 1;
            if (i < path.length) step();
            else resolve();
          },
        });
      };
      step();
    });
  }

  function destroyAll() {
    pawns.forEach((pawn) => pawn.obj.destroy());
    pawns.clear();
  }

  void groupCounter;
  return { sync, moveAlong, destroyAll };
}

function cssToHex(cssColor) {
  if (typeof cssColor !== 'string' || cssColor[0] !== '#') return 0xffffff;
  const n = parseInt(cssColor.slice(1), 16);
  return Number.isFinite(n) ? n : 0xffffff;
}
