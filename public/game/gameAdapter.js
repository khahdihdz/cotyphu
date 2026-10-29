// game/gameAdapter.js
// Cầu nối duy nhất giữa game.js và lớp hiển thị bàn cờ/token. Chọn giữa 3 chế
// độ theo cài đặt người dùng (setting-renderer):
//   'phaser' → view 2D hoạt hình trên đảo nhiệt đới (mặc định; local, không CDN)
//   'dom'    → bảng cờ DOM như trước (fallback toàn phần)
//   '3d'     → island3d.js tự kích hoạt; DOM board vẫn hiển thị nền bên dưới
// Adapter chỉ chuyển dữ liệu engine (BOARD, players, propertyStates, path của
// event PLAYER_MOVED) sang renderer, và trả về Promise cho hoạt ảnh. Không
// chứa luật chơi, không tự quyết kết quả game.
import * as UI from '../ui.js';

const SETTINGS_KEY = 'ctp_settings_v1';

const REDUCED_MOTION =
  (typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches) || false;

let mode = 'dom';            // chế độ hiện tại của bàn cờ
let controller = null;       // PhaserBoardController (khi mode === 'phaser')
let runSeq = 0;              // tăng mỗi lần initBoard để bỏ kết quả chạy cũ
const SKIP = Symbol('ctp-init-skip');
let lastBoard = null;
let lastOwnershipArgs = null;
let lastTokensArgs = null;

export function getRendererSetting() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (raw.renderer === '3d') return '3d';
    if (raw.renderer === 'dom') return 'dom';
    return 'phaser';
  } catch (_err) {
    return 'phaser';
  }
}

/** Dựng view cho một ván/bàn cờ mới; luôn dựng DOM board làm fallback + a11y. */
export function initBoard(board) {
  lastBoard = board;
  mode = 'dom';
  destroyController();
  document.documentElement.classList.remove('ctp-phaser-view');
  document.documentElement.classList.remove('ctp-phaser-fallback');
  UI.initBoard(board);

  if (getRendererSetting() === 'phaser') {
    const wrap = document.querySelector('.board-wrap');
    const runId = ++runSeq;
    if (wrap) {
      import('../vendor/phaser.esm.min.js')
        .then((Phaser) =>
          import('./phaserGame.js').then((mod) => mod.createPhaserBoardController(Phaser, {
            reducedMotion: REDUCED_MOTION,
          })))
        .then((ctl) => {
          if (runId !== runSeq) { ctl.destroy(); throw SKIP; }
          controller = ctl;
          return ctl.init(wrap, board);
        })
        .then((ok) => {
          if (runId !== runSeq || !controller) return;
          if (ok) {
            mode = 'phaser';
            document.documentElement.classList.add('ctp-phaser-view');
            if (lastOwnershipArgs) controller.renderOwnership(...lastOwnershipArgs);
            if (lastTokensArgs) controller.renderTokens(...lastTokensArgs);
          } else {
            controller.destroy();
            document.documentElement.classList.add('ctp-phaser-fallback');
          }
        })
        .catch((error) => {
          if (error === SKIP) return;
          console.warn('Phaser view unavailable; falling back to DOM board.', error);
          destroyController();
          document.documentElement.classList.add('ctp-phaser-fallback');
        });
    }
  }
  // '3d': island3d.js tự đọc setting; adapter chỉ giữ DOM board cập nhật.
}

function destroyController() {
  if (controller) {
    try { controller.destroy(); } catch (_err) { /* noop */ }
  }
  controller = null;
}

/**
 * Người dùng đổi chế độ hiển thị ở Cài Đặt: Phaser↔DOM áp dụng ngay tại chỗ;
 * '3d' cần reload trang (island3d chỉ nạp lúc đầu) → trả về chế độ áp dụng.
 */
export async function reinitView() {
  const setting = getRendererSetting();
  if (!lastBoard) return setting;
  if (setting === '3d') {
    // DOM board làm nền; island3d.js chỉ hiển thị khi trang được nạp với setting 3d.
    return '3d-requires-reload';
  }
  initBoard(lastBoard);
  return setting;
}

/** Cập nhật chủ sở hữu/cấp nhà/thế chấp từ state engine. */
export function renderOwnership(board, players, state) {
  lastOwnershipArgs = [players, state ? state.propertyStates : {}];
  if (mode === 'phaser' && controller) controller.renderOwnership(...lastOwnershipArgs);
  // DOM + 3D luôn được cập nhật để có fallback nhất quán.
  UI.renderOwnership(board, players);
}

/** Đồng bộ token với danh sách người chơi engine. */
export function renderTokens(players) {
  lastTokensArgs = [players];
  if (mode === 'phaser' && controller) controller.renderTokens(...lastTokensArgs);
  UI.renderTokens(players);
}

/** Hoạt ảnh đi theo path của event PLAYER_MOVED (đích đến do engine quyết). */
export function animateTokenMove(playerId, path, opts = {}) {
  if (mode === 'phaser' && controller) {
    return controller.animateTokenMove(playerId, path, opts);
  }
  return UI.animateTokenMove(playerId, path, opts);
}

/** Xoá các vệt sáng "đó qua/đã dừng" trước một lần di chuyển mới. */
export function clearTileSignals() {
  if (mode === 'phaser' && controller) {
    try { controller.clearSignals(); } catch (_err) { /* noop */ }
  }
  UI.clearTileSignals();
}

/** Nhấn sáng ô đích (chỉ hình ảnh). */
export function flashTile(tileId, style) {
  if (mode === 'phaser' && controller) {
    try { controller.flashTile(tileId, style); } catch (_err) { /* noop */ }
  }
}
