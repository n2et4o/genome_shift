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
