#!/bin/bash
# Double-cliquez ce fichier : il démarre le serveur et ouvre le site.
# Fermez la fenêtre du Terminal pour l'arrêter.
cd "$(dirname "$0")"
PORT=8150
# Si un serveur tourne déjà sur ce port, on ne le double pas.
if ! curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
  node src/serveur-local.mjs "$PORT" &
  sleep 1.2
fi
open "http://localhost:$PORT/"
echo
echo "  Villa Alizéa tourne sur http://localhost:$PORT"
echo "  Le survol du hero se pilote en faisant défiler la page d'accueil."
echo
echo "  Fermez cette fenêtre pour arrêter le serveur."
wait
