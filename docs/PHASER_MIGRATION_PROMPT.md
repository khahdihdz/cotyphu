# Prompt triển khai nâng cấp Cờ Tỷ Phú Online bằng Phaser 3

> Dùng prompt này với coding agent có quyền đọc/ghi repository GitHub. Yêu cầu hiện tại là làm việc trực tiếp trên repository và nhánh `main`, không chỉ trả về code mẫu. Agent phải xác minh quyền truy cập và kết quả thật; không được bịa trạng thái commit, test, CI hay deploy.

## Mục tiêu

Bạn là Senior Game Developer chuyên Phaser 3, JavaScript ES Modules, HTML5, game board, responsive UI, Cloudflare Workers, Durable Objects, WebSocket và kiểm thử tự động. Nâng cấp dự án hiện có:

- Repository: https://github.com/khahdihdz/cotyphu
- Nhánh đích: `main`
- Tên game: **Cờ Tỷ Phú Online**
- Tiền trong game: Việt Nam đồng (₫)
- Nền tảng: trình duyệt trên PC, tablet và Android/iOS.
- Phong cách: bàn cờ 2D hoạt hình trên đảo nhiệt đới; cỏ xanh, biển xanh ngọc, trời xanh, mây trắng, nhà nhỏ dễ thương, màu tươi sáng và chữ dễ đọc.

## 1. Làm việc trực tiếp trên repository

1. Xác minh repository tồn tại, quyền đọc/ghi, nhánh mặc định, commit mới nhất, trạng thái CI và các Pull Request liên quan. Không giả định PR hoặc workflow vẫn còn tồn tại.
2. Đọc tối thiểu: `README.md`, `package.json`, `wrangler.toml`, `src/worker.js`, `src/gameRoom.js`, `src/gameLogic.js`, `src/ai.js`, `src/protocol.js`, `src/cards.js`, `public/index.html`, `public/game.js`, `public/ui.js`, `public/websocket.js`, `public/style.css`, các bản sao logic trong `public/`, `scripts/build.mjs`, `scripts/test-game.mjs` và các workflow thực sự có trong `.github/workflows/`.
3. Xác định frontend hiện tại, cấu trúc board, cách render token, các hành động UI và hợp đồng WebSocket trước khi chọn phương án tích hợp Phaser.
4. Vì người yêu cầu muốn làm trực tiếp trên `main`, chỉ commit lên `main` sau khi kiểm tra commit head hiện tại, thay đổi gần nhất, tính tương thích và kết quả test. Không force-push, không reset lịch sử, không xóa/ghi đè thay đổi chưa hiểu rõ. Nếu phát hiện thay đổi xung đột, branch protection hoặc CI đỏ, dừng ở bước an toàn và báo nguyên nhân; không lách bảo vệ nhánh.
5. Nếu công cụ chỉ hỗ trợ sửa file qua GitHub API và không thể chạy code trong môi trường thực thi, hãy nói rõ giới hạn trước khi tuyên bố đã kiểm thử. Không coi việc đọc source là đã chạy test.
6. Sau mỗi nhóm thay đổi, kiểm tra diff và các file liên quan. Giữ commit nhỏ, message mô tả đúng nội dung. Không tự động deploy production nếu chưa được cho phép rõ ràng.

## 2. Kiến trúc hiện có phải được bảo toàn

Không viết lại dự án từ đầu. Giữ Cloudflare Workers + Durable Objects + WebSocket hiện tại, backend authoritative và các tính năng đang hoạt động. Các module luật chơi và AI là nguồn nghiệp vụ; Phaser chỉ là tầng hiển thị và nhập liệu.

Các file quan trọng đã được nhận diện trong repository gồm `src/gameLogic.js`, `src/ai.js`, `src/gameRoom.js`, `src/protocol.js`, `public/game.js`, `public/ui.js`, `public/websocket.js`, `public/style.css`, `public/gameLogic.js`, `public/ai.js`, `public/protocol.js`, `scripts/build.mjs` và `scripts/test-game.mjs`. Xác minh lại đường dẫn và nội dung trên nhánh mới nhất trước khi sửa.

### Không được làm hỏng

- Bàn cờ 40 ô và dữ liệu `BOARD` hiện có là nguồn sự thật duy nhất cho vị trí, tên, loại ô, nhóm màu và giá.
- Chơi offline với AI, lưu tiến trình hiện có, tạo phòng, tham gia bằng mã phòng, sẵn sàng/bắt đầu ván, nhiều người chơi, chat và tự kết nối lại.
- Server là nơi quyết định xúc xắc, tiền, sự kiện, lượt chơi và giao dịch trong chế độ online. Client không được tự quyết định kết quả.
- Các luật hiện có: tiền khởi đầu, thưởng qua Xuất Phát, mua/bỏ qua đất, đấu giá, tiền thuê, thuế, thẻ Cơ Hội/Sự Kiện, nhà giam, đổ đôi, nhà/khách sạn, bán nhà, thế chấp/chuộc lại, giao dịch, phá sản và kết thúc ván.
- Giao thức WebSocket trong `src/protocol.js` và bản sao `public/protocol.js` phải đồng bộ. Nếu thay đổi logic hoặc AI trong `src/`, kiểm tra và đồng bộ các bản sao `public/` theo cách build hiện có.
- Hiển thị tiền bằng định dạng tiếng Việt, ví dụ `1.200.000 ₫`.

Không thay đổi luật, giá đất, tiền thưởng hoặc giao thức chỉ để thuận tiện cho hiệu ứng. Nếu phát hiện bug, viết test tái hiện, sửa tối thiểu và ghi rõ tác động.

## 3. Thiết kế và trải nghiệm

- Phong cách đảo nhiệt đới: nền biển xanh dịu, đảo/cỏ xanh, trời xanh nhạt, mây trắng, nhà nhỏ hoạt hình, đường đi rõ ràng.
- Màu sáng, thân thiện, có tương phản cao; tránh giao diện chủ đạo màu đen/tím tối, neon, gradient nặng hoặc glassmorphism quá mức.
- Tên đất, giá tiền, chủ sở hữu, token, nhà/khách sạn và các ô đặc biệt phải đọc được ở kích thước màn hình nhỏ.
- Bàn cờ 40 ô có bốn góc rõ ràng; giữ đúng thứ tự và tọa độ logic từ `BOARD`, không hard-code một bản board thứ hai.
- Dùng biểu tượng hoặc hình minh họa gốc cho Xuất Phát, Nhà Giam, Thuế, Cơ Hội, Sự Kiện, Bãi Nghỉ, Dịch Chuyển và Đi Tù.
- Token người chơi khác nhau về màu/hình; nhiều token ở cùng một ô không che lấp hoàn toàn nhau.
- Có hiệu ứng tung xúc xắc, di chuyển token theo đường đi, mua đất, thay đổi tiền, xây/bán nhà, sự kiện và kết thúc ván. Hiệu ứng chỉ phản ánh state/event đã được engine xác nhận; không được thay đổi luật hoặc state.
- Hỗ trợ `prefers-reduced-motion`, nút bật/tắt âm thanh nếu âm thanh được thêm vào, và không làm hiệu ứng nặng kéo dài.
- Responsive cho 320, 360, 375, 390, 414, 480, 576, 768, 992, 1200, 1400 và 1600 px; dùng được với chuột, bàn phím khi phù hợp và thao tác chạm. Không để bàn cờ, modal hoặc nút hành động bị cắt ở portrait/landscape.

## 4. Tích hợp Phaser 3

Trước tiên đánh giá liệu có thể thay lớp render DOM hiện tại bằng Phaser mà không phá các modal/form/chat hiện có. Ưu tiên phương án tích hợp tăng dần; không xóa UI đang chạy cho đến khi có đường thay thế được kiểm chứng.

Có thể dùng cấu trúc module tương đương:

- `public/game/PhaserGame.js`: tạo/huỷ game và quản lý resize.
- `public/game/scenes/BootScene.js`: khởi tạo, nạp asset, fallback khi asset lỗi.
- `public/game/scenes/BoardScene.js`: scene bàn cờ, đảo, tương tác và resize.
- `public/game/render/BoardRenderer.js`: render 40 ô dựa trên `BOARD`.
- `public/game/render/PawnRenderer.js`: token và hoạt ảnh di chuyển.
- `public/game/render/DiceRenderer.js`: hiệu ứng xúc xắc chỉ từ kết quả engine/server.
- `public/game/render/PropertyRenderer.js`: chủ sở hữu, nhà và khách sạn.
- `public/game/GameAdapter.js`: chuyển state/event của game logic hiện tại sang renderer và chuyển thao tác người dùng sang các handler hiện có.

Tên file chỉ là gợi ý; thích ứng với cấu trúc repository thực tế. Chọn phiên bản Phaser 3 tương thích, khóa dependency phù hợp và tránh thêm framework không cần thiết. Không nhân đôi luật chơi trong scene. Nếu không thể nạp Phaser từ dependency/build hiện tại, cấu hình lại theo cách tương thích với Cloudflare Assets và script build hiện có, rồi kiểm tra.

## 5. Tài nguyên và giấy phép

Ưu tiên hình SVG/Canvas tự vẽ hoặc asset miễn phí có giấy phép rõ ràng. Có thể tìm ở Kenney, OpenGameArt hoặc itch.io, nhưng phải kiểm tra giấy phép từng asset và ghi nguồn, giấy phép, đường dẫn trong `assets/ASSET_LICENSES.md`. Không lấy hình, logo, tên đất hay âm thanh từ trò chơi thương mại có bản quyền. Tránh phụ thuộc vào CDN bên ngoài để game vẫn chạy ổn định khi mạng yếu. Có fallback nếu asset không tải được.

## 6. Hiệu năng và bảo mật

- Không yêu cầu GPU AI để chơi game; phải hoạt động trên máy tính cấu hình phổ thông và điện thoại.
- Giảm tải texture, kích thước file, draw calls và timer; không chạy vòng lặp animation khi tab ẩn nếu không cần.
- Không đưa secret/token vào mã frontend, log hoặc file docs.
- Không giảm kiểm tra xác thực ở server để làm UI chạy được. Kiểm tra reconnect, gửi lặp hành động, dữ liệu sai định dạng và quyền thực hiện hành động theo lượt.
- Không thêm dịch vụ backend khác như Firebase/Supabase thay cho Workers/DO nếu chưa được yêu cầu.

## 7. Kiểm thử bắt buộc

Trước khi sửa, chạy các test hiện có và ghi lại kết quả baseline. Sau mỗi phần, chạy đúng các script tồn tại trong `package.json`; hiện repository có khai báo `npm run test` và `npm run build`, nhưng phải kiểm tra lại trước khi chạy. Không bịa kết quả.

Kiểm tra ít nhất:

1. Build/asset manifest và tất cả asset được tham chiếu tồn tại.
2. `BOARD` có đúng 40 ô; renderer hiển thị đủ 40 ô theo đúng ID, thứ tự và loại ô.
3. Xúc xắc, chuyển động, mua đất, trả tiền thuê, thuế, đấu giá, nâng cấp, thế chấp, nhà giam, giao dịch, phá sản và kết thúc ván vẫn do engine hiện tại xử lý.
4. Chơi offline với AI không bị treo lượt và vẫn lưu/khôi phục theo chức năng hiện có.
5. Online bằng tối thiểu hai client thật: tạo phòng, tham gia, sẵn sàng, bắt đầu, đồng bộ state, hành động, chat và reconnect.
6. Responsive trên các kích thước mục tiêu; không có lỗi nghiêm trọng trong console, lỗi import module, asset 404 hoặc event listener bị gắn lặp.
7. Kiểm tra accessibility cơ bản: focus, label, tương phản, nút chạm đủ lớn và reduced motion.
8. Chạy `git diff --check` nếu thao tác qua Git; xem diff cuối để phát hiện thay đổi ngoài ý muốn.

Nếu không thể chạy browser hoặc hai client, ghi rõ phần nào chưa xác minh và cung cấp các bước test thủ công. Không được đánh dấu multiplayer là PASS chỉ dựa trên đọc code.

## 8. Triển khai theo giai đoạn

1. **Audit và baseline:** kiểm tra repo, main, CI, PR, file, luật, UI và test hiện tại.
2. **Thiết kế tích hợp:** quyết định adapter và ranh giới giữa Phaser với DOM; viết ghi chú kiến trúc ngắn trước khi sửa.
3. **Bàn cờ:** render 40 ô theo `BOARD`, màu nhóm, tên, giá và ô đặc biệt.
4. **Token và state:** hiển thị token, chủ đất, nhà/khách sạn và trạng thái lượt.
5. **Hiệu ứng:** xúc xắc, di chuyển, sự kiện và tiền; không thay đổi kết quả engine.
6. **Offline và AI:** xác minh chơi hết lượt và lưu/khôi phục.
7. **Online:** xác minh đồng bộ server-authoritative, reconnect và tương thích giao thức.
8. **Responsive, accessibility và assets:** kiểm tra màn hình nhỏ, landscape, giấy phép và fallback.
9. **Test và commit:** chạy test/build, kiểm tra diff và CI; commit trực tiếp lên `main` chỉ khi mọi điều kiện an toàn đáp ứng và quyền ghi cho phép.
10. **Báo cáo:** nêu commit SHA/link thật, các file đã đổi, test thực sự đã chạy, trạng thái CI, phần chưa kiểm chứng và link preview/deploy chỉ khi đã xác minh.

## 9. Điều kiện hoàn thành

- Bàn cờ 2D phong cách đảo nhiệt đới hiển thị đủ 40 ô và dễ đọc.
- Luật chơi, AI offline, online multiplayer và backend hiện tại vẫn hoạt động.
- UI đáp ứng PC/tablet/mobile và các thao tác chính không bị che/cắt.
- Build/test thực tế đạt; hoặc mọi test chưa chạy được phải được ghi rõ, không che giấu.
- Không có secret bị commit, không có asset vi phạm giấy phép và không có thay đổi không liên quan.
- Báo cáo cuối bằng tiếng Việt, ngắn gọn, dựa trên bằng chứng.

**Cấm tuyệt đối:** tuyên bố đã hoàn thành khi mới lập kế hoạch; bịa commit/test/CI/PR/deploy; force-push; xóa lịch sử; bỏ qua branch protection; xóa luật/backend đang hoạt động; hoặc tự deploy production khi chưa được cho phép.
