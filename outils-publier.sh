#!/bin/bash
# =============================================================================
# Assemble _site/ : exactement ce qui doit partir en ligne, rien de plus.
#
# Netlify n'a pas d'équivalent de .vercelignore — tout le dossier publié est
# déployé. Sans ce tri partiraient les scripts de fabrication, la page d'essai
# des replis, et surtout src/orig : près de quatre cents mégaoctets de vidéos
# sources.
# =============================================================================
set -e
cd "$(dirname "$0")"

# ---- Garde : pas de publication sans identité complète de l'éditeur --------
# La loi impose que l'éditeur d'un site commercial soit identifiable. Tant que
# le SIREN manque, les mentions légales sont incomplètes : on refuse d'assembler
# plutôt que de laisser partir un site en défaut.
python3 - <<'PY'
import json, sys
e = json.load(open("config/villa.json", encoding="utf-8"))["editeur"]
manque = [c for c in ("studio", "responsable", "adresse", "courriel")
          if not str(e.get(c, "")).strip()]
if manque:
    print("\n  PUBLICATION REFUSÉE — identité de l'éditeur incomplète.")
    print("  Champ(s) vide(s) dans config/villa.json, bloc « editeur » : "
          + ", ".join(manque))
    print("  Renseignez-les, relancez `python3 construire.py`, puis ce script.\n")
    sys.exit(1)
PY

# ---- Les blocs générés sont-ils à jour ? ----------------------------------
python3 construire.py --verifie > /dev/null

rm -rf _site && mkdir -p _site
for f in *.html; do
  case "$f" in essai-*.html) continue;; esac
  cp "$f" _site/
done
cp -R assets css js _site/
cp favicon.svg favicon.ico apple-touch-icon.png robots.txt sitemap.xml _site/ 2>/dev/null || true

# ---- Domaine réel -----------------------------------------------------------
# config/villa.json porte un domaine d'attente. Netlify expose l'adresse vraie
# du site dans $URL au moment de construire : on la substitue ici, faute de quoi
# le lien canonique, les balises de partage et le plan du site désigneraient un
# domaine qui n'existe pas — et l'aperçu partagé n'aurait pas d'image.
python3 - "${URL:-}" "${DEPLOY_PRIME_URL:-}" <<'DOM'
import json, sys, glob
attente = json.load(open("config/villa.json", encoding="utf-8"))["site"]["url"].rstrip("/")
reel = (sys.argv[1] or sys.argv[2] or "").rstrip("/")
if not reel:
    print("  domaine : %s (l'hebergeur n'a fourni aucune adresse)" % attente)
    raise SystemExit
n = 0
for f in glob.glob("_site/**/*", recursive=True):
    if not f.endswith((".html", ".xml", ".txt", ".webmanifest")): continue
    s = open(f, encoding="utf-8").read()
    if attente in s:
        open(f, "w", encoding="utf-8").write(s.replace(attente, reel))
        n += 1
print("  domaine : %s -> %s (%d fichiers)" % (attente, reel, n))
DOM

echo "  _site assemblé : $(find _site -type f | wc -l | tr -d ' ') fichiers, $(du -sh _site | cut -f1)"
echo "  exclus : src/ (dont $(du -sh src/orig 2>/dev/null | cut -f1 || echo 0) de sources), les pages essai-*.html, config/"
