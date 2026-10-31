// gameRoom.js
// Durable Object GameRoom: nguồn sự thật authoritative cho một phòng chơi.
import { C2S, S2C, ERROR_CODES, makeError } from './protocol.js';
import * as Game from './gameLogic.js';
import * as AI from './ai.js';

const MAX_PLAYERS = 4;
const DISCONNECT_GRACE_MS = 60_000;
const CHAT_RATE_LIMIT = { windowMs: 5000, max: 5 };
const MAX_CHAT_LEN = 500;

function genRoomSuffixSafe() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.sessions = new Map();
    this.game = null; this.aiRunning = false; this.auctionRunning = false; this.loaded = false;
  }

  async ensureLoaded() {
    if (this.loaded) return;
    this.game = await this.ctx.storage.get('game') || null;
    this.loaded = true;
  }
  async persist() { if (this.game) await this.ctx.storage.put('game', this.game); }

  async fetch(request) {
    await this.ensureLoaded();
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener('message', evt => this.onMessage(server, evt));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));
    const roomId = url.searchParams.get('room') || this.roomIdFallback();
    const name = (url.searchParams.get('name') || 'Người chơi').slice(0, 20);
    const wantCreate = url.searchParams.get('action') === 'create';
    const rejoinPlayerId = url.searchParams.get('playerId') || null;
    this.handleNewSession(server, roomId, name, wantCreate, rejoinPlayerId).catch(err => {
      this.safeSend(server, makeError(ERROR_CODES.UNKNOWN, { detail: String(err?.message || err) }));
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  roomIdFallback() { return this.game?.roomId || genRoomSuffixSafe(); }

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
      this.safeSend(ws, makeError(ERROR_CODES.ROOM_NOT_FOUND)); ws.close(1008, 'room not found'); return;
    }
    if (rejoinPlayerId) {
      const existing = this.game.players.find(p => p.id === rejoinPlayerId);
      if (existing) {
        existing.connected = true; delete existing.disconnectedAt;
        this.sessions.set(ws, { playerId: rejoinPlayerId, chatTimestamps: [] });
        this.safeSend(ws, { type: S2C.GAME_STATE, state: this.game, playerId: rejoinPlayerId });
        this.broadcast({ type: S2C.PLAYER_JOINED, playerId: rejoinPlayerId, reconnect: true });
        await this.persist(); return;
      }
    }
    if (this.game.phase !== 'LOBBY') {
      this.safeSend(ws, makeError(ERROR_CODES.GAME_ALREADY_STARTED)); ws.close(1008, 'already started'); return;
    }
    if (this.game.players.length >= MAX_PLAYERS) {
      this.safeSend(ws, makeError(ERROR_CODES.ROOM_FULL)); ws.close(1008, 'room full'); return;
    }
    const newId = crypto.randomUUID();
    const color = Game.PLAYER_COLORS[this.game.players.length % Game.PLAYER_COLORS.length];
    const player = Game.createPlayer({ id: newId, name, color });
    this.game.players.push(player); this.sessions.set(ws, { playerId: newId, chatTimestamps: [] });
    await this.persist();
    this.safeSend(ws, { type: S2C.ROOM_CREATED, roomId, playerId: newId, state: this.game });
    this.broadcast({ type: S2C.PLAYER_JOINED, playerId: newId, name });
    this.broadcastRoomUpdate();
  }

  safeSend(ws, payload) { try { ws.send(JSON.stringify(payload)); } catch (_) {} }
  broadcast(payload, exceptWs = null) {
    const msg = JSON.stringify(payload);
    for (const ws of this.sessions.keys()) { if (ws === exceptWs) continue; try { ws.send(msg); } catch (_) {} }
  }
  broadcastRoomUpdate() { this.broadcast({ type: S2C.ROOM_UPDATED, state: this.game }); }
  sessionFor(ws) { return this.sessions.get(ws); }

  async onMessage(ws, evt) {
    await this.ensureLoaded();
    const session = this.sessionFor(ws); if (!session) return;
    let msg;
    try { msg = JSON.parse(evt.data); } catch (_) { this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION)); return; }
    const playerId = session.playerId;
    switch (msg.type) {
      case C2S.PING: this.safeSend(ws, { type: S2C.PONG, t: msg.t }); return;
      case C2S.REQUEST_STATE: this.safeSend(ws, { type: S2C.GAME_STATE, state: this.game, playerId }); return;
      case C2S.READY: {
        const p = this.game.players.find(pl => pl.id === playerId); if (p) p.ready = !!msg.ready;
        this.broadcastRoomUpdate(); await this.persist(); return;
      }
      case C2S.START_GAME: {
        if (this.game.players[0]?.id !== playerId) {
          this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION, { detail: 'Chỉ chủ phòng mới có thể bắt đầu.' })); return;
        }
        if (msg.fillAI) this.fillAIToCapacity();
        const result = Game.startGame(this.game);
        if (!result.ok) { this.safeSend(ws, makeError(result.error)); return; }
        await this.persist(); this.broadcast({ type: S2C.GAME_STARTED, state: this.game }); this.runAILoop(); return;
      }
      case C2S.ROLL_DICE: return this.handlePlayerAction(() => Game.rollDice(this.game, playerId), ws);
      case C2S.BUY_PROPERTY: return this.handlePlayerAction(() => Game.buyProperty(this.game, playerId, 'BUY'), ws);
      case C2S.SKIP_PROPERTY: return this.handlePlayerAction(() => Game.buyProperty(this.game, playerId, 'SKIP'), ws);
      case C2S.UPGRADE_PROPERTY: return this.handlePlayerAction(() => Game.upgradeProperty(this.game, playerId, msg.tileId), ws);
      case C2S.DOWNGRADE_PROPERTY: return this.handlePlayerAction(() => Game.downgradeProperty(this.game, playerId, msg.tileId), ws);
      case C2S.MORTGAGE_PROPERTY: return this.handlePlayerAction(() => Game.mortgageProperty(this.game, playerId, msg.tileId), ws);
      case C2S.UNMORTGAGE_PROPERTY: return this.handlePlayerAction(() => Game.unmortgageProperty(this.game, playerId, msg.tileId), ws);
      case C2S.PAY_BAIL: return this.handlePlayerAction(() => Game.payBail(this.game, playerId), ws);
      case C2S.USE_JAIL_CARD: return this.handlePlayerAction(() => Game.useJailCard(this.game, playerId), ws);
      case C2S.AUCTION_BID: return this.handlePlayerAction(() => Game.auctionBid(this.game, playerId, msg.amount), ws);
      case C2S.AUCTION_PASS: return this.handlePlayerAction(() => Game.auctionPass(this.game, playerId), ws);
      case C2S.END_TURN: return this.handlePlayerAction(() => Game.endTurn(this.game, playerId), ws, true);
      case C2S.TRADE_OFFER: {
        await this.handlePlayerAction(() => Game.proposeTrade(this.game, playerId, {
          toId: msg.toId, giveProperties: msg.giveProperties || [], giveMoney: msg.giveMoney || 0,
          wantProperties: msg.wantProperties || [], wantMoney: msg.wantMoney || 0
        }), ws);
        await this.maybeRespondToTradeAsAI(); return;
      }
      case C2S.TRADE_RESPONSE: return this.handlePlayerAction(() => Game.respondTrade(this.game, playerId, !!msg.accept), ws);
      case C2S.CHAT: return this.handleChat(ws, session, playerId, msg.text);
      default: this.safeSend(ws, makeError(ERROR_CODES.INVALID_ACTION));
    }
  }

  fillAIToCapacity() {
    const personalities = ['CAUTIOUS', 'AGGRESSIVE', 'GREEDY', 'STRATEGIST', 'BALANCED', 'TACTICIAN'];
    let i = 0;
    while (this.game.players.length < MAX_PLAYERS) {
      const index = this.game.players.length;
      const personality = personalities[i % personalities.length];
      this.game.players.push(Game.createPlayer({
        id: crypto.randomUUID(), name: `AI ${personality}`, isAI: true, personality,
        color: Game.PLAYER_COLORS[index % Game.PLAYER_COLORS.length]
      }));
      i++;
    }
  }

  async handlePlayerAction(fn, ws, isEndTurn = false) {
    const result = fn();
    if (!result.ok) { this.safeSend(ws, makeError(result.error)); return; }
    this.broadcast(result.events ? { type: S2C.GAME_STATE, state: this.game, events: result.events } : { type: S2C.ROOM_UPDATED, state: this.game });
    AI.updateAIMemory(this.game); await this.persist();
    if (this.game.phase === 'ENDED') {
      this.broadcast({ type: S2C.GAME_OVER, winnerId: this.game.winnerId, state: this.game }); return;
    }
    if (isEndTurn || this.game.turnPhase === 'TURN_DONE') this.runAILoop();
    else if (this.game.turnPhase === 'AWAITING_AUCTION') this.runAuctionAI();
  }

  async runAuctionAI() {
    if (this.auctionRunning) return; this.auctionRunning = true;
    try {
      while (this.game?.turnPhase === 'AWAITING_AUCTION' && this.game.auction) {
        const actor = this.game.players.find(p => p.id === this.game.auction.currentTurnId);
        if (!actor?.isAI) break;
        this.broadcast({ type: S2C.AI_THINKING, playerId: actor.id });
        await sleep(AI.getThinkingDelay(actor.personality));
        if (!this.game.auction || this.game.auction.currentTurnId !== actor.id) continue;
        const d = AI.decideAuctionAction(this.game, actor, this.game.auction);
        const res = d?.action === 'BID' ? Game.auctionBid(this.game, actor.id, d.amount) : Game.auctionPass(this.game, actor.id);
        if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
        await this.persist();
      }
    } finally { this.auctionRunning = false; }
    if (this.game?.turnPhase === 'TURN_DONE') this.runAILoop();
  }

  async maybeRespondToTradeAsAI() {
    const offer = this.game?.pendingOffer; if (!offer) return;
    const p = this.game.players.find(x => x.id === offer.toId); if (!p?.isAI) return;
    await sleep(AI.getThinkingDelay(p.personality));
    if (!this.game.pendingOffer) return;
    const res = Game.respondTrade(this.game, p.id, AI.decideTradeResponse(this.game, p, offer));
    if (res.ok) this.broadcast({ type: S2C.GAME_STATE, state: this.game, events: res.events });
    await this.persist();
  }

  handleChat(ws, session, playerId, text) {
    if (typeof text !== 'string' || !text.trim()) return;
    const now = Date.now(); session.chatTimestamps = session.chatTimestamps.filter(t => now - t < CHAT_RATE_LIMIT.windowMs);
    if (session.chatTimestamps.length >= CHAT_RATE_LIMIT.max) { this.safeSend(ws, makeError(ERROR_CODES.RATE_LIMITED)); return; }
    session.chatTimestamps.push(now);
    const clean = text.slice(0, MAX_CHAT_LEN).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
    const player = this.game.players.find(p => p.id === playerId);
    this.broadcast({ type: S2C.CHAT_MESSAGE, playerId, name: player?.name || '???', text: clean, at: now });
  }

  onClose(ws) {
    const session = this.sessions.get(ws); this.sessions.delete(ws); if (!session || !this.game) return;
    const p = this.game.players.find(x => x.id === session.playerId); if (!p) return;
    p.connected = false; p.disconnectedAt = Date.now(); this.broadcast({ type: S2C.PLAYER_LEFT, playerId: p.id });
    this.persist(); this.scheduleDisconnectAlarm();
  }
  async scheduleDisconnectAlarm() {
    const current = await this.ctx.storage.getAlarm(), target = Date.now() + DISCONNECT_GRACE_MS + 500;
    if (!current || current > target) await this.ctx.storage.setAlarm(target);
  }
  async alarm() {
    await this.ensureLoaded(); if (!this.game) return;
    const now = Date.now(); let changed = false;
    for (const p of this.game.players) if (!p.connected && p.disconnectedAt && now - p.disconnectedAt >= DISCONNECT_GRACE_MS && !p.isAI) {
      p.isAI = true; p.personality = p.personality || Game.pickRandomPersonality(); p.aiTakeover = true; changed = true;
      this.broadcast({ type: S2C.CHAT_MESSAGE, playerId: 'system', name: 'Hệ thống', text: `${p.name} mất kết nối quá lâu, AI đã tiếp quản.`, at: now });
    }
    if (changed) { await this.persist(); this.broadcastRoomUpdate(); this.runAILoop(); }
  }

  async runAILoop() {
    if (this.aiRunning) return; this.aiRunning = true;
    try {
      while (this.game?.phase === 'PLAYING') {
        const p = this.game.players[this.game.turnIndex]; if (!p?.isAI) break;
        if (p.bankrupt && this.game.turnPhase !== 'TURN_DONE') break;
        this.broadcast({ type: S2C.AI_THINKING, playerId: p.id });
        await sleep(AI.getThinkingDelay(p.personality));
        if (this.game.turnPhase === 'AWAITING_ROLL' && p.inJail) {
          const action = AI.decideJailAction(this.game, p);
          const res = action === 'PAY_BAIL' ? Game.payBail(this.game,p.id) : action === 'USE_CARD' ? Game.useJailCard(this.game,p.id) : Game.rollDice(this.game,p.id);
          if (res.ok) this.broadcast({ type:S2C.GAME_STATE,state:this.game,events:res.events });
        } else if (this.game.turnPhase === 'AWAITING_ROLL') {
          const res = Game.rollDice(this.game,p.id); if (res.ok) this.broadcast({type:S2C.GAME_STATE,state:this.game,events:res.events});
        } else if (this.game.turnPhase === 'AWAITING_PROPERTY_DECISION') {
          const tile = Game.BOARD.find(t => t.id === this.game.pendingTileId); await sleep(400);
          const res = Game.buyProperty(this.game,p.id,tile ? AI.decideBuy(this.game,p,tile) : 'SKIP');
          if (res.ok) this.broadcast({type:S2C.GAME_STATE,state:this.game,events:res.events});
          if (this.game.turnPhase === 'AWAITING_AUCTION') { await this.persist(); await this.runAuctionAI(); continue; }
        } else if (this.game.turnPhase === 'TURN_DONE') {
          for (const tileId of AI.decideUpgrades(this.game,p)) {
            const res = Game.upgradeProperty(this.game,p.id,tileId); if (res.ok) this.broadcast({type:S2C.GAME_STATE,state:this.game,events:res.events});
            await sleep(300);
          }
          AI.updateAIMemory(this.game); const res = Game.endTurn(this.game,p.id);
          if (res.ok) this.broadcast({type:S2C.GAME_STATE,state:this.game,events:res.events});
          await this.persist();
          if (this.game.phase === 'ENDED') { this.broadcast({type:S2C.GAME_OVER,winnerId:this.game.winnerId,state:this.game}); break; }
        } else break;
        await this.persist();
      }
    } finally { this.aiRunning = false; }
  }
}
