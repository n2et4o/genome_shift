window.GS = window.GS || {};
GS.hero = {
  dna: "ATCG",
  hp: 100,
  maxHp: 100,
  atk: 10,
  def: 4,
  speed: 220,
  _hybridBoostMs: 0
};

GS.hero.effects = {
  slowMs: 0,
  atkDebuffMs: 0,
  atkDebuffValue: 0,
  confusionMs: 0,
  controlMap: null
};

GS.hero.lastGenomeHitAt = 0;


GS.applyDnaToHero = function (dna) {
  const len = Math.max(4, dna.length);
  const gc = (dna.match(/[GC]/g) || []).length;
  const at = (dna.match(/[AT]/g) || []).length;

  GS.hero.def = 3 + Math.floor((gc / len) * 10);
  GS.hero.speed = 180 + Math.floor((at / len) * 160);
  GS.hero.atk = 9 + Math.floor(len / 6);

  GS.hero.maxHp = 90 + len * 2;
  GS.hero.hp = Math.min(GS.hero.hp, GS.hero.maxHp);
};

// PCR cooldowns
GS.pcr = {
  cd: { denaturation: 0, hybridation: 0, elongation: 0 }
};

GS.updatePcrCooldowns = function (delta) {
  for (const k of Object.keys(GS.pcr.cd)) {
    if (GS.pcr.cd[k] > 0) GS.pcr.cd[k] = Math.max(0, GS.pcr.cd[k] - delta);
  }
  if (GS.hero._hybridBoostMs > 0) GS.hero._hybridBoostMs = Math.max(0, GS.hero._hybridBoostMs - delta);
};

// Mutations (attaque) -> cible = monstre le plus proche
GS.castMutation = function (scene, type) {
  
  const target = GS.nearestMonsterInRange(scene, 220);
  if (!target) return;

  const baseDmg = GS.hero.atk;
  const boost = (GS.hero._hybridBoostMs > 0) ? 1.35 : 1.0;

  if (type === "substitution") {
    GS.dealToMonster(scene, target, Math.floor(baseDmg * 1.0 * boost));
    GS.applyAtkDebuff(target, 4000, 3);
    GS.flashRect(target, 0x60a5fa, 80);

  } else if (type === "inversion") {
    GS.dealToMonster(scene, target, Math.floor(baseDmg * 0.6 * boost));
    GS.applyStun(target, 900);
    GS.flashRect(target, 0xf472b6, 80);

  } else if (type === "insertion") {
    GS.dealToMonster(scene, target, Math.floor(baseDmg * 1.35 * boost));
    GS.applySlow(target, 3500);
    GS.flashRect(target, 0x34d399, 80);

  } else if (type === "deletion") {
    GS.dealToMonster(scene, target, Math.floor(baseDmg * 0.9 * boost));
    GS.applyDot(target, 4500, 700, 2);
    GS.flashRect(target, 0xf87171, 80);
  }
};

// PCR powers
GS.castPcr = function (scene, type) {
  if (!GS.inventory.pcrUnlocked) {
    GS.pushMsg("PCR verrouillée : trouve ADN matrice, amorces, dNTP, polymérase.");
    return;
  }

  const CD = { denaturation: 9000, hybridation: 12000, elongation: 15000 };
  if (GS.pcr.cd[type] > 0) {
    GS.pushMsg(`PCR ${type} en recharge...`);
    return;
  }
  GS.pcr.cd[type] = CD[type];

  if (type === "denaturation") {
    let count = 0;
    for (const m of GS.monsters.getChildren()) {
      const d = Phaser.Math.Distance.Between(scene.GS.player.x, scene.GS.player.y, m.x, m.y);
      if (d <= 260) {
        GS.applyStun(m, 2000);
        count++;
      }
    }
    GS.pushMsg(`Dénaturation : ${count} ennemis immobilisés.`);

  }   else if (type === "hybridation") {
      // si déjà prêt => déclenche et consomme
      if (GS.hybrid.ready && GS.hybrid.first && GS.hybrid.second) {
        GS.hybrid.ready = false;
        GS.pushMsg("Combo Hybridation !");
        GS.castMutation(scene, GS.hybrid.first);
        GS.castMutation(scene, GS.hybrid.second);
        GS.hybrid.first = null;
        GS.hybrid.second = null;
        return;
      }

      // sinon => ouvrir sélection
      GS.hybrid.active = true;
      GS.hybrid.selecting = true;
      GS.hybrid.step = 1;
      GS.hybrid.first = null;
      GS.hybrid.second = null;

      GS.openRadialMenu(scene, "Choisis la mutation 1");
      GS.pushMsg("Hybridation : choisis 2 mutations.");
    }

 
    else if (type === "elongation") {
    const heal = 25;
    GS.hero.hp = Math.min(GS.hero.maxHp, GS.hero.hp + heal);
    GS.pushMsg(`Élongation : +${heal} HP.`);
  }
};

GS.mutateDnaOnce = function(dna, type) {
  if (!dna || dna.length < 4) dna = "ATCG";

  const bases = ["A","T","C","G"];
  const i = Phaser.Math.Between(0, dna.length - 1);

  if (type === "substitution") {
    const current = dna[i];
    const b = Phaser.Utils.Array.RemoveRandomElement(bases.slice());
    // assure différent
    const newBase = (b === current) ? bases[(bases.indexOf(b)+1)%4] : b;
    return dna.slice(0,i) + newBase + dna.slice(i+1);
  }

  if (type === "insertion") {
    const newBase = Phaser.Utils.Array.GetRandom(bases);
    return dna.slice(0,i) + newBase + dna.slice(i);
  }

  if (type === "deletion") {
    if (dna.length <= 4) return dna; // évite ADN trop court
    return dna.slice(0,i) + dna.slice(i+1);
  }

  if (type === "inversion") {
    const a = Phaser.Math.Between(0, dna.length - 2);
    const b = Phaser.Math.Between(a+1, dna.length - 1);
    const mid = dna.slice(a, b+1).split("").reverse().join("");
    return dna.slice(0,a) + mid + dna.slice(b+1);
  }

  return dna;
};

GS.applyGenomeShiftFromDarkShifter = function(scene) {
  const now = scene.time.now;

  // cooldown anti-spam (ex: 2.5s)
  if (now - GS.hero.lastGenomeHitAt < 2500) return;
  GS.hero.lastGenomeHitAt = now;

  // choisir mutation aléatoire
  const choices = ["substitution","insertion","deletion","inversion"];
  const type = Phaser.Utils.Array.GetRandom(choices);

  const before = GS.hero.dna;
  GS.hero.dna = GS.mutateDnaOnce(GS.hero.dna, type);

  const saved = localStorage.getItem("GS_HERO_DNA");
  if (saved && /^[ATCGN]+$/i.test(saved)) {
    GS.hero.dna = saved.toUpperCase();
  } else {
    GS.hero.dna = fasta["hero"] ?? GS.hero.dna;
  }
  GS.applyDnaToHero(GS.hero.dna);
  localStorage.setItem("GS_HERO_DNA", GS.hero.dna);




  // effet selon mutation
  if (type === "substitution") {
    GS.hero.effects.atkDebuffMs = 4000;
    GS.hero.effects.atkDebuffValue = 3;
    GS.pushMsg("⚠ Dark Shifter : Substitution ! ATK réduit (4s).");
  } else if (type === "insertion") {
    GS.hero.effects.slowMs = 3000;
    GS.pushMsg("⚠ Dark Shifter : Insertion ! Ralentissement (3s).");
  } else if (type === "deletion") {
    GS.hero.hp = Math.max(1, GS.hero.hp - 10);
    GS.pushMsg("⚠ Dark Shifter : Délétion ! -10 HP.");
  } else if (type === "inversion") {
    GS.hero.effects.slowMs = 2000;
    GS.pushMsg("⚠ Dark Shifter : Inversion ! Confusion (slow 2s).");
  }

  GS.pushMsg(`ADN: ${before} → ${GS.hero.dna}`);
};
