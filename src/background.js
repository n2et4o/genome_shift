// ============================================================
// GENOME SHIFT — background.js  v4
// Top-down procédural • Fixes : eau, chargement, transitions
// ============================================================
// INTÉGRATION :
//   index.html  → <script src="./src/background.js"></script>  AVANT main.js
//   preload()   → GS.BG.preload(this)
//   create()    → GS.BG.create(this)   // tout au début
//   update()    → GS.BG.update(this, time, delta)
//
// API utile :
//   GS.BG.isWalkable(worldX, worldY)  → bool
//   GS.BG.getTileAt(worldX, worldY)   → numéro tile
//   GS.BG.setSeason("winter")
//   GS.BG.setTimeOfDay(0.75)
//   GS.BG.TILE                        → taille d'une tuile (32)
// ============================================================

window.GS = window.GS || {};

GS.BG = (function () {

  // ── Constantes ───────────────────────────────────────────
  const TILE  = 32;
  const W     = 1200, H = 600;
  const COLS  = Math.ceil(W / TILE) + 4;
  const ROWS  = Math.ceil(H / TILE) + 4;
  const CHUNK = 16;                        // 16×16 tuiles par chunk

  // Rayon de pré-chargement (en chunks autour du joueur)
  const PRELOAD_RADIUS = 3;

  const DAY_DURATION    = 180000;
  const SEASON_DURATION = 600000;

  // ── Walkable par type ────────────────────────────────────
  // 0=herbe 1=herbe haute 2=chemin 3=fleurs 4=arbre(X) 5=buisson(X)
  // 6=eau(X) 7=rive 8=rocher(X) 9=champignon 10=arbre mort(X)
  // 11=ruines 12=sable
  const WALKABLE = [true,true,true,true,false,false,false,true,false,true,false,true,true];

  // ── Palettes saisons ─────────────────────────────────────
  const PAL = {
    spring:{
      sky:[0x7EC8E3,0xC8F5E0],
      grass:[0x7ED44C,0x1A3A0A], grassHigh:[0x5EC030,0x122808],
      path:[0xC8A878,0x4A3820], flower:[0xFF90C0,0x5A1830],
      tree:[0x2A7830,0x081808], treeTop:[0x3AA040,0x0A200A],
      bush:[0x28A038,0x082808],
      water:[0x48C0F0,0x081838], waterEdge:[0x78D8F8,0x102848],
      rock:[0x9090A0,0x202028], mushroom:[0xFF7878,0x801010],
      deadTree:[0x887060,0x201808], ruin:[0xB8A888,0x302820], sand:[0xE8D898,0x504030],
      nightTint:0x050A20, nightAlpha:0.62,
      fogColor:0xA8D8B8, fogAlpha:0.13,
      particle:0xFFB8D4, particleType:"petals",
      moonColor:0xDDEEFF, starColor:0xFFFFDD,
    },
    summer:{
      sky:[0x40C0F8,0x010828],
      grass:[0x58B820,0x0E2205], grassHigh:[0x40A010,0x091804],
      path:[0xD8B870,0x503A10], flower:[0xFFE840,0x504800],
      tree:[0x1A7028,0x050F08], treeTop:[0x28A030,0x081408],
      bush:[0x209830,0x062008],
      water:[0x18B8F8,0x040A30], waterEdge:[0x58D0F8,0x0C1840],
      rock:[0x888898,0x181820], mushroom:[0xFF6030,0x701008],
      deadTree:[0x807060,0x181408], ruin:[0xC0A870,0x302010], sand:[0xF0E0A0,0x584828],
      nightTint:0x010510, nightAlpha:0.68,
      fogColor:0xFFF8C0, fogAlpha:0.07,
      particle:0xCCFF60, particleType:"fireflies",
      moonColor:0xFFFDE7, starColor:0xFFFFAA,
    },
    autumn:{
      sky:[0xC09060,0x080304],
      grass:[0x908030,0x201800], grassHigh:[0x785818,0x180C00],
      path:[0xB88858,0x402810], flower:[0xE08028,0x481800],
      tree:[0xA85020,0x200800], treeTop:[0xC06828,0x280A00],
      bush:[0x986018,0x200800],
      water:[0x608898,0x080F12], waterEdge:[0x80A8B8,0x101820],
      rock:[0x807060,0x181408], mushroom:[0xC04010,0x400800],
      deadTree:[0x604830,0x100800], ruin:[0xA08858,0x281808], sand:[0xD0A868,0x483018],
      nightTint:0x050200, nightAlpha:0.65,
      fogColor:0xC88858, fogAlpha:0.18,
      particle:0xD04810, particleType:"leaves",
      moonColor:0xFFE4C0, starColor:0xFFDDA0,
    },
    winter:{
      sky:[0x98B8D8,0x020008],
      grass:[0xC8D8F0,0x101828], grassHigh:[0xA8C0E8,0x0C1420],
      path:[0xD8E0F0,0x283048], flower:[0xE0D0FF,0x201830],
      tree:[0x4858A0,0x081018], treeTop:[0x6878B8,0x101828],
      bush:[0x505890,0x080C18],
      water:[0x7888B8,0x080814], waterEdge:[0x98A8C8,0x101828],
      rock:[0x8898B8,0x101828], mushroom:[0x9878C0,0x201830],
      deadTree:[0x485878,0x080C14], ruin:[0xA0B0C8,0x181C28], sand:[0xD0D8E8,0x202830],
      nightTint:0x000005, nightAlpha:0.72,
      fogColor:0xC8D8FF, fogAlpha:0.24,
      particle:0xE8F0FF, particleType:"snow",
      moonColor:0xDDCCFF, starColor:0xCCDDFF,
    }
  };
  const SEASONS = ["spring","summer","autumn","winter"];

  // ── État ─────────────────────────────────────────────────
  let _tod=0.22, _sIdx=0, _sBlend=0, _sTimer=0;

  // Cache chunks : key → Uint8Array(CHUNK*CHUNK)
  const _cache = new Map();
  // Queue de pré-chargement asynchrone
  let _preloadQueue = [];
  let _preloading = false;

  // Phaser graphics
  let gBase, gOverlay, gFog, gParticles, gHorror;

  // Particules & étoiles
  let _parts=[], _stars=[];

  // ── Couleurs ─────────────────────────────────────────────
  function hexToRgb(h){return[(h>>16)&255,(h>>8)&255,h&255];}
  function rgbToHex(r,g,b){return((r&255)<<16)|((g&255)<<8)|(b&255);}
  function lerpC(a,b,t){
    const[r1,g1,b1]=hexToRgb(a),[r2,g2,b2]=hexToRgb(b);
    return rgbToHex(r1+(r2-r1)*t|0,g1+(g2-g1)*t|0,b1+(b2-b1)*t|0);
  }
  function getC(key){
    const p1=PAL[SEASONS[_sIdx]], p2=PAL[SEASONS[(_sIdx+1)%4]];
    const c1=p1[key], c2=p2[key];
    if(Array.isArray(c1)){
      const na=nightAmt();
      return lerpC(lerpC(c1[0],c2[0],_sBlend), lerpC(c1[1],c2[1],_sBlend), na);
    }
    return lerpC(c1, c2, _sBlend);
  }
  function getPF(key){ const p1=PAL[SEASONS[_sIdx]],p2=PAL[SEASONS[(_sIdx+1)%4]]; return p1[key]+(p2[key]-p1[key])*_sBlend; }

  // ── Temps ────────────────────────────────────────────────
  function nightAmt(){
    const t=_tod;
    if(t<0.55)return 0; if(t<0.70)return(t-0.55)/0.15;
    if(t<0.88)return 1; return Math.max(0,1-(t-0.88)/0.12);
  }
  function duskAmt(){
    const t=_tod;
    if(t<0.42)return 0; if(t<0.55)return(t-0.42)/0.13;
    if(t<0.68)return 1-(t-0.55)/0.13; return 0;
  }

  // ── Noise (déterministe, rapide) ─────────────────────────
  function h(x,y,s){let n=Math.sin(x*127.1+y*311.7+s*74.3)*43758.5453;return n-Math.floor(n);}
  function sn(x,y,s){
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    return h(ix,iy,s)*(1-ux)*(1-uy)+h(ix+1,iy,s)*ux*(1-uy)
          +h(ix,iy+1,s)*(1-ux)*uy+h(ix+1,iy+1,s)*ux*uy;
  }
  function fbm(x,y,s,o){let v=0,a=0.5;for(let i=0;i<o;i++){v+=sn(x,y,s+i)*a;x*=2.1;y*=2.1;a*=0.5;}return v;}

  // ── Génération tile ──────────────────────────────────────
  function genTile(tx,ty){
    // Chemins (réseau régulier mais légèrement sinueux)
    const pathSway = sn(tx*0.05, ty*0.05, 99)*3|0;
    const roadH = ((ty+pathSway)%22+22)%22;
    const roadV = ((tx+pathSway)%30+30)%30;
    if(roadH<2||roadV<2) return 2;

    const bx=tx*0.04, by=ty*0.04;
    const biome    = fbm(bx,      by,      1, 4);
    const moisture = fbm(bx+100,  by+100,  2, 3);
    const rough    = fbm(bx*3,    by*3,    3, 2);
    const horror   = fbm(bx*1.5+50, by*1.5+50, 7, 3);

    // ── Eau & rives ──
    if(biome < 0.20 && moisture > 0.42){
      return biome > 0.16 ? 7 : 6;
    }
    // Rivières (noise sinusoïdal)
    const rv = Math.abs(sn(tx*0.018, ty*0.018, 9)-0.5);
    const rw = 0.038 + sn(tx*0.004, ty*0.004, 10)*0.028;
    if(rv < rw){ return rv > rw*0.55 ? 7 : 6; }

    // ── Sable (transition eau→terre) ──
    if(biome < 0.28 && moisture > 0.32) return 12;

    // ── Forêts & végétation dense ──
    if(biome > 0.70 && rough > 0.52){
      if(horror > 0.74 && rough > 0.62) return 10;
      return rough > 0.68 ? 4 : 5;
    }
    if(fbm(bx*0.8,by*0.8,5,3) > 0.67 && rough > 0.46) return 4;

    // ── Rochers ──
    if(rough > 0.82 && biome > 0.38) return 8;

    // ── Ruines (horror) ──
    if(horror > 0.82 && biome > 0.33) return 11;

    // ── Champignons ──
    if(horror > 0.67 && rough > 0.58 && biome > 0.28) return 9;

    // ── Fleurs ──
    if(moisture > 0.63 && rough < 0.33 && biome > 0.28) return 3;

    // ── Herbe haute ──
    if(rough > 0.54 && biome > 0.28) return 1;

    return 0; // herbe normale
  }

  // ── Chunk cache ──────────────────────────────────────────
  function getChunk(cx,cy){
    const k=`${cx},${cy}`;
    if(_cache.has(k)) return _cache.get(k);
    const tiles=new Uint8Array(CHUNK*CHUNK);
    for(let ty=0;ty<CHUNK;ty++)
      for(let tx=0;tx<CHUNK;tx++)
        tiles[ty*CHUNK+tx]=genTile(cx*CHUNK+tx,cy*CHUNK+ty);
    _cache.set(k,tiles);
    if(_cache.size>300){ _cache.delete(_cache.keys().next().value); }
    return tiles;
  }
  function getTile(tx,ty){
    const cx=Math.floor(tx/CHUNK),cy=Math.floor(ty/CHUNK);
    const lx=((tx%CHUNK)+CHUNK)%CHUNK,ly=((ty%CHUNK)+CHUNK)%CHUNK;
    return getChunk(cx,cy)[ly*CHUNK+lx];
  }

  // ── Pré-chargement directionnel (toutes directions) ──────
  let _lastPx=null, _lastPy=null, _lastPcx=null, _lastPcy=null, _isPreloading=false;

  function schedulePreload(playerX, playerY){
    const pcx=Math.floor(playerX/TILE/CHUNK);
    const pcy=Math.floor(playerY/TILE/CHUNK);

    // Si même chunk et déjà en cours → rien
    if(pcx===_lastPcx && pcy===_lastPcy && _isPreloading) return;

    // Direction de déplacement
    let dirX=0, dirY=0;
    if(_lastPx!==null){
      const dx=playerX-_lastPx, dy=playerY-_lastPy;
      const len=Math.sqrt(dx*dx+dy*dy);
      if(len>0.5){ dirX=dx/len; dirY=dy/len; }
    }
    _lastPx=playerX; _lastPy=playerY; _lastPcx=pcx; _lastPcy=pcy;

    // Collecte chunks manquants dans toutes les directions
    const toLoad=[];
    for(let dx=-PRELOAD_RADIUS;dx<=PRELOAD_RADIUS;dx++){
      for(let dy=-PRELOAD_RADIUS;dy<=PRELOAD_RADIUS;dy++){
        const k=`${pcx+dx},${pcy+dy}`;
        if(_cache.has(k)) continue;
        // Priorité : chunks dans la direction du mouvement d'abord
        const dot=dirX*dx+dirY*dy;
        toLoad.push({cx:pcx+dx,cy:pcy+dy,priority:dot});
      }
    }
    if(toLoad.length===0){ _isPreloading=false; return; }

    // Tri : chunks dans la direction du joueur en premier
    toLoad.sort((a,b)=>b.priority-a.priority);

    _isPreloading=true;
    let idx=0;
    function loadBatch(){
      const end=Math.min(idx+3,toLoad.length);
      while(idx<end){ const{cx,cy}=toLoad[idx++]; getChunk(cx,cy); }
      if(idx<toLoad.length) setTimeout(loadBatch,8);
      else _isPreloading=false;
    }
    loadBatch(); // premier batch immédiat (pas de délai)
  }

  // ── Dessin d'une tuile ───────────────────────────────────
  function drawTile(gfx,sx,sy,tile,tx,ty,now){
    const s=TILE, na=nightAmt();
    const rng=h(tx,ty,42); // valeur pseudo-aléatoire fixe par tuile

    switch(tile){

      case 0:{ // Herbe normale
        const c=getC("grass");
        gfx.fillStyle(lerpC(c,rng>0.7?0xFFFFFF:0x000000,rng>0.7?0.06:0.04),1);
        gfx.fillRect(sx,sy,s,s);
        // 0-2 brins d'herbe subtils
        if(rng>0.60){
          const gc=lerpC(c,0x000000,0.18);
          gfx.fillStyle(gc,0.65);
          gfx.fillRect(sx+rng*s*0.5|0,sy+s-6,1,5);
          if(rng>0.75) gfx.fillRect(sx+rng*s*0.8|0,sy+s-5,1,4);
        }
        break;
      }

      case 1:{ // Herbe haute
        const gc=getC("grass"), ghc=getC("grassHigh");
        gfx.fillStyle(gc,1); gfx.fillRect(sx,sy,s,s);
        for(let i=0;i<5;i++){
          const bx2=sx+h(tx+i,ty,13)*s|0;
          const bh2=7+h(tx,ty+i,14)*10|0;
          const sway=Math.sin(now*1.1+tx*0.25+i*1.3)*2.5|0;
          gfx.fillStyle(lerpC(ghc,0x000000,i*0.06),0.85);
          gfx.fillRect(bx2+sway,sy+s-bh2,2,bh2);
        }
        break;
      }

      case 2:{ // Chemin
        const pc=getC("path");
        gfx.fillStyle(pc,1); gfx.fillRect(sx,sy,s,s);
        // Quelques petits cailloux
        for(let i=0;i<4;i++){
          const px2=sx+h(tx+i,ty,20)*s|0, py2=sy+h(tx,ty+i,21)*(s-3)|0;
          gfx.fillStyle(lerpC(pc,0x000000,0.18),0.45);
          gfx.fillRect(px2,py2,2,2);
        }
        break;
      }

      case 3:{ // Fleurs
        gfx.fillStyle(getC("grass"),1); gfx.fillRect(sx,sy,s,s);
        const fc=getC("flower");
        const n2=2+Math.floor(rng*2);
        for(let i=0;i<n2;i++){
          const fx2=sx+h(tx+i,ty,31)*(s-6)|0, fy2=sy+h(tx,ty+i,32)*(s-8)|0;
          gfx.fillStyle(lerpC(getC("grass"),0x000000,0.25),1);
          gfx.fillRect(fx2+1,fy2+4,1,5);
          // Fleur pixel 3x3
          gfx.fillStyle(fc,1);
          gfx.fillRect(fx2,fy2+1,3,1);
          gfx.fillRect(fx2+1,fy2,1,3);
          gfx.fillStyle(lerpC(fc,0xFFFFFF,0.4),1);
          gfx.fillRect(fx2+1,fy2+1,1,1);
        }
        break;
      }

      case 4:{ // Arbre
        gfx.fillStyle(getC("grass"),1); gfx.fillRect(sx,sy,s,s);
        // Ombre portée (décalée vers bas-droite)
        gfx.fillStyle(0x000000,0.20+na*0.08);
        gfx.fillEllipse(sx+s*0.56,sx+s*0.64,s*0.68,s*0.38);
        // Couronne : côté sombre d'abord
        const tc=getC("treeTop");
        const cr2=s*0.40+rng*3|0;
        gfx.fillStyle(lerpC(tc,0x000000,0.32),1);
        gfx.fillCircle(sx+s/2+2,sy+s/2+2,cr2);
        // Corps principal
        gfx.fillStyle(tc,1);
        gfx.fillCircle(sx+s/2,sy+s/2,cr2);
        // Reflet lumière (petite ellipse claire en haut-gauche)
        gfx.fillStyle(lerpC(tc,0xFFFFFF,0.28),0.55);
        gfx.fillCircle(sx+s/2-cr2*0.28,sy+s/2-cr2*0.28,cr2*0.32);
        // Halo horror la nuit sur certains arbres
        if(na>0.3 && h(tx*2,ty*2,77)>0.62){
          gfx.fillStyle(0x6B00AA,na*0.11);
          gfx.fillCircle(sx+s/2,sy+s/2,cr2+8);
        }
        break;
      }

      case 5:{ // Buisson
        gfx.fillStyle(getC("grass"),1); gfx.fillRect(sx,sy,s,s);
        const bc=getC("bush");
        gfx.fillStyle(lerpC(bc,0x000000,0.28),1);
        gfx.fillCircle(sx+s*0.38+2,sy+s*0.50+2,s*0.26);
        gfx.fillCircle(sx+s*0.62+2,sy+s*0.44+2,s*0.20);
        gfx.fillStyle(bc,1);
        gfx.fillCircle(sx+s*0.38,sy+s*0.48,s*0.27);
        gfx.fillCircle(sx+s*0.62,sy+s*0.42,s*0.20);
        gfx.fillStyle(lerpC(bc,0xFFFFFF,0.22),0.5);
        gfx.fillCircle(sx+s*0.30,sy+s*0.38,s*0.11);
        break;
      }

      case 6:{ // Eau profonde — REFLETS CORRIGÉS (pas de gros cercles)
        const wc=getC("water");
        gfx.fillStyle(wc,1); gfx.fillRect(sx,sy,s,s);

        // Lignes de reflet ondulées (2-3 px de haut max)
        const woff=Math.sin(now*0.9+tx*0.8+ty*0.6)*2.5;
        const wc2=lerpC(wc,0xFFFFFF,0.14);
        gfx.fillStyle(wc2,0.55);
        // Reflet 1 : petite ligne horizontale
        const ry1=sy+s*0.28+woff|0;
        gfx.fillRect(sx+4,ry1, s-10, 2);
        // Reflet 2 : plus courte, décalée
        const ry2=sy+s*0.62-woff|0;
        gfx.fillRect(sx+8,ry2, s-18, 2);

        // Scintillement ponctuel (1 pixel aléatoire)
        if(rng>0.75){
          const shimmer=0.3+0.5*Math.sin(now*3.5+tx*1.1+ty*0.9);
          gfx.fillStyle(0xFFFFFF,shimmer*0.6);
          gfx.fillRect(sx+rng*(s-4)|0, sy+h(tx,ty,52)*(s-4)|0, 2,2);
        }

        // Reflet lune (très subtil, juste une teinte)
        if(na>0.5){
          const mc=PAL[SEASONS[_sIdx]].moonColor||0xDDCCFF;
          gfx.fillStyle(mc,na*0.08);
          gfx.fillRect(sx,sy,s,s);
        }
        break;
      }

      case 7:{ // Rive
        const gc2=getC("grass"), wec=getC("waterEdge");
        gfx.fillStyle(gc2,1); gfx.fillRect(sx,sy,s,s);
        // Tache d'eau organique via plusieurs ellipses
        gfx.fillStyle(wec,0.70);
        gfx.fillEllipse(sx+s*0.50,sy+s*0.58,s*1.05,s*0.75);
        // Petite ligne de reflet
        const woff2=Math.sin(now*0.9+tx*0.8+ty*0.6)*1.5;
        gfx.fillStyle(lerpC(wec,0xFFFFFF,0.18),0.5);
        gfx.fillRect(sx+s*0.2+woff2|0,sy+s*0.55,s*0.4,1);
        break;
      }

      case 8:{ // Rocher
        gfx.fillStyle(getC("grass"),1); gfx.fillRect(sx,sy,s,s);
        const rc=getC("rock");
        // Ombre
        gfx.fillStyle(0x000000,0.20);
        gfx.fillEllipse(sx+s*0.55,sy+s*0.64,s*0.62,s*0.32);
        // Corps
        gfx.fillStyle(lerpC(rc,0x000000,0.28),1);
        gfx.fillEllipse(sx+s/2+2,sy+s/2+1,s*0.60,s*0.52);
        gfx.fillStyle(rc,1);
        gfx.fillEllipse(sx+s/2,sy+s/2,s*0.60,s*0.52);
        // Reflet
        gfx.fillStyle(lerpC(rc,0xFFFFFF,0.32),0.55);
        gfx.fillEllipse(sx+s/2-s*0.10,sy+s/2-s*0.13,s*0.22,s*0.15);
        break;
      }

      case 9:{ // Champignon
        gfx.fillStyle(getC("grass"),1); gfx.fillRect(sx,sy,s,s);
        const mc2=getC("mushroom");
        // Tige (petite)
        gfx.fillStyle(lerpC(mc2,0xFFFFFF,0.5),1);
        gfx.fillRect(sx+s*0.44,sy+s*0.52,s*0.12,s*0.28);
        // Chapeau (ellipse plate, vue du dessus)
        gfx.fillStyle(lerpC(mc2,0x000000,0.22),1);
        gfx.fillEllipse(sx+s/2+1,sy+s*0.46+1,s*0.52,s*0.25);
        gfx.fillStyle(mc2,1);
        gfx.fillEllipse(sx+s/2,sy+s*0.44,s*0.52,s*0.25);
        // Points blancs (2 max)
        gfx.fillStyle(0xFFFFFF,0.8);
        gfx.fillRect(sx+s*0.36,sy+s*0.36,3,3);
        gfx.fillRect(sx+s*0.54,sy+s*0.40,2,2);
        // Lueur douce la nuit
        if(na>0.15){
          const gl=0.35+0.35*Math.sin(now*1.8+tx+ty);
          gfx.fillStyle(mc2,na*gl*0.22);
          gfx.fillCircle(sx+s/2,sy+s*0.44,s*0.42);
        }
        break;
      }

      case 10:{ // Arbre mort / horror
        gfx.fillStyle(lerpC(getC("grass"),0x200000,0.14),1);
        gfx.fillRect(sx,sy,s,s);
        const dtc=getC("deadTree");
        // Ombre
        gfx.fillStyle(0x000000,0.22);
        gfx.fillEllipse(sx+s*0.54,sy+s*0.62,s*0.46,s*0.22);
        // Tronc (ellipse petite)
        gfx.fillStyle(lerpC(dtc,0x000000,0.28),1);
        gfx.fillEllipse(sx+s/2+1,sy+s/2+1,s*0.24,s*0.20);
        gfx.fillStyle(dtc,1);
        gfx.fillEllipse(sx+s/2,sy+s/2,s*0.24,s*0.20);
        // Branches (vue du dessus = lignes depuis le centre)
        for(let i=0;i<5;i++){
          const ang=(i/5)*Math.PI*2+rng*0.6;
          const len=s*0.32+h(tx+i,ty,81)*s*0.14;
          gfx.lineStyle(2,lerpC(dtc,0x000000,0.35),1);
          gfx.lineBetween(sx+s/2,sy+s/2,sx+s/2+Math.cos(ang)*len|0,sy+s/2+Math.sin(ang)*len|0);
        }
        // Halo horror
        if(na>0.20){
          const pulse=0.35+0.35*Math.sin(now*0.85+tx*0.7+ty*0.5);
          gfx.fillStyle(0x8800CC,na*pulse*0.16);
          gfx.fillCircle(sx+s/2,sy+s/2,s*0.48);
        }
        break;
      }

      case 11:{ // Ruines
        const rc2=getC("ruin"), gc3=getC("grass");
        gfx.fillStyle(lerpC(rc2,gc3,0.38),1); gfx.fillRect(sx,sy,s,s);
        // Lignes de dalles
        gfx.lineStyle(1,lerpC(rc2,0x000000,0.28),0.55);
        gfx.lineBetween(sx+s*0.33,sy,sx+s*0.33,sy+s);
        gfx.lineBetween(sx,sy+s*0.5,sx+s,sy+s*0.5);
        // Morceaux de mur
        if(rng>0.45){
          gfx.fillStyle(rc2,1);
          gfx.fillRect(sx+s*0.08,sy+s*0.08,s*0.22,s*0.18);
          gfx.fillStyle(lerpC(rc2,0x000000,0.2),1);
          gfx.fillRect(sx+s*0.62,sy+s*0.66,s*0.28,s*0.20);
        }
        if(na>0.25){ gfx.fillStyle(0x3300AA,na*0.09); gfx.fillRect(sx,sy,s,s); }
        break;
      }

      case 12:{ // Sable
        const sc2=getC("sand");
        gfx.fillStyle(sc2,1); gfx.fillRect(sx,sy,s,s);
        for(let i=0;i<5;i++){
          gfx.fillStyle(lerpC(sc2,0x000000,0.14),0.45);
          gfx.fillRect(sx+h(tx+i,ty,95)*(s-2)|0,sy+h(tx,ty+i,96)*(s-2)|0,2,2);
        }
        break;
      }
    }
  }

  // ── Overlay nuit / soleil / lune ─────────────────────────
  function drawOverlay(camX,camY){
    gOverlay.clear();
    const na=nightAmt(), da=duskAmt(), now=Date.now()*0.001;
    const pal=PAL[SEASONS[_sIdx]];

    // Nuit
    if(na>0.01){ gOverlay.fillStyle(pal.nightTint,na*pal.nightAlpha); gOverlay.fillRect(0,0,W,H); }
    // Crépuscule
    if(da>0.01){ gOverlay.fillStyle(0x280600,da*0.20); gOverlay.fillRect(0,0,W,H); }

    // Étoiles
    if(na>0.04){
      for(const s of _stars){
        const tw=0.3+0.7*Math.abs(Math.sin(now*s.sp+s.ph));
        gOverlay.fillStyle(pal.starColor||0xFFFFEE,na*tw*0.85);
        gOverlay.fillRect(s.x|0,s.y|0,s.sz,s.sz);
      }
    }

    // Lune (en haut de l'écran)
    if(_tod>0.60&&_tod<0.97){
      const lf=Math.min(1,Math.min((_tod-0.60)/0.10,(0.97-_tod)/0.07));
      const lx=W*0.74|0,ly=38;
      gOverlay.fillStyle(0x5B0090,lf*0.05); gOverlay.fillCircle(lx,ly,30);
      gOverlay.fillStyle(0x8040B0,lf*0.10); gOverlay.fillCircle(lx,ly,22);
      gOverlay.fillStyle(pal.moonColor||0xDDCCFF,lf); gOverlay.fillCircle(lx,ly,14);
      gOverlay.fillStyle(0x000000,lf*0.13); gOverlay.fillCircle(lx+4,ly-3,4);
      gOverlay.fillStyle(0x000000,lf*0.09); gOverlay.fillCircle(lx-3,ly+4,3);
    }

    // Soleil
    if(_tod>=0.07&&_tod<=0.60){
      const f=(_tod-0.07)/0.53;
      const sx=W*0.12+f*W*0.74|0, sy=38;
      const dusk=Math.max(0,(_tod-0.43)/0.17);
      const sc=lerpC(0xFFFDE7,0xFF5500,dusk);
      gOverlay.fillStyle(sc,0.06); gOverlay.fillCircle(sx,sy,26);
      gOverlay.fillStyle(sc,0.13); gOverlay.fillCircle(sx,sy,17);
      gOverlay.fillStyle(sc,1);    gOverlay.fillCircle(sx,sy,11);
      for(let a=0;a<8;a++){
        const ang=a/8*Math.PI*2+now*0.25,r1=13,r2=19+Math.sin(now*1.5+a)*2;
        gOverlay.lineStyle(2,sc,0.38);
        gOverlay.lineBetween(sx+Math.cos(ang)*r1|0,sy+Math.sin(ang)*r1|0,sx+Math.cos(ang)*r2|0,sy+Math.sin(ang)*r2|0);
      }
    }

    // Vignette coins
    const vig=Math.max(na,da*0.4)*0.45;
    if(vig>0.05){
      for(let x=0;x<100;x++){const a=((100-x)/100)**2*vig;gOverlay.fillStyle(0x000000,a);gOverlay.fillRect(x,0,1,H);gOverlay.fillRect(W-x-1,0,1,H);}
      for(let y=0;y<80;y++){const a=((80-y)/80)**2*vig*0.75;gOverlay.fillStyle(0x000000,a);gOverlay.fillRect(0,y,W,1);gOverlay.fillRect(0,H-y-1,W,1);}
    }
  }

  // ── Brume ────────────────────────────────────────────────
  function drawFog(camX,camY){
    gFog.clear();
    const now=Date.now()*0.001, fogA=getPF("fogAlpha");
    if(fogA<0.01) return;
    const[fr,fg,fb]=hexToRgb(getC("fogColor"));
    for(let y=H*0.50|0;y<H;y++){
      const wave=Math.sin(now*0.28+y*0.035+camX*0.0006)*0.5+0.5;
      const dist=(y-H*0.50)/(H*0.50);
      const a=fogA*wave*dist*0.55;
      if(a<0.007) continue;
      gFog.fillStyle(rgbToHex(fr,fg,fb),a);
      gFog.fillRect(0,y,W,1);
    }
  }

  // ── Horror ───────────────────────────────────────────────
  function drawHorror(){
    gHorror.clear();
    const na=nightAmt(); if(na<0.10) return;
    const now=Date.now()*0.001;
    // Tentacules coins
    const pts=[{x:0,y:0,dx:1,dy:1},{x:W,y:0,dx:-1,dy:1},{x:0,y:H,dx:1,dy:-1},{x:W,y:H,dx:-1,dy:-1}];
    for(let i=0;i<pts.length;i++){
      const p=pts[i],len=40+Math.sin(now*0.4+i)*20,sw=Math.sin(now*0.5+i*1.3)*12;
      gHorror.lineStyle(1,0x15002A,na*0.75);
      gHorror.lineBetween(p.x,p.y,p.x+p.dx*len+sw,p.y+p.dy*len+sw);
      const pulse=0.5+0.5*Math.sin(now*2.2+i*2);
      gHorror.fillStyle(0x9900EE,na*pulse*0.55);
      gHorror.fillCircle(p.x+p.dx*len+sw,p.y+p.dy*len+sw,5);
    }
    // Yeux
    const eyes=[{x:60,y:H-60},{x:W-70,y:H-55},{x:W*0.32,y:H-50},{x:W*0.68,y:H-58}];
    for(let i=0;i<eyes.length;i++){
      const b=Math.sin(now*0.7+i*3.9); if(b<0.5) continue;
      const a=(b-0.5)/0.5*na;
      gHorror.fillStyle(0xFF1100,a*0.8); gHorror.fillEllipse(eyes[i].x,eyes[i].y,12,6);
      gHorror.fillStyle(0xFFBB00,a);     gHorror.fillCircle(eyes[i].x,eyes[i].y,2);
    }
  }

  // ── Particules ───────────────────────────────────────────
  function updateParticles(delta){
    gParticles.clear();
    const p1=PAL[SEASONS[_sIdx]],p2=PAL[SEASONS[(_sIdx+1)%4]];
    const type=p1.particleType, col=lerpC(p1.particle,p2.particle,_sBlend);
    const na=nightAmt(), now=Date.now()*0.001;
    for(let i=0;i<_parts.length;i++){
      let p=_parts[i];
      if(type==="snow"){p.x+=Math.sin(now*0.5+p.ph)*0.45+p.vx*0.2;p.y+=p.vy*0.4;}
      else if(type==="leaves"){p.x+=p.vx+Math.sin(now*0.6+p.ph)*0.8;p.y+=p.vy*0.6;p.rot+=p.rv;}
      else if(type==="petals"){p.x+=p.vx+Math.sin(now*0.8+p.ph)*0.5;p.y+=p.vy*0.35;}
      else{p.x+=Math.sin(now*1.1+p.ph)*0.7;p.y+=Math.cos(now*0.9+p.ph*1.2)*0.7;p.x=(p.x+W)%W;p.y=(p.y+H)%H;}
      if(p.y>H+10||p.x<-20||p.x>W+20){if(type!=="fireflies"){_parts[i]=mkPart(Math.random()*W,-6);continue;}}
      const px=p.x|0,py=p.y|0;
      if(type==="fireflies"){
        if(na<0.10) continue;
        const gl=0.5+0.5*Math.sin(now*3+p.ph);
        gParticles.fillStyle(0x99FF44,na*gl*0.5);gParticles.fillCircle(px,py,3);
        gParticles.fillStyle(0xCCFF88,na*gl);gParticles.fillRect(px,py,1,1);
      }else{
        gParticles.fillStyle(col,p.al*0.8);gParticles.fillRect(px,py,p.sz,p.sz);
        gParticles.fillStyle(col,p.al*0.3);gParticles.fillRect(px+1,py+1,1,1);
      }
    }
  }
  function mkPart(x,y){return{x,y,vx:(Math.random()-0.5)*0.7,vy:0.25+Math.random()*0.8,rot:Math.random()*Math.PI*2,rv:(Math.random()-0.5)*0.05,ph:Math.random()*Math.PI*2,sz:1+Math.floor(Math.random()*2),al:0.45+Math.random()*0.5};}

  // ── Rendu monde ──────────────────────────────────────────
  function renderWorld(camX,camY){
    gBase.clear();
    const now=Date.now()*0.001;
    const startTX=Math.floor(camX/TILE)-1;
    const startTY=Math.floor(camY/TILE)-1;
    const offX=((camX%TILE)+TILE)%TILE, offY=((camY%TILE)+TILE)%TILE;
    for(let row=0;row<ROWS+2;row++){
      for(let col=0;col<COLS+2;col++){
        const tx=startTX+col, ty=startTY+row;
        const sx=col*TILE-offX|0, sy=row*TILE-offY|0;
        if(sx>W+TILE||sy>H+TILE||sx<-TILE||sy<-TILE) continue;
        drawTile(gBase,sx,sy,getTile(tx,ty),tx,ty,now);
      }
    }
  }

  // ── Init ─────────────────────────────────────────────────
  function initStars(){
    _stars=[];
    for(let i=0;i<220;i++)_stars.push({x:Math.random()*W,y:Math.random()*H*0.88,sz:Math.random()<0.10?2:1,ph:Math.random()*Math.PI*2,sp:0.02+Math.random()*0.05});
  }
  function initParts(){
    _parts=[];
    for(let i=0;i<65;i++)_parts.push(mkPart(Math.random()*W,Math.random()*H));
  }

  // ── API ──────────────────────────────────────────────────
  function preload(scene){}

  function create(scene){
    _tod=0.22;_sIdx=0;_sBlend=0;_sTimer=0;
    const D=-200;
    gBase      =scene.add.graphics().setScrollFactor(0).setDepth(D);
    gOverlay   =scene.add.graphics().setScrollFactor(0).setDepth(D+5);
    gFog       =scene.add.graphics().setScrollFactor(0).setDepth(D+6);
    gParticles =scene.add.graphics().setScrollFactor(0).setDepth(D+7);
    gHorror    =scene.add.graphics().setScrollFactor(0).setDepth(D+8);
    initStars(); initParts();
    // Pré-charger les chunks autour de l'origine immédiatement
    for(let cx=-PRELOAD_RADIUS;cx<=PRELOAD_RADIUS;cx++)
      for(let cy=-PRELOAD_RADIUS;cy<=PRELOAD_RADIUS;cy++)
        getChunk(cx,cy);
  }

  function update(scene,time,delta){
    const dt=delta/1000;
    _tod=(_tod+dt/(DAY_DURATION/1000))%1;
    _sTimer+=delta;
    if(_sTimer>=SEASON_DURATION){_sTimer=0;_sIdx=(_sIdx+1)%4;_sBlend=0;}
    _sBlend=_sTimer>SEASON_DURATION-15000?(_sTimer-(SEASON_DURATION-15000))/15000:0;

    const camX=scene.cameras.main.worldView.x;
    const camY=scene.cameras.main.worldView.y;

    // Déclenche le pré-chargement des chunks proches (asynchrone, sans freeze)
    const px=scene.GS?.player?.x||camX+W/2;
    const py=scene.GS?.player?.y||camY+H/2;
    schedulePreload(px,py);

    renderWorld(camX,camY);
    drawOverlay(camX,camY);
    drawFog(camX,camY);
    updateParticles(delta);
    drawHorror();
  }

  function setSeason(n){const i=SEASONS.indexOf(n);if(i>=0){_sIdx=i;_sBlend=0;_sTimer=0;}}
  function setTimeOfDay(t){_tod=((t%1)+1)%1;}
  function getState(){return{timeOfDay:_tod,season:SEASONS[_sIdx],blend:_sBlend};}
  function isWalkable(wx,wy){const t=getTile(Math.floor(wx/TILE),Math.floor(wy/TILE));return WALKABLE[t]!==false;}
  function getTileAt(wx,wy){return getTile(Math.floor(wx/TILE),Math.floor(wy/TILE));}

  return{preload,create,update,setSeason,setTimeOfDay,getState,isWalkable,getTileAt,TILE};
})();