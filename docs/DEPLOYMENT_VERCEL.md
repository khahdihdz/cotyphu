# Triển khai Cờ Tỷ Phú trên Vercel + Cloudflare Workers

Kiến trúc production được tách thành hai dịch vụ:

- **Vercel:** host frontend tĩnh trong `public/`; không chạy game server.
- **Cloudflare Workers:** REST endpoint và WebSocket gateway.
- **Durable Objects:** mỗi phòng là một GameRoom, lưu trạng thái ván trong SQLite-backed DO storage; không cần MySQL, VPS hoặc tiến trình nền.
- **Trình duyệt:** HTML/CSS/JavaScript và Three.js; offline AI tiếp tục chạy cục bộ.

## 1. Deploy backend Cloudflare

1. Mở Cloudflare Dashboard → Workers & Pages → Create → Import a repository.
2. Chọn repository `khahdihdz/cotyphu`.
3. Để Wrangler dùng `wrangler.toml` ở thư mục gốc.
4. Deploy Worker và kiểm tra endpoint `/api/create-room`.
5. Ghi lại URL HTTPS dạng `https://<worker>.<account>.workers.dev`.

Worker cần binding Durable Object `GAME_ROOM`, class `GameRoom` và migration SQLite đã khai báo trong `wrangler.toml`. Không đổi tên binding/class hoặc bỏ migration khi chưa có migration tương ứng.

## 2. Deploy frontend Vercel

1. Vercel → Add New → Project → Import Git Repository.
2. Chọn `khahdihdz/cotyphu`.
3. Dùng các thiết lập:
   - Framework Preset: Other
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `public`
4. Trong Project → Settings → Environment Variables, thêm:
   - Name: `CTP_WORKER_URL`
   - Value: URL HTTPS Worker ở bước 1, không thêm `/ws` hoặc `/api`.
   - Environments: Production, Preview (và Development nếu cần).
5. Redeploy để build tạo `public/runtime-config.js` với Worker URL.
6. Mở domain Vercel, thử chơi offline, tạo phòng và tham gia phòng bằng hai trình duyệt/thiết bị.

Không đặt secret Cloudflare trong Vercel frontend. `CTP_WORKER_URL` chỉ là địa chỉ công khai của Worker, không phải secret.

## 3. Cấu hình local

```bash
npm install
CTP_WORKER_URL=https://<worker>.<account>.workers.dev npm run build
npm run dev
```

Trên PowerShell:

```powershell
$env:CTP_WORKER_URL = "https://<worker>.<account>.workers.dev"
npm run build
npm run dev
```

Nếu không đặt biến, frontend dùng cùng origin để tương thích khi chạy bằng Wrangler hoặc PHP host cũ.

## 4. Kiểm tra sau deploy

- `/` tải giao diện và tài nguyên trong `public/`.
- `/runtime-config.js` được tạo ở build và chứa đúng Worker URL.
- `https://<worker>/api/create-room` trả JSON có `roomId`.
- WebSocket kết nối tới `wss://<worker>/ws?room=...`.
- Tạo phòng, tham gia từ client thứ hai, bắt đầu ván, tung xúc xắc và kiểm tra state đồng bộ.
- Reload/reconnect một client và xác minh người chơi được khôi phục.
- Kiểm tra offline AI khi không có mạng.

## 5. Giới hạn và bảo mật

- Vercel chỉ host frontend; không thay thế Durable Objects.
- Game state online phải tiếp tục được xác thực trong `src/gameRoom.js`; không chuyển quyền quyết định xúc xắc, tiền, giao dịch hoặc lượt chơi về client.
- Durable Object storage có thể giữ state phòng qua lần khởi động lại isolate; đây không phải cơ chế lưu hồ sơ/tài khoản lâu dài.
- CORS hiện tại của Worker đang mở rộng (`*`). Nếu cần giới hạn domain, bổ sung allowlist cho cả HTTP và WebSocket trước khi mở rộng public.
- Three.js/OrbitControls hiện tải từ jsDelivr; cần mạng để tải renderer 3D lần đầu. Bàn cờ HTML fallback vẫn là phương án dự phòng.
