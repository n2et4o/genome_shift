from flask import Flask, request, jsonify, send_from_directory
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent  # racine du projet
FASTA_PATH = ROOT / "data" / "dna.fasta"

# On sert les fichiers statiques depuis la racine (comme Live Server)
app = Flask(__name__, static_folder=str(ROOT), static_url_path="")


def read_fasta(path: Path) -> dict:
    seqs = {}
    current = None
    if not path.exists():
        return seqs

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            current = line[1:].strip()
            seqs[current] = ""
        elif current:
            seqs[current] += re.sub(r"[^ATCGN]", "", line.upper())

    return seqs


def write_fasta(path: Path, seqs: dict):
    lines = []
    for k, v in seqs.items():
        lines.append(f">{k}")
        lines.append(v)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.post("/api/save-dna")
def save_dna():
    data = request.get_json(force=True) or {}

    hero_initial = (data.get("hero_initial") or "").upper()
    hero_current = (data.get("hero_current") or "").upper()

    if not re.fullmatch(r"[ATCGN]+", hero_initial):
        return jsonify({"ok": False, "error": "hero_initial invalide"}), 400
    if not re.fullmatch(r"[ATCGN]+", hero_current):
        return jsonify({"ok": False, "error": "hero_current invalide"}), 400

    seqs = read_fasta(FASTA_PATH)
    seqs["hero_initial"] = hero_initial
    seqs["hero_current"] = hero_current
    write_fasta(FASTA_PATH, seqs)

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)