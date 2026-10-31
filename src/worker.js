// worker.js
// Điểm vào của Cloudflare Worker.
//   - /api/create-room  : sinh mã phòng ngẫu nhiên (không cần Durable Object nào
//                          được tạo trước — DO chỉ thực sự khởi tạo khi có kết nối
//                          WebSocket đầu tiên với action=create).
//   - /ws                : nâng cấp WebSocket, chuyển tiếp tới đúng Durable Object
//                          của phòng đó (idFromName(roomId)).
//   - còn lại            : phục vụ file tĩnh trong public/ qua Static Assets.
export { GameRoom } from './gameRoom.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm (I,O,0,1)

function randomRoomCode(len = 4) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return out;
}

function withCORS(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCORS(new Response(null, { status: 204 }));
    }

    if (url.pathname === '/api/create-room') {
      const roomId = randomRoomCode(6);
      return withCORS(
        new Response(JSON.stringify({ roomId }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (url.pathname === '/ws') {
      const roomId = (url.searchParams.get('room') || '').toUpperCase().trim();
      if (!roomId || roomId.length < 4 || roomId.length > 6) {
        return new Response('Thiếu hoặc sai mã phòng (room).', { status: 400 });
      }
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Static assets (public/) — yêu cầu binding "ASSETS" trong wrangler.toml.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
