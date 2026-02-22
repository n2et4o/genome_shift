window.GS = window.GS || {};

// =========================
// CONFIG MAP
// =========================
GS.MAP = {
  MINI_W: 220,
  MINI_H: 140,
  MARGIN: 14,

  // Rayon “carte” autour du héros (en pixels monde)
  WORLD_RADIUS: 900,      // carte normale
  HEAT_RADIUS: 900,       // heatmap (peut être différent)
  HEAT_CELL: 90,          // taille cellule heatmap

  // progression carte
  // 0 = base, 1 = PCR items, 2 = heatmap, 3 = volcanoplot
  level: 0,

  // état UI
  open: false
};

// =========================
// INIT MAP
// =========================
GS.initMap = function (scene) {
  // 2 layers UI (mini + full)
  GS.mapGfxMini = scene.add.graphics().setScrollFactor(0).setDepth(9999);
  GS.mapGfxFull = scene.add.graphics().setScrollFactor(0).setDepth(10000);
  GS.mapGfxFull.setVisible(false);

  // Toggle M
  scene.input.keyboard.on("keydown-M", () => {
    GS.toggleMap(scene);
  });
};

// =========================
// TOGGLE FULL MAP + PAUSE
// =========================
GS.toggleMap = function (scene) {
  GS.MAP.open = !GS.MAP.open;
  GS.mapGfxFull.setVisible(GS.MAP.open);

  // Pause logique de ton jeu
  // (si tu as déjà GS.paused / GS.togglePause, adapte ici)
  GS.paused = GS.MAP.open;

  // pause physics aussi (recommandé)
  if (GS.MAP.open) scene.physics.world.pause();
  else scene.physics.world.resume();
};

// =========================
// API “UNLOCK” (livres)
// =========================
GS.unlockMapLevel = function (lvl) {
  GS.MAP.level = Math.max(GS.MAP.level, lvl);
};

// Exemple : quand tu ramasses le livre PCR -> GS.unlockMapLevel(1)
// Exemple : après 1ère PCR complète -> GS.unlockMapLevel(2)
// Exemple : livre volcanoplot -> GS.unlockMapLevel(3)

// =========================
// UPDATE MAP (à appeler dans main.js update())
// =========================
GS.updateMap = function (scene) {
  GS.drawMiniMap(scene);
  if (GS.MAP.open) GS.drawFullMap(scene);
};

// =========================
// HELPERS
// =========================
GS._mapRectScreenPos = function (W, H, w, h, margin) {
  return { x: W - w - margin, y: margin, w, h };
};

GS._worldToMap = function (wx, wy, centerX, centerY, radius, mapX, mapY, mapW, mapH) {
  // world -> [-radius..+radius] -> [0..1] -> map coords
  const nx = (wx - centerX) / (radius * 2) + 0.5;
  const ny = (wy - centerY) / (radius * 2) + 0.5;

  const sx = mapX + nx * mapW;
  const sy = mapY + ny * mapH;
  return { sx, sy, nx, ny };
};

GS._inMapBounds = function (nx, ny) {
  return nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
};

// =========================
// DRAW MINI MAP
// =========================
GS.drawMiniMap = function (scene) {
  const W = 1200, H = 600; // ton écran
  const r = GS._mapRectScreenPos(W, H, GS.MAP.MINI_W, GS.MAP.MINI_H, GS.MAP.MARGIN);

  const hero = scene.GS.player;
  const cx = hero.x, cy = hero.y;

  const gfx = GS.mapGfxMini;
  gfx.clear();

  // fond + bordure
  gfx.fillStyle(0x000000, 0.55);
  gfx.fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  gfx.lineStyle(2, 0xffffff, 0.35);
  gfx.strokeRoundedRect(r.x, r.y, r.w, r.h, 8);

  // carte “environnement” simple (grille)
  GS._drawEnvironmentGrid(gfx, r);

  // héros
  GS._drawHeroDot(gfx, hero, cx, cy, GS.MAP.WORLD_RADIUS, r);

  // objets PCR (si débloqué)
  if (GS.MAP.level >= 1) {
    GS._drawPcrItems(gfx, scene, cx, cy, GS.MAP.WORLD_RADIUS, r);
  }

  // heatmap (si débloqué)
  if (GS.MAP.level >= 2) {
    GS._drawHeatmap(gfx, scene, cx, cy, GS.MAP.HEAT_RADIUS, r, false);
  }

  // marqueur volcanoplot (si débloqué)
  if (GS.MAP.level >= 3) {
    GS._drawVolcanoBook(gfx, scene, cx, cy, GS.MAP.WORLD_RADIUS, r);
  }
};

// =========================
// DRAW FULL MAP
// =========================
GS.drawFullMap = function (scene) {
  const W = 1200, H = 600;
  const margin = 40;
  const r = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 };

  const hero = scene.GS.player;
  const cx = hero.x, cy = hero.y;

  const gfx = GS.mapGfxFull;
  gfx.clear();

  // overlay sombre
  gfx.fillStyle(0x000000, 0.75);
  gfx.fillRect(0, 0, W, H);

  // cadre carte
  gfx.fillStyle(0x000000, 0.65);
  gfx.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
  gfx.lineStyle(2, 0xffffff, 0.6);
  gfx.strokeRoundedRect(r.x, r.y, r.w, r.h, 10);

  GS._drawEnvironmentGrid(gfx, r);

  GS._drawHeroDot(gfx, hero, cx, cy, GS.MAP.WORLD_RADIUS * 1.6, r);

  if (GS.MAP.level >= 1) {
    GS._drawPcrItems(gfx, scene, cx, cy, GS.MAP.WORLD_RADIUS * 1.6, r);
  }

  if (GS.MAP.level >= 2) {
    GS._drawHeatmap(gfx, scene, cx, cy, GS.MAP.HEAT_RADIUS * 1.6, r, true);
  }

  if (GS.MAP.level >= 3) {
    GS._drawVolcanoBook(gfx, scene, cx, cy, GS.MAP.WORLD_RADIUS * 1.6, r);
  }

  // petit texte aide
  gfx.fillStyle(0xffffff, 0.9);
  gfx.fillRect(r.x, r.y - 26, 260, 20);
};

// =========================
// VISU: ENV GRID
// =========================
GS._drawEnvironmentGrid = function (gfx, r) {
  gfx.lineStyle(1, 0xffffff, 0.08);
  const step = 22;
  for (let x = r.x; x <= r.x + r.w; x += step) {
    gfx.lineBetween(x, r.y, x, r.y + r.h);
  }
  for (let y = r.y; y <= r.y + r.h; y += step) {
    gfx.lineBetween(r.x, y, r.x + r.w, y);
  }
};

// =========================
// VISU: HERO DOT
// =========================
GS._drawHeroDot = function (gfx, hero, cx, cy, radius, r) {
  const p = GS._worldToMap(hero.x, hero.y, cx, cy, radius, r.x, r.y, r.w, r.h);
  gfx.fillStyle(0x22c55e, 1);
  gfx.fillCircle(p.sx, p.sy, 4);
};

// =========================
// VISU: PCR ITEMS
// (adapte selon comment tu stockes tes objets)
// =========================
GS._drawPcrItems = function (gfx, scene, cx, cy, radius, r) {
  // Si tu as un groupe GS.loots et loot.gs.type etc.
  if (!GS.loots) return;

  for (const loot of GS.loots.getChildren()) {
    if (!loot || !loot.active) continue;

    const t = loot.gs?.type;
    if (!t) continue;

    // on affiche uniquement les 4 objets PCR
    const isPcr = (t === "dntp" || t === "primer" || t === "polymerase" || t === "template");
    if (!isPcr) continue;

    const p = GS._worldToMap(loot.x, loot.y, cx, cy, radius, r.x, r.y, r.w, r.h);
    if (!GS._inMapBounds(p.nx, p.ny)) continue;

    gfx.fillStyle(0xfacc15, 1);
    gfx.fillRect(p.sx - 2, p.sy - 2, 4, 4);
  }
};

// =========================
// VISU: HEATMAP MONSTERS
// =========================
GS._drawHeatmap = function (gfx, scene, cx, cy, radius, r, big) {
  if (!GS.monsters) return;

  const cell = GS.MAP.HEAT_CELL * (big ? 1 : 1); // tu peux changer si tu veux
  const cols = Math.floor((radius * 2) / cell);
  const rows = Math.floor((radius * 2) / cell);

  // compteur par cellule
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (const m of GS.monsters.getChildren()) {
    if (!m || !m.active) continue;

    const dx = m.x - cx;
    const dy = m.y - cy;

    if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;

    const gx = Math.floor((dx + radius) / cell);
    const gy = Math.floor((dy + radius) / cell);

    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
      grid[gy][gx] += 1;
    }
  }

  // normalisation simple
  let maxV = 1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) maxV = Math.max(maxV, grid[y][x]);

  // dessin : intensité = alpha (même couleur)
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const v = grid[gy][gx];
      if (v <= 0) continue;

      const a = Math.min(0.60, 0.12 + (v / maxV) * 0.55);

      const wx = -radius + gx * cell;
      const wy = -radius + gy * cell;

      const p = GS._worldToMap(cx + wx, cy + wy, cx, cy, radius, r.x, r.y, r.w, r.h);
      const p2 = GS._worldToMap(cx + wx + cell, cy + wy + cell, cx, cy, radius, r.x, r.y, r.w, r.h);

      gfx.fillStyle(0xef4444, a);
      gfx.fillRect(p.sx, p.sy, (p2.sx - p.sx), (p2.sy - p.sy));
    }
  }
};

// =========================
// VISU: VOLCANO BOOK (placeholder)
// =========================
GS._drawVolcanoBook = function (gfx, scene, cx, cy, radius, r) {
  // plus tard: quand tu auras un objet/livre dédié.
  // Ici on cherche un loot type "book_volcano" par exemple.
  if (!GS.loots) return;

  for (const loot of GS.loots.getChildren()) {
    if (!loot || !loot.active) continue;
    if (loot.gs?.type !== "book_volcano") continue;

    const p = GS._worldToMap(loot.x, loot.y, cx, cy, radius, r.x, r.y, r.w, r.h);
    if (!GS._inMapBounds(p.nx, p.ny)) continue;

    gfx.fillStyle(0xa855f7, 1);
    gfx.fillCircle(p.sx, p.sy, 4);
  }
};