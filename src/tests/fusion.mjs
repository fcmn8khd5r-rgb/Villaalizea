import { fusionner } from '../../netlify/functions/disponibilites.mjs';
const cas = [
  { nom:"chevauchement",
    e:[{debut:"2026-02-14",fin:"2026-02-21",source:"Airbnb",motif:"reserve"},
       {debut:"2026-02-18",fin:"2026-02-25",source:"Booking",motif:"reserve"}],
    attendu:[["2026-02-14","2026-02-25"]] },
  { nom:"contigus (depart = arrivee)",
    e:[{debut:"2026-03-07",fin:"2026-03-14",source:"Airbnb",motif:"reserve"},
       {debut:"2026-03-14",fin:"2026-03-21",source:"Airbnb",motif:"reserve"}],
    attendu:[["2026-03-07","2026-03-21"]] },
  { nom:"disjoints",
    e:[{debut:"2026-05-02",fin:"2026-05-09",source:"Airbnb",motif:"reserve"},
       {debut:"2026-06-06",fin:"2026-06-13",source:"Airbnb",motif:"reserve"}],
    attendu:[["2026-05-02","2026-05-09"],["2026-06-06","2026-06-13"]] },
  { nom:"englobe",
    e:[{debut:"2026-07-01",fin:"2026-07-29",source:"Airbnb",motif:"reserve"},
       {debut:"2026-07-10",fin:"2026-07-17",source:"Booking",motif:"reserve"}],
    attendu:[["2026-07-01","2026-07-29"]] },
  { nom:"non trie a l'entree",
    e:[{debut:"2026-09-05",fin:"2026-09-12",source:"A",motif:"reserve"},
       {debut:"2026-08-01",fin:"2026-08-08",source:"A",motif:"reserve"}],
    attendu:[["2026-08-01","2026-08-08"],["2026-09-05","2026-09-12"]] }
];
let ok = true;
for (const c of cas) {
  const r = fusionner(c.e).map(p => [p.debut, p.fin]);
  const bon = JSON.stringify(r) === JSON.stringify(c.attendu);
  if (!bon) ok = false;
  console.log((bon ? "  ok  " : "ECHEC ") + c.nom, bon ? "" : "-> " + JSON.stringify(r));
}
console.log(ok ? "\nFusion correcte." : "\nFusion FAUSSE.");
process.exit(ok ? 0 : 1);
