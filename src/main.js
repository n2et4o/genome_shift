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


  // FASTA global (utilisé par Monster)
  const fastaText = this.cache.text.get("dna_fasta");
  GS.fasta = GS.parseFasta(fastaText);

  // Hero init
  GS.hero.dna = GS.fasta["hero"] ?? GS.hero.dna;
  GS.applyDnaToHero(GS.hero.dna);

  // Player rect
  const player = this.add.rectangle(140, 140, 28, 28, 0x4ade80);
  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(false);
  this.GS.player = player;

  this.GS.cursors = this.input.keyboard.createCursorKeys();

  // Monsters group
  GS.monsters = this.physics.add.group();

  // Loot group
  GS.lootGroup = this.physics.add.staticGroup();

  // Spawn loot PCR
  GS.spawnLoot(this, "matrix", 420, 120);
  GS.spawnLoot(this, "primers", 860, 120);
  GS.spawnLoot(this, "dntp", 420, 470);
  GS.spawnLoot(this, "polymerase", 860, 470);
  

  // Overlap loot
  this.physics.add.overlap(player, GS.lootGroup, (p, loot) => GS.onLootPickup(this, loot), null, this);


  // Spawn monsters
  GS.spawnMonster(this, "monster_slime", 650, 220, { kind: "normal" });
  GS.spawnMonster(this, "monster_wolf", 760, 360, { kind: "normal" });
  GS.spawnMonster(this, "dark_shifter", 620, 390, { kind: "dark" });
  

  // UI
  this.GS.uiText = this.add.text(16, 16, "", { fontFamily: "Arial", fontSize: "16px", color: "#fff" });

  GS.msgText = this.add.text(16, 90, "", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: { x: 8, y: 6 }
  }).setDepth(999);

  this.GS.helpText = this.add.text(16, H - 70,
    "Déplacement: flèches | Mutations: Z Inversion, S Substitution, A Insertion, E Délétion | I inventaire",
    { fontFamily: "Arial", fontSize: "14px", color: "#ccc" }
  );

  // Inventaire UI
  this.GS.invPanel = this.add.rectangle(W - 260, 170, 480, 280, 0x000000, 0.65)
    .setOrigin(0.5).setDepth(1000).setVisible(false);

  this.GS.invText = this.add.text(W - 480, 50, "", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    wordWrap: { width: 440 }
  }).setDepth(1001).setVisible(false);

  GS.refreshInventoryUI(this);

  // Messages init
  GS.pushMsg("Bienvenue dans Genome Shift.");
  GS.pushMsg("Mutations: Z inversion | S substitution | A insertion | E délétion");
  GS.pushMsg("Trouve les 4 réactifs pour débloquer la PCR.");

  this.GS.uiText.setScrollFactor(0).setDepth(1000);
  GS.msgText.setScrollFactor(0).setDepth(1000);
  this.GS.helpText.setScrollFactor(0).setDepth(1000);

  this.GS.invPanel.setScrollFactor(0).setDepth(1000);
  this.GS.invText.setScrollFactor(0).setDepth(1001);


  // Overlap monsters -> hero hit
  this.physics.add.overlap(player, GS.monsters, (p, m) => GS.onHeroHit(this, m), null, this);
  // ✅ Génère les chunks autour du joueur au départ
  GS.ensureChunksAroundPlayer(this);

  // Input: Mutations
  this.input.keyboard.on("keydown-Z", () => GS.castMutation(this, "inversion"));
  this.input.keyboard.on("keydown-S", () => GS.castMutation(this, "substitution"));
  this.input.keyboard.on("keydown-A", () => GS.castMutation(this, "insertion"));
  this.input.keyboard.on("keydown-E", () => GS.castMutation(this, "deletion"));

  // Input: PCR
  this.input.keyboard.on("keydown-W", () => GS.castPcr(this, "denaturation"));
  this.input.keyboard.on("keydown-X", () => GS.castPcr(this, "hybridation"));
  this.input.keyboard.on("keydown-C", () => GS.castPcr(this, "elongation"));

  // Input: Inventory toggle
  this.input.keyboard.on("keydown-I", () => {
    this.GS.invOpen = !this.GS.invOpen;
    this.GS.invPanel.setVisible(this.GS.invOpen);
    this.GS.invText.setVisible(this.GS.invOpen);
    if (this.GS.invOpen) GS.refreshInventoryUI(this);
  });

  // Monde plus grand que l'écran (exemple)
  this.physics.world.setBounds(0, 0, 3000, 2000);

  // Caméra suit le joueur
  this.cameras.main.startFollow(this.GS.player, true, 0.08, 0.08);

  

  // Décor simple (points)
  const g = this.add.graphics();
  g.fillStyle(0x1f1f1f, 1);
  for (let x = 0; x < worldW; x += 60) {
    for (let y = 0; y < worldH; y += 60) {
      g.fillCircle(x, y, 2);
    }
  }
}

function update(time, delta) {
  GS.updateMessages(delta);
  GS.updatePcrCooldowns(delta);

  const player = this.GS.player;
  const cursors = this.GS.cursors;

  // Player movement
  const body = player.body;
  body.setVelocity(0);
  if (cursors.left.isDown) body.setVelocityX(-GS.hero.speed);
  else if (cursors.right.isDown) body.setVelocityX(GS.hero.speed);
  if (cursors.up.isDown) body.setVelocityY(-GS.hero.speed);
  else if (cursors.down.isDown) body.setVelocityY(GS.hero.speed);

  // Monsters update
  for (const m of GS.monsters.getChildren()) {
    GS.updateMonsterEffects(m, delta);
    GS.applyMonsterMovement(this, m);
  }

  // UI
  this.GS.uiText.setText([
    `HÉROS | HP: ${GS.hero.hp}/${GS.hero.maxHp} | ATK: ${GS.hero.atk} | DEF: ${GS.hero.def} | SPD: ${GS.hero.speed}`,
    `ADN: ${GS.hero.dna}`,
    `Monstres: ${GS.monsters.getChildren().length} | PCR: ${GS.inventory.pcrUnlocked ? "Débloquée" : "Verrouillée"}`,
    `PCR CD: W=${Math.ceil(GS.pcr.cd.denaturation/1000)}s X=${Math.ceil(GS.pcr.cd.hybridation/1000)}s C=${Math.ceil(GS.pcr.cd.elongation/1000)}s`
  ]);

  if (GS.hero.hp <= 0) {
    GS.hero.hp = 0;
    this.GS.helpText.setText("💀 Game Over (refresh la page).");
    player.body.setVelocity(0);
    player.body.enable = false;
  }
  GS.ensureChunksAroundPlayer(this);


}
