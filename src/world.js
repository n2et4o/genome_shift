window.GS = window.GS || {};

// --------- Monde infini par chunks ---------
// Un chunk = une zone carrée de CHUNK_SIZE pixels
GS.world = {
  seed: 1337,
  CHUNK_SIZE: 900,
  VIEW_RADIUS: 1,     // 1 => 3x3 chunks autour du joueur
  activeChunks: new Map(), // key => { gfx, spawned }
  maxEntitiesPerChunk: { monsters: 1.1, loot: 1 }
};

// hash simple (déterministe) pour "random" stable par chunk
GS.hash2 = function (x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  // -> [0..1)
  return ((n >>> 0) % 1000000) / 1000000;
};

GS.randBetween = function (a, b, r01) {
  return a + (b - a) * r01;
};

GS.chunkKey = (cx, cy) => `${cx},${cy}`;
GS.worldToChunk = function (x, y) {
  const s = GS.world.CHUNK_SIZE;
  return { cx: Math.floor(x / s), cy: Math.floor(y / s) };
};

GS.ensureChunksAroundPlayer = function (scene) {
  const p = scene.GS.player;
  const { cx, cy } = GS.worldToChunk(p.x, p.y);
  const R = GS.world.VIEW_RADIUS;

  // 1) créer les chunks requis
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      const k = GS.chunkKey(cx + dx, cy + dy);
      if (!GS.world.activeChunks.has(k)) {
        GS.spawnChunk(scene, cx + dx, cy + dy);
      }
    }
  }

  // 2) détruire ceux trop loin
  // for (const [k, chunk] of GS.world.activeChunks.entries()) {
  //   const [ccx, ccy] = k.split(",").map(Number);
  //   if (Math.abs(ccx - cx) > R || Math.abs(ccy - cy) > R) {
  //     GS.despawnChunk(scene, ccx, ccy);
  //   }
  // }

  const kids = GS.monsters.getChildren();
  if (kids.length > 60) {
    for (let i = 0; i < 10; i++) kids[i].destroy();
  }

   // 2) marquer ceux trop loin (ne pas delete pendant l'itération)
  const toRemove = [];
  for (const k of GS.world.activeChunks.keys()) {
    const [ccx, ccy] = k.split(",").map(Number);
    if (Math.abs(ccx - cx) > R || Math.abs(ccy - cy) > R) {
      toRemove.push({ ccx, ccy });
    }
  }

  // supprimer après
  for (const r of toRemove) {
    GS.despawnChunk(scene, r.ccx, r.ccy);
  }

};

GS.spawnChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const s = GS.world.CHUNK_SIZE;
  const x0 = cx * s;
  const y0 = cy * s;

  // Décor très léger (points) — pas trop dense !
  const gfx = scene.add.graphics();
  gfx.setDepth(-10);
  gfx.fillStyle(0x1f1f1f, 1);

  // points déterministes
  const points = 12;
  for (let i = 0; i < points; i++) {
    const rx = GS.hash2(cx * 100 + i, cy * 100 + 7, GS.world.seed);
    const ry = GS.hash2(cx * 100 + 9, cy * 100 + i, GS.world.seed);
    const px = x0 + Math.floor(rx * s);
    const py = y0 + Math.floor(ry * s);
    gfx.fillCircle(px, py, 2);
  }

  // Spawn monstres (déterministe)
  GS.spawnEntitiesForChunk(scene, cx, cy);

  GS.world.activeChunks.set(k, { gfx });
};

GS.despawnChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const chunk = GS.world.activeChunks.get(k);
  if (!chunk) return;

  chunk.gfx.destroy();

  for (const m of GS.monsters.getChildren()) {
    if (m && m.gs && m.gs.chunkKey === k) m.destroy();
  }
  const kids = GS.monsters.getChildren();
  if (kids.length > 60) {
    for (let i = 0; i < 10; i++) kids[i].destroy();
  }


  for (const l of GS.lootGroup.getChildren()) {
    if (l && l.chunkKey === k) {
      if (l.label) l.label.destroy();
      l.destroy();
    }
  }

  GS.world.activeChunks.delete(k);
};


GS.spawnEntitiesForChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const s = GS.world.CHUNK_SIZE;
  const x0 = cx * s;
  const y0 = cy * s;

  // --- Monstres
  const nMonsters = Math.floor(GS.randBetween(1, GS.world.maxEntitiesPerChunk.monsters + 1,
    GS.hash2(cx, cy, GS.world.seed)));
  //const nMonsters = GS.world.maxEntitiesPerChunk.monsters;


  for (let i = 0; i < nMonsters; i++) {
    const rx = GS.hash2(cx * 1000 + i, cy * 1000 + 33, GS.world.seed);
    const ry = GS.hash2(cx * 1000 + 77, cy * 1000 + i, GS.world.seed);
    const x = x0 + 80 + Math.floor(rx * (s - 160));
    const y = y0 + 80 + Math.floor(ry * (s - 160));

    // petite chance de Dark Shifter
    const rKind = GS.hash2(cx * 10 + i, cy * 10 + i, GS.world.seed);
    const kind = (rKind > 0.88) ? "dark" : "normal";
    const id = (kind === "dark") ? "dark_shifter" : (rKind > 0.55 ? "monster_wolf" : "monster_slime");

    const m = GS.spawnMonster(scene, id, x, y, { kind });
    m.gs.chunkKey = k;
  }

  // --- Loot PCR (rare)
  // On ne spawn que si pas déjà loot (sinon, tu pourrais re-loot à l'infini)
  // Ici: un loot random par chunk, mais seulement si l'item n'est pas déjà obtenu
  const lootKeys = Object.keys(GS.inventory.pcr).filter(key => !GS.inventory.pcr[key].have);
  if (lootKeys.length > 0) {
    const rLoot = GS.hash2(cx * 999, cy * 777, GS.world.seed);
    if (rLoot > 0.82) {
      const pick = lootKeys[Math.floor(rLoot * lootKeys.length) % lootKeys.length];
      const lx = x0 + Math.floor(GS.hash2(cx, cy + 1, GS.world.seed) * (s - 160)) + 80;
      const ly = y0 + Math.floor(GS.hash2(cx + 1, cy, GS.world.seed) * (s - 160)) + 80;
      const loot = GS.spawnLoot(scene, pick, lx, ly);
      // spawnLoot ne renvoie rien chez toi -> on va le corriger plus bas
      // on tagge dans equipement.js
      if (loot) {
        loot.chunkKey = k;
        if (loot.label) loot.label.setScrollFactor(1);
      }
    }
  }
  
};
