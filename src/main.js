// =====================
// Genome Shift (MVP)
// Phaser 3
// =====================

const W = 960;
const H = 540;

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

let player;
let monsters;
let cursors;
let uiText;
let helpText;

let fasta = {};
let lastDamageAt = 0;

let msgText;
let msgQueue = [];
let msgTimer = 0;

let invOpen = false;
let invPanel;
let invText;

let lootGroup;



// ---------- Etat joueur ----------
const hero = {
  dna: "ATCG",
  hp: 100,
  maxHp: 100,
  atk: 10,
  def: 4,
  speed: 220
};

// ---------- Inventaire PCR ----------
const inventory = {
  // Déjà possédés (communs dans ton univers)
  common: {
    mg: { name: "Ion magnésium (Mg²⁺)", have: true, desc: "Cofacteur essentiel pour l’activité de la polymérase." },
    buffer: { name: "Tampon de réaction", have: true, desc: "Assure un pH et une force ionique optimaux." },
    water: { name: "Eau ultrapure", have: true, desc: "Pour ajuster le volume final du mélange réactionnel." }
  },
  // À trouver pour débloquer PCR
  pcr: {
    matrix: { name: "ADN matrice", have: false, desc: "Échantillon contenant la séquence à amplifier." },
    primers: { name: "Amorces (x2)", have: false, desc: "Courtes séquences d’ADN simple brin délimitant la région cible." },
    dntp: { name: "dNTP", have: false, desc: "Briques (dATP, dCTP, dGTP, dTTP) utilisées pour synthétiser le nouveau brin." },
    polymerase: { name: "ADN polymérase thermostable", have: false, desc: "Enzyme résistante à la chaleur (ex: Taq) catalysant l’ajout des nucléotides." }
  },
  pcrUnlocked: false
};

function preload() {
  this.load.text("dna_fasta", "data/dna.fasta");
}

function create() {
    // Fond
    this.add.rectangle(W / 2, H / 2, W, H, 0x141414);

    // FASTA
    const fastaText = this.cache.text.get("dna_fasta");
    fasta = parseFasta(fastaText);

    // ADN héros depuis FASTA
    hero.dna = fasta["hero"] ?? hero.dna;
    // Stats de base depuis ADN (facile à ajuster)
    applyDnaToHero(hero.dna);

    // Joueur (rectangle)
    player = this.add.rectangle(140, 140, 28, 28, 0x4ade80);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);

    cursors = this.input.keyboard.createCursorKeys();

    // Groupe de monstres
    monsters = this.physics.add.group();

    lootGroup = this.physics.add.staticGroup();
    spawnLoot(this, "matrix", 420, 120);
    spawnLoot(this, "primers", 860, 120);
    spawnLoot(this, "dntp", 420, 470);
    spawnLoot(this, "polymerase", 860, 470);

    // Overlap loot (ramassage)
    this.physics.add.overlap(player, lootGroup, (p, loot) => onLootPickup(loot), null, this);


    // Spawn monstres
    spawnMonster(this, "monster_slime", 650, 220, { kind: "normal" });
    spawnMonster(this, "monster_wolf", 760, 360, { kind: "normal" });
    spawnMonster(this, "dark_shifter", 620, 390, { kind: "dark" }); // plus tard: modifie ADN héros

    function spawnLoot(scene, key, x, y) {
  // Petit carré jaune = loot
  const loot = scene.add.rectangle(x, y, 18, 18, 0xfbbf24);
  scene.physics.add.existing(loot, true); // static body

  loot.lootKey = key; // "matrix" / "primers" / "dntp" / "polymerase"
  lootGroup.add(loot);

  // Petit label au-dessus
  scene.add.text(x - 30, y - 30, inventory.pcr[key].name, {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#fbbf24"
  });
}

function onLootPickup(loot) {
  const k = loot.lootKey;
  if (!inventory.pcr[k].have) {
    inventory.pcr[k].have = true;
    pushMsg(`📦 Réactif obtenu : ${inventory.pcr[k].name}`);
    pushMsg(inventory.pcr[k].desc);

    // Détruire l'objet sur la map
    loot.destroy();

    // Vérifier déblocage PCR
    if (checkPcrUnlock()) {
      pushMsg("✅ PCR débloquée ! Nouvelles touches: W (dénaturation), X (hybridation), C (élongation)");
    }

    // Mise à jour UI inventaire si ouvert
    if (invOpen) refreshInventoryUI();
  }
}


    // UI
    uiText = this.add.text(16, 16, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff"
    });

    msgText = this.add.text(16, 90, "", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: { x: 8, y: 6 }
    }).setDepth(999);

    helpText = this.add.text(
    16,
    H - 70,
    "Déplacement: flèches | Mutations: Z Inversion, S Substitution, A Insertion, E Délétion | I inventaire",
    { fontFamily: "Arial", fontSize: "14px", color: "#cccccc" }
    );


  // Panneau inventaire (caché au début)
  invPanel = this.add.rectangle(W - 260, 170, 480, 280, 0x000000, 0.65)
    .setOrigin(0.5)
    .setDepth(1000)
    .setVisible(false);

  invText = this.add.text(W - 480, 50, "", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    wordWrap: { width: 440 }
  }).setDepth(1001).setVisible(false);

  refreshInventoryUI();



    pushMsg("Bienvenue dans Genome Shift.");
    pushMsg("Z=Inversion | S=Substitution | A=Insertion | E=Délétion");
    pushMsg("Trouve les items PCR pour débloquer W/X/C.");


    


    // Collisions / dégâts physiques
    this.physics.add.overlap(player, monsters, (p, m) => onHeroHit(this, m), null, this);


    // Mutations de base
    this.input.keyboard.on("keydown-Z", () => castMutation(this, "inversion"));
    this.input.keyboard.on("keydown-S", () => castMutation(this, "substitution"));
    this.input.keyboard.on("keydown-A", () => castMutation(this, "insertion"));
    this.input.keyboard.on("keydown-E", () => castMutation(this, "deletion"));

    // Inventaire
    this.input.keyboard.on("keydown-I", () => {
      invOpen = !invOpen;
      invPanel.setVisible(invOpen);
      invText.setVisible(invOpen);
      if (invOpen) {
        refreshInventoryUI();
        pushMsg("Inventaire ouvert.");
      } else {
        pushMsg("Inventaire fermé.");
      }
    });

    function refreshInventoryUI() {
      if (!invText) return;

      const lines = [];
      lines.push("📒 Carnet d'inventaire — PCR");
      lines.push(`PCR: ${inventory.pcrUnlocked ? "✅ Débloquée (W/X/C)" : "🔒 Verrouillée"}`);
      lines.push("");
      lines.push("Objets communs (déjà possédés) :");
      for (const k of Object.keys(inventory.common)) {
        const it = inventory.common[k];
        lines.push(`- ✅ ${it.name}`);
      }
      lines.push("");
      lines.push("Réactifs à trouver :");
      for (const k of Object.keys(inventory.pcr)) {
        const it = inventory.pcr[k];
        lines.push(`- ${it.have ? "✅" : "❌"} ${it.name}`);
      }
      lines.push("");
      lines.push("Description (réactifs PCR) :");
      for (const k of Object.keys(inventory.pcr)) {
        const it = inventory.pcr[k];
        lines.push(`• ${it.name} : ${it.desc}`);
      }

      invText.setText(lines.join("\n"));
    }


    // Pouvoirs PCR (débloqués plus tard)
    this.input.keyboard.on("keydown-W", () => castPcr(this, "denaturation"));
    this.input.keyboard.on("keydown-X", () => castPcr(this, "hybridation"));
    this.input.keyboard.on("keydown-C", () => castPcr(this, "elongation"));


    // Petit outil dev : simule la récupération d’items PCR (pour tester le déblocage)
    /*this.input.keyboard.on("keydown-P", () => {
        devGiveNextPcrItem();
        if (checkPcrUnlock()) pushMsg("✅ Mode PCR débloqué !");
    });*/
}

// Etat PCR : cooldowns, unlocked ou pas
const pcr = {
  unlocked: false,
  cd: { denaturation: 0, hybridation: 0, elongation: 0 }
};

function castPcr(scene, type) {
  if (!inventory.pcrUnlocked) {
    pushMsg("PCR verrouillée : trouve ADN matrice, amorces, dNTP, polymérase.");
    return;
  }

  // Cooldowns (ms)
  const CD = { denaturation: 9000, hybridation: 12000, elongation: 15000 };
  if (pcr.cd[type] > 0) {
    pushMsg(`PCR ${type} en recharge...`);
    return;
  }
  pcr.cd[type] = CD[type];

  if (type === "denaturation") {
    // Freeze tous les ennemis proches (ennemi ne peut plus attaquer)
    let count = 0;
    for (const m of monsters.getChildren()) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
      if (d <= 260) {
        applyStun(m, 2000); // 2s
        count++;
      }
    }
    pushMsg(`Dénaturation : ${count} ennemis immobilisés.`);

  } else if (type === "hybridation") {
    // Prépare un "combo" : la prochaine mutation applique +dégâts
    hero._hybridBoostMs = 6000; // 6s fenêtre
    pushMsg("Hybridation : prochaine mutation renforcée (6s).");

  } else if (type === "elongation") {
    const heal = 25;
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    pushMsg(`Élongation : +${heal} HP.`);
  }
}

function updatePcrCooldowns(delta) {
  for (const k of Object.keys(pcr.cd)) {
    if (pcr.cd[k] > 0) pcr.cd[k] = Math.max(0, pcr.cd[k] - delta);
  }
  if (hero._hybridBoostMs > 0) hero._hybridBoostMs = Math.max(0, hero._hybridBoostMs - delta);
}



function update(time, delta) {
    updateMessages(delta);
    // Mouvement joueur
    const body = player.body;
    body.setVelocity(0);

    if (cursors.left.isDown) body.setVelocityX(-hero.speed);
    else if (cursors.right.isDown) body.setVelocityX(hero.speed);

    if (cursors.up.isDown) body.setVelocityY(-hero.speed);
    else if (cursors.down.isDown) body.setVelocityY(hero.speed);

    // Mise à jour effets sur monstres
    for (const m of monsters.getChildren()) {
        updateMonsterEffects(m, delta);
        applyMonsterMovement(m);
    }

    // UI
    uiText.setText([
        `HÉROS | HP: ${hero.hp}/${hero.maxHp} | ATK: ${hero.atk} | DEF: ${hero.def} | SPD: ${hero.speed}`,
        `ADN: ${hero.dna}`,
        `Monstres: ${monsters.getChildren().length} | PCR: ${inventory.pcrUnlocked ? "Débloquée" : "Verrouillée"}`,
        `PCR: ${inventory.pcrUnlocked ? "OK (W/X/C)" : "LOCK"} | CD: W=${Math.ceil(pcr.cd.denaturation/1000)}s X=${Math.ceil(pcr.cd.hybridation/1000)}s C=${Math.ceil(pcr.cd.elongation/1000)}s`
    ]);


  // Game over simple
  if (hero.hp <= 0) {
    hero.hp = 0;
    helpText.setText("💀 Game Over (refresh la page).");
    player.body.setVelocity(0);
    player.body.enable = false;
  }

  updatePcrCooldowns(delta);

}

// =====================
// FASTA
// =====================
function parseFasta(text) {
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
}

// =====================
// ADN -> stats (simple, modifiable)
// =====================
function applyDnaToHero(dna) {
  const len = Math.max(4, dna.length);
  const gc = (dna.match(/[GC]/g) || []).length;
  const at = (dna.match(/[AT]/g) || []).length;

  hero.def = 3 + Math.floor((gc / len) * 10);
  hero.speed = 180 + Math.floor((at / len) * 160);
  hero.atk = 9 + Math.floor(len / 6);

  hero.maxHp = 90 + len * 2;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

function dnaToMonsterStats(dna) {
  const len = Math.max(4, dna.length);
  const gc = (dna.match(/[GC]/g) || []).length;
  const at = (dna.match(/[AT]/g) || []).length;

  const def = 2 + Math.floor((gc / len) * 8);
  const speed = 80 + Math.floor((at / len) * 140);
  const atk = 5 + Math.floor(len / 8);
  const hp = 25 + len * 2;

  return { hp, atk, def, speed };
}

// =====================
// Spawn monstres
// =====================
function spawnMonster(scene, fastaId, x, y, opts = {}) {
  const dna = fasta[fastaId] ?? "ATCGATCG";
  const base = dnaToMonsterStats(dna);

  const color = (opts.kind === "dark") ? 0xa855f7 : 0xf87171;

  const rect = scene.add.rectangle(x, y, 26, 26, color);
  scene.physics.add.existing(rect);
  rect.body.setCollideWorldBounds(true);

  rect.data = {
    id: fastaId,
    kind: opts.kind ?? "normal",
    dna,
    hp: base.hp,
    maxHp: base.hp,
    atk: base.atk,
    def: base.def,
    speed: base.speed,

    // Effets temporaires
    effects: {
      slowMs: 0,
      stunMs: 0,
      dotMs: 0,
      dotTickMs: 0,
      atkDebuffMs: 0,
      atkDebuffValue: 0
    }
  };

  // Vitesse initiale random
  rect.body.setVelocity(
    Phaser.Math.Between(-80, 80),
    Phaser.Math.Between(-80, 80)
  );

  monsters.add(rect);
  return rect;
}

function applyMonsterMovement(m) {
  // Stun -> immobilisé
  if (m.data.effects.stunMs > 0) {
    m.body.setVelocity(0);
    return;
  }

  const spd = currentMonsterSpeed(m);

  // Paramètres de repérage
  const aggroRange = (m.data.kind === "dark") ? 420 : 360;
  const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);

  if (d <= aggroRange) {
    // CHASE : le monstre te poursuit
    const ang = Phaser.Math.Angle.Between(m.x, m.y, player.x, player.y);
    m.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
  } else {
    // PATROL : marche aléatoire, mais moins chaotique
    // si vitesse trop faible, relance un peu
    if (Math.abs(m.body.velocity.x) + Math.abs(m.body.velocity.y) < 10) {
      m.body.setVelocity(
        Phaser.Math.Between(-spd, spd),
        Phaser.Math.Between(-spd, spd)
      );
    } else {
      // clamp vitesse
      const vx = Phaser.Math.Clamp(m.body.velocity.x, -spd, spd);
      const vy = Phaser.Math.Clamp(m.body.velocity.y, -spd, spd);
      m.body.setVelocity(vx, vy);
    }
  }
}


function currentMonsterSpeed(m) {
  const base = m.data.speed;
  if (m.data.effects.slowMs > 0) return Math.max(40, Math.floor(base * 0.45));
  return base;
}

// =====================
// Combat: monstres -> dégâts physiques
// =====================
function onHeroHit(scene, monster) {
  const now = scene.time.now;
  // i-frames pour éviter de perdre 50 HP/seconde en overlap
  if (now - lastDamageAt < 600) return;
  lastDamageAt = now;

  const mAtk = currentMonsterAtk(monster);
  const dmg = Math.max(1, mAtk - hero.def);

  hero.hp -= dmg;

  // Feedback visuel simple
  flashRect(player, 0xfacc15, 90);

  // Dark Shifter (plus tard) : modifie ADN héros (pas encore implémenté en dur)
  if (monster.data.kind === "dark") {
    // Placeholder: petit effet narratif
    // (On codera la vraie mutation du génome héros ensuite)
    console.log("⚠ Dark Shifter touched the hero (future: genome shift).");
  }
}

function currentMonsterAtk(m) {
  const base = m.data.atk;
  if (m.data.effects.atkDebuffMs > 0) {
    return Math.max(1, base - m.data.effects.atkDebuffValue);
  }
  return base;
}

// =====================
// Mutations: héros -> attaque + effets
// (Portée courte: cible = monstre le plus proche)
// =====================
function castMutation(scene, type) {
  const target = nearestMonsterInRange(220);
  if (!target) return;

  // base damage dépend du héros
  const baseDmg = hero.atk;
  const boost = (hero._hybridBoostMs > 0) ? 1.35 : 1.0;


  if (type === "substitution") {
    // Dégâts moyens + -ATK
    dealToMonster(scene, target, Math.floor(baseDmg * 1.0 * boost));
    applyAtkDebuff(target, 4000, 3); // 4s, -3 atk
    flashRect(target, 0x60a5fa, 80);

  } else if (type === "inversion") {
    // Dégâts faibles + stun
    dealToMonster(scene, target, Math.floor(baseDmg * 0.6 * boost));
    applyStun(target, 900); // 0.9s
    flashRect(target, 0xf472b6, 80);

  } else if (type === "insertion") {
    // Dégâts élevés + slow
    dealToMonster(scene, target, Math.floor(baseDmg * 1.35 * boost));
    applySlow(target, 3500); // 3.5s
    flashRect(target, 0x34d399, 80);

  } else if (type === "deletion") {
    // Dégâts moyens + DOT
    dealToMonster(scene, target, Math.floor(baseDmg * 0.9 * boost));
    applyDot(target, 4500, 700, 2); // 4.5s, tick 0.7s, 2 dmg/tick
    flashRect(target, 0xf87171, 80);
  }
}

function nearestMonsterInRange(range) {
  let best = null;
  let bestD = Infinity;
  for (const m of monsters.getChildren()) {
    const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  if (!best || bestD > range) return null;
  return best;
}

function dealToMonster(scene, m, dmg) {
  const real = Math.max(1, dmg - m.data.def);
  m.data.hp -= real;

  // Si mort → remove
  if (m.data.hp <= 0) {
    m.destroy();
    return;
  }

  // Knockback léger
  const angle = Phaser.Math.Angle.Between(player.x, player.y, m.x, m.y);
  const kb = 120;
  m.body.setVelocity(Math.cos(angle) * kb, Math.sin(angle) * kb);
}

// =====================
// Effets temporaires (monstres)
// =====================
function applySlow(m, ms) {
  m.data.effects.slowMs = Math.max(m.data.effects.slowMs, ms);
}

function applyStun(m, ms) {
  m.data.effects.stunMs = Math.max(m.data.effects.stunMs, ms);
}

function applyDot(m, totalMs, tickMs, dmgPerTick) {
  m.data.effects.dotMs = Math.max(m.data.effects.dotMs, totalMs);
  m.data.effects.dotTickMs = tickMs;
  m.data.effects._dotAcc = 0;
  m.data.effects._dotDmg = dmgPerTick;
}

function applyAtkDebuff(m, ms, value) {
  m.data.effects.atkDebuffMs = Math.max(m.data.effects.atkDebuffMs, ms);
  m.data.effects.atkDebuffValue = Math.max(m.data.effects.atkDebuffValue, value);
}

function updateMonsterEffects(m, delta) {
  const e = m.data.effects;

  if (e.slowMs > 0) e.slowMs = Math.max(0, e.slowMs - delta);
  if (e.stunMs > 0) e.stunMs = Math.max(0, e.stunMs - delta);
  if (e.atkDebuffMs > 0) e.atkDebuffMs = Math.max(0, e.atkDebuffMs - delta);

  if (e.dotMs > 0) {
    e.dotMs = Math.max(0, e.dotMs - delta);
    e._dotAcc = (e._dotAcc ?? 0) + delta;

    if (e._dotAcc >= e.dotTickMs) {
      e._dotAcc = 0;
      // DOT ignore partiellement la défense (simple)
      m.data.hp -= Math.max(1, e._dotDmg);

      flashRect(m, 0xffffff, 40);

      if (m.data.hp <= 0) {
        m.destroy();
      }
    }
  }
}

// Petit flash visuel
function flashRect(rect, color, ms) {
  const original = rect.fillColor;
  rect.fillColor = color;
  setTimeout(() => {
    // Si rect a été détruit
    if (rect && rect.scene) rect.fillColor = original;
  }, ms);
}

// =====================
// Inventaire / PCR
// =====================
function inventorySummary() {
  const out = [];
  out.push("=== Inventaire (PCR) ===");
  out.push(`PCR: ${inventory.pcrUnlocked ? "✅ Débloquée" : "🔒 Verrouillée"}`);
  out.push("");
  out.push("Objets communs (déjà possédés):");
  for (const k of Object.keys(inventory.common)) {
    const it = inventory.common[k];
    out.push(`- ✅ ${it.name} : ${it.desc}`);
  }
  out.push("");
  out.push("Objets à trouver (pour débloquer PCR):");
  for (const k of Object.keys(inventory.pcr)) {
    const it = inventory.pcr[k];
    out.push(`- ${it.have ? "✅" : "❌"} ${it.name} : ${it.desc}`);
  }
  out.push("");
  out.push("Astuce dev: touche P pour simuler le loot d’un item PCR.");
  return out;
}

function devGiveNextPcrItem() {
  // Donne le prochain item PCR manquant (juste pour tester)
  for (const k of Object.keys(inventory.pcr)) {
    if (!inventory.pcr[k].have) {
      inventory.pcr[k].have = true;
      pushMsg(`📦 Objet obtenu: ${inventory.pcr[k].name}`);
      return;
    }
  }
  pushMsg("Tu as déjà tous les items PCR.");
}

function checkPcrUnlock() {
  const keys = Object.keys(inventory.pcr);
  const ok = keys.every(k => inventory.pcr[k].have);
  inventory.pcrUnlocked = ok;
  return ok;
}

function pushMsg(text) {
  msgQueue.push(text);
  // si rien n'affiche, on démarre direct
  if (msgTimer <= 0) {
    msgTimer = 3400; // ms
    msgText.setText(msgQueue[0]);
  }
}

function updateMessages(delta) {
  if (!msgText) return;
  if (msgQueue.length === 0) {
    msgText.setText("");
    return;
  }
  msgTimer -= delta;
  if (msgTimer <= 0) {
    msgQueue.shift();
    if (msgQueue.length > 0) {
      msgText.setText(msgQueue[0]);
      msgTimer = 2400;
    } else {
      msgText.setText("");
    }
  }
}

