// =====================
// Genome Shift (Main)
// =====================

const W = 1200;
const H = 600;
const worldW = 3000;
const worldH = 2000;

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  physics: { default: "arcade", arcade: { debug: false } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() {
  this.load.text("dna_fasta", "data/dna.fasta");
}

function create() {
  // petit “state” attaché à la scene (pratique)
  this.GS = {
    player: null,
    cursors: null,
    uiText: null,
    helpText: null,
    invOpen: false,
    invPanel: null,
    invText: null
  };
  this.GS.isPaused = false;

  // FASTA global (utilisé par Monster)
  const fastaText = this.cache.text.get("dna_fasta");
  GS.fasta = GS.parseFasta(fastaText);

  // Hero init
  GS.hero.dna = GS.fasta["hero"] ?? GS.hero.dna;
  GS.applyDnaToHero(GS.hero.dna);

  // PCR state : hybridation step + targets
  GS.hybrid = {
    active: false,
    selecting: false,
    step: 0,
    first: null,
    second: null,
    ready: false
  };


  // Player rect
  const player = this.add.rectangle(140, 140, 28, 28, 0x4ade80);
  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(false);
  this.GS.player = player;

  this.GS.cursors = this.input.keyboard.createCursorKeys();

  
  // Monsters group (  AVANT darkshifters)
  GS.monsters = this.physics.add.group();
  // Collisions physiques (empêche la superposition)
  this.physics.add.collider(GS.monsters, GS.monsters);             // monstre vs monstre
  this.physics.add.collider(this.GS.player, GS.monsters,           // joueur vs monstres
    (p, m) => GS.onHeroHit(this, m), null, this
  );

  // darkshifter
  GS.initDarkShifters(this);
  // --- Collisions DarkShifters ---
  this.physics.add.collider(GS.darkShifters, GS.darkShifters);  // dark vs dark
  this.physics.add.collider(GS.darkShifters, GS.monsters);      // dark vs monsters (normal + dark si tu les ajoutes aussi)

  // Héros vs darkshifters : collision physique + dégâts
  this.physics.add.collider(this.GS.player, GS.darkShifters,
  (p, d) => GS.onHeroHit(this, d), null, this
);
  GS.spawnDarkShifter(this, 600, 300);
  GS.spawnDarkShifter(this, 900, 500);
  // Loot group
  GS.lootGroup = this.physics.add.staticGroup();

  // Spawn loot PCR
  GS.spawnLoot(this, "matrix", 420, 120);
  GS.spawnLoot(this, "primers", 860, 120);
  GS.spawnLoot(this, "dntp", 420, 470);
  GS.spawnLoot(this, "polymerase", 860, 470);
  

  // Overlap loot
  this.physics.add.overlap(player, GS.lootGroup, (p, loot) => GS.onLootPickup(this, loot), null, this);

  // UI
  this.GS.uiText = this.add.text(16, 130, "", { fontFamily: "Arial", fontSize: "16px", color: "#fff" });
  // Radial menu init (hidden)
  this.GS.dpad = GS.createDpad(this);

  // HUD radials (près du dpad)
  const camW = this.cameras.main.width;
  const camH = this.cameras.main.height;

  // Mutation : à gauche, au-dessus du dpad
  this.GS.mutationHud = GS.createRadialHud(this, 180, camH - 75, "Mutations", [
    { key: "Z", name: "Inversion", enabled: true },
    { key: "E", name: "Délétion", enabled: true },
    { key: "S", name: "Substitution", enabled: true },
    { key: "A", name: "Insertion", enabled: true }
    
  ], 0.75); //   réduit

  // PCR : à droite de l'écran, plus bas
  this.GS.pcrHud = GS.createRadialHud(
    this,
    camW - 120,
    camH - 70,
    GS.inventory.pcrUnlocked ? "PCR" : "",   //   titre caché si lock
    [
      { key: "W", name: "Dénaturation", enabled: GS.inventory.pcrUnlocked },
      { key: "X", name: "Hybridation", enabled: GS.inventory.pcrUnlocked },
      { key: "C", name: "Élongation", enabled: GS.inventory.pcrUnlocked }
    ],
    0.75
  );

  GS.msgText = this.add.text(16, 90, "", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: { x: 8, y: 6 }
  }).setDepth(999);


  // --- Inventaire RPG UI (caché) ---
  this.GS.invOpen = false;
  this.GS.invIndex = 0;

  this.GS.invPanel = this.add.rectangle(W/2, H/2, 820, 420, 0x000000, 0.75)
    .setDepth(2000).setVisible(false).setScrollFactor(0);

  this.GS.invTitle = this.add.text(W/2 - 380, H/2 - 190, "Inventaire", {
    fontFamily: "Arial", fontSize: "22px", color: "#ffffff"
  }).setDepth(2001).setVisible(false).setScrollFactor(0);

  this.GS.invList = this.add.text(W/2 - 380, H/2 - 140, "", {
    fontFamily: "Arial", fontSize: "16px", color: "#ffffff",
    lineSpacing: 6
  }).setDepth(2001).setVisible(false).setScrollFactor(0);

  this.GS.invDescBox = this.add.rectangle(W/2 + 170, H/2 + 10, 380, 280, 0x111111, 0.85)
    .setDepth(2001).setVisible(false).setScrollFactor(0);

  this.GS.invDesc = this.add.text(W/2 + 10, H/2 - 110, "", {
    fontFamily: "Arial", fontSize: "16px", color: "#ffffff",
    wordWrap: { width: 360 }
  }).setDepth(2002).setVisible(false).setScrollFactor(0);


  GS.refreshInventoryUI(this);

  // Messages init
  GS.pushMsg("Bienvenue dans Genome Shift.");
  GS.pushMsg("Mutations: Z inversion | S substitution | A insertion | E délétion");
  GS.pushMsg("Trouve les 4 réactifs pour débloquer la PCR.");

  this.GS.uiText.setScrollFactor(0).setDepth(1000);
  GS.msgText.setScrollFactor(0).setDepth(1000);
  /*this.GS.helpText.setScrollFactor(0).setDepth(1000);*/

  this.GS.invPanel.setScrollFactor(0).setDepth(1000);
  /*this.GS.invText.setScrollFactor(0).setDepth(1001);*/
  this.GS.invPanel.setScrollFactor(0).setDepth(2000);
  this.GS.invTitle.setScrollFactor(0).setDepth(2001);
  this.GS.invList.setScrollFactor(0).setDepth(2001);
  this.GS.invDescBox.setScrollFactor(0).setDepth(2001);
  this.GS.invDesc.setScrollFactor(0).setDepth(2002);



  // Overlap monsters -> hero hit
  //this.physics.add.overlap(player, GS.monsters, (p, m) => GS.onHeroHit(this, m), null, this);
  //   Génère les chunks autour du joueur au départ
  GS.ensureChunksAroundPlayer(this);

  function handleMutationKey(type) {
    // Si radial ouvert => sélection hybridation
    if (GS.radial.visible && GS.hybrid.active) {
      if (GS.hybrid.step === 1) {
        GS.hybrid.first = type;
        GS.hybrid.step = 2;
        GS.pushMsg("Choisis la mutation 2");
        GS.hybrid.step = 2;
        GS.setRadialTitle(this, "Choisis la mutation 2");

        return;
      } else if (GS.hybrid.step === 2) {
        GS.hybrid.second = type;
        GS.hybrid.selecting = false;
        GS.hybrid.step = 0;
        GS.hybrid.ready = true;
        GS.closeRadialMenu(this);
        GS.pushMsg(`Hybridation prête : ${GS.hybrid.first} + ${GS.hybrid.second}`);
        return;
      }
    }

    // Sinon => attaque normale
    GS.castMutation(this, type);
  }

  // Input: Mutations
  this.input.keyboard.on("keydown-Z", () => handleMutationKey.call(this, "inversion"));
  this.input.keyboard.on("keydown-S", () => handleMutationKey.call(this, "substitution"));
  this.input.keyboard.on("keydown-A", () => handleMutationKey.call(this, "insertion"));
  this.input.keyboard.on("keydown-E", () => handleMutationKey.call(this, "deletion"));

  // Input: PCR
  this.input.keyboard.on("keydown-W", () => GS.castPcr(this, "denaturation"));
  this.input.keyboard.on("keydown-X", () => GS.castPcr(this, "hybridation"));
  this.input.keyboard.on("keydown-C", () => GS.castPcr(this, "elongation"));

  // Input: Inventory toggle
  this.input.keyboard.on("keydown-I", () => {
    this.GS.invOpen = !this.GS.invOpen;

    const v = this.GS.invOpen;

    this.GS.invPanel.setVisible(v);
    this.GS.invTitle.setVisible(v);
    this.GS.invList.setVisible(v);
    this.GS.invDescBox.setVisible(v);
    this.GS.invDesc.setVisible(v);

    if (v) GS.refreshInventoryUI(this);

    if (this.GS.invOpen) {
      GS.setPaused(this, true);
      GS.refreshInventoryUI(this);
      GS.pushMsg("Inventaire (pause)");
    } else {
      GS.setPaused(this, false);
      GS.pushMsg("Retour au jeu");
    }

  });

  const map = GS.hero.effects.controlMap || {
    left: "left",
    right: "right",
    up: "up",
    down: "down"
  };

  this.input.keyboard.on("keydown-UP", () => {
    if (!this.GS.invOpen) return;
    this.GS.invIndex = Math.max(0, this.GS.invIndex - 1);
    GS.refreshInventoryUI(this);
  });

  this.input.keyboard.on("keydown-DOWN", () => {
    if (!this.GS.invOpen) return;
    const max = (this.GS.invItems?.length ?? 1) - 1;
    this.GS.invIndex = Math.min(max, this.GS.invIndex + 1);
    GS.refreshInventoryUI(this);
  });

  // Input: Close inventory with ESC
  this.input.keyboard.on("keydown-ESC", () => {
    if (this.GS.invOpen) {
      this.GS.invOpen = false;
      this.GS.invPanel.setVisible(false);
      this.GS.invPanel.setVisible(false);
      this.GS.invTitle.setVisible(false);
      this.GS.invList.setVisible(false);
      this.GS.invDescBox.setVisible(false);
      this.GS.invDesc.setVisible(false);

      GS.setPaused(this, false);
      GS.pushMsg("Retour au jeu");
    }
  });


  // Monde plus grand que l'écran (exemple)
  this.physics.world.setBounds(-50000, -50000, 100000, 100000);
  //this.physics.world.setBounds(0, 0, 3000, 2000);

  // Caméra suit le joueur
  this.cameras.main.startFollow(this.GS.player, true, 0.08, 0.08);

  // Limites de la caméra (optionnel, ici on peut dépasser un peu)
  this.cameras.main.setViewport(0, 0, 1200, 600);

  

  // Décor simple (points)
  /*const g = this.add.graphics();
  g.fillStyle(0x1f1f1f, 1);
  for (let x = 0; x < worldW; x += 60) {
    for (let y = 0; y < worldH; y += 60) {
      g.fillCircle(x, y, 2);
    }
  }*/
   // === HUD HP HERO ===
  this.GS.heroHpBg = this.add.rectangle(20, 60, 220, 14, 0x222222, 0.9)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(3000);

  this.GS.heroHpBar = this.add.rectangle(20, 60, 220, 14, 0x22c55e, 1)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(3001);

  this.GS.heroHpLabel = this.add.text(20, 40, "HP", {
    fontFamily: "Arial", fontSize: "14px", color: "#ffffff"
  }).setScrollFactor(0).setDepth(3002);


}

function update(time, delta) {
  GS.updateMessages(delta);
  GS.updatePcrCooldowns(delta);

  const player = this.GS.player;
  const cursors = this.GS.cursors;

  const map = GS.hero.effects.controlMap || { left: "left", right: "right", up: "up", down: "down" };

  const leftDown  = cursors[map.left]?.isDown;
  const rightDown = cursors[map.right]?.isDown;
  const upDown    = cursors[map.up]?.isDown;
  const downDown  = cursors[map.down]?.isDown;

  // en tout début de update
  if (time % 500 < delta) console.log("paused=", this.GS.isPaused, "invOpen=", this.GS.invOpen, "radial=", GS.radial.visible);

  if (this.GS.isPaused) {
    GS.updateMessages(delta); // on laisse les messages vivre
    //console.log(this.GS.setPaused(scene, true));
    return;
  }

  // Player movement
    const body = player.body;
    body.setVelocity(0);

    // calcul speed réelle AVANT d'appliquer
    let spd = GS.hero.speed;

    if (GS.hero.effects.slowMs > 0) {
      spd = Math.floor(spd * 0.6);
    }

    // Si tu veux gérer la confusion plus tard, tu pourras inverser ici

    if (leftDown) body.setVelocityX(-spd);
    else if (rightDown) body.setVelocityX(spd);

    if (upDown) body.setVelocityY(-spd);
    else if (downDown) body.setVelocityY(spd);

  // === Update HUD hero HP ===
  const ratio = Phaser.Math.Clamp(GS.hero.hp / GS.hero.maxHp, 0, 1);
  this.GS.heroHpBar.width = 220 * ratio;
  this.GS.heroHpLabel.setText(`HP ${GS.hero.hp}/${GS.hero.maxHp}`);

  GS.hero.effects.slowMs = Math.max(0, GS.hero.effects.slowMs - delta);
  GS.hero.effects.atkDebuffMs = Math.max(0, GS.hero.effects.atkDebuffMs - delta);
  if (GS.hero.effects.slowMs > 0) spd = Math.floor(spd * 0.6);

  GS.hero.effects.confusionMs = Math.max(0, (GS.hero.effects.confusionMs || 0) - delta);
  if (GS.hero.effects.confusionMs <= 0 && GS.hero.effects.controlMap) {
    GS.hero.effects.controlMap = null; // retour normal
  }




  // Monsters update
  for (const m of GS.monsters.getChildren()) {
    if (!m || !m.active) continue;
    GS.updateMonsterEffects(m, delta);
    GS.applyMonsterMovement(this, m);
  }
  // barre HP monsters update 
  GS.updateAllHpBars();

  // UI
  this.GS.uiText.setText([
    `HÉROS | HP: ${GS.hero.hp}/${GS.hero.maxHp} | ATK: ${GS.hero.atk} | DEF: ${GS.hero.def} | SPD: ${spd}`,
    `ADN: ${GS.hero.dna}`,
    `Monstres: ${GS.monsters.getChildren().length} | PCR: ${GS.inventory.pcrUnlocked ? "Débloquée" : "Verrouillée"}`,
    `PCR CD: W=${Math.ceil(GS.pcr.cd.denaturation/1000)}s X=${Math.ceil(GS.pcr.cd.hybridation/1000)}s C=${Math.ceil(GS.pcr.cd.elongation/1000)}s`
  ]);

  // effets de Proximité darkshifters
  GS.updateDarkProximity = function(scene) {
    if (!GS.darkShifters) return;
    const hero = scene.GS.player;
    const now = scene.time.now;
    for (const dark of GS.darkShifters.getChildren()) {
      if (!dark || !dark.active) continue;
      const dist = Phaser.Math.Distance.Between(hero.x, hero.y, dark.x, dark.y);
      if (dist <= GS.DARK_TRIGGER_RANGE) {
        if (!dark.gs) dark.gs = {};
        // cooldown par darkshifter
        if (now - (dark.gs.lastEffectAt || 0) < GS.DARK_EFFECT_COOLDOWN)
          continue;
        dark.gs.lastEffectAt = now;
        GS.applyRandomDarkEffect(scene, dark);
      }
    }
  };

  

  if (GS.hero.hp <= 0) {
    GS.hero.hp = 0;
    GS.pushMsg("💀 Game Over (refresh la page).");
    player.body.setVelocity(0);
    player.body.enable = false;
  }
  GS.ensureChunksAroundPlayer(this);
  GS.updateDarkProximity(this);


}
