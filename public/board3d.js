import * as THREE from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';

const GROUP={A:'#e85a4f',B:'#f2b84b',C:'#3fc1c9',D:'#9b8cf2',E:'#5ec97a',F:'#f27db0',G:'#6fcf97',H:'#f2994a',STATION:'#8c97b8'};
const SPECIAL={START:'#d5a83d',TAX:'#d65d5d',CHANCE:'#8e79c8',EVENT:'#4f9baf',BONUS:'#54a77a',REST:'#718096',JAIL:'#bf7657',GO_TO_JAIL:'#bf5a5a',TELEPORT:'#6977ba'};
const grid=id=>id<=10?{r:11,c:11-id}:id<=20?{r:11-(id-10),c:1}:id<=30?{r:1,c:id-19}:{r:id-29,c:11};
const pos=(id,y=.15)=>{const p=grid(id);return new THREE.Vector3(p.c-6,y,p.r-6);};
function labelMap(tile){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.fillStyle='#fff8e8';x.fillRect(0,0,256,128);x.fillStyle='#263a48';x.textAlign='center';x.font='bold 25px sans-serif';x.fillText(String(tile.name||'').slice(0,22),128,48);x.font='bold 18px sans-serif';if(tile.price)x.fillText(new Intl.NumberFormat('vi-VN').format(tile.price)+' ₫',128,94);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}

export class Board3D {
  constructor(){this.host=null;this.scene=null;this.camera=null;this.renderer=null;this.controls=null;this.pawns=new Map();this.dice=[];this.frame=0;this.observer=null;this.lastDice='';this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}
  mount(host,board){
    this.host=host;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#142b35');
    this.camera=new THREE.PerspectiveCamera(36,w/h,.1,100);this.camera.position.set(13,17,18);
    this.renderer=new THREE.WebGLRenderer({antialias:w>520,alpha:false,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<520?1.2:1.5));this.renderer.setSize(w,h,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.shadowMap.enabled=w>520;host.replaceChildren(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xe5f2ff,0x34443c,2));
    const sun=new THREE.DirectionalLight(0xffe0b0,2.5);sun.position.set(-7,15,8);sun.castShadow=w>520;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#10242c',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;floor.receiveShadow=true;this.scene.add(floor);
    const base=new THREE.Mesh(new THREE.BoxGeometry(11.5,.42,11.5),new THREE.MeshStandardMaterial({color:'#704b35',roughness:.8}));base.position.y=-.17;base.castShadow=true;this.scene.add(base);
    for(const tile of board)this.addTile(tile);
    const center=new THREE.Mesh(new THREE.BoxGeometry(7.7,.12,7.7),new THREE.MeshStandardMaterial({color:'#1c3943',roughness:.7}));center.position.y=.08;this.scene.add(center);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.5,.06,8,72),new THREE.MeshStandardMaterial({color:'#d4a84d',metalness:.6,roughness:.3}));ring.rotation.x=Math.PI/2;ring.position.y=.17;this.scene.add(ring);
    this.addDice();
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=11;this.controls.maxDistance=25;this.controls.maxPolarAngle=Math.PI*.46;this.controls.enablePan=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.animate();
  }
  addTile(tile){
    const p=pos(tile.id),color=tile.type==='PROPERTY'?(GROUP[tile.group]||'#748494'):(SPECIAL[tile.type]||'#536879');
    const box=new THREE.Mesh(new THREE.BoxGeometry(.94,.24,.94),new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.08}));box.position.copy(p);box.castShadow=true;box.receiveShadow=true;this.scene.add(box);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.86,.42),new THREE.MeshStandardMaterial({map:labelMap(tile),roughness:1}));label.rotation.x=-Math.PI/2;label.position.set(p.x,.275,p.z);this.scene.add(label);
  }
  addDice(){const m=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.3});for(let i=0;i<2;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),m.clone());d.position.set(i?-.5:.5,.7,0);d.castShadow=true;this.scene.add(d);this.dice.push(d);}}
  pawn(color){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:color||'#e7a84b',metalness:.35,roughness:.32});const foot=new THREE.Mesh(new THREE.CylinderGeometry(.23,.28,.12,20),m);foot.castShadow=true;g.add(foot);const body=new THREE.Mesh(new THREE.ConeGeometry(.19,.52,20),m);body.position.y=.31;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),new THREE.MeshStandardMaterial({color:'#fff0c8'}));head.position.y=.65;g.add(head);return g;}
  update(state){if(!state||!this.scene)return;const alive=new Set();for(const [i,p] of state.players.entries()){if(p.bankrupt)continue;alive.add(p.id);let g=this.pawns.get(p.id);if(!g){g=this.pawn(p.color);this.pawns.set(p.id,g);this.scene.add(g);}const at=pos(p.position,.4),same=state.players.filter(x=>!x.bankrupt&&x.position===p.position),offset=(same.findIndex(x=>x.id===p.id)-(same.length-1)/2)*.18;g.position.set(at.x+offset,at.y,at.z+offset);}
    for(const [id,g] of this.pawns)if(!alive.has(id)){this.scene.remove(g);this.pawns.delete(id);}
    if(state.lastDice&&state.lastDice.join(',')!==this.lastDice){this.lastDice=state.lastDice.join(',');if(!this.reduce)this.dice.forEach(d=>d.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6));}
  }
  animate(){this.frame=requestAnimationFrame(()=>this.animate());this.controls?.update();if(!this.reduce)this.dice.forEach((d,i)=>d.rotation.y+=i?.001:-.001);this.renderer?.render(this.scene,this.camera);}
  resize(){if(!this.host||!this.renderer)return;const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<520?1.2:1.5));this.renderer.setSize(w,h,false);}
  destroy(){cancelAnimationFrame(this.frame);this.observer?.disconnect();this.controls?.dispose();this.scene?.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});this.renderer?.dispose();this.host?.replaceChildren();this.pawns.clear();}
}
