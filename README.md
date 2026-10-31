# 🎲 Cờ Tỷ Phú Online

Game Cờ Tỷ Phú nguyên bản chạy trên trình duyệt, hỗ trợ chơi offline với AI và multiplayer 2–4 người. Giao diện 3D Three.js, luật chơi tiếng Việt, tiền Việt Nam đồng và tương thích điện thoại, tablet, máy tính.

## Tính năng

- Bàn cờ 40 ô, tài sản, nhóm đất, nhà và khách sạn.
- Chơi offline với AI; lưu tiến trình cục bộ trên trình duyệt.
- Phòng online bằng mã 6 ký tự, 2–4 người, có thể điền AI.
- Server-authoritative: Cloudflare Durable Object quyết định xúc xắc, tiền, sự kiện, giao dịch và lượt.
- WebSocket đồng bộ, chat, reconnect và AI tiếp quản người chơi mất kết nối.
- Mua đất, thu tiền thuê, đấu giá, xây/bán nhà, thế chấp/chuộc lại, giao dịch, nhà giam, thẻ bài, phá sản và chiến thắng.
- Renderer Three.js tải khi vào bàn cờ; bàn cờ HTML là fallback khi WebGL/3D không khả dụng.
- Responsive và hỗ trợ `prefers-reduced-motion`.

## Kiến trúc triển khai mới

```text
Trình duyệt
  ├─ Vercel: frontend tĩnh (public/)
  │    ├─ HTML / CSS / JavaScript ES modules
  │    ├─ Three.js renderer
  │    └─ Offline game engine + AI
  │
  └─ HTTPS / WebSocket
       └─ Cloudflare Worker
            └─ Durable Object: GameRoom
                 ├─ trạng thái phòng và người chơi
                 ├─ xác thực hành động / luật chơi
                 ├─ AI online
                 └─ lưu trạng thái phòng trong DO storage
```

**Không cần** PHP hosting, MySQL, VPS hoặc Node.js chạy nền. Node.js chỉ dùng ở bước cài dependency, kiểm tra và build trên CI/Vercel. Cloudflare Durable Objects là backend multiplayer.

## Deploy production

### A. Cloudflare Worker (backend)

1. Import repository này vào Cloudflare Workers & Pages.
2. Giữ cấu hình `wrangler.toml` ở thư mục gốc.
3. Deploy Worker.
4. Ghi lại URL HTTPS dạng `https://<worker>.<account>.workers.dev`.

### B. Vercel (frontend)

1. Import cùng repository vào Vercel.
2. Framework Preset: **Other**.
3. Install Command: `npm install`.
4. Build Command: `npm run build`.
5. Output Directory: `public`.
6. Thêm Environment Variable:
   - `CTP_WORKER_URL` = URL HTTPS của Cloudflare Worker (không thêm `/ws` hay `/api`).
7. Deploy hoặc Redeploy.

Build script sẽ sinh `public/runtime-config.js` từ biến môi trường để frontend biết Worker endpoint. Hướng dẫn đầy đủ: [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md).

## Chạy local

```bash
npm install
npm run dev
```

Để test frontend với Worker đã deploy, đặt biến `CTP_WORKER_URL` trước khi build:

```bash
CTP_WORKER_URL=https://<worker>.<account>.workers.dev npm run build
```

## Cấu trúc chính

- `public/`: frontend, renderer 3D, offline game engine, AI và asset.
- `src/worker.js`: HTTP API và WebSocket routing.
- `src/gameRoom.js`: Durable Object, quản lý phòng và trạng thái authoritative.
- `src/gameLogic.js`: nguồn luật chơi chính.
- `src/ai.js`, `src/cards.js`: AI và bộ thẻ.
- `src/protocol.js`: giao thức client/server.
- `scripts/build.mjs`: kiểm tra dữ liệu/asset và sinh runtime config.
- `scripts/test-game.mjs`: kiểm thử luật chơi.
- `wrangler.toml`: cấu hình Worker và Durable Objects.
- `vercel.json`: cấu hình deploy frontend trên Vercel.

## Phát triển và kiểm thử

```bash
npm run check
npm run build
npm test
```

Online multiplayer cần hai client trình duyệt và một Worker đã deploy hoặc đang chạy qua Wrangler. Chỉ chạy unit test không thay thế kiểm thử WebSocket nhiều client.

## Tham khảo kiến trúc

Dự án tham khảo cách tổ chức module, quản lý vòng đời game, state machine và giao thức của [MineMonopoly](https://github.com/FatPaper-1874/mine-monopoly). Cotyphu không sao chép mã nguồn, tài nguyên, bản đồ hay nội dung độc quyền của dự án đó. Kiến trúc backend được giữ phù hợp với Cloudflare Workers + Durable Objects thay vì Express/MySQL/WebRTC P2P.

## Giấy phép

MIT. Tên đất, nhân vật, hình ảnh và nội dung trong game được xây dựng riêng; không sử dụng thương hiệu hoặc tài sản có bản quyền của trò chơi thương mại khác.
