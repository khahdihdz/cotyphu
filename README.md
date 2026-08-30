# Cờ Tỷ Phú Web v1.0

Bản 1.0 playable bằng HTML5 Canvas, UI 100% tiếng Việt, offline với bot và multiplayer WebSocket.

## Chạy offline
Mở `client/index.html` bằng trình duyệt hiện đại. Không cần build step.

## Chạy multiplayer
Node.js 18+:

```bash
cd server
npm install
npm start
```

Sau đó mở `http://localhost:8080`.

## Tính năng
- Engine + state machine độc lập renderer
- 40 ô bàn cờ, mua đất, tiền thuê, nhóm màu, nhà/khách sạn
- Không mua đất => đấu giá
- AI bot: mua, đấu giá, xây, thế chấp, giao dịch
- Giao dịch tiền + đất + thẻ tùy thân
- Chance / Community Chest đầy đủ theo bộ 16 + 16 thẻ
- Double, 3 double vào tù, trả tiền/Double/thẻ để ra tù
- Thế chấp/chuộc thế chấp, phá sản
- Âm thanh WebAudio và hiệu ứng Canvas
- Menu phòng, tạo/join phòng, đồng bộ state server-authoritative
- Reconnect và snapshot state
- UI tiếng Việt, responsive mobile

`assets/asset-sheet-reference.png` là asset sheet tham chiếu từ bộ tài sản đã cung cấp; code có fallback vector/CSS để game chạy độc lập.
