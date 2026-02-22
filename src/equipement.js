window.GS = window.GS || {};

GS.inventory = {
  common: {
    mg: { name: "Ion magnésium (Mg²⁺)", have: true, desc: "Cofacteur essentiel pour l'activité de la polymérase." },
    buffer: { name: "Tampon de réaction", have: true, desc: "Assure un pH et une force ionique optimaux." },
    water: { name: "Eau ultrapure", have: true, desc: "Pour ajuster le volume final du mélange réactionnel." }
  },
  pcr: {
    matrix: { name: "ADN matrice", have: false, desc: "Échantillon contenant la séquence à amplifier." },
    primers: { name: "Amorces (x2)", have: false, desc: "Courtes séquences d'ADN simple brin délimitant la région cible." },
    dntp: { name: "dNTP", have: false, desc: "Briques (dATP, dCTP, dGTP, dTTP) utilisées pour synthétiser le nouveau brin." },
    polymerase: { name: "ADN polymérase thermostable", have: false, desc: "Enzyme résistante à la chaleur (ex: Taq polymérase), catalyse l'ajout des nucléotides." }
  },
  pcrUnlocked: false
};

// Loot group
GS.lootGroup = null;

GS.spawnLoot = function (scene, key, x, y) {
    const loot = scene.add.rectangle(x, y, 18, 18, 0xfbbf24);
    scene.physics.add.existing(loot, true);
    loot.lootKey = key;
    GS.lootGroup.add(loot);

    const label = scene.add.text(x - 30, y - 30, GS.inventory.pcr[key].name, {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#fbbf24"
    });
    loot.label = label;


  return loot; // AJOUT
};


GS.onLootPickup = function (scene, loot) {
  const k = loot.lootKey;
  if (!GS.inventory.pcr[k].have) {
    GS.inventory.pcr[k].have = true;
    GS.pushMsg(`📦 Réactif obtenu : ${GS.inventory.pcr[k].name}`);
    //GS.pushMsg(GS.inventory.pcr[k].desc);

    if (GS.checkPcrUnlock()) {
      GS.pushMsg("✅ PCR débloquée ! Touches: W (dénaturation), X (hybridation), C (élongation)");
    }

    if (scene.GS.invOpen) GS.refreshInventoryUI(scene);
  }

  if (loot.label) loot.label.destroy();
  loot.destroy();

  const unlockedNow = GS.checkPcrUnlock();

  if (unlockedNow) {
    if (scene?.GS?.pcrHud) {
      scene.GS.pcrHud.setTitle("PCR"); // affiche le titre seulement maintenant
    }
    GS.pushMsg("✅ PCR débloquée ! Touches: W (dénaturation), X (hybridation), C (élongation)");

    if (scene?.GS?.pcrHud) {
      scene.GS.pcrHud.updateSlots([
        { key: "W", name: "Dénaturation", enabled: true },
        { key: "X", name: "Hybridation", enabled: true },
        { key: "C", name: "Élongation", enabled: true }
      ]);
    }
  } else {
    // optionnel : garder les cercles visibles mais verrouillés
    if (scene?.GS?.pcrHud) {
      scene.GS.pcrHud.updateSlots([
        { key: "W", name: "Dénaturation", enabled: false },
        { key: "X", name: "Hybridation", enabled: false },
        { key: "C", name: "Élongation", enabled: false }
      ]);
    }
  }


};


GS.checkPcrUnlock = function () {
  const keys = Object.keys(GS.inventory.pcr);
  const ok = keys.every(k => GS.inventory.pcr[k].have);
  GS.inventory.pcrUnlocked = ok;
  return ok;

};

// UI Inventaire
GS.refreshInventoryUI = function (scene) {
  const items = [];

  // Communs
  for (const k of Object.keys(GS.inventory.common)) {
    const it = GS.inventory.common[k];
    items.push({ name: it.name, have: it.have, desc: it.desc, cat: "Commun" });
  }

  // PCR
  for (const k of Object.keys(GS.inventory.pcr)) {
    const it = GS.inventory.pcr[k];
    items.push({ name: it.name, have: it.have, desc: it.desc, cat: "PCR" });
  }

  scene.GS.invItems = items;

  // Clamp index
  scene.GS.invIndex = Phaser.Math.Clamp(scene.GS.invIndex ?? 0, 0, items.length - 1);

  // Liste avec curseur
  const lines = [];
  lines.push("— Communs —");
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.cat !== "Commun") continue;
    const cursor = (i === scene.GS.invIndex) ? "▶ " : "  ";
    const mark = it.have ? "✅" : "❌";
    lines.push(`${cursor}${mark} ${it.name}`);
  }

  lines.push("");
  lines.push("— Réactifs PCR —");
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.cat !== "PCR") continue;
    const cursor = (i === scene.GS.invIndex) ? "▶ " : "  ";
    const mark = it.have ? "✅" : "❌";
    lines.push(`${cursor}${mark} ${it.name}`);
  }

  scene.GS.invList.setText(lines.join("\n"));

  // Description du sélectionné
  const sel = items[scene.GS.invIndex];
  scene.GS.invDesc.setText(
    `${sel.name}\n\n${sel.desc}\n\nCatégorie : ${sel.cat}`
  );
};

