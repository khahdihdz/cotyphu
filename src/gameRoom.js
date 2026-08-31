// gameRoom.js
// Durable Object "GameRoom" — mỗi phòng chơi (roomId) tương ứng với ĐÚNG MỘT
// instance của class này. Đây là nguồn sự thật duy nhất (authoritative) cho:
// game state, người chơi, lượt chơi, AI, tài sản, tiền, giao dịch, chat, reconnect.
import { C2S, S2C, ERROR_CODES, makeError } from './protocol.js';
import * as Game from './gameLogic.js';
import * as AI from './ai.js';

const DISCONNECT_GRACE_MS = 60_000; // 30-120s theo yêu cầu, chọn mốc giữa 60s
const CHAT_RATE_LIMIT = { windowMs: 5000, max: 5 };
const MAX_CHAT_LEN = 500;

function genRoomSuffixSafe() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {Map<WebSocket, {playerId: string, chatTimestamps: number[]}>} */
    this.sessions = new Map();
    this.game = null; // đã load từ storage khi cần
    this.aiRunning = false;
    this.auctionRunning = false;
    this.loaded = false;
  }

  async ensureLoaded() {
    if (this.loaded) return;
    const stored = await this.ctx.storage.get('game');
    this.game = stored || null;
    this.loaded = true;
  }

  async persist() {
    if (this.game) await this.ctx.storage.put('game', this.game);
  }

  async fetch(request) {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    server.addEventListener('message', (evt) => this.onMessage(server, evt));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    const roomId = url.searchParams.get('room') || this.roomIdFallback();
    const name = (url.searchParams.get('name') || 'Người chơi').slice(0, 20);
    const wantCreate = url.searchParams.get('action') === 'create';
    const rejoinPlayerId = url.searchParams.get('playerId') || null;

    this.handleNewSession(server, roomId, name, wantCreate, rejoinPlayerId).catch((err) => {
      this.safeSend(server, makeError(ERROR_CODES.UNKNOWN, { detail: String(err && err.message) }));
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  roomIdFallback() {
    return this.game?.roomId || genRoomSuffixSafe();
  }

  async handleNewSession(ws, roomId, name, wantCreate, rejoinPlayerId) {
    if (wantCreate && !this.game) {
      const hostId = crypto.randomUUID();
      const host = Game.createPlayer({ id: hostId, name, color: Game.PLAYER_COLORS[0] });
      this.game = Game.createInitialState(roomId, [host]);
      await this.persist();
      this.sessions.set(ws, { playerId: hostId, chatTimestamps: [] });
      this.safeSend(ws, { type: S2C.ROOM_CREATED, roomId, playerId: hostId, state: this.game });
      this.broadcastRoomUpdate();
      return;
    }

    if (!this.game) {
      this.safeSend(ws, makeError(ERROR_CODES.ROOM_NOT_FOUND));
      ws.close(1008, 'room not found');
      return;
    }

    // Reconnect: playerId đã tồn tại trong ván.
    if (rejoinPlayerId) {
      const existing = this.game.players.find((p) => p.id === rejoinPlayerId);
      if (existing) {
        existing.connected = true;
        delete existing.disconnectedAt;
        this.sessions.set(ws, { playerId: rejoinPlayerId, chatTimestamps: [] });
        this.safeSend(ws, { type: S2C.GAME_STATE, state: this.game, playerId: rejoinPlayerId });
        this.broadcast({ type: S2C.PLAYER_JOINED, playerId: rejoinPlayerId, reconnect: true });
        await this.persist();
        return;
      }
    }

    // Tham gia phòng mới (JOIN_ROOM ở màn hình lobby)
    if (this.game.phase !== 'LOBBY') {
      this.safeSend(ws, makeError(ERROR_CODES.GAME_ALREADY_STARTED));
      ws.close(1008, 'already started');
      return;
    }
    if (this.game.players.length >= 4) {
      this.safeSend(ws, makeError(ERROR_CODES.ROOM_FULL));
      ws.close(1008, 'room full');
      return;
    }
    const newId = crypto.randomUUID();
    const color = Game.PLAYER_COLORS[this.game.players.length];
    const player = Game.createPlayer({ id: newId, name, color });
    this.game.players.push(player);
    this.sessions.set(ws, { playerId: newId, chatTimestamps: [] });
    await this.persist();
    this.safeSend(ws, { type: S2C.ROOM_CREATED, roomId, playerId: newId, state: this.game });
    this.broadcast({ type: S2C.PLAYER_JOINED, playerId: newId, name });
    this.broadcastRoomUpdate();
  }

  safeSend(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (_err) {
      // socket có thể đã đóng; bỏ qua an toàn.
    }
  }

  broadcast(payload, exceptWs = null) {
    const msg = JSON.stringify(payload);
    for (const ws of this.sessions.keys()) {
      if (ws === exceptWs) continue;
      try {
        ws.send(msg);
      } catch (_err) {
        // ignore
      }
    }
  }

  broadcastRoomUpdate() {
    this.broadcast({ type: S2C.ROOM_UPDATED, state: this.game });
  }

  sessionFor(ws) {
    return this.sessions.get(ws);
  }

  async onMessage(ws, evt) {
    await this.ensureLoaded();
    const session = this.sessionFor(ws);
    if (!session) return;

    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (_err) {
      this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION));
      return;
    }

    const playerId = session.playerId;

    switch (msg.type) {
      case C2S.PING:
        this.safeSend(ws, { type: S2C.PONG, t: msg.t });
        return;

      case C2S.REQUEST_STATE:
        this.safeSend(ws, { type: S2C.GAME_STATE, state: this.game, playerId });
        return;

      case C2S.READY: {
        const p = this.game.players.find((pl) => pl.id === playerId);
        if (p) p.ready = !!msg.ready;
        this.broadcastRoomUpdate();
        await this.persist();
        return;
      }

      case C2S.START_GAME: {
        if (this.game.players[0]?.id !== playerId) {
          this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION, { detail: 'Chỉ chủ phòng mới có thể bắt đầu.' }));
          return;
        }
        if (msg.fillAI) {
          const personalities = ['CAUTIOUS', 'AGGRESSIVE', 'GREEDY', 'STRATEGIST'];
          let i = 0;
          while (this.game.players.length < 4) {
            const id = crypto.randomUUID();
            const color = Game.PLAYER_COLORS[this.game.players.length];
            const bot = Game.createPlayer({
              id,
              name: `AI ${personalities[i % personalities.length]}`,
              isAI: true,
              personality: personalities[i % personalities.length],
              color,
            });
            this.game.players.push(bot);
            i += 1;
          }
        }
        const result = Game.startGame(this.game);
        if (!result.ok) {
          this.safeSend(ws, makeError(result.error));
          return;
        }
        await this.persist();
        this.broadcast({ type: S2C.GAME_STARTED, state: this.game });
        this.runAILoop();
        return;
      }

      case C2S.ROLL_DICE: {
        this.handlePlayerAction(() => Game.rollDice(this.game, playerId), ws);
        return;
      }

      case C2S.BUY_PROPERTY: {
        this.handlePlayerAction(() => Game.buyProperty(this.game, playerId, 'BUY'), ws);
        return;
      }

      case C2S.SKIP_PROPERTY: {
        this.handlePlayerAction(() => Game.buyProperty(this.game, playerId, 'SKIP'), ws);
        return;
      }

      case C2S.UPGRADE_PROPERTY: {
        this.handlePlayerAction(() => Game.upgradeProperty(this.game, playerId, msg.tileId), ws);
        return;
      }

      case C2S.DOWNGRADE_PROPERTY: {
        this.handlePlayerAction(() => Game.downgradeProperty(this.game, playerId, msg.tileId), ws);
        return;
      }

      case C2S.MORTGAGE_PROPERTY: {
        this.handlePlayerAction(() => Game.mortgageProperty(this.game, playerId, msg.tileId), ws);
        return;
      }

      case C2S.UNMORTGAGE_PROPERTY: {
        this.handlePlayerAction(() => Game.unmortgageProperty(this.game, playerId, msg.tileId), ws);
        return;
      }

      case C2S.PAY_BAIL: {
        this.handlePlayerAction(() => Game.payBail(this.game, playerId), ws);
        return;
      }

      case C2S.USE_JAIL_CARD: {
        this.handlePlayerAction(() => Game.useJailCard(this.game, playerId), ws);
        return;
      }

      case C2S.AUCTION_BID: {
        this.handlePlayerAction(() => Game.auctionBid(this.game, playerId, msg.amount), ws);
        return;
      }

      case C2S.AUCTION_PASS: {
        this.handlePlayerAction(() => Game.auctionPass(this.game, playerId), ws);
        return;
      }

      case C2S.END_TURN: {
        this.handlePlayerAction(() => Game.endTurn(this.game, playerId), ws, true);
        return;
      }

      case C2S.TRADE_OFFER: {
        await this.handlePlayerAction(
          () =>
            Game.proposeTrade(this.game, playerId, {
              toId: msg.toId,
              giveProperties: msg.giveProperties || [],
              giveMoney: msg.giveMoney || 0,
              wantProperties: msg.wantProperties || [],
              wantMoney: msg.wantMoney || 0,
            }),
          ws
        );
        await this.maybeRespondToTradeAsAI();
        return;
      }

      case C2S.TRADE_RESPONSE: {
        this.handlePlayerAction(() => Game.respondTrade(this.game, playerId, !!msg.accept), ws);
        return;
      }

      case C2S.CHAT: {
        this.handleChat(ws, session, playerId, msg.text);
        return;
      }

      default:
        this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION));
    }
  }

  async handlePlayerAction(fn, ws, isEndTurn = false) {
    const result = fn();
    if (!result.ok) {
      this.safeSend(ws, makeError(result.error));
      return;
    }
    if (result.events) {
      this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: result.events });
    } else {
      this.broadcastRoomUpdate();
    }
    AI.updateAIMemory(this.game);
    await this.persist();
    if (isEndTurn) {
      this.runAILoop();
    } else if (this.game.turnPhase === 'AWAITING_AUCTION') {
      this.runAuctionAI();
    } else if (this.game.turnPhase === 'TURN_DONE') {
      // Người chơi vẫn cần tự bấm "Kết thúc lượt" trên UI; nếu là AI thì tự động.
      this.runAILoop();
    }
  }

  /**
   * Vòng lặp đấu giá: khi đến lượt một AI đấu giá (bất kể AI đó có phải người
   * đang chơi lượt chính hay không), tự động đấu giá hoặc rút lui. Dừng lại khi
   * đến lượt một người chơi thật, hoặc khi phiên đấu giá kết thúc.
   */
  async runAuctionAI() {
    if (this.auctionRunning) return;
    this.auctionRunning = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.game || this.game.turnPhase !== 'AWAITING_AUCTION' || !this.game.auction) break;
        const actor = this.game.players.find((p) => p.id === this.game.auction.currentTurnId);
        if (!actor || !actor.isAI) break;

        this.broadcast({ type: S2C.AI_THINKING, playerId: actor.id });
        await sleep(AI.getThinkingDelay(actor.personality));
        if (!this.game.auction || this.game.auction.currentTurnId !== actor.id) continue; // trạng thái đã đổi trong lúc chờ

        const decision = AI.decideAuctionAction(this.game, actor, this.game.auction);
        const res =
          decision && decision.action === 'BID'
            ? Game.auctionBid(this.game, actor.id, decision.amount)
            : Game.auctionPass(this.game, actor.id);
        if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
        await this.persist();
      }
    } finally {
      this.auctionRunning = false;
    }
    // Đấu giá đã xong (hoặc đến lượt người thật); nếu lượt chính đã TURN_DONE và
    // người chơi hiện tại là AI, tiếp tục vòng lặp AI chính để họ nâng cấp/kết thúc lượt.
    if (this.game && this.game.turnPhase === 'TURN_DONE') {
      this.runAILoop();
    }
  }

  async maybeRespondToTradeAsAI() {
    const offer = this.game?.pendingOffer;
    if (!offer) return;
    const toPlayer = this.game.players.find((p) => p.id === offer.toId);
    if (!toPlayer || !toPlayer.isAI) return;
    await sleep(AI.getThinkingDelay(toPlayer.personality));
    if (!this.game.pendingOffer) return; // đã bị huỷ/đổi trong lúc chờ
    const accept = AI.decideTradeResponse(this.game, toPlayer, offer);
    const res = Game.respondTrade(this.game, toPlayer.id, accept);
    if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
    await this.persist();
  }

  handleChat(ws, session, playerId, text) {
    if (typeof text !== 'string' || !text.trim()) return;
    const now = Date.now();
    session.chatTimestamps = session.chatTimestamps.filter((t) => now - t < CHAT_RATE_LIMIT.windowMs);
    if (session.chatTimestamps.length >= CHAT_RATE_LIMIT.max) {
      this.safeSend(ws, makeError(ERROR_CODES.RATE_LIMITED));
      return;
    }
    session.chatTimestamps.push(now);

    const clean = text
      .slice(0, MAX_CHAT_LEN)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const player = this.game.players.find((p) => p.id === playerId);
    this.broadcast({ type: S2C.CHAT_MESSAGE, playerId, name: player?.name || '???', text: clean, at: now });
  }

  onClose(ws) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (!session || !this.game) return;
    const player = this.game.players.find((p) => p.id === session.playerId);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = Date.now();
    this.broadcast({ type: S2C.PLAYER_LEFT, playerId: player.id });
    this.persist();
    this.scheduleDisconnectAlarm();
  }

  async scheduleDisconnectAlarm() {
    const current = await this.ctx.storage.getAlarm();
    const target = Date.now() + DISCONNECT_GRACE_MS + 500;
    if (!current || current > target) {
      await this.ctx.storage.setAlarm(target);
    }
  }

  async alarm() {
    await this.ensureLoaded();
    if (!this.game) return;
    const now = Date.now();
    let changed = false;
    for (const player of this.game.players) {
      if (!player.connected && player.disconnectedAt && now - player.disconnectedAt >= DISCONNECT_GRACE_MS) {
        if (!player.isAI) {
          player.isAI = true; // AI tiếp quản người chơi mất kết nối quá lâu
          player.personality = player.personality || Game.pickRandomPersonality();
          player.aiTakeover = true;
          changed = true;
          this.broadcast({ type: S2C.CHAT_MESSAGE, playerId: 'system', name: 'Hệ thống', text: `${player.name} mất kết nối quá lâu, AI đã tiếp quản.`, at: now });
        }
      }
    }
    if (changed) {
      await this.persist();
      this.broadcastRoomUpdate();
      this.runAILoop();
    }
  }

  /**
   * Vòng lặp AI: nếu người chơi hiện tại là AI, tự động thực hiện hành động
   * (roll -> buy/skip -> upgrade -> end turn) với độ trễ suy nghĩ tự nhiên.
   * Được bảo vệ bởi cờ `aiRunning` để tránh chạy song song nhiều lần.
   */
  async runAILoop() {
    if (this.aiRunning) return;
    this.aiRunning = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.game || this.game.phase !== 'PLAYING') break;
        const player = this.game.players[this.game.turnIndex];
        if (!player || !player.isAI) break;
        // Người chơi vừa phá sản trong lượt của chính mình (ví dụ không trả nổi tiền
        // thuê) vẫn cần được xử lý một lần cuối để gọi endTurn() và nhường lượt —
        // nếu không turnIndex sẽ mắc kẹt mãi mãi ở người chơi đã phá sản.
        if (player.bankrupt && this.game.turnPhase !== 'TURN_DONE') break;

        this.broadcast({ type: S2C.AI_THINKING, playerId: player.id });
        await sleep(AI.getThinkingDelay(player.personality));

        if (this.game.turnPhase === 'AWAITING_ROLL' && player.inJail) {
          const jailAction = AI.decideJailAction(this.game, player);
          if (jailAction === 'PAY_BAIL') {
            const res = Game.payBail(this.game, player.id);
            if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
          } else if (jailAction === 'USE_CARD') {
            const res = Game.useJailCard(this.game, player.id);
            if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
          } else {
            const res = Game.rollDice(this.game, player.id);
            if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
          }
        } else if (this.game.turnPhase === 'AWAITING_ROLL') {
          const res = Game.rollDice(this.game, player.id);
          if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
        } else if (this.game.turnPhase === 'AWAITING_PROPERTY_DECISION') {
          const tile = Game.BOARD.find((t) => t.id === this.game.pendingTileId);
          await sleep(400);
          const decision = tile ? AI.decideBuy(this.game, player, tile) : 'SKIP';
          const res = Game.buyProperty(this.game, player.id, decision);
          if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
          if (this.game.turnPhase === 'AWAITING_AUCTION') {
            await this.persist();
            await this.runAuctionAI();
            continue;
          }
        } else if (this.game.turnPhase === 'TURN_DONE') {
          const upgrades = AI.decideUpgrades(this.game, player);
          for (const tileId of upgrades) {
            const res = Game.upgradeProperty(this.game, player.id, tileId);
            if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
            await sleep(300);
          }
          AI.updateAIMemory(this.game);
          const endRes = Game.endTurn(this.game, player.id);
          if (endRes.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: endRes.events });
          await this.persist();
          if (this.game.phase === 'ENDED') {
            this.broadcast({ type: S2C.GAME_OVER, winnerId: this.game.winnerId, state: this.game });
            break;
          }
        } else {
          break; // AWAITING trade response từ người khác, v.v — chờ.
        }
        await this.persist();
      }
    } finally {
      this.aiRunning = false;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
