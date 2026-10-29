# ASSET LICENSES — Cờ Tỷ Phú Online

Ghi chép nguồn + giấy phép của mọi tài nguyên dùng trong game. Toàn bộ hình
vẽ trong game là **nội dung gốc tự vẽ (SVG/text/Canvas)** — không lấy hình,
nhân vật, tên đất hay âm thanh từ bất kỳ trò chơi thương mại nào.

## Engine / thư viện

| Tài nguyên | Nguồn | Giấy phép | Đường dẫn |
|---|---|---|---|
| Phaser 3.90.0 (ESM bundle) | npm registry `phaser@3.90.0` (https://registry.npmjs.org/phaser/-/phaser-3.90.0.tgz), repo https://github.com/phaserjs/phaser | MIT © Phaser Studio | `public/vendor/phaser.esm.min.js` |

- Phaser được **vendor trực tiếp** vào repo (không nạp từ CDN) để game chạy ổn
  khi mạng yếu và hoạt động với Cloudflare Static Assets.
- Kiểm tra tính nguyên vẹn: `sha256 e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7`
  của `dist/phaser.min.js` từ tarball npm; ESM bundle đóng gói cùng tarball.
- Service worker (`public/sw.js`) và build check (`scripts/build.mjs`) kiểm tra
  sự tồn tại/đúng dung lượng của bundle trong shell cache.

## Artwork gốc (tự vẽ, thuộc dự án)

| Nhóm | Nội dung | Đường dẫn |
|---|---|---|
| Board | nền đảo, tâm bàn cờ, khung, ô Xuất Phát/Nhà Giam/Thuế/Cơ Hội/Sự Kiện | `public/assets/board/*.svg` |
| Buildings | 5 cấp nhà/khách sạn | `public/assets/buildings/*.svg` |
| Cards | minh hoạ 30 thẻ | `public/assets/cards/*.svg` |
| Characters | 8 nhân vật | `public/assets/characters/*.svg` |
| Effects | sheet hiệu ứng | `public/assets/effects/effects.svg` |
| Icons | icon PWA 192/512 | `public/assets/icons/*.svg` |
| Tokens | 12 token người chơi | `public/assets/tokens/*.svg` |
| UI | sheet UI | `public/assets/ui/ui.svg` |

Giấy phép toàn bộ artwork: cùng giấy phép dự án (MIT, xem `LICENSE` ở gốc repo).
Hiệu ứng bàn cờ Phaser 2D (biển, đảo, mây, nhà, highlight) được vẽ bằng
Graphics/Text của Phaser tại runtime trong `public/game/` — không cần file binary.

## Tài nguyên bên ngoài khác

| Tài nguyên | Nguồn | Giấy phép | Ghi chú |
|---|---|---|---|
| Fonts Baloo 2 / Be Vietnam Pro / JetBrains Mono | Google Fonts (CDN) | SIL OFL 1.1 | `<link>` trong `index.html`; nếu offline/mạng chặn thì font fallback hệ thống, game vẫn chạy |
| Three.js 0.180.0 | jsDelivr CDN | MIT | chỉ tải khi người dùng bật "Đảo 3D" (`setting-renderer === '3d'`); chế độ mặc định là Phaser 2D local |

## Quy tắc khi thêm asset mới

1. Ưu tiên tự vẽ SVG/Canvas hoặc asset có giấy phép rõ ràng (Kenney — CC0,
   OpenGameArt CC0/MIT, itch.io free-license) — kiểm tra từng asset, không tin
   nhãn miễn phí tổng thể.
2. Nếu asset ngoài là bắt buộc: thêm đây vào bảng + sót giấy phép + nguồn +
   đường dẫn, và cân nhắc vendor thẳng vào repo thay CDN.
3. Không thêm hình/nhạc/logo từ game có bản quyền (Monopoly, v.v.).
