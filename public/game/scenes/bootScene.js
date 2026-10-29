// game/scenes/bootScene.js
// Scene khởi động: nạp token SVG gốc (public/assets/tokens) như texture Phaser
// khi renderer là WebGL. Nếu renderer là CANVAS (thiết bị yếu/thiếu WebGL) hoặc
// token nào lỗi, PawnRenderer sẽ tự vẽ token hình tròn màu — game vẫn chạy
// không treo, không cần CDN bên ngoài nào.
export function createBootSceneClass(Phaser, { tokenAssets = [] } = {}) {
  return class CtpBootScene extends Phaser.Scene {
    constructor() {
      super('ctp-boot');
    }

    preload() {
      const hasWebGL = !!(this.game.renderer && this.game.renderer.type === Phaser.WEBGL);
      this.registry.set('ctp-webgl', hasWebGL);
      if (hasWebGL && tokenAssets.length) {
        tokenAssets.forEach((file, index) => {
          this.load.svg(`ctp-token-${index}`, {
            url: `assets/tokens/${file}`,
            width: 96,
            height: 96,
          });
        });
      }
      // Bỏ qua từng asset token lỗi — PawnRenderer tồn tại fallback hình tròn.
      this.load.on('loaderror', () => {});
    }

    create() {
      this.scene.start('ctp-board');
    }
  };
}
