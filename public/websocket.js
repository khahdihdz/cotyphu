// websocket.js
// Quản lý kết nối WebSocket tới Cloudflare Worker: kết nối, tự động reconnect
// với exponential backoff (1s, 2s, 4s, 8s...), ping/pong giữ kết nối, và một
// cơ chế pub/sub đơn giản để game.js lắng nghe message từ server.
import { C2S } from './protocol.js';

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 8000, 8000];
const PING_INTERVAL_MS = 15000;

export class RoomConnection {
  constructor({ onMessage, onOpen, onClose, onReconnecting } = {}) {
    this.ws = null;
    this.url = null;
    this.onMessage = onMessage || (() => {});
    this.onOpen = onOpen || (() => {});
    this.onClose = onClose || (() => {});
    this.onReconnecting = onReconnecting || (() => {});
    this.reconnectAttempt = 0;
    this.pingTimer = null;
    this.shouldReconnect = false;
    this.playerId = null;
    this.roomId = null;
  }

  buildUrl({ room, name, action, playerId }) {
    const configured = window.CTP_CONFIG?.workerUrl || '';
    const endpoint = new URL(configured || location.origin, location.href);
    const proto = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ room, name });
    if (action) params.set('action', action);
    if (playerId) params.set('playerId', playerId);
    return `${proto}//${endpoint.host}${endpoint.pathname.replace(/\\/$/, '')}/ws?${params.toString()}`;
  }

  connect({ room, name, action, playerId }) {
    this.roomId = room;
    this.playerName = name;
    this.playerId = playerId || this.playerId;
    this.url = this.buildUrl({ room, name, action, playerId: this.playerId });
    this.shouldReconnect = true;
    this._open();
  }

  _open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this._startPing();
      this.onOpen();
    });

    ws.addEventListener('message', (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (_err) {
        return;
      }
      if (msg.playerId) this.playerId = msg.playerId;
      this.onMessage(msg);
    });

    ws.addEventListener('close', () => {
      this._stopPing();
      this.onClose();
      if (this.shouldReconnect) this._scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch (_err) {
        /* noop */
      }
    });
  }

  _scheduleReconnect() {
    const delay = BACKOFF_STEPS_MS[Math.min(this.reconnectAttempt, BACKOFF_STEPS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.onReconnecting(delay);
    setTimeout(() => {
      if (!this.shouldReconnect) return;
      this.url = this.buildUrl({ room: this.roomId, name: this.playerName, playerId: this.playerId });
      this._open();
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: C2S.PING, t: Date.now() });
    }, PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  disconnect() {
    this.shouldReconnect = false;
    this._stopPing();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_err) {
        /* noop */
      }
    }
  }
}
