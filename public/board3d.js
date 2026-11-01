import * as THREE from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';

const GROUP={A:'#e85a4f',B:'#f2b84b',C:'#3fc1c9',D:'#9b8cf2',E:'#5ec97a',F:'#f27db0',G:'#6fcf97',H:'#f2994a',STATION:'#8c97b8'};
const SPECIAL={START:'#d5a83d',TAX:'#d65d5d',CHANCE:'#8e79c8',EVENT:'#4f9baf',BONUS:'#54a77a',REST:'#718096',JAIL:'#bf7657',GO_TO_JAIL:'#bf5a5a',TELEPORT:'#6977ba'};
const grid=id=>id<=10?{r:11,c:11-id}:id<=20?{r:11-(id-10),c:1}:id<=30?{r:1,c:id-19}:{r:id-29,c:11};
const pos=(id,y=.15)=>{const p=grid(id);return new THREE.Vector3(p.c-6,y,p.r-6);};
const disposeObject=(root)=>root?.traverse?.(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>{m.map?.dispose();m.dispose();});else if(o.material){o.material.map?.dispose();o.material.dispose();}});
function labelMap(tile){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const x=c.getContext('2d');x.fillStyle='#fff8e8';x.fillRect(0,0,256,128);
  x.fillStyle='#263a48';x.textAlign='center';x.font='bold 25px sans-serif';
  x.fillText(String(tile.name||'').slice(0,22),128,48);x.font='bold 18px sans-serif';
  if(tile.price)x.fillText(new Intl.NumberFormat('vi-VN').format(tile.price)+' ₫',128,94);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export class Board3D {
  constructor(){
    this.host=null;this.scene=null;this.camera=null;this.renderer=null;this.controls=null;
    this.pawns=new Map();this.dice=[];this.tileMeshes=new Map();this.tileData=new Map();
    this.ownerMarkers=new Map();this.buildingGroups=new Map();this.buildingLevels=new Map();
    this.frame=0;this.observer=null;this.lastDice='';this.diceSpin=0;this.clock=new THREE.Clock();
    this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  mount(host,board){
    this.host=host;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#142b35');
    this.camera=new THREE.PerspectiveCamera(36,w/h,.1,100);this.camera.position.set(13,17,18);
    this.renderer=new THREE.WebGLRenderer({antialias:w>520,alpha:false,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<520?1.2:1.5));
    this.renderer.setSize(w,h,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=w>520;host.replaceChildren(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xe5f2ff,0x34443c,2));
    const sun=new THREE.DirectionalLight(0xffe0b0,2.5);sun.position.set(-7,15,8);
    sun.castShadow=w>520;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#10242c',roughness:.95}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.42;floor.receiveShadow=true;this.scene.add(floor);
    const base=new THREE.Mesh(new THREE.BoxGeometry(11.7,.48,11.7),new THREE.MeshStandardMaterial({color:'#805238',roughness:.72}));
    base.position.y=-.2;base.castShadow=true;base.receiveShadow=true;this.scene.add(base);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(11.82,.12,11.82),new THREE.MeshStandardMaterial({color:'#d6a84f',metalness:.62,roughness:.3}));
    trim.position.y=-.39;this.scene.add(trim);
    const inset=new THREE.Mesh(new THREE.BoxGeometry(11.35,.06,11.35),new THREE.MeshStandardMaterial({color:'#f0d7a0',metalness:.22,roughness:.5}));
    inset.position.y=.055;this.scene.add(inset);
    for(const tile of board)this.addTile(tile);
    const center=new THREE.Mesh(new THREE.BoxGeometry(7.7,.16,7.7),new THREE.MeshStandardMaterial({color:'#214653',roughness:.56,metalness:.12}));
    center.position.y=.12;center.castShadow=true;center.receiveShadow=true;this.scene.add(center);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.65,.055,10,96),new THREE.MeshStandardMaterial({color:'#e4b957',metalness:.68,roughness:.28}));
    ring.rotation.x=Math.PI/2;ring.position.y=.22;this.scene.add(ring);
    const plaque=document.createElement('canvas');plaque.width=1024;plaque.height=320;
    const ctx=plaque.getContext('2d');const grad=ctx.createLinearGradient(0,0,1024,320);grad.addColorStop(0,'#173b49');grad.addColorStop(.5,'#285c68');grad.addColorStop(1,'#173b49');
    ctx.fillStyle=grad;ctx.fillRect(0,0,1024,320);ctx.strokeStyle='#e7c16b';ctx.lineWidth=10;ctx.strokeRect(18,18,988,284);
    ctx.textAlign='center';ctx.fillStyle='#ffe4a0';ctx.font='bold 108px sans-serif';ctx.fillText('CỜ TỶ PHÚ',512,158);
    ctx.fillStyle='#d9edf0';ctx.font='bold 34px sans-serif';ctx.fillText('MUA ĐẤT • XÂY NHÀ • LÀM CHỦ CUỘC CHƠI',512,226);
    const plaqueTexture=new THREE.CanvasTexture(plaque);plaqueTexture.colorSpace=THREE.SRGBColorSpace;
    const plaqueMesh=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.68),new THREE.MeshStandardMaterial({map:plaqueTexture,roughness:.9}));
    plaqueMesh.rotation.x=-Math.PI/2;plaqueMesh.position.set(0,.215,0);this.scene.add(plaqueMesh);
    this.addDice();
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.minDistance=11;this.controls.maxDistance=25;this.controls.maxPolarAngle=Math.PI*.46;this.controls.enablePan=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.animate();
  }
  addTile(tile){
    const p=pos(tile.id),color=tile.type==='PROPERTY'?(GROUP[tile.group]||'#748494'):(SPECIAL[tile.type]||'#536879');
    const shadow=new THREE.Mesh(new THREE.BoxGeometry(.98,.28,.98),new THREE.MeshStandardMaterial({color:'#142d36',roughness:.9}));
    shadow.position.set(p.x,.13,p.z);this.scene.add(shadow);
    const box=new THREE.Mesh(new THREE.BoxGeometry(.94,.24,.94),new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.12}));
    box.position.copy(p);box.castShadow=true;box.receiveShadow=true;this.scene.add(box);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(.88,.88),new THREE.MeshStandardMaterial({color:'#fff4d9',roughness:.94}));
    top.rotation.x=-Math.PI/2;top.position.set(p.x,.273,p.z);this.scene.add(top);
    if(tile.type==='PROPERTY'){
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(.9,.045,.16),new THREE.MeshStandardMaterial({color,roughness:.42,metalness:.08}));
      stripe.position.set(p.x,.305,p.z-.34);this.scene.add(stripe);
    }
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.84,.42),new THREE.MeshStandardMaterial({map:labelMap(tile),transparent:true,roughness:1}));
    label.rotation.x=-Math.PI/2;label.position.set(p.x,.279,p.z+.07);this.scene.add(label);
    this.tileMeshes.set(tile.id,box);this.tileData.set(tile.id,tile);
  }
  createDie(){
    const group=new THREE.Group();
    const cube=new THREE.Mesh(new THREE.BoxGeometry(.68,.68,.68),new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.28,metalness:.02}));
    cube.castShadow=true;group.add(cube);
    const pipMaterial=new THREE.MeshStandardMaterial({color:'#263b49',roughness:.42});
    const faces=[
      {n:[0,1,0],u:[1,0,0],v:[0,0,-1],count:1},
      {n:[0,-1,0],u:[1,0,0],v:[0,0,1],count:6},
      {n:[0,0,1],u:[1,0,0],v:[0,1,0],count:2},
      {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],count:5},
      {n:[1,0,0],u:[0,0,-1],v:[0,1,0],count:3},
      {n:[-1,0,0],u:[0,0,1],v:[0,1,0],count:4}
    ];
    const layouts={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
    for(const face of faces){
      const n=new THREE.Vector3(...face.n),u=new THREE.Vector3(...face.u),v=new THREE.Vector3(...face.v);
      for(const [x,y] of layouts[face.count]){
        const pip=new THREE.Mesh(new THREE.SphereGeometry(.052,10,8),pipMaterial);
        pip.position.copy(n.clone().multiplyScalar(.345).add(u.clone().multiplyScalar(x*.17)).add(v.clone().multiplyScalar(y*.17)));
        group.add(pip);
      }
    }
    return group;
  }
  addDice(){
    for(let i=0;i<2;i++){
      const die=this.createDie();die.position.set(i?-.48:.48,.72,0);die.rotation.set(.18+i*.12,.3+i*.4,.12);die.castShadow=true;this.scene.add(die);this.dice.push(die);
    }
  }
  pawn(color){
    const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:color||'#e7a84b',metalness:.35,roughness:.32});
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(.23,.28,.12,20),m);foot.castShadow=true;g.add(foot);
    const body=new THREE.Mesh(new THREE.ConeGeometry(.19,.52,20),m);body.position.y=.31;body.castShadow=true;g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),new THREE.MeshStandardMaterial({color:'#fff0c8'}));
    head.position.y=.65;head.castShadow=true;g.add(head);return g;
  }
  createOwnerMarker(tileId,color,mortgaged){
    const marker=new THREE.Mesh(
      new THREE.SphereGeometry(.13,16,12),
      new THREE.MeshStandardMaterial({color:mortgaged?'#777777':(color||'#ffffff'),roughness:.35,metalness:.15})
    );
    const p=pos(tileId,.43);marker.position.set(p.x+.31,p.y,p.z+.31);marker.castShadow=true;
    this.scene.add(marker);return marker;
  }
  createBuildings(tileId,level,color){
    if(!level)return null;
    const group=new THREE.Group(),p=pos(tileId,.29);
    group.position.set(p.x,p.y,p.z);
    const houseMaterial=new THREE.MeshStandardMaterial({color:color||'#f4e8c8',roughness:.72});
    const roofMaterial=new THREE.MeshStandardMaterial({color:'#bd5949',roughness:.65});
    if(level>=5){
      const body=new THREE.Mesh(new THREE.BoxGeometry(.34,.32,.3),houseMaterial);body.position.y=.19;body.castShadow=true;group.add(body);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(.27,.2,4),roofMaterial);roof.rotation.y=Math.PI/4;roof.position.y=.45;roof.castShadow=true;group.add(roof);
    }else{
      for(let i=0;i<Math.min(4,level);i++){
        const house=new THREE.Group();const x=(i%2)*.25-.125,z=Math.floor(i/2)*.23-.115;
        const body=new THREE.Mesh(new THREE.BoxGeometry(.17,.16,.16),houseMaterial);body.position.y=.1;body.castShadow=true;house.add(body);
        const roof=new THREE.Mesh(new THREE.ConeGeometry(.13,.12,4),roofMaterial);roof.rotation.y=Math.PI/4;roof.position.y=.24;roof.castShadow=true;house.add(roof);
        house.position.set(x,0,z);group.add(house);
      }
    }
    this.scene.add(group);return group;
  }
  update(state){
    if(!state||!this.scene)return;
    const alive=new Set(),owners=new Map();
    for(const player of state.players||[]){
      if(player.bankrupt)continue;
      for(const tileId of player.properties||[])owners.set(tileId,player);
    }
    for(const [i,player] of (state.players||[]).entries()){
      if(player.bankrupt)continue;
      alive.add(player.id);
      let pawn=this.pawns.get(player.id);
      if(!pawn){pawn=this.pawn(player.color);this.pawns.set(player.id,pawn);this.scene.add(pawn);}
      const at=pos(player.position,.46);
      const same=(state.players||[]).filter(x=>!x.bankrupt&&x.position===player.position);
      const offset=(same.findIndex(x=>x.id===player.id)-(same.length-1)/2)*.18;
      pawn.userData.target=new THREE.Vector3(at.x+offset,at.y,at.z+offset);
      if(pawn.userData.target && pawn.position.lengthSq()===0)pawn.position.copy(pawn.userData.target);
    }
    for(const [id,pawn] of this.pawns)if(!alive.has(id)){this.scene.remove(pawn);disposeObject(pawn);this.pawns.delete(id);}
    for(const [tileId,tile] of this.tileData){
      if(tile.type!=='PROPERTY')continue;
      const owner=owners.get(tileId),oldMarker=this.ownerMarkers.get(tileId);
      if(owner){
        if(!oldMarker||oldMarker.userData.ownerId!==owner.id){
          if(oldMarker){this.scene.remove(oldMarker);disposeObject(oldMarker);}
          const marker=this.createOwnerMarker(tileId,owner.color,state.propertyStates?.[String(tileId)]?.mortgaged);
          marker.userData.ownerId=owner.id;this.ownerMarkers.set(tileId,marker);
        }else{
          oldMarker.material.color.set(state.propertyStates?.[String(tileId)]?.mortgaged?'#777777':owner.color);
        }
      }else if(oldMarker){this.scene.remove(oldMarker);disposeObject(oldMarker);this.ownerMarkers.delete(tileId);}
      const level=state.propertyStates?.[String(tileId)]?.level||0;
      if(this.buildingLevels.get(tileId)!==level){
        const old=this.buildingGroups.get(tileId);
        if(old){this.scene.remove(old);disposeObject(old);this.buildingGroups.delete(tileId);}
        const group=level?this.createBuildings(tileId,level,owner?.color):null;
        if(group)this.buildingGroups.set(tileId,group);
        this.buildingLevels.set(tileId,level);
      }
    }
    if(state.lastDice&&state.lastDice.join(',')!==this.lastDice){
      this.lastDice=state.lastDice.join(',');this.diceSpin=this.reduce?0:.32;
    }
  }
  animate(){
    this.frame=requestAnimationFrame(()=>this.animate());
    this.controls?.update();
    const elapsed=this.clock.getElapsedTime();
    for(const [index,pawn] of [...this.pawns.values()].entries()){
      if(pawn.userData.target&&!this.reduce){pawn.position.lerp(pawn.userData.target,.16);pawn.position.y=pawn.userData.target.y+Math.sin(elapsed*3.2+index)*.035;}
      else if(pawn.userData.target)pawn.position.copy(pawn.userData.target);
      if(!this.reduce)pawn.rotation.y=Math.sin(elapsed*.8+index)*.12;
    }
    if(this.diceSpin>.002){
      this.dice.forEach((die,i)=>{die.rotation.x+=this.diceSpin*(i?-.7:1);die.rotation.y+=this.diceSpin*(i?.8:-.9);die.rotation.z+=this.diceSpin*(i?.45:-.35);});
      this.diceSpin*=.92;
    }
    this.renderer?.render(this.scene,this.camera);
  }
  resize(){
    if(!this.host||!this.renderer)return;
    const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<520?1.2:1.5));this.renderer.setSize(w,h,false);
  }
  destroy(){
    cancelAnimationFrame(this.frame);this.observer?.disconnect();this.controls?.dispose();
    disposeObject(this.scene);this.renderer?.dispose();this.host?.replaceChildren();
    this.pawns.clear();this.ownerMarkers.clear();this.buildingGroups.clear();this.tileMeshes.clear();this.tileData.clear();
  }
}
