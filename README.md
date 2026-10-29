# 🎲 Cờ Tỷ Phú Online

Webgame board game "mua đất – đầu tư – thu tiền" nhiều người chơi (2–4 người,
kết hợp Người + AI), chơi được trên điện thoại, tablet và PC. Lấy cảm hứng từ
thể loại board-game đầu tư bất động sản, **không** sử dụng thương hiệu, tên gọi
hay hình ảnh của bất kỳ trò chơi có bản quyền nào — toàn bộ tên đất, thẻ bài và
hình ảnh trong game là nội dung gốc.

## Tính năng

- **Chơi online nhiều người** (2–4 người, tạo phòng bằng mã 4 ký tự, hoặc kết
  hợp với AI để lấp đầy phòng).
- **Chơi offline** với AI ngay trên trình duyệt, không cần mạng, tự lưu tiến
  trình bằng `localStorage`.
- **Server authoritative**: mọi xúc xắc, tiền, sự kiện đều do server
  (Cloudflare Durable Object) quyết định — client không thể gian lận.
- **AI thực thụ**: 5 cá tính (CAUTIOUS, AGGRESSIVE, GREEDY, STRATEGIST,
  RANDOM), hệ thống chấm điểm tiện ích (utility scoring), có trí nhớ trong
  ván, độ trễ suy nghĩ tự nhiên (800–2500ms), và có thể phản hồi đề nghị
  giao dịch.
- **Giao dịch** tài sản + tiền giữa người chơi, được server xác thực.
- **Thế chấp / chuộc lại**: thế chấp đất trống (chưa xây nhà) để lấy tiền mặt
  ngay (50% giá đất), chuộc lại với lãi suất 10%. Đất thế chấp không thu được
  tiền thuê và không thể xây nhà cho tới khi chuộc lại.
- **Đấu giá**: bỏ qua một ô đất chưa ai sở hữu sẽ mở phiên đấu giá cho mọi
  người chơi (kể cả người vừa bỏ qua) thay vì để ô đó bỏ trống.
- **Luật Nhà Giam đầy đủ**: đổ đôi 3 lần liên tiếp bị bắt vào tù ngay; trong
  tù có thể thử đổ đôi, tự nguyện nộp phạt, hoặc dùng Thẻ Ra Tù Miễn Phí (rút
  được từ bộ bài Cơ Hội).
- **Bán nhà chủ động**: có thể bán bớt từng cấp nhà đã xây để lấy lại 50% chi
  phí xây, không chỉ tự động khi sắp phá sản.
- **Reconnect** tự động với exponential backoff (1s → 2s → 4s → 8s) và đồng
  bộ lại trạng thái; nếu mất kết nối quá 60 giây, AI tạm thời tiếp quản để
  ván chơi không bị treo.
- **Chat** trong phòng, có escape HTML và rate limit chống spam.
- **Responsive** từ 320px đến màn hình desktop lớn, tối ưu chạm (44×44px).

## Kiến trúc

```
Người chơi
   │  HTML5 / CSS3 / Vanilla JS (public/)
   ▼
Cloudflare Worker (src/worker.js)
   │  định tuyến /ws theo mã phòng
   ▼
Durable Object "GameRoom" (src/gameRoom.js)   ← nguồn sự thật duy nhất
   ├─ WebSocket sessions (nhiều người chơi)
   ├─ src/gameLogic.js  — luật chơi thuần (bàn cờ, xúc xắc, mua/thuê/nâng cấp,
   │                       giao dịch, phá sản, thắng thua)
   └─ src/ai.js         — AI: cá tính, utility scoring, trí nhớ, độ trễ
```

`src/gameLogic.js` và `src/ai.js` là **logic thuần, không phụ thuộc
Cloudflare/WebSocket**, nên được sao chép y hệt vào `public/` để chế độ
**Chơi Offline** chạy đúng luật y hệt chế độ online, ngay trên trình duyệt.
Nếu bạn sửa `src/gameLogic.js` hoặc `src/ai.js`, hãy chép đè sang bản trong
`public/` (và tương tự với `protocol.js`) để hai bên không lệch nhau.

### Cấu trúc thư mục

```
monopoly-webgame/
├── public/                # Frontend tĩnh — deploy thẳng qua Cloudflare Assets
│   ├── index.html
│   ├── style.css
│   ├── game.js            # điều phối UI ⇄ online/offline
│   ├── websocket.js        # kết nối + reconnect
│   ├── ui.js               # toàn bộ thao tác DOM/hiển thị
│   ├── gameLogic.js         # bản sao luật chơi (dùng cho chế độ offline)
│   ├── ai.js                 # bản sao AI (dùng cho chế độ offline)
│   ├── cards.js              # bản sao nguồn thẻ bài (gameLogic.js cần import)
│   ├── protocol.js            # bản sao hằng số giao thức
│   ├── game/                  # lớp hiển thị Phaser 3 (2D đảo nhiệt đới)
│   │   ├── gameAdapter.js      # chọn view: Phaser / DOM / 3D
│   │   ├── phaserGame.js       # vòng đời Phaser.Game + resize
│   │   ├── scenes/             # bootScene, boardScene
│   │   └── render/             # layout, board, property, pawn renderers
│   ├── vendor/phaser.esm.min.js # Phaser 3.90.0 vendor-local (không CDN, MIT)
│   └── assets/
├── src/
│   ├── worker.js           # entry point Cloudflare Worker
│   ├── gameRoom.js         # Durable Object — 1 phòng = 1 instance
│   ├── gameLogic.js         # luật chơi thuần (nguồn chính)
│   ├── ai.js                 # AI (nguồn chính)
│   └── protocol.js            # hằng số giao thức WebSocket (nguồn chính)
├── package.json
├── wrangler.toml
├── .gitignore
└── LICENSE
```

Vì `src/gameLogic.js` cần `src/cards.js`, bản sao trong `public/` bao gồm cả
`public/cards.js`. Toàn bộ 4 cặp file `gameLogic.js`, `ai.js`, `cards.js`,
`protocol.js` **phải giống hệt nhau hàng byte**, và `scripts/test-game.mjs`
kiểm tra điều này mỗi lần chạy test (sync-guard).

### Chế độ hiển thị bàn cờ

- **"2D hoạt hình trên đảo (Phaser)" (mặc định)**: bàn cờ 2D vẽ bằng Phaser 3
  vendor-local (`public/vendor/phaser.esm.min.js`, không dùng CDN) với phong
  cách đảo nhiệt đới. Bất động sản hiển thị vòng màu chủ sở hữu, nhà/khách sạn
  theo cấp, dấu thế chấp; token dùng ảnh SVG gốc có fallback; `prefers-reduced-
  motion` được tôn trọng. Chi tiết kiến trúc: `docs/PHASER_ARCHITECTURE.md`.
- **"Đảo 3D"**: view Three.js trước đó (cần tải lại trang sau khi đổi setting).
- **"Đơn giản (DOM)"**: bảng cờ DOM, phù hợp thiết bị rất yếu.

Giấy phép/ nguồn tài nguyên: `public/assets/ASSET_LICENSES.md`.

## Chạy local

```bash
npm install
npm run dev       # wrangler dev — mở URL được in ra terminal
```

`wrangler dev` chạy cả Worker, Durable Object và phục vụ `public/` cùng lúc
(nhờ khai báo `[assets]` trong `wrangler.toml`), nên bạn không cần chạy thêm
server nào khác.

## Đưa source lên GitHub

```bash
git init
git add .
git commit -m "Cờ Tỷ Phú Online — bản đầu tiên"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
git push -u origin main
```

## Import GitHub vào Cloudflare (deploy production)

Không cần chạy `wrangler login` / `wrangler deploy` thủ công — làm hoàn toàn
qua giao diện:

1. Đăng nhập **Cloudflare Dashboard** → **Workers & Pages** → **Create** →
   chọn **Import a repository** (Connect to Git).
2. Chọn repository GitHub vừa push ở bước trên, cấp quyền truy cập nếu được
   hỏi.
3. Cloudflare sẽ tự nhận diện `wrangler.toml` trong repo — giữ nguyên các giá
   trị mặc định (build command để trống, vì đây không phải project cần build
   bước trung gian).
4. Bấm **Save and Deploy**.
5. Sau khi deploy xong, Cloudflare cấp một domain dạng
   `co-ty-phu-online.<subdomain>.workers.dev` — mở domain đó để chơi.
6. Mỗi lần bạn `git push` lên nhánh `main`, Cloudflare sẽ tự động build & deploy
   lại (CI/CD tích hợp sẵn).
### Cấu hình Cloudflare Worker

`wrangler.toml` đã khai báo sẵn:

- `[assets]` — phục vụ toàn bộ `public/` làm site tĩnh, binding tên `ASSETS`.
- `[[durable_objects.bindings]]` — binding `GAME_ROOM` trỏ tới class
  `GameRoom`.
- `[[migrations]]` — khai báo Durable Object dùng storage kiểu SQLite (mặc
  định mới của Cloudflare, không cần cấu hình thêm).

### Cấu hình Durable Objects

Không cần tạo gì thêm thủ công trên Dashboard — Durable Object được cấp phát
tự động theo tên phòng (`idFromName(roomId)`) ngay khi có kết nối WebSocket
đầu tiên tới phòng đó.

### WebSocket

- Development: `ws://localhost:8787/ws?room=ABCD&name=...`
- Production: `wss://<domain-cua-ban>/ws?room=ABCD&name=...`

Client không cần biết `ws://` hay `wss://` — `public/websocket.js` tự chọn
theo `location.protocol`.

### Environment Variables

Bản hiện tại **không cần biến môi trường / secret nào**. Nếu sau này bạn thêm
tính năng cần secret (ví dụ giới hạn số phòng, webhook thông báo…), thêm bằng:

```bash
# chỉ dùng khi PHÁT TRIỂN THÊM tính năng cần secret — không bắt buộc để chạy game
npx wrangler secret put TEN_BIEN
```

hoặc qua Dashboard → Worker → **Settings → Variables**. Tuyệt đối không hard
code API key/secret vào source code.

### Troubleshooting

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| WebSocket báo lỗi 400 "Thiếu hoặc sai mã phòng" | URL `/ws` thiếu tham số `room` | Kiểm tra `public/websocket.js` có truyền đúng `room` |
| Vào phòng báo "Không tìm thấy phòng" | Mã phòng gõ sai, hoặc Durable Object storage đã bị reset | Tạo phòng mới |
| AI không tự đi | `runAILoop`/`aiRunning` bị kẹt do lỗi phía trước làm `this.game` null | Xem log Worker (`wrangler tail`), thường do exception chưa bắt ở một hành động trước đó |
| Mất kết nối liên tục không tự nối lại | Trình duyệt chặn WebSocket hoặc mạng chặn `wss://` | Kiểm tra tường lửa/mạng công ty, thử mạng khác |
| Static assets 404 | Thiếu khai báo `[assets]` trong `wrangler.toml` hoặc thư mục `public/` không được commit | Kiểm tra `wrangler.toml` và `.gitignore` |

## Ghi chú thiết kế

- Bàn cờ có 40 ô, xếp theo chu vi lưới 11×11 (tên ô, thẻ bài là nội dung gốc;
  lưới 11×11 có 4 ô góc: Xuất Phát, Nhà Giam, Bãi Nghỉ và Phố 30).
- Cấp thuê/nâng cấp được đơn giản hoá thành 5 cấp (0–4 nhà + khách sạn) để dễ
  bảo trì.
- Thế chấp/chuộc lại, đấu giá, luật Nhà Giam (đổ đôi 3 lần, nộp phạt, thẻ ra
  tù) và bán nhà chủ động đều nằm trong `gameLogic.js` (nguồn chính ở
  `src/`, sao chép y hệt sang `public/` cho chế độ offline) — không tách
  riêng module vì luật chơi có nhiều phụ thuộc chéo (vd. thế chấp chặn nâng
  cấp, phá sản tự động thế chấp trước khi tuyên bố phá sản).
- Đấu giá dùng cơ chế theo lượt (round-robin), người đang giữ giá cao nhất
  được bỏ qua trong vòng xoay cho tới khi có người trả cao hơn; phiên đấu giá
  kết thúc khi chỉ còn 1 người chưa rút. `gameRoom.js` (online) và `game.js`
  (offline) đều có vòng lặp AI đấu giá riêng (`runAuctionAI`), tách khỏi vòng
  lặp AI chính (`runAILoop`) vì người tham gia đấu giá không nhất thiết là
  người đang có lượt chơi.
- Khi một người chơi phá sản ngay trong lượt của chính họ (ví dụ không trả
  nổi tiền thuê sau khi đã bán nhà + thế chấp hết tài sản), vòng lặp AI vẫn
  cho phép họ gọi `endTurn()` một lần cuối để nhường lượt — nếu chặn hoàn
  toàn người chơi đã phá sản, `turnIndex` sẽ mắc kẹt vĩnh viễn ở người đó.
- Vì điều kiện thắng là "chỉ còn 1 người chưa phá sản", một ván có thể kéo
  rất dài (thậm chí gần như vô hạn) nếu 2 người chơi còn lại đều đủ giàu/đủ
  tài sản để thế chấp sống sót qua mọi khoản nợ — đây là đặc điểm của luật
  chơi (giống board-game gốc), không phải lỗi kỹ thuật.
- AI không được truy cập bất kỳ thông tin tương lai nào (xúc xắc, thẻ bài) —
  toàn bộ quyết định của AI chỉ dựa trên `state` hiện tại, giống một người
  chơi thật. AI có thêm logic riêng cho đấu giá (`decideAuctionAction`) và
  quyết định trong Nhà Giam (`decideJailAction`), tuỳ theo cá tính.
