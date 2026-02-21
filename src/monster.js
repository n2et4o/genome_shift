window.GS = window.GS || {};

// Monsters group
GS.monsters = null;
GS.lastDamageAt = 0;

GS.dnaToMonsterStats = function (dna) {
  const len = Math.max(4, dna.length);
  const gc = (dna.match(/[GC]/g) || []).length;
  const at = (dna.match(/[AT]/g) || []).length;

  const def = 2 + Math.floor((gc / len) * 8);
  const speed = 80 + Math.floor((at / len) * 140);
  const atk = 5 + Math.floor(len / 8);
  const hp = 25 + len * 2;
  return { hp, atk, def, speed };
};

GS.spawnMonster = function (scene, fastaId, x, y, opts = {}) {
  const dna = GS.fasta[fastaId] ?? "ATCGATCG";
  const base = GS.dnaToMonsterStats(dna);

  const color = (opts.kind === "dark") ? 0xa855f7 : 0xf87171;
  const rect = scene.add.rectangle(x, y, 26, 26, color);
  scene.physics.add.existing(rect);
  rect.body.setCollideWorldBounds(true);
  rect.body.setBounce(1, 1); // rebondit sur les limites


  rect.gs = {
    id: fastaId,
    kind: opts.kind ?? "normal",
    dna,
    hp: base.hp,
    maxHp: base.hp,
    atk: base.atk,
    def: base.def,
    speed: base.speed,
    effects: {
      slowMs: 0,
      stunMs: 0,
      dotMs: 0,
      dotTickMs: 0,
      atkDebuffMs: 0,
      atkDebuffValue: 0
    }
  };

  rect.body.setVelocity(Phaser.Math.Between(-80, 80), Phaser.Math.Between(-80, 80));

  GS.monsters.add(rect);

  //  ici seulement
  if (typeof GS.attachHpBar === "function") GS.attachHpBar(scene, rect);

  return rect;
};



// AI movement
GS.applyMonsterMovement = function (scene, m) {
  //   si le monstre a été détruit pendant les effets, on saute
  if (!m || !m.active || !m.body) return;
  if (m.gs.effects.stunMs > 0) {
    m.body.setVelocity(0);
    return;
  }

  const spd = GS.currentMonsterSpeed(m);
  const aggroRange = (m.gs.kind === "dark") ? 620 : 360;
  const player = scene.GS.player;

  const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
  if (d <= aggroRange) {
    const ang = Phaser.Math.Angle.Between(m.x, m.y, player.x, player.y);
    m.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
  } else {
    if (Math.abs(m.body.velocity.x) + Math.abs(m.body.velocity.y) < 10) {
      m.body.setVelocity(Phaser.Math.Between(-spd, spd), Phaser.Math.Between(-spd, spd));
    } else {
      const vx = Phaser.Math.Clamp(m.body.velocity.x, -spd, spd);
      const vy = Phaser.Math.Clamp(m.body.velocity.y, -spd, spd);
      m.body.setVelocity(vx, vy);
    }
  }
};

GS.currentMonsterSpeed = function (m) {
  const base = m.gs.speed;
  if (m.gs.effects.slowMs > 0) return Math.max(40, Math.floor(base * 0.45));
  return base;
};

GS.currentMonsterAtk = function (m) {
  const base = m.gs.atk;
  if (m.gs.effects.atkDebuffMs > 0) return Math.max(1, base - m.gs.effects.atkDebuffValue);
  return base;
};

// Collision: monster hits hero
GS.onHeroHit = function (scene, monster) {
  const now = scene.time.now;
  if (now - GS.lastDamageAt < 600) return;
  GS.lastDamageAt = now;

  if (monster.gs?.kind === "dark" || monster.kind === "dark") {
    GS.applyGenomeShiftFromDarkShifter(scene);
  }


  const dmg = Math.max(1, GS.currentMonsterAtk(monster) - GS.hero.def);
  GS.hero.hp -= dmg;
  GS.flashRect(scene.GS.player, 0xfacc15, 90);

  if (monster.gs.kind === "dark") {
    console.log("⚠ Dark Shifter touched the hero (future: genome shift).");
  }
};

// Effects
GS.applySlow = (m, ms) => m.gs.effects.slowMs = Math.max(m.gs.effects.slowMs, ms);
GS.applyStun = (m, ms) => m.gs.effects.stunMs = Math.max(m.gs.effects.stunMs, ms);

GS.applyDot = function (m, totalMs, tickMs, dmgPerTick) {
  m.gs.effects.dotMs = Math.max(m.gs.effects.dotMs, totalMs);
  m.gs.effects.dotTickMs = tickMs;
  m.gs.effects._dotAcc = 0;
  m.gs.effects._dotDmg = dmgPerTick;
};

GS.applyAtkDebuff = function (m, ms, value) {
  m.gs.effects.atkDebuffMs = Math.max(m.gs.effects.atkDebuffMs, ms);
  m.gs.effects.atkDebuffValue = Math.max(m.gs.effects.atkDebuffValue, value);
};

GS.updateMonsterEffects = function (m, delta) {
  const e = m.gs.effects;
  if (e.slowMs > 0) e.slowMs = Math.max(0, e.slowMs - delta);
  if (e.stunMs > 0) e.stunMs = Math.max(0, e.stunMs - delta);
  if (e.atkDebuffMs > 0) e.atkDebuffMs = Math.max(0, e.atkDebuffMs - delta);

  if (e.dotMs > 0) {
    e.dotMs = Math.max(0, e.dotMs - delta);
    e._dotAcc = (e._dotAcc ?? 0) + delta;

    if (e._dotAcc >= e.dotTickMs) {
      e._dotAcc = 0;
      m.gs.hp -= Math.max(1, e._dotDmg);
      GS.flashRect(m, 0xffffff, 40);
      if (m.gs.hp <= 0) m.destroy();
    }
  }
};

// Damage helpers used by hero
GS.nearestMonsterInRange = function (scene, range) {
  let best = null;
  let bestD = Infinity;
  const player = scene.GS.player;
  for (const m of GS.monsters.getChildren()) {
    const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
    if (d < bestD) { bestD = d; best = m; }
  }
  if (!best || bestD > range) return null;
  return best;
};

GS.dealToMonster = function (scene, m, dmg) {
  const real = Math.max(1, dmg - m.gs.def);
  m.gs.hp -= real;

  if (m.gs.hp <= 0) {
    if (m.hpBg) m.hpBg.destroy();
    if (m.hpBar) m.hpBar.destroy();
    m.destroy();
    return;
  }

  const player = scene.GS.player;
  const angle = Phaser.Math.Angle.Between(player.x, player.y, m.x, m.y);
  const kb = 120;
  m.body.setVelocity(Math.cos(angle) * kb, Math.sin(angle) * kb);
};
