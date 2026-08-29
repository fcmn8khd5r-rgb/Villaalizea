#!/bin/bash
# Double-cliquez ce fichier pour lancer le site et l'ouvrir dans le navigateur.
cd "$(dirname "$0")" || exit 1
PORT=8150
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  echo "Le serveur tourne déjà sur le port $PORT."
else
  echo "Démarrage du serveur…"
  node src/serveur-local.mjs $PORT &
  sleep 1
fi
open "http://localhost:$PORT"
echo
echo "Villa Alizéa — http://localhost:$PORT"
echo "Fermez cette fenêtre pour arrêter le serveur."
wait
