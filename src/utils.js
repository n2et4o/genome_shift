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

  // 4 cercles
  const options = [
    { key: "inversion",   label: "Z  Inversion",   x: cx,     y: cy - 80 },
    { key: "substitution",label: "S  Substitution",x: cx + 120, y: cy },
    { key: "insertion",   label: "A  Insertion",   x: cx,     y: cy + 80 },
    { key: "deletion",    label: "E  Délétion",    x: cx - 120, y: cy }
  ];

  const circles = [];
  for (const opt of options) {
    const circle = scene.add.circle(opt.x, opt.y, 28, 0xffffff, 0.18)
      .setScrollFactor(0);
    const txt = scene.add.text(opt.x + 40, opt.y - 10, opt.label, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff"
    }).setScrollFactor(0);
    circles.push({ opt, circle, txt });
  }

  c.add([bg, t, ...circles.flatMap(o => [o.circle, o.txt])]);

  GS.radial.container = c;
  GS.radial.items = circles;
  GS.radial.visible = true;

  // Pause pendant le menu
  scene.GS.isPaused = true;
  scene.physics.world.isPaused = true;
};

GS.closeRadialMenu = function(scene) {
  if (GS.radial.container) GS.radial.container.destroy(true);
  GS.radial.container = null;
  GS.radial.items = [];
  GS.radial.visible = false;

  // Reprendre seulement si pas inventaire
  if (!scene.GS.invOpen) {
    scene.GS.isPaused = false;
    scene.physics.world.isPaused = false;
  }
};
