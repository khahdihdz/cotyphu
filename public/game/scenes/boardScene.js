// game/scenes/boardScene.js
// Scene bàn cờ 2D phong cách đảo nhiệt đới: trời xanh nhạt, biển xanh ngọc,
// đảo cỏ xanh có viền cát, vài đám mây trắng bồng bềnh và 40 ô từ BOARD.
// Scene KHÔNG chứa luật chơi và không giữ state game: mọi dữ liệu hiển thị
// được controller (phaserGame.js) đẩy xuống gồmBOARD + players + propertyStates.
import { BOARD_PIXELS } from '../render/boardLayout.js';
import { createBoardRenderer } from '../render/boardRenderer.js';
import { createPawnRenderer } from '../render/pawnRenderer.js';

const LOGO_ID = 'ctp-board';

export function createBoardSceneClass(Phaser, { board = [], tokenAssets = [], reducedMotion = false } = {}) {
  return class CtpBoardScene extends Phaser.Scene {
    constructor() {
      super(LOGO_ID);
      this.boardRenderer = null;
      this.pawnRenderer = null;
      this.clouds = [];
      this.opts = { board, tokenAssets, reducedMotion };
    }

    create() {
      const camera = this.cameras.main;
      camera.setBackgroundColor('#a9e4f7'); // trời xanh nhạt

      this.drawIsland();
      this.boardRenderer = createBoardRenderer(this, this.opts.board);
      this.pawnRenderer = createPawnRenderer(this, {
        useTextures: !!this.registry.get('ctp-webgl'),
      });

      this.fitCamera();
      this.scale.on('resize', this.fitCamera, this);
      this.events.once('shutdown', () => {
        this.scale.off('resize', this.fitCamera, this);
        this.pawnRenderer && this.pawnRenderer.destroyAll();
      });

      // Thông báo cho controller biết scene đã sẵn sàng.
      this.game.events.emit('ctp-board-ready', this);
    }

    /** Vẽ biển, đài đảo cát + cỏ, ao nhỏ và đám mây (đồ hoạ vẽ tay, không asset ngoài). */
    drawIsland() {
      const bg = this.add.graphics();
      bg.setDepth(0);
      // biển — phủ rộng hơn khung nhìn để nhìn khít ở mọi tỉ lệ
      const pad = BOARD_PIXELS * 0.9;
      bg.fillStyle(0x5cc8ee, 1);
      bg.fillRoundedRect(-pad, -pad, BOARD_PIXELS + pad * 2, BOARD_PIXELS + pad * 2, 180);
      // sóng nhẹ: vài đường cong sáng
      bg.lineStyle(4, 0x8fdcf5, 0.8);
      for (let y = 90; y < BOARD_PIXELS + 400; y += 190) {
        bg.beginPath();
        bg.moveTo(-120, y);
        bg.lineTo(BOARD_PIXELS + 120, y);
        bg.strokePath();
      }
      // cát & cỏ — tấm đảo bo tròn ngay dưới bàn cờ
      bg.fillStyle(0xf5e3b3, 1);
      bg.fillRoundedRect(30, 30, BOARD_PIXELS - 60, BOARD_PIXELS - 60, 60);
      bg.fillStyle(0x8fd46a, 1);
      bg.fillRoundedRect(46, 46, BOARD_PIXELS - 92, BOARD_PIXELS - 92, 52);
      // ao nhỏ nghiêng góc dưới trái (trang trí)
      bg.fillStyle(0x7bd4ee, 1);
      bg.fillEllipse(220, BOARD_PIXELS - 250, 200, 120);
      bg.fillStyle(0x9fe2f5, 1);
      bg.fillEllipse(220, BOARD_PIXELS - 265, 150, 70);

      // mây trắng — chậm, nhẹ; khi reduced motion thì đứng yên
      for (let i = 0; i < 4; i += 1) {
        const cloud = this.add.container(
          140 + i * 260,
          60 + (i % 2) * 150,
        );
        cloud.setDepth(3);
        const puffs = [[0, 0, 46], [40, 8, 34], [-40, 10, 32], [12, 16, 36]];
        puffs.forEach(([x, y, r]) => {
          const puff = this.add.circle(x, y, r, 0xffffff, 0.92);
          cloud.add(puff);
        });
        if (!this.opts.reducedMotion) {
          this.tweens.add({
            targets: cloud,
            x: `+=${40 + i * 6}`,
            duration: 14000 + i * 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          });
        }
        this.clouds.push(cloud);
      }

      // Bóng đổ mỏng dưới đảo tạo độ sâu nhẹ (không thay đổi dữ liệu ô).
      const g = this.add.graphics();
      g.setDepth(1);
      g.fillStyle(0x000000, 0.06);
      g.fillRect(46, BOARD_PIXELS - 52, BOARD_PIXELS - 92, 6);
    }

    fitCamera() {
      const w = this.scale.width || 1;
      const h = this.scale.height || 1;
      const zoom = Math.min(w, h) / BOARD_PIXELS;
      this.cameras.main.setZoom(zoom);
      this.cameras.main.centerOn(BOARD_PIXELS / 2, BOARD_PIXELS / 2);
      void this.boardRenderer; // đã vẽ theo toạ độ logic; camera lo scale toàn cục
    }

    /* ---------------- API cho controller ---------------- */

    applyOwnership(players, propertyStates) {
      this.boardRenderer && this.boardRenderer.applyOwnership(players, propertyStates);
    }

    flashTile(tileId, style) {
      this.boardRenderer && this.boardRenderer.flashTile(tileId, style);
    }

    clearSignals() {
      this.boardRenderer && this.boardRenderer.clearSignals();
    }

    applyTokens(players) {
      this.pawnRenderer && this.pawnRenderer.sync(players);
    }

    animateTokenMove(playerId, path) {
      return this.pawnRenderer
        ? this.pawnRenderer.moveAlong(playerId, path, { reducedMotion: this.opts.reducedMotion })
        : Promise.resolve();
    }
  };
}
