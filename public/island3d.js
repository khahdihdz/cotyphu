// 3D island board view — visual layer only; game rules/network remain in game.js + Durable Objects.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { BOARD } from './gameLogic.js';

const wrap = document.querySelector('.board-wrap');
const boardEl = document.getElementById('board');
if (!wrap || !boardEl || !('WebGLRenderingContext' in window)) {
  document.documentElement.classList.add('ctp-3d-fallback');
} else {
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'island3d-canvas';
    canvas.setAttribute('aria-label', 'Bàn cờ 3D trên đảo xanh');
    canvas.setAttribute('role', 'img');
    wrap.prepend(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#79c9f3');
    scene.fog = new THREE.Fog('#a8e0f6', 20, 42);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(12, 15, 18);
    camera.lookAt(0, 0.3, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene.add(new THREE.HemisphereLight('#effaff', '#57864b', 2.0));
    const sun = new THREE.DirectionalLight('#fff4d8', 3.0);
    sun.position.set(-8, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const mat = (color, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
    const grass = mat('#79d45b'), grassTop = mat('#9be66f'), soil = mat('#a96b3d');
    const stone = mat('#f8f2dc'), white = mat('#fffdf5'), water = new THREE.MeshStandardMaterial({ color:'#51c9ec', roughness:.28, metalness:.04 });
    const island = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(12.5, .7, 12.5), soil);
    slab.position.y = -.42; slab.castShadow = true; slab.receiveShadow = true; island.add(slab);
    const turf = new THREE.Mesh(new THREE.BoxGeometry(12.65, .35, 12.65), grass);
    turf.position.y = .05; turf.castShadow = true; turf.receiveShadow = true; island.add(turf);
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(11.9, .12, 11.9), grassTop);
    lawn.position.y = .28; lawn.receiveShadow = true; island.add(lawn);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, .08, 32), water);
    pond.scale.z = .68; pond.position.set(0, .37, .35); island.add(pond);

    // 40 board spaces placed around the perimeter in the same order as BOARD ids.
    const tileMeshes = [];
    const sideCount = 10, tileSize = 1.02, gap = .035, edge = 5.35;
    const palette = ['#ffb7a8','#ffe08a','#a5e9f2','#c8b9ff','#b9edaa','#ffb5d5','#9ce4cf','#ffc98c'];
    function tilePosition(id) {
      if (id <= 10) return { x: edge - id * (edge * 2 / 10), z: edge, rot: 0 };
      if (id <= 20) return { x: -edge, z: edge - (id - 10) * (edge * 2 / 10), rot: Math.PI / 2 };
      if (id <= 30) return { x: -edge + (id - 20) * (edge * 2 / 10), z: -edge, rot: 0 };
      return { x: edge, z: -edge + (id - 30) * (edge * 2 / 10), rot: Math.PI / 2 };
    }
    const moneyLabel = value => {
      if (!Number.isFinite(Number(value))) return '';
      const n = Number(value);
      return n >= 1_000_000 ? (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr' :
        n >= 1_000 ? Math.round(n / 1_000).toLocaleString('vi-VN') + 'k' : String(n);
    };
    function labelTexture(tile) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320;
      const ctx = c.getContext('2d');
      // Opaque high-contrast label cards remain legible against the bright 3D island.
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(8, 8, 496, 304);
      ctx.strokeStyle = '#d6dce5'; ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 492, 300);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const name = String(tile.name || '');
      const words = name.split(/\\s+/);
      const lines = [];
      let line = '';
      for (const word of words) {
        const next = line ? line + ' ' + word : word;
        if (next.length > 13 && line) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      const shown = lines.slice(0, 2);
      if (lines.length > 2) shown[1] = shown[1].slice(0, 10) + '…';
      ctx.fillStyle = '#172033';
      ctx.font = 'bold 43px system-ui, sans-serif';
      const startY = shown.length > 1 ? 88 : 112;
      shown.forEach((part, i) => ctx.fillText(part, 256, startY + i * 50, 460));
      const value = tile.type === 'PROPERTY' ? moneyLabel(tile.price) + ' đ' :
        Number.isFinite(Number(tile.amount)) ? moneyLabel(tile.amount) + ' đ' : '';
      if (value) {
        ctx.fillStyle = '#075985'; ctx.font = 'bold 35px system-ui, sans-serif';
        ctx.fillText(value, 256, 244, 460);
      } else {
        ctx.fillStyle = '#475569'; ctx.font = 'bold 27px system-ui, sans-serif';
        ctx.fillText(String(tile.type || '').replaceAll('_', ' '), 256, 250, 460);
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
    }
    BOARD.forEach((tile, id) => {
      const p = tilePosition(id);
      const group = new THREE.Group(); group.position.set(p.x,.42,p.z); group.rotation.y = p.rot;
      const corner = [0,10,20,30].includes(id);
      const box = new THREE.Mesh(new THREE.BoxGeometry(corner ? 1.16 : tileSize, corner ? .28 : .2, corner ? 1.16 : tileSize), mat(corner ? '#ffe5a0' : '#fffdf6'));
      box.castShadow = true; box.receiveShadow = true; group.add(box);
      if (tile.type === 'PROPERTY') {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(.84,.035,.19), mat(palette['ABCDEFGH'.indexOf(tile.group)] || '#a5e9f2'));
        strip.position.set(0,.12,-.28); group.add(strip);
      }
      const spriteMat = new THREE.MeshBasicMaterial({ map: labelTexture(tile), transparent:true, side:THREE.DoubleSide, depthWrite:false });
      const sprite = new THREE.Mesh(new THREE.PlaneGeometry(.94,.58), spriteMat);
      sprite.rotation.x = -Math.PI/2; sprite.position.set(0,.126,.12); group.add(sprite);
      island.add(group); tileMeshes[id] = { group, box, baseMaterial: box.material };
    });

    // Friendly low-poly trees and soft toy-like clouds, all procedural (no unlicensed model downloads).
    function tree(x,z,s=1) {
      const g = new THREE.Group(); g.position.set(x,.38,z); g.scale.setScalar(s);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.42,6), mat('#99633b')); trunk.position.y=.21; g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(.42,.92,7), mat('#35ad59')); crown.position.y=.76; crown.castShadow=true; g.add(crown);
      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(.3,.62,7), mat('#66cf65')); crown2.position.y=1.12; g.add(crown2); island.add(g);
    }
    [[-4,-3],[4,-3],[-3.9,3.5],[3.8,3.8],[-4.4,0],[4.3,.4],[-2,4.1],[2.2,-4.1]].forEach((p,i)=>tree(p[0],p[1],i%3===0?1.1:.82));
    scene.add(island);
    function cloud(x,y,z,s=1) {
      const g = new THREE.Group(); g.position.set(x,y,z);
      [[0,0,0,.7],[.55,.05,0,.55],[-.48,-.05,0,.48],[.15,.28,0,.5]].forEach(([a,b,c,r])=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r*s,1),white);m.position.set(a*s,b*s,c*s);g.add(m);});
      scene.add(g); return g;
    }
    const clouds = [cloud(-7,6,-5,1.1),cloud(6,7,-4,.9),cloud(7,5,5,.7)];
    // Colorful toy pawns track the same positions as the existing UI token layer when available.
    const pawns = [];
    const pawnColors = ['#ff6b6b','#5b8ff9','#ffd166','#a78bfa','#38c99b','#ff8cc6'];
    for(let i=0;i<6;i++){
      const g=new THREE.Group();
      const base=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,.12,12),mat(pawnColors[i])); base.position.y=.12; g.add(base);
      const body=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),mat(pawnColors[i])); body.position.y=.38; body.scale.y=1.25; g.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),mat('#fff0d8')); head.position.y=.68; g.add(head);
      const eyeMat=new THREE.MeshBasicMaterial({color:'#334155'});
      [-.055,.055].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,6,4),eyeMat);eye.position.set(x,.7,.145);g.add(eye);});
      island.add(g); pawns.push(g);
    }
    function syncPawns() {
      const state = window.__ctpState;
      if (!state?.players) return;
      state.players.forEach((p,i)=>{
        const pawn=pawns[i]; if(!pawn)return;
        pawn.visible=!p.bankrupt;
        const pos=tilePosition(Number(p.position)||0);
        const offset=(i%3-1)*.16;
        pawn.position.set(pos.x+offset,.56,pos.z+((Math.floor(i/3)-.5)*.22));
      });
    }
    function syncOwnership() {
      const state=window.__ctpState;
      if(!state?.players)return;
      BOARD.forEach((tile,id)=>{
        if(tile.type!=='PROPERTY')return;
        const owner=state.players.find(p=>p.properties?.includes(id));
        const mesh=tileMeshes[id]; if(!mesh)return;
        mesh.box.material=owner ? mat(owner.color || pawnColors[state.players.indexOf(owner)%pawnColors.length]) : mesh.baseMaterial;
      });
    }
    let lastState = null;
    function frame(t) {
      renderer.render(scene,camera);
      if (t-lastState>350) { syncPawns(); syncOwnership(); clouds.forEach((c,i)=>{c.position.x += Math.sin(t*.00015+i)*.0008;}); lastState=t; }
      requestAnimationFrame(frame);
    }
    function resize() {
      const w=Math.max(1,wrap.clientWidth), h=Math.max(1,wrap.clientHeight);
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize',resize,{passive:true});
    const observer=new ResizeObserver(resize); observer.observe(wrap); resize();
    document.documentElement.classList.add('ctp-3d-ready');
    requestAnimationFrame(frame);
  } catch (error) {
    console.warn('3D board unavailable; using 2D board fallback.', error);
    document.documentElement.classList.add('ctp-3d-fallback');
  }
}
