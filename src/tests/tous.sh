#!/bin/bash
# Lance les contrôles du site. À exécuter depuis la racine du projet.
cd "$(dirname "$0")" || exit 1
echo "=== analyse iCalendar ==="       && node ical.mjs    | tail -1
echo "=== fusion des périodes ==="     && node fusion.mjs  | tail -1
echo "=== calcul des prix ==="         && node tarifs.mjs  | tail -8
echo "=== disponibilités simulées ===" && node dispo.mjs   | tail -3
