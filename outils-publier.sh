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
manque = [c for c in ("studio", "responsable", "adresse", "courriel", "siren")
          if not str(e.get(c, "")).strip()]
if manque:
    print("\n  PUBLICATION REFUSÉE — mentions légales incomplètes.")
    print("  Champ(s) vide(s) dans config/villa.json, bloc « editeur » : "
          + ", ".join(manque))
    print("  Renseignez-les, relancez `python3 construire.py`, puis ce script.\n")
    sys.exit(1)
PY

# ---- Les blocs générés sont-ils à jour ? ----------------------------------
python3 construire.py --verifie > /dev/null

rm -rf _site && mkdir -p _site
for f in *.html; do
  [ "$f" = "essai-replis.html" ] && continue
  cp "$f" _site/
done
cp -R assets css js _site/
cp favicon.svg robots.txt sitemap.xml _site/ 2>/dev/null || true

echo "  _site assemblé : $(find _site -type f | wc -l | tr -d ' ') fichiers, $(du -sh _site | cut -f1)"
echo "  exclus : src/ (dont $(du -sh src/orig 2>/dev/null | cut -f1 || echo 0) de sources), essai-replis.html, config/"
