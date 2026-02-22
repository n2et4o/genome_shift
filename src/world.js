window.GS = window.GS || {};

// --------- Monde infini par chunks ---------

GS.world = {
  seed: 1337,
  CHUNK_SIZE: 900,
  VIEW_RADIUS: 1, // change à 2 si tu veux moins de disparition

  activeChunks: new Map(),      // chunks actuellement affichés
  spawnedOnce: new Set(),       // chunks déjà générés au moins une fois
  chunkEntities: new Map(),     // chunkKey -> { monsters: [], loots: [] }

  maxEntitiesPerChunk: { monsters: 1.1, loot: 1 }
};

GS.hash2 = function (x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
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

// ========================================================
// GESTION DES CHUNKS AUTOUR DU JOUEUR
// ========================================================

GS.ensureChunksAroundPlayer = function (scene) {
  const p = scene.GS.player;
  const { cx, cy } = GS.worldToChunk(p.x, p.y);
  const R = GS.world.VIEW_RADIUS;

  // créer chunks nécessaires
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      const k = GS.chunkKey(cx + dx, cy + dy);
      if (!GS.world.activeChunks.has(k)) {
        GS.spawnChunk(scene, cx + dx, cy + dy);
      }
    }
  }

  // désactiver chunks trop loin
  const toRemove = [];
  for (const k of GS.world.activeChunks.keys()) {
    const [ccx, ccy] = k.split(",").map(Number);
    if (Math.abs(ccx - cx) > R || Math.abs(ccy - cy) > R) {
      toRemove.push({ ccx, ccy });
    }
  }

  for (const r of toRemove) {
    GS.despawnChunk(scene, r.ccx, r.ccy);
  }
};

// ========================================================
// SPAWN CHUNK
// ========================================================

GS.spawnChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const s = GS.world.CHUNK_SIZE;
  const x0 = cx * s;
  const y0 = cy * s;

  const gfx = scene.add.graphics();
  gfx.setDepth(-10);
  gfx.fillStyle(0x1f1f1f, 1);

  const points = 12;
  for (let i = 0; i < points; i++) {
    const rx = GS.hash2(cx * 100 + i, cy * 100 + 7, GS.world.seed);
    const ry = GS.hash2(cx * 100 + 9, cy * 100 + i, GS.world.seed);
    const px = x0 + Math.floor(rx * s);
    const py = y0 + Math.floor(ry * s);
    gfx.fillCircle(px, py, 2);
  }

  // si déjà généré → réactivation
  if (GS.world.spawnedOnce.has(k)) {
    GS.reactivateChunkEntities(k);
  } else {
    GS.spawnEntitiesForChunk(scene, cx, cy);
    GS.world.spawnedOnce.add(k);
  }

  GS.world.activeChunks.set(k, { gfx });
};

// ========================================================
// DESPAWN (désactivation uniquement)
// ========================================================

GS.despawnChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const chunk = GS.world.activeChunks.get(k);
  if (!chunk) return;

  GS.deactivateChunkEntities(k);

  chunk.gfx.destroy();
  GS.world.activeChunks.delete(k);
};

// ========================================================
// SPAWN ENTITÉS D’UN CHUNK
// ========================================================

GS.spawnEntitiesForChunk = function (scene, cx, cy) {
  const k = GS.chunkKey(cx, cy);
  const s = GS.world.CHUNK_SIZE;
  const x0 = cx * s;
  const y0 = cy * s;

  GS.world.chunkEntities.set(k, { monsters: [], loots: [] });

  const nMonsters = Math.floor(
    GS.randBetween(1, GS.world.maxEntitiesPerChunk.monsters + 1,
      GS.hash2(cx, cy, GS.world.seed))
  );

  for (let i = 0; i < nMonsters; i++) {
    let x, y;
    for (let tries = 0; tries < 12; tries++) {
      const rx = GS.hash2(cx * 1000 + i + tries, cy * 1000 + 33, GS.world.seed);
      const ry = GS.hash2(cx * 1000 + 77, cy * 1000 + i + tries, GS.world.seed);
      x = x0 + 80 + Math.floor(rx * (s - 160));
      y = y0 + 80 + Math.floor(ry * (s - 160));

      // pas trop près du joueur
      const dp = Phaser.Math.Distance.Between(scene.GS.player.x, scene.GS.player.y, x, y);
      if (dp < 120) continue;

      // pas trop près des autres mobs déjà spawn dans ce chunk
      const already = GS.world.chunkEntities.get(k)?.monsters ?? [];
      let ok = true;
      for (const other of already) {
        if (!other) continue;
        if (Phaser.Math.Distance.Between(other.x, other.y, x, y) < 60) { ok = false; break; }
      }
      if (ok) break;
    }

    const rKind = GS.hash2(cx * 10 + i, cy * 10 + i, GS.world.seed);
    const kind = (rKind > 0.88) ? "dark" : "normal";

    let m;
    if (kind === "dark") {
      m = GS.spawnDarkShifter(scene, x, y);
    } else {
      const id = (rKind > 0.55 ? "monster_wolf" : "monster_slime");
      m = GS.spawnMonster(scene, id, x, y, { kind: "normal" });
    }

    m.gs.chunkKey = k;
    GS.world.chunkEntities.get(k).monsters.push(m);
  }
};

// ========================================================
// ACTIVER / DÉSACTIVER ENTITÉS
// ========================================================

GS.deactivateChunkEntities = function (k) {
  const pack = GS.world.chunkEntities.get(k);
  if (!pack) return;

  for (const m of pack.monsters) {
    if (!m) continue;
    m.setActive(false).setVisible(false);
    if (m.body) m.body.enable = false;
    if (m.hpBg) m.hpBg.setVisible(false);
    if (m.hpBar) m.hpBar.setVisible(false);
  }
};

GS.reactivateChunkEntities = function (k) {
  const pack = GS.world.chunkEntities.get(k);
  if (!pack) return;

  for (const m of pack.monsters) {
    if (!m) continue;
    m.setActive(true).setVisible(true);
    if (m.body) m.body.enable = true;
    if (m.hpBg) m.hpBg.setVisible(true);
    if (m.hpBar) m.hpBar.setVisible(true);
  }
};