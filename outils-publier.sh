#!/bin/bash
# Assemble _site/ : exactement ce qui doit partir en ligne, rien de plus.
#
# Netlify n'a pas d'équivalent de .vercelignore : tout le dossier publié part.
# Sans ce tri, les scripts de fabrication, la page d'essai des replis et
# surtout src/orig — quatre cents mégaoctets de vidéos sources — seraient
# déposés sur le serveur.
set -e
cd "$(dirname "$0")"
rm -rf _site && mkdir -p _site
for f in *.html; do
  [ "$f" = "essai-replis.html" ] && continue
  cp "$f" _site/
done
cp -R assets css js _site/
cp favicon.svg robots.txt sitemap.xml _site/ 2>/dev/null || true
# La configuration sert au générateur, pas au navigateur : on ne la publie pas.
echo "  _site assemblé : $(find _site -type f | wc -l | tr -d ' ') fichiers, $(du -sh _site | cut -f1)"
echo "  exclus : src/ (dont $(du -sh src/orig 2>/dev/null | cut -f1) de sources), essai-replis.html, config/"
