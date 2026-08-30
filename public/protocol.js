// protocol.js
// Định nghĩa toàn bộ loại message dùng trong giao thức WebSocket.
// File này được giữ giống hệt bản sao ở public/protocol.js vì Worker (backend)
// và trang tĩnh (frontend) được build/deploy như hai bundle riêng biệt.
// Nếu bạn sửa file này, hãy sửa luôn public/protocol.js cho đồng bộ.

export const C2S = Object.freeze({
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  READY: 'READY',
  START_GAME: 'START_GAME',
  ROLL_DICE: 'ROLL_DICE',
  BUY_PROPERTY: 'BUY_PROPERTY',
  SKIP_PROPERTY: 'SKIP_PROPERTY',
  UPGRADE_PROPERTY: 'UPGRADE_PROPERTY',
  TRADE_OFFER: 'TRADE_OFFER',
  TRADE_RESPONSE: 'TRADE_RESPONSE',
  END_TURN: 'END_TURN',
  CHAT: 'CHAT',
  REQUEST_STATE: 'REQUEST_STATE',
  PING: 'PING',
});

export const S2C = Object.freeze({
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_UPDATED: 'ROOM_UPDATED',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  GAME_STARTED: 'GAME_STARTED',
  TURN_STARTED: 'TURN_STARTED',
  DICE_RESULT: 'DICE_RESULT',
  PLAYER_MOVED: 'PLAYER_MOVED',
  PROPERTY_OFFER: 'PROPERTY_OFFER',
  PROPERTY_PURCHASED: 'PROPERTY_PURCHASED',
  RENT_PAID: 'RENT_PAID',
  PROPERTY_UPGRADED: 'PROPERTY_UPGRADED',
  EVENT_TRIGGERED: 'EVENT_TRIGGERED',
  MONEY_CHANGED: 'MONEY_CHANGED',
  TRADE_PROPOSED: 'TRADE_PROPOSED',
  TRADE_RESOLVED: 'TRADE_RESOLVED',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  GAME_STATE: 'GAME_STATE',
  AI_THINKING: 'AI_THINKING',
  BANKRUPT: 'BANKRUPT',
  GAME_OVER: 'GAME_OVER',
  ERROR: 'ERROR',
  PONG: 'PONG',
});

export const ERROR_CODES = Object.freeze({
  INVALID_ACTION: 'INVALID_ACTION',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  WRONG_PHASE: 'WRONG_PHASE',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  PROPERTY_OWNED: 'PROPERTY_OWNED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  GAME_OVER: 'GAME_OVER',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN',
});

export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_ACTION]: 'Hành động không hợp lệ.',
  [ERROR_CODES.NOT_YOUR_TURN]: 'Chưa đến lượt của bạn.',
  [ERROR_CODES.WRONG_PHASE]: 'Không thể thực hiện hành động này lúc này.',
  [ERROR_CODES.INSUFFICIENT_FUNDS]: 'Bạn không đủ tiền.',
  [ERROR_CODES.PROPERTY_NOT_FOUND]: 'Không tìm thấy bất động sản.',
  [ERROR_CODES.PROPERTY_OWNED]: 'Bất động sản đã có chủ.',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'Không tìm thấy phòng.',
  [ERROR_CODES.ROOM_FULL]: 'Phòng đã đầy.',
  [ERROR_CODES.GAME_ALREADY_STARTED]: 'Ván chơi đã bắt đầu.',
  [ERROR_CODES.GAME_OVER]: 'Ván chơi đã kết thúc.',
  [ERROR_CODES.RATE_LIMITED]: 'Bạn thao tác quá nhanh, vui lòng thử lại.',
  [ERROR_CODES.UNKNOWN]: 'Đã xảy ra lỗi không xác định.',
});

export function makeError(code, extra) {
  return {
    type: S2C.ERROR,
    code,
    message: ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN],
    ...extra,
  };
}
