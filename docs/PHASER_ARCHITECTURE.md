# Ghi chú kiến trúc — lớp hiển thị Phaser 3 (bàn cờ 2D đảo nhiệt đới)

> Ngày tạo: 29/10/2026. Áp dụng cho commit chuyển đổi view bàn cờ sang Phaser 3.

## Nguyên tắc bất biến

1. **Engine vẫn là nguồn sự thật duy nhất:** `src/gameLogic.js` (tương tự bản sao
   `public/gameLogic.js`) quyết định xúc xắc, tiền, sự kiện, lượt. Phaser chỉ
   **hiển thị** state/event đã được engine xác nhận và **gửi thao tác** người
   dùng về các handler hiện có (`game.js` → `Game.*` hoặc WebSocket).
2. **Không có bản board thứ hai:** tọa độ/loại ô/nhóm/giá suy ra trực tiếp từ
   mảng `BOARD` truyền vào renderer (`public/game/render/boardLayout.js` chỉ là
   hàm layout, không chứa dữ liệu ô).
3. **Không đổi luật/giá/giao thức** vì hiệu ứng. Sự kiện mới phía client chỉ là
   alias hiển thị cho event engine gửi ra (`PROPERTY_BOUGHT`, `RENT_PAID`,
   `AUCTION_BID`, `PLAYER_BANKRUPT`, `TRADE_ACCEPTED`…).

## Phân tầng

```
game.js (điều phối UI ⇄ engine/WS)
   │
   ├── UI (ui.js): HUD, ticker, dice chạm DOM, modals, chat, lobby ← giữ nguyên
   │
   └── game/gameAdapter.js  ← điểm chọn view duy nhất
         ├── 'phaser' (mặc định): game/phaserGame.js + game/scenes/* + game/render/*
         ├── 'dom': ui.initBoard như cũ (fallback toàn phần)
         └── '3d': island3d.js (cần reload trang) — DOM board vẫn cập nhật nền

phaserGame.js  : vòng đời Phaser.Game (tạo/huỷ/resize), buffer state khi scene chưa ready
scenes/bootScene.js    : nạp texture token SVG (WebGL); CANVAS/asset lỗi → fallback
scenes/boardScene.js   : vẽ biển/đảo/mây, lắp boardRenderer + pawnRenderer, fit camera
render/boardLayout.js  : layout 11×11 từ BOARD (giống tileGridPosition của ui.js)
render/boardRenderer.js: 40 ô (nền, thanh nhóm, tên, giá/icon) + highlight
render/propertyRenderer.js: chủ sở hữu (vòng màu), nhà/khách sạn, thế chấp
render/pawnRenderer.js : token (ảnh SVG hoặc hình tròn màu) + tween theo path engine
```

## Ranh giới được lựa chọn có chủ đích

- **Xúc xắc/PWA HUD vẫn là DOM**: `#board-center` (dice, nút Tung/Kết thúc lượt,
  panel đấu giá) và `#player-hud` nằm trên canvas — mọi chế độ dùng chung, không
  nhân đôi logic hiển thị. Không tạo `DiceRenderer` riêng cho Phaser vì DOM dice
  đã chạy tốt và là đường kiểm chứng sẵn.
- **Modals/form/chat/validation** hoàn toàn nằm ở DOM — Phaser không chạm vào.
- **Tokens chung nguồn**: 12 file token ở `public/assets/tokens/` được cả DOM
  (ui.js) và Phaser (bootScene texture) dùng; fallback hình tròn màu khi renderer
  là CANVAS hoặc asset lỗi.
- **Reduced motion**: `matchMedia('(prefers-reduced-motion: reduce)')` → tween di
  chuyển token đặt thẳng vị trí đích; mây/hoạt ảnh trang trí đứng yên.

## Hiệu năng

- Không WebGL API AI, không shader nặng; toàn bộ là Graphics + Text.
- Phaser `audio: noAudio`, không physics, scene duy nhất + boot.
- RAF tự dừng khi tab ẩn (browser / Phaser loop). Tween mây chỉ là 4 container,
  tắt khi reduced-motion.
- Token texture 96px, tối đa 12 texture nhỏ; không texture atlas lớn.

## Fallback chain

1. `setting-renderer === 'phaser'` (mặc định): thử Phaser; lỗi import/WebView/
   WebGL/CANVAS bất thường → chọn DOM board và đặt class `ctp-phaser-fallback`.
2. `dom`: bảng DOM cũ, thêm lớp nền (đã test từ trước).
3. `3d`: island3d.js — chỉ khi addon được chọn trước khi tải trang; thiếu
   Three.js/WebGL → class `ctp-3d-fallback`, hiển thị DOM board.

## Cài đặt người dùng

`localStorage['ctp_settings_v1'].renderer ∈ {'phaser','3d','dom'}` (mặc định
`'phaser'`). Đổi trong **Cài Đặt → Chế độ hiển thị bàn cờ**; Phaser↔DOM đổi ngay
lập tức; `3d` cần tải lại trang.

## Kiểm thử tự động hiện có

- `npm test` (`scripts/test-game.mjs`): engine 40 ô, luật nâng cấp/thế chấp,
  sync-guard `src/`↔`public/`, board.json khớp BOARD, smoke loop AI offline.
- `npm run build` (`scripts/build.mjs`): manifest asset + tồn tại/byte-size của
  Phaser vendor + module `public/game/`.
- Browser/multiplayer: xem "Kiểm thử thủ công chưa thể tự động hoá" trong báo
  cáo triển khai (chưa chạy được trong môi trường CI hiện tại).
