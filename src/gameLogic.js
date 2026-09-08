// gameLogic.js
// Engine thuần, dùng chung cho server authoritative và offline.

export const TILE_TYPES = Object.freeze({
  START:'START', PROPERTY:'PROPERTY', TAX:'TAX', CHANCE:'CHANCE', EVENT:'EVENT', BONUS:'BONUS', REST:'REST', JAIL:'JAIL', TELEPORT:'TELEPORT', GO_TO_JAIL:'GO_TO_JAIL'
});

export const START_MONEY = 5_000_000;
export const PASS_START_BONUS = 200_000;
export const MAX_HOUSE_LEVEL = 5; // 0: chưa xây, 1-4: nhà, 5: khách sạn
export const JAIL_TILE_ID = 10;
export const MAX_JAIL_TURNS = 3;
export const JAIL_BAIL_AMOUNT = 100_000;
export const MORTGAGE_INTEREST_RATE = 0.1;
export const DOUBLES_TO_JAIL = 3;
export const PLAYER_COLORS = ['#F2B84B','#3FC1C9','#E85A4F','#9B8CF2','#6FCF97','#F2994A'];

const P = (id,name,group,price,rent,upgradeCost) => ({id,type:TILE_TYPES.PROPERTY,name,group,price,rent,upgradeCost});
const S = (id,name) => ({id,type:TILE_TYPES.PROPERTY,name,group:'STATION',price:1_000_000,rent:[100_000,250_000,500_000,1_000_000],upgradeCost:0});
export const BOARD = Object.freeze([
  {id:0,type:TILE_TYPES.START,name:'Xuất Phát',icon:'🚩'},
  P(1,'Phố Hoa Sen','A',500_000,[50_000,100_000,200_000,400_000,800_000,1_000_000],250_000),
  {id:2,type:TILE_TYPES.CHANCE,name:'Cơ Hội',icon:'🎴'},
  P(3,'Phố Bình Minh','A',500_000,[50_000,100_000,200_000,400_000,800_000,1_000_000],250_000),
  {id:4,type:TILE_TYPES.TAX,name:'Thuế Thu Nhập',amount:200_000},
  S(5,'Ga Trung Tâm'),
  P(6,'Phố Biển Xanh','B',700_000,[70_000,140_000,280_000,560_000,1_120_000,1_400_000],350_000),
  {id:7,type:TILE_TYPES.EVENT,name:'Sự Kiện',icon:'✨'},
  P(8,'Phố Rừng Thông','B',700_000,[70_000,140_000,280_000,560_000,1_120_000,1_400_000],350_000),
  P(9,'Phố Hoàng Hôn','B',800_000,[80_000,160_000,320_000,640_000,1_280_000,1_600_000],400_000),
  {id:10,type:TILE_TYPES.JAIL,name:'Nhà Giam',icon:'🔒'},
  P(11,'Phố Kim Cương','C',900_000,[90_000,180_000,360_000,720_000,1_440_000,1_800_000],450_000),
  {id:12,type:TILE_TYPES.BONUS,name:'Ô May Mắn',icon:'🍀'},
  P(13,'Phố Ngọc Bích','C',900_000,[90_000,180_000,360_000,720_000,1_440_000,1_800_000],450_000),
  S(14,'Ga Đông'),
  P(15,'Phố Hồng Ngọc','C',1_000_000,[100_000,200_000,400_000,800_000,1_600_000,2_000_000],500_000),
  {id:16,type:TILE_TYPES.REST,name:'Bãi Nghỉ',icon:'🅿️'},
  P(17,'Phố Thạch Anh','D',1_100_000,[110_000,220_000,440_000,880_000,1_760_000,2_200_000],550_000),
  {id:18,type:TILE_TYPES.CHANCE,name:'Cơ Hội',icon:'🎴'},
  P(19,'Phố Lưu Ly','D',1_100_000,[110_000,220_000,440_000,880_000,1_760_000,2_200_000],550_000),
  P(20,'Phố Hoàng Gia','D',1_200_000,[120_000,240_000,480_000,960_000,1_920_000,2_400_000],600_000),
  {id:21,type:TILE_TYPES.TELEPORT,name:'Cổng Dịch Chuyển',icon:'🌀'},
  P(22,'Phố Tường Vy','E',1_300_000,[130_000,260_000,520_000,1_040_000,2_080_000,2_600_000],650_000),
  {id:23,type:TILE_TYPES.EVENT,name:'Sự Kiện',icon:'✨'},
  P(24,'Phố Lan Tím','E',1_300_000,[130_000,260_000,520_000,1_040_000,2_080_000,2_600_000],650_000),
  S(25,'Ga Tây'),
  P(26,'Phố Cẩm Tú','E',1_400_000,[140_000,280_000,560_000,1_120_000,2_240_000,2_800_000],700_000),
  {id:27,type:TILE_TYPES.TAX,name:'Thuế Tài Sản',amount:300_000},
  P(28,'Phố Hoàng Kim','F',1_600_000,[160_000,320_000,640_000,1_280_000,2_560_000,3_200_000],800_000),
  {id:29,type:TILE_TYPES.CHANCE,name:'Cơ Hội',icon:'🎴'},
  P(30,'Phố Kim Tự Tháp','F',1_800_000,[180_000,360_000,720_000,1_440_000,2_880_000,3_600_000],900_000),
  {id:31,type:TILE_TYPES.EVENT,name:'Sự Kiện',icon:'✨'},
  P(32,'Phố Mây Trắng','G',1_900_000,[190_000,380_000,760_000,1_520_000,3_040_000,3_800_000],950_000),
  P(33,'Phố Đại Dương','G',2_000_000,[200_000,400_000,800_000,1_600_000,3_200_000,4_000_000],1_000_000),
  {id:34,type:TILE_TYPES.BONUS,name:'Phần Thưởng',icon:'🎁'},
  P(35,'Phố Ngân Hà','G',2_200_000,[220_000,440_000,880_000,1_760_000,3_520_000,4_400_000],1_100_000),
  {id:36,type:TILE_TYPES.TAX,name:'Phí Dịch Vụ',amount:250_000},
  P(37,'Phố Mặt Trời','H',2_400_000,[240_000,480_000,960_000,1_920_000,3_840_000,4_800_000],1_200_000),
  {id:38,type:TILE_TYPES.EVENT,name:'Sự Kiện',icon:'✨'},
  {id:39,type:TILE_TYPES.GO_TO_JAIL,name:'Đi Tù',icon:'🚓'}
]);
export const BOARD_SIZE = BOARD.length;

export function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
export function rollTwoDice(){return [randInt(1,6),randInt(1,6)];}
export function mortgageValueOf(tile){return Math.floor(tile.price/2);}
export function unmortgageCostOf(tile){const v=mortgageValueOf(tile);return v+Math.ceil(v*MORTGAGE_INTEREST_RATE);}
export function getPropertyState(state,tileId){return state.propertyStates?.[String(tileId)]||{level:0,mortgaged:false};}
function setPropertyState(state,tileId,patch){const k=String(tileId);state.propertyStates[k]={...getPropertyState(state,tileId),...patch};}
function current(state){return state.players[state.turnIndex];}
function playerOf(state,id){return state.players.find(p=>p.id===id);}
function tileOf(id){return BOARD[id];}
function ownerOf(state,id){return state.players.find(p=>p.properties.includes(id));}
function log(state,text){state.log.push({text,turn:state.turnNumber,at:Date.now()});if(state.log.length>200)state.log.shift();}
function result(state,events=[]){return {ok:true,events};}
function fail(error){return {ok:false,error,events:[]};}
function movePath(from,steps){const path=[];let pos=from;for(let i=0;i<Math.abs(steps);i++){pos=(pos+(steps>=0?1:-1)+BOARD_SIZE)%BOARD_SIZE;path.push(pos);}return path;}
function changeMoney(state,p,delta,reason,events){p.money+=delta;events.push({type:'MONEY_CHANGED',playerId:p.id,delta,reason});}
function eliminateIfNeeded(state,p,events){if(p.money>=0||p.bankrupt)return false;p.bankrupt=true;for(const id of [...p.properties]){setPropertyState(state,id,{level:0,mortgaged:false});}p.properties=[];events.push({type:'PLAYER_BANKRUPT',playerId:p.id});log(state,`${p.name} đã phá sản.`);return true;}
function transfer(state,from,to,amount,reason,events){if(amount<=0)return;if(from.money<amount)amount=from.money;from.money-=amount;to.money+=amount;events.push({type:'TRANSFER',fromId:from.id,toId:to.id,amount,reason});}

export function createPlayer({id,name,isAI=false,personality=null,color}){return {id,name,isAI,personality:isAI?(personality||'RANDOM'):null,money:START_MONEY,position:0,properties:[],color,bankrupt:false,inJail:false,jailTurns:0,jailCards:0,connected:true,ready:false};}
export function createInitialState(roomId,players){return {roomId,phase:'LOBBY',board:BOARD,players,turnIndex:0,turnPhase:'AWAITING_ROLL',lastDice:null,doublesStreak:0,pendingTileId:null,pendingOffer:null,auction:null,winnerId:null,log:[],aiMemory:{},turnNumber:0,propertyStates:{},history:[]};}
export function startGame(state){if(state.phase!=='LOBBY')return fail('WRONG_PHASE');if(state.players.length<2||state.players.length>6)return fail('INVALID_ACTION');state.phase='PLAYING';state.turnIndex=0;state.turnNumber=1;state.turnPhase='AWAITING_ROLL';state.doublesStreak=0;state.pendingTileId=null;state.pendingOffer=null;state.auction=null;for(const p of state.players){p.money=START_MONEY;p.position=0;p.properties=[];p.bankrupt=false;p.inJail=false;p.jailTurns=0;p.jailCards=0;state.aiMemory[p.id]={knownRich:[],dangerZones:[],badInvestments:[],tradeHistory:[]};}log(state,`Ván chơi bắt đầu với ${state.players.length} người chơi.`);return result(state,[{type:'GAME_STARTED'}]);}
function sendToJail(state,p,events,reason){p.position=JAIL_TILE_ID;p.inJail=true;p.jailTurns=0;state.doublesStreak=0;events.push({type:'SENT_TO_JAIL',playerId:p.id,reason:reason||'RULE'});log(state,`${p.name} vào Nhà Giam.`);}
function movePlayer(state,p,steps,events,reason='DICE'){const path=movePath(p.position,steps);for(const pos of path)events.push({type:'MOVEMENT_STEP',playerId:p.id,position:pos});const old=p.position;p.position=path.length?path[path.length-1]:old;if(steps>0&&Math.floor((old+steps)/BOARD_SIZE)>0){changeMoney(state,p,PASS_START_BONUS,'PASS_START',events);log(state,`${p.name} đi qua Xuất Phát và nhận ${PASS_START_BONUS.toLocaleString('vi-VN')} ₫.`);}events.push({type:'PLAYER_MOVED',playerId:p.id,from:old,to:p.position,steps,path,reason});}
function payTax(state,p,amount,events){const paid=Math.min(p.money,Math.max(0,amount));p.money-=paid;events.push({type:'MONEY_CHANGED',playerId:p.id,delta:-paid,reason:'TAX'});log(state,`${p.name} nộp ${paid.toLocaleString('vi-VN')} ₫.`);eliminateIfNeeded(state,p,events);}
function applyCard(state,p,card,events){events.push({type:'CARD_DRAWN',playerId:p.id,card});const e=card.effect||{};if(Number.isFinite(e.money)&&e.money!==0)changeMoney(state,p,e.money,'CARD',events);if(e.jailCard)p.jailCards+=1;if(e.jail)sendToJail(state,p,events,'CARD');if(Number.isFinite(e.move)&&e.move!==0){movePlayer(state,p,e.move,events,'CARD_MOVE');resolveLanding(state,p,events,true);}if(e.teleport){const target=randInt(0,BOARD_SIZE-1);const steps=(target-p.position+BOARD_SIZE)%BOARD_SIZE;movePlayer(state,p,steps,events,'TELEPORT');}eliminateIfNeeded(state,p,events);}
const fallbackCards=[...Array(30)].map((_,i)=>({id:i+1,title:`Sự kiện ${i+1}`,description:'Một biến cố bất ngờ',icon:'🎴',effect:{money:i%2?100_000:-100_000}}));
function drawCard(state,p,type,events){const pool=state.cardDeck?.[type]||fallbackCards;const card=pool[randInt(0,pool.length-1)];applyCard(state,p,card,events);}
function resolveLanding(state,p,events,fromCard=false){const t=tileOf(p.position);events.push({type:'PROPERTY_LANDED',playerId:p.id,tileId:t.id});if(t.type===TILE_TYPES.PROPERTY){const owner=ownerOf(state,t.id);if(!owner){state.pendingTileId=t.id;state.turnPhase='AWAITING_PROPERTY_DECISION';}else if(owner.id!==p.id){const ps=getPropertyState(state,t.id);if(ps.mortgaged)return;const level=Math.min(ps.level,t.rent.length-1);const rent=t.rent[level];transfer(state,p,owner,rent,'RENT',events);events.push({type:'RENT_PAID',fromId:p.id,toId:owner.id,tileId:t.id,amount:rent});eliminateIfNeeded(state,p,events);}}else if(t.type===TILE_TYPES.TAX){payTax(state,p,t.amount,events);}else if(t.type===TILE_TYPES.CHANCE){drawCard(state,p,'CHANCE',events);}else if(t.type===TILE_TYPES.EVENT){drawCard(state,p,'EVENT',events);}else if(t.type===TILE_TYPES.BONUS){const bonus=300_000;changeMoney(state,p,bonus,'BONUS',events);events.push({type:'BONUS_RECEIVED',playerId:p.id,amount:bonus});}else if(t.type===TILE_TYPES.TELEPORT){const target=[1,6,11,17,22,28,33,37][randInt(0,7)];const steps=(target-p.position+BOARD_SIZE)%BOARD_SIZE;movePlayer(state,p,steps,events,'TELEPORT');resolveLanding(state,p,events,true);}else if(t.type===TILE_TYPES.GO_TO_JAIL){sendToJail(state,p,events,'GO_TO_JAIL');}}

export function rollDice(state,playerId){const p=current(state);if(!p||p.id!==playerId)return fail('NOT_YOUR_TURN');if(p.bankrupt)return fail('INVALID_ACTION');if(state.turnPhase!=='AWAITING_ROLL')return fail('WRONG_PHASE');const dice=rollTwoDice();state.lastDice=dice;const dbl=dice[0]===dice[1];const events=[{type:'DICE_RESULT',playerId,dice}];if(p.inJail){if(dbl){p.inJail=false;p.jailTurns=0;events.push({type:'JAIL_RELEASED',playerId});}else{p.jailTurns++;if(p.jailTurns>=MAX_JAIL_TURNS){p.inJail=false;p.jailTurns=0;p.money-=JAIL_BAIL_AMOUNT;events.push({type:'MONEY_CHANGED',playerId,delta:-JAIL_BAIL_AMOUNT,reason:'JAIL_BAIL'});}else{state.turnPhase='TURN_DONE';events.push({type:'JAIL_WAIT',playerId,turn:p.jailTurns});return result(state,events);}}}else{if(dbl)state.doublesStreak++;else state.doublesStreak=0;movePlayer(state,p,dice[0]+dice[1],events);if(state.doublesStreak>=DOUBLES_TO_JAIL){sendToJail(state,p,events,'THREE_DOUBLES');state.turnPhase='TURN_DONE';return result(state,events);}resolveLanding(state,p,events);}if(state.turnPhase!=='AWAITING_PROPERTY_DECISION')state.turnPhase='TURN_DONE';return result(state,events);}

export function buyProperty(state,playerId,decision){const p=current(state);if(!p||p.id!==playerId)return fail('NOT_YOUR_TURN');if(state.turnPhase!=='AWAITING_PROPERTY_DECISION')return fail('WRONG_PHASE');const tile=tileOf(state.pendingTileId);if(!tile||tile.type!==TILE_TYPES.PROPERTY)return fail('INVALID_ACTION');state.pendingTileId=null;if(decision==='BUY'){if(ownerOf(state,tile.id)||p.money<tile.price){state.pendingTileId=tile.id;return fail(p.money<tile.price?'INSUFFICIENT_FUNDS':'PROPERTY_OWNED');}p.money-=tile.price;p.properties.push(tile.id);setPropertyState(state,tile.id,{level:0,mortgaged:false});log(state,`${p.name} mua ${tile.name} với ${tile.price.toLocaleString('vi-VN')} ₫.`);state.turnPhase='TURN_DONE';return result(state,[{type:'PROPERTY_BOUGHT',playerId,tileId:tile.id,price:tile.price},{type:'MONEY_CHANGED',playerId,delta:-tile.price,reason:'BUY'}]);}if(decision==='SKIP'){state.auction={tileId:tile.id,highestBid:0,highestBidderId:null,participants:state.players.filter(x=>!x.bankrupt&&x.id!==p.id).map(x=>x.id),passedIds:[],currentTurnId:null};if(!state.auction.participants.length){state.turnPhase='TURN_DONE';return result(state,[{type:'PROPERTY_SKIPPED',playerId,tileId:tile.id}]);}state.auction.currentTurnId=state.auction.participants[0];state.turnPhase='AWAITING_AUCTION';return result(state,[{type:'AUCTION_STARTED',tileId:tile.id,participants:state.auction.participants}]);}return fail('INVALID_ACTION');}
function finishAuction(state,events){const a=state.auction;if(!a)return;const tile=tileOf(a.tileId);if(a.highestBidderId){const winner=playerOf(state,a.highestBidderId);if(winner&&winner.money>=a.highestBid){winner.money-=a.highestBid;winner.properties.push(tile.id);setPropertyState(state,tile.id,{level:0,mortgaged:false});events.push({type:'AUCTION_WON',playerId:winner.id,tileId:tile.id,amount:a.highestBid});}}else events.push({type:'AUCTION_ENDED',tileId:tile.id});state.auction=null;state.turnPhase='TURN_DONE';}
function advanceAuction(state){const a=state.auction;if(!a)return;const active=a.participants.filter(id=>!a.passedIds.includes(id)&&!playerOf(state,id)?.bankrupt);if(a.highestBidderId&&active.length===1&&active[0]===a.highestBidderId)return true;const idx=a.participants.indexOf(a.currentTurnId);for(let n=1;n<=a.participants.length;n++){const next=a.participants[(idx+n)%a.participants.length];if(!a.passedIds.includes(next)&&!playerOf(state,next)?.bankrupt){a.currentTurnId=next;return false;}}return true;}
export function auctionBid(state,playerId,amount){const a=state.auction,p=playerOf(state,playerId);if(state.turnPhase!=='AWAITING_AUCTION'||!a||!p||a.currentTurnId!==playerId)return fail('INVALID_ACTION');const n=Number(amount);const min=a.highestBid+Math.max(10_000,Math.ceil(tileOf(a.tileId).price*0.05));if(!Number.isSafeInteger(n)||n<min||n>p.money)return fail('INVALID_BID');a.highestBid=n;a.highestBidderId=playerId;const events=[{type:'AUCTION_BID',playerId,amount:n}];if(advanceAuction(state))finishAuction(state,events);else state.turnPhase='AWAITING_AUCTION';return result(state,events);}
export function auctionPass(state,playerId){const a=state.auction,p=playerOf(state,playerId);if(state.turnPhase!=='AWAITING_AUCTION'||!a||!p||a.currentTurnId!==playerId)return fail('INVALID_ACTION');if(!a.passedIds.includes(playerId))a.passedIds.push(playerId);const events=[{type:'AUCTION_PASS',playerId}];if(advanceAuction(state))finishAuction(state,events);return result(state,events);}
function groupComplete(state,p,tile){return BOARD.filter(t=>t.type===TILE_TYPES.PROPERTY&&t.group===tile.group).every(t=>p.properties.includes(t.id));}
export function upgradeProperty(state,playerId,tileId){const p=current(state);const t=tileOf(tileId);if(!p||p.id!==playerId||state.turnPhase!=='TURN_DONE')return fail('INVALID_ACTION');if(!t||t.type!==TILE_TYPES.PROPERTY||t.group==='STATION'||!p.properties.includes(tileId))return fail('INVALID_ACTION');const ps=getPropertyState(state,tileId);if(ps.mortgaged||ps.level>=4)return fail('INVALID_ACTION');if(!groupComplete(state,p,t))return fail('MONOPOLY_REQUIRED');if(p.money<t.upgradeCost)return fail('INSUFFICIENT_FUNDS');p.money-=t.upgradeCost;setPropertyState(state,tileId,{level:ps.level+1});return result(state,[{type:'PROPERTY_UPGRADED',playerId,tileId,level:ps.level+1,cost:t.upgradeCost},{type:'MONEY_CHANGED',playerId,delta:-t.upgradeCost,reason:'UPGRADE'}]);}
export function downgradeProperty(state,playerId,tileId){const p=current(state);const t=tileOf(tileId);if(!p||p.id!==playerId||state.turnPhase!=='TURN_DONE'||!t||!p.properties.includes(tileId))return fail('INVALID_ACTION');const ps=getPropertyState(state,tileId);if(ps.level<=0)return fail('INVALID_ACTION');const refund=Math.floor(t.upgradeCost/2);p.money+=refund;setPropertyState(state,tileId,{level:ps.level-1});return result(state,[{type:'PROPERTY_DOWNGRADED',playerId,tileId,level:ps.level-1,refund},{type:'MONEY_CHANGED',playerId,delta:refund,reason:'DOWNGRADE'}]);}
export function mortgageProperty(state,playerId,tileId){const p=current(state);const t=tileOf(tileId);if(!p||p.id!==playerId||!t||!p.properties.includes(tileId))return fail('INVALID_ACTION');const ps=getPropertyState(state,tileId);if(ps.mortgaged||ps.level>0)return fail('INVALID_ACTION');const value=mortgageValueOf(t);p.money+=value;setPropertyState(state,tileId,{mortgaged:true});return result(state,[{type:'PROPERTY_MORTGAGED',playerId,tileId,value},{type:'MONEY_CHANGED',playerId,delta:value,reason:'MORTGAGE'}]);}
export function unmortgageProperty(state,playerId,tileId){const p=current(state);const t=tileOf(tileId);if(!p||p.id!==playerId||!t||!p.properties.includes(tileId))return fail('INVALID_ACTION');const ps=getPropertyState(state,tileId);const cost=unmortgageCostOf(t);if(!ps.mortgaged||p.money<cost)return fail('INVALID_ACTION');p.money-=cost;setPropertyState(state,tileId,{mortgaged:false});return result(state,[{type:'PROPERTY_UNMORTGAGED',playerId,tileId,cost},{type:'MONEY_CHANGED',playerId,delta:-cost,reason:'UNMORTGAGE'}]);}
export function payBail(state,playerId){const p=current(state);if(!p||p.id!==playerId||!p.inJail||state.turnPhase!=='AWAITING_ROLL'||p.money<JAIL_BAIL_AMOUNT)return fail('INVALID_ACTION');p.money-=JAIL_BAIL_AMOUNT;p.inJail=false;p.jailTurns=0;return result(state,[{type:'JAIL_BAIL_PAID',playerId,amount:JAIL_BAIL_AMOUNT},{type:'MONEY_CHANGED',playerId,delta:-JAIL_BAIL_AMOUNT,reason:'JAIL_BAIL'}]);}
export function useJailCard(state,playerId){const p=current(state);if(!p||p.id!==playerId||!p.inJail||p.jailCards<1||state.turnPhase!=='AWAITING_ROLL')return fail('INVALID_ACTION');p.jailCards--;p.inJail=false;p.jailTurns=0;return result(state,[{type:'JAIL_CARD_USED',playerId}]);}
export function proposeTrade(state,fromId,offer){const from=playerOf(state,fromId);if(!from||from.bankrupt||state.pendingOffer)return fail('INVALID_ACTION');const to=playerOf(state,offer.toId);if(!to||to.bankrupt||to.id===from.id)return fail('INVALID_ACTION');const cleanIds=(ids,owner)=>[...new Set(Array.isArray(ids)?ids.map(Number).filter(Number.isInteger):[])].filter(id=>owner.properties.includes(id));const giveProperties=cleanIds(offer.giveProperties,from);const wantProperties=cleanIds(offer.wantProperties,to);const giveMoney=Math.max(0,Math.floor(Number(offer.giveMoney)||0));const wantMoney=Math.max(0,Math.floor(Number(offer.wantMoney)||0));if(giveMoney>from.money||giveProperties.length!==new Set(offer.giveProperties||[]).size||wantProperties.length!==new Set(offer.wantProperties||[]).size)return fail('INVALID_TRADE');state.pendingOffer={fromId,toId:to.id,giveProperties,giveMoney,wantProperties,wantMoney,createdAt:Date.now()};return result(state,[{type:'TRADE_PROPOSED',offer:state.pendingOffer}]);}
export function respondTrade(state,playerId,accept){const o=state.pendingOffer;if(!o||o.toId!==playerId)return fail('INVALID_ACTION');const events=[];if(!accept){state.pendingOffer=null;events.push({type:'TRADE_REJECTED'});return result(state,events);}const from=playerOf(state,o.fromId),to=playerOf(state,o.toId);if(!from||!to||from.money<o.giveMoney||to.money<o.wantMoney||o.giveProperties.some(id=>!from.properties.includes(id))||o.wantProperties.some(id=>!to.properties.includes(id)))return fail('INVALID_TRADE');for(const id of o.giveProperties){from.properties.splice(from.properties.indexOf(id),1);to.properties.push(id);}for(const id of o.wantProperties){to.properties.splice(to.properties.indexOf(id),1);from.properties.push(id);}from.money-=o.giveMoney;to.money+=o.giveMoney;to.money-=o.wantMoney;from.money+=o.wantMoney;state.pendingOffer=null;events.push({type:'TRADE_ACCEPTED',offer:o});return result(state,events);}
export const acceptTrade=(state,playerId)=>respondTrade(state,playerId,true);
export const rejectTrade=(state,playerId)=>respondTrade(state,playerId,false);
export function endTurn(state,playerId){const p=current(state);if(!p||p.id!==playerId)return fail('NOT_YOUR_TURN');if(state.turnPhase!=='TURN_DONE')return fail('WRONG_PHASE');if(p.bankrupt)return fail('INVALID_ACTION');if(state.phase==='ENDED')return fail('GAME_OVER');let next=state.turnIndex;for(let i=0;i<state.players.length;i++){next=(next+1)%state.players.length;if(!state.players[next].bankrupt)break;}state.turnIndex=next;state.turnNumber++;state.doublesStreak=0;state.turnPhase='AWAITING_ROLL';state.lastDice=null;const alive=state.players.filter(x=>!x.bankrupt);if(alive.length===1){state.phase='ENDED';state.winnerId=alive[0].id;return result(state,[{type:'GAME_OVER',winnerId:alive[0].id}]);}return result(state,[{type:'TURN_CHANGED',playerId:state.players[next].id,turnIndex:next}]);}
export function applyCardDeck(state,deck){state.cardDeck=deck;return state;}
