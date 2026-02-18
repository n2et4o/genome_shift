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
