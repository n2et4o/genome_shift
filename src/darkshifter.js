// =======================
// DARK SHIFTERS (humains)
// =======================

window.GS = window.GS || {};

GS.DARK_TRIGGER_RANGE = 50;      // distance en pixels (modifiable)
GS.DARK_EFFECT_COOLDOWN = 4000;  // délai entre 2 attaques du même darkshifter

GS.initDarkShifters = function(scene) {
  GS.darkShifters = scene.physics.add.group();

  // Overlap spécial DarkShifter -> Hero (mutation ADN)
  scene.physics.add.overlap(
    scene.GS.player,
    GS.darkShifters,
    (_player, dark) => GS.onDarkShifterTouch(scene, dark),
    null,
    scene
  );
};


// Création d'un Dark Shifter
GS.spawnDarkShifter = function(scene, x, y) {
  /*const h = scene.add.rectangle(x, y, 26, 26, 0x7c3aed); // affichage des carres violets
  scene.physics.add.existing(h);
  h.body.setSize(20, 20, true); // body plus petit que le sprite (26x26)
  */
  const h = scene.physics.add.sprite(x, y, "darkshifter", 0);
  h.play("ds_walk");

  // taille visuelle (à ajuster si tu veux plus grand/petit)
  h.setScale(0.09); // 384x512 -> ~35x46 à l’écran
  // hitbox (collision) plus proche de tes anciens carrés
  h.body.setSize(200, 260, true);  // taille en pixels "avant scale"
  h.body.setOffset(90, 210);       // centre le body sur le bas du perso

  

    //   Physique + mouvement
  h.body.setCollideWorldBounds(true);
  h.body.setBounce(1, 1);
  h.body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-120, 120));

  //   IMPORTANT : kind="dark" pour que monster.js déclenche les effets spéciaux
  h.gs = {
    kind: "dark",
    hp: 40,
    maxHp: 40,
    atk: 8,
    def: 2,
    speed: 150,
    effects: {
      slowMs: 0,
      stunMs: 0,
      dotMs: 0,
      dotTickMs: 0,
      atkDebuffMs: 0,
      atkDebuffValue: 0
    }
  };

  // Groupe “spécial”
  GS.darkShifters.add(h);

  //   Pour l’IA + update + barres HP, on les met aussi dans GS.monsters
  if (GS.monsters) GS.monsters.add(h);

  // ici seulement, car scene + h existent
  if (typeof GS.attachHpBar === "function") GS.attachHpBar(scene, h);

  return h;
};


// Quand un Dark Shifter touche le héros
GS.onDarkShifterTouch = function(scene, dark) {
  const now = scene.time.now;
  if (now - (GS.hero.lastGenomeHitAt || 0) < 2500) return;
  GS.hero.lastGenomeHitAt = now;

  const before = GS.hero.dna;

  const types = ["substitution", "insertion", "deletion", "inversion"];
  const type = Phaser.Utils.Array.GetRandom(types);

  GS.hero.dna = GS.mutateDnaOnce(GS.hero.dna, type);
  GS.applyDnaToHero(GS.hero.dna);

  const heroInitial = GS.fasta["hero_initial"] || GS.hero.dna;
  const heroCurrent = GS.hero.dna;

  fetch("/api/save-dna", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hero_initial: heroInitial,
      hero_current: heroCurrent
    })
  })
  .then(r => r.json())
  .then(data => {
    if (!data.ok) console.error(data.error);
  })
  .catch(err => console.error("Erreur save DNA:", err));

  // Effets
  if (type === "inversion") {
    GS.hero.effects.confusionMs = 12000;
    GS.hero.effects.controlMap = GS.randomControlMap();
    GS.pushMsg("⚠ Dark Shifter : Inversion → Contrôles mélangés !");
  }

  if (type === "deletion") {
    GS.hero.hp = Math.max(1, GS.hero.hp - 10);
    GS.pushMsg("⚠ Dark Shifter : Délétion → -10 HP");
  }

  if (type === "substitution") {
    GS.hero.effects.atkDebuffMs = 4000;
    GS.hero.effects.atkDebuffValue = 3;
    GS.pushMsg("⚠ Dark Shifter : Substitution → ATK réduit");
  }

  if (type === "insertion") {
    GS.hero.effects.slowMs = 3000;
    GS.pushMsg("⚠ Dark Shifter : Insertion → Ralentissement");
  }

  // Sauvegarde ADN persistante
  localStorage.setItem("GS_HERO_DNA", GS.hero.dna);

  GS.pushMsg(`ADN modifié: ${before} → ${GS.hero.dna}`);
};


// Attaque le hero si proche (de 50pixels)  
GS.applyRandomDarkEffect = function(scene, dark) {

  dark.play("ds_attack", true);
  dark.once("animationcomplete-ds_attack", () => {
    if (dark.active) dark.play("ds_walk");
  });

  const effects = ["inversion", "deletion", "substitution", "insertion"];
  const type = Phaser.Utils.Array.GetRandom(effects);

  if (type === "inversion") {
    GS.hero.effects.confusionMs = 12000;
    GS.hero.effects.controlMap = GS.randomControlMap();
    GS.pushMsg("⚠ Dark Shifter : Inversion → Contrôles mélangés !");
  }

  if (type === "deletion") {
    GS.hero.hp = Math.max(1, GS.hero.hp - 10);
    GS.pushMsg("⚠ Dark Shifter : Délétion → -10 HP");
  }

  if (type === "substitution") {
    GS.hero.effects.atkDebuffMs = 4000;
    GS.hero.effects.atkDebuffValue = 3;
    GS.pushMsg("⚠ Dark Shifter : Substitution → ATK réduit");
  }

  if (type === "insertion") {
    GS.hero.effects.slowMs = 3000;
    GS.pushMsg("⚠ Dark Shifter : Insertion → Ralentissement");
  }

};


GS.preloadDarkShifter = function (scene) {
  // marche
  scene.load.image("ds_walk_1", "images/d1.png");
  scene.load.image("ds_walk_2", "images/d2.png");
  scene.load.image("ds_walk_3", "images/d3.png");
  scene.load.image("ds_walk_4", "images/d4.png");

  // attaque
  scene.load.image("ds_attack_1", "images/da1.png");
  scene.load.image("ds_attack_2", "images/da2.png");
  scene.load.image("ds_attack_3", "images/da3.png");
  scene.load.image("ds_attack_4", "images/da4.png");
};

GS.createDarkShifterAnims = function (scene) {
  if (scene.anims.exists("ds_walk")) return;

  scene.anims.create({
    key: "ds_walk",
    frames: [
      { key: "ds_walk_1" },
      { key: "ds_walk_2" },
      { key: "ds_walk_3" },
      { key: "ds_walk_4" }
    ],
    frameRate: 8,
    repeat: -1
  });

  scene.anims.create({
    key: "ds_attack",
    frames: [
      { key: "ds_attack_1" },
      { key: "ds_attack_2" },
      { key: "ds_attack_3" },
      { key: "ds_attack_4" }
    ],
    frameRate: 6,
    repeat: 0
  });
};

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
        dark.play("ds_attack", true);
        dark.once("animationcomplete-ds_attack", () => {
          if (dark.active) dark.play("ds_walk");
        });
        GS.applyRandomDarkEffect(scene, dark);
      }
    }
  };