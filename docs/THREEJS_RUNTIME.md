# Three.js local runtime

Three.js 0.179.1 và OrbitControls được cài bằng npm dependency và copy vào `public/vendor/three/` trong bước build.

- Runtime không cần tải core Three.js hoặc OrbitControls từ jsDelivr.
- `public/board3d.js` import module local, phù hợp Vercel static hosting và Cloudflare Assets.
- Bản quyền Three.js (MIT) được copy kèm tại `public/vendor/three/LICENSE`.
- Không sửa tay các file vendor; cập nhật phiên bản qua `package.json` rồi chạy build.
- Google Fonts vẫn là tài nguyên ngoài tùy chọn; font fallback hệ thống vẫn hoạt động khi CDN font không truy cập được.

Build kiểm tra sự tồn tại của bundle và OrbitControls trước khi hoàn tất.
