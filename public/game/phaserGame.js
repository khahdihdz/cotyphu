// game/phaserGame.js
// Controller vòng đời của view Phaser: tạo/huỷ game, resize theo .board-wrap,
// và là điểm đẩy dữ liệu duy nhất từ game.js xuống scene. KHÔNG chứa luật chơi
// và KHÔNG tự sinh kết quả (xúc xắc/di chuyển chỉ render từ event engine).
import { createBootSceneClass } from './scenes/bootScene.js';
import { createBoardSceneClass } from './scenes/boardScene.js';
import { TOKEN_ASSETS } from '../ui.js';

export function createPhaserBoardController(Phaser, { reducedMotion = false } = {}) {
  let game = null;
  let boardScene = null;
  let readyPromise = null;
  let wrapEl = null;
  let resizeObserver = null;

  // Buffer dữ liệu nhận trước khi scene sẵn sàng — scene sẽ consume khi ready.
  const pending = { players: null, ownership: null };

  function boardSceneLookup() {
    if (!game) return null;
    const scenes = (game.scene && game.scene.scenes) || [];
    return scenes.find((s) => s && s.scene && s.scene.key === 'ctp-board' && s.boardRenderer) || null;
  }

  function fitCanvasSize() {
    const w = Math.max(1, Math.round((wrapEl && wrapEl.clientWidth) || 600));
    const h = Math.max(1, Math.round((wrapEl && wrapEl.clientHeight) || 600));
    return { w, h };
  }

  function drainState() {
    const scene = boardSceneLookup();
    if (!scene) return;
    if (pending.ownership) {
      scene.applyOwnership(pending.ownership.players, pending.ownership.states);
      pending.ownership = null;
    }
    if (pending.players) {
      scene.applyTokens(pending.players);
      pending.players = null;
    }
  }

  const controller = {
    /** Tạo Phaser.Game trong .board-wrap; trả Promise<boolean> (true nếu setup OK). */
    init(wrap, board) {
      wrapEl = wrap;
      const { w, h } = fitCanvasSize();
      const Boot = createBootSceneClass(Phaser, { tokenAssets: TOKEN_ASSETS });
      const Board = createBoardSceneClass(Phaser, { board, tokenAssets: TOKEN_ASSETS, reducedMotion });

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: w,
        height: h,
        parent: wrap,
        backgroundColor: '#a9e4f7',
        banner: false,
        audio: { noAudio: true },
        scene: [Boot, Board],
        render: { antialias: true, powerPreference: 'low-power' },
      });

      readyPromise = new Promise((resolve) => {
        const onReady = (scene) => {
          boardScene = scene;
          game.events.off('ctp-board-ready', onReady);
          drainState();
          resolve(true);
        };
        game.events.on('ctp-board-ready', onReady);
        // Game không sẵn sàng đúng hạn (WebGL/CANVAS lỗi thật sớm) → resolve false
        // để adapter quay về view DOM thay vì treo màn hình.
        setTimeout(() => {
          if (!boardScene) {
            try { game.destroy(true); } catch (_err) { /* noop */ }
            game = null;
            resolve(false);
          }
        }, 8000);
      });

      // Resize theo .board-wrap (portrait/landscape, xoay máy, thu phóng).
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => {
          if (!game) return;
          const { w, h } = fitCanvasSize();
          try { game.scale.resize(w, h); } catch (_err) { /* noop */ }
        });
        resizeObserver.observe(wrap);
      }
      return readyPromise;
    },

    renderOwnership(players, states) {
      pending.ownership = { players, states };
      drainState();
    },

    renderTokens(players) {
      pending.players = players;
      drainState();
    },

    async animateTokenMove(playerId, path) {
      const ok = await readyPromise;
      const scene = ok ? boardSceneLookup() : null;
      if (!scene) return;
      await scene.animateTokenMove(playerId, path);
    },

    flashTile(tileId, style) {
      const scene = boardSceneLookup();
      scene && scene.flashTile(tileId, style);
    },

    clearSignals() {
      const scene = boardSceneLookup();
      scene && scene.clearSignals();
    },

    destroy() {
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (_err) { /* noop */ }
        resizeObserver = null;
      }
      try { game && game.destroy(true); } catch (_err) { /* noop */ }
      game = null;
      boardScene = null;
      readyPromise = null;
      pending.players = null;
      pending.ownership = null;
      wrapEl = null;
    },
  };

  return controller;
}
