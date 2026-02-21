// Namespace global
window.GS = window.GS || {};

// Messages in-game
GS.msgQueue = [];
GS.msgTimer = 0;
GS.msgText = null;

GS.pushMsg = function (text) {
  GS.msgQueue.push(text);
  if (GS.msgTimer <= 0 && GS.msgText) {
    GS.msgTimer = 3400;
    GS.msgText.setText(GS.msgQueue[0]);
  }
};

GS.updateMessages = function (delta) {
  if (!GS.msgText) return;
  if (GS.msgQueue.length === 0) {
    GS.msgText.setText("");
    return;
  }
  GS.msgTimer -= delta;
  if (GS.msgTimer <= 0) {
    GS.msgQueue.shift();
    if (GS.msgQueue.length > 0) {
      GS.msgText.setText(GS.msgQueue[0]);
      GS.msgTimer = 2400;
    } else {
      GS.msgText.setText("");
    }
  }
};

// FASTA
GS.parseFasta = function (text) {
  const seqs = {};
  let current = null;

  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith(">")) {
      current = line.slice(1).trim();
      seqs[current] = "";
    } else if (current) {
      seqs[current] += line.toUpperCase().replace(/[^ATCGN]/g, "");
    }
  }
  return seqs;
};

GS.flashRect = function (rect, color, ms) {
  const original = rect.fillColor;
  rect.fillColor = color;
  setTimeout(() => {
    if (rect && rect.scene) rect.fillColor = original;
  }, ms);
};


GS.radial = {
  container: null,
  items: [],
  visible: false
};

GS.openRadialMenu = function(scene, title) {
  GS.closeRadialMenu(scene);

  const cx = scene.cameras.main.width / 2;
  const cy = scene.cameras.main.height / 2;

  const c = scene.add.container(0, 0).setDepth(2000);
  c.setScrollFactor?.(0);

  const bg = scene.add.rectangle(cx, cy, 520, 320, 0x000000, 0.75)
    .setScrollFactor(0);
  const t = scene.add.text(cx - 230, cy - 140, title, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff"
  }).setScrollFactor(0);

  GS.radial.titleText = t;
  


  // 4 cercles
  const options = [
    { key: "inversion",   label: "Z  Inversion",   x: cx,     y: cy - 80 },
    { key: "deletion",    label: "E  Délétion",    x: cx + 120, y: cy },
    { key: "substitution",label: "S  Substitution",x: cx - 120, y: cy },
    { key: "insertion",   label: "A  Insertion",   x: cx,     y: cy + 80 }
    
  ];

  const circles = [];
  for (const opt of options) {
    const circle = scene.add.circle(opt.x, opt.y, 14, 0xffffff, 0.09).setScrollFactor(0);
    const keyLetter = opt.label.split(" ")[0]; // Z/S/A/E
    const keyTxt = scene.add.text(opt.x - 3, opt.y - 5, keyLetter, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff"
    }).setScrollFactor(0);

    const name = opt.label.slice(3); // "Inversion"...
    const txt = scene.add.text(opt.x + 40, opt.y - 10, name, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff"
    }).setScrollFactor(0);

    circles.push({ opt, circle, keyTxt, txt });

  }

  c.add([bg, t, ...circles.flatMap(o => [o.circle, o.keyTxt, o.txt])]);


  GS.radial.container = c;
  GS.radial.items = circles;
  GS.radial.visible = true;

  // Pause pendant le menu
  GS.setPaused(scene, true);

};


GS.closeRadialMenu = function(scene) {
  if (GS.radial.container) GS.radial.container.destroy(true);
  GS.radial.container = null;
  GS.radial.items = [];
  GS.radial.visible = false;

  // Reprendre seulement si pas inventaire
  // Reprendre uniquement si inventaire fermé
  if (!scene.GS.invOpen) GS.setPaused(scene, false);

};

// Croix DPAD 
GS.createDpad = function(scene) {
  const x = 70;
  const y = scene.cameras.main.height - 120;

  const c = scene.add.container(0, 0).setDepth(1200);
  c.setScrollFactor?.(0);

  const base = scene.add.rectangle(x, y, 120, 120, 0x000000, 0.35).setScrollFactor(0);
  const up    = scene.add.rectangle(x, y-35, 28, 28, 0xffffff, 0.15).setScrollFactor(0);
  const down  = scene.add.rectangle(x, y+35, 28, 28, 0xffffff, 0.15).setScrollFactor(0);
  const left  = scene.add.rectangle(x-35, y, 28, 28, 0xffffff, 0.15).setScrollFactor(0);
  const right = scene.add.rectangle(x+35, y, 28, 28, 0xffffff, 0.15).setScrollFactor(0);
  const mid   = scene.add.rectangle(x, y, 22, 22, 0xffffff, 0.08).setScrollFactor(0);

  const t = scene.add.text(x - 32, y - 70, "Déplacement", {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#ffffff"
  }).setScrollFactor(0);

  c.add([base, up, down, left, right, mid, t]);
  return c;
};

// Radial HUD
GS.createRadialHud = function(scene, x, y, title, slots, scale = 1) {
  const c = scene.add.container(0, 0).setDepth(1300);
  c.setScrollFactor?.(0);

  const bgSize = 210 * scale;
  const titleOffsetX = 25 * scale;
  const titleOffsetY = 125 * scale;

  const bg = scene.add.rectangle(x, y, bgSize, bgSize, 0x000000, 0.22).setScrollFactor(0);
  const t = scene.add.text(x - titleOffsetX, y - titleOffsetY , title, {
    fontFamily: "Arial",
    fontSize: `${Math.round(14 * scale)}px`,
    color: "#ffffff"
  }).setScrollFactor(0);

  const ring = [];
  const n = slots.length;
  const radius = 62 * scale;
  const circleR = 22 * scale;


  for (let i = 0; i < n; i++) {
    const ang = (-Math.PI / 2) + (i * (2 * Math.PI / n));
    const px = x + Math.cos(ang) * radius;
    const py = y + Math.sin(ang) * radius;

    const slot = slots[i];
    const enabled = !!slot.enabled;

    const circle = scene.add.circle(px, py, circleR, 0xffffff, enabled ? 0.16 : 0.06).setScrollFactor(0);

    const keyTxt = scene.add.text(px - 6*scale, py - 10*scale, enabled ? slot.key : "", {
      fontFamily: "Arial",
      fontSize: `${Math.round(16 * scale)}px`,
      color: "#ffffff"
    }).setScrollFactor(0);

    const nameTxt = scene.add.text( (px - 45) + 30*scale, 23 + py - 10*scale, enabled ? slot.name : "—", {
      fontFamily: "Arial",
      fontSize: `${Math.round(14 * scale)}px`,
      color: enabled ? "#ffffff" : "#777777"
    }).setScrollFactor(0);


    ring.push({ circle, keyTxt, nameTxt });
  }

  c.add([bg, t, ...ring.flatMap(r => [r.circle, r.keyTxt, r.nameTxt])]);

  // petit helper pour update
  c._ring = ring;
  c._title = t;
  c.setTitle = function(newTitle) {
    c._title.setText(newTitle || "");
  };
  c._x = x;
  c._y = y;
  c._slots = slots;

  c.updateSlots = function(newSlots) {
    c._slots = newSlots;
    for (let i = 0; i < c._ring.length; i++) {
      const slot = newSlots[i];
      const enabled = !!slot.enabled;
      const r = c._ring[i];

      r.circle.setFillStyle(0xffffff, enabled ? 0.16 : 0.06);
      r.keyTxt.setText(enabled ? slot.key : "");
      r.nameTxt.setText(enabled ? slot.name : "—");
      r.nameTxt.setColor(enabled ? "#ffffff" : "#777777");
    }
  };

  return c;
};

GS.setPaused = function(scene, paused) {
  scene.GS.isPaused = paused;
  scene.physics.world.isPaused = paused;
};

GS.setRadialTitle = function(scene, txt){
    if (GS.radial.titleText) GS.radial.titleText.setText(txt);
  };

// creation des barre de vie des ennemis(monsters et dark shifters)
GS.attachHpBar = function(scene, m) {
  // évite double création
  if (m.hpBg || m.hpBar) return;

  m.hpBg  = scene.add.rectangle(m.x, m.y - 22, 34, 6, 0x111111, 0.9).setDepth(10);
  m.hpBar = scene.add.rectangle(m.x, m.y - 22, 34, 6, 0xef4444, 1).setDepth(11);

  // dans le monde (doit suivre la caméra)
  m.hpBg.setScrollFactor(1);
  m.hpBar.setScrollFactor(1);
};


// Met à jour toutes les barres HP (position + taille)
GS.updateAllHpBars = function () {
  if (!GS.monsters) return;

  for (const m of GS.monsters.getChildren()) {
    if (!m || !m.active || !m.gs) continue;

    if (m.hpBg)  m.hpBg.setPosition(m.x, m.y - 22);
    if (m.hpBar) m.hpBar.setPosition(m.x, m.y - 22);

    const hp = m.gs.hp ?? 0;
    const maxHp = m.gs.maxHp ?? 1;
    const r = Phaser.Math.Clamp(hp / maxHp, 0, 1);

    if (m.hpBar) m.hpBar.width = 34 * r;
  }
};
