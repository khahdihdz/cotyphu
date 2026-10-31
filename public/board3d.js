import * as THREE from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';

const GROUP={A:'#e85a4f',B:'#f2b84b',C:'#3fc1c9',D:'#9b8cf2',E:'#5ec97a',F:'#f27db0',G:'#6fcf97',H:'#f2994a',STATION:'#8c97b8'};
const SPECIAL={START:'#d5a83d',TAX:'#d65d5d',CHANCE:'#8e79c8',EVENT:'#4f9baf',BONUS:'#54a77a',REST:'#718096',JAIL:'#bf7657',GO_TO_JAIL:'#bf5a5a',TELEPORT:'#6977ba'};
const grid=id=>id<=10?{r:11,c:11-id}:id<=20?{r:11-(id-10),c:1}:id<=30?{r:1,c:id-19}:{r:id-29,c:11};
const pos=(id,y=.15)=>{const p=grid(id);return new THREE.Vector3(p.c-6,y,p.r-6);};
const disposeObject=(root)=>root?.traverse?.(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
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
    this.frame=0;this.observer=null;this.lastDice='';this.diceSpin=0;
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
    const base=new THREE.Mesh(new THREE.BoxGeometry(11.5,.42,11.5),new THREE.MeshStandardMaterial({color:'#704b35',roughness:.8}));
    base.position.y=-.17;base.castShadow=true;this.scene.add(base);
    for(const tile of board)this.addTile(tile);
    const center=new THREE.Mesh(new THREE.BoxGeometry(7.7,.12,7.7),new THREE.MeshStandardMaterial({color:'#1c3943',roughness:.7}));
    center.position.y=.08;this.scene.add(center);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.5,.06,8,72),new THREE.MeshStandardMaterial({color:'#d4a84d',metalness:.6,roughness:.3}));
    ring.rotation.x=Math.PI/2;ring.position.y=.17;this.scene.add(ring);
    this.addDice();
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.minDistance=11;this.controls.maxDistance=25;this.controls.maxPolarAngle=Math.PI*.46;this.controls.enablePan=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.animate();
  }
  addTile(tile){
    const p=pos(tile.id),color=tile.type==='PROPERTY'?(GROUP[tile.group]||'#748494'):(SPECIAL[tile.type]||'#536879');
    const box=new THREE.Mesh(new THREE.BoxGeometry(.94,.24,.94),new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.08}));
    box.position.copy(p);box.castShadow=true;box.receiveShadow=true;this.scene.add(box);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.86,.42),new THREE.MeshStandardMaterial({map:labelMap(tile),roughness:1}));
    label.rotation.x=-Math.PI/2;label.position.set(p.x,.275,p.z);this.scene.add(label);
    this.tileMeshes.set(tile.id,box);this.tileData.set(tile.id,tile);
  }
  addDice(){
    const material=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.3});
    for(let i=0;i<2;i++){
      const die=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),material.clone());
      die.position.set(i?-.5:.5,.7,0);die.castShadow=true;this.scene.add(die);this.dice.push(die);
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
    for(const pawn of this.pawns.values()){
      if(pawn.userData.target&&!this.reduce)pawn.position.lerp(pawn.userData.target,.16);
      else if(pawn.userData.target)pawn.position.copy(pawn.userData.target);
    }
    if(this.diceSpin>.002){
      this.dice.forEach((die,i)=>{die.rotation.x+=this.diceSpin*(i?-.7:1);die.rotation.y+=this.diceSpin*(i?.8:-.9);});
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
