import { obtenirPeriodes, estLibre } from '../../netlify/functions/disponibilites.mjs';
import { calculer } from '../../js/tarifs.mjs';
const d = await obtenirPeriodes();
console.log("mode :", d.mode, "| periodes :", d.periodes.length);
console.log("5 premieres :");
d.periodes.slice(0,5).forEach(p => console.log("   ", p.debut, "->", p.fin, "|", p.source));
// deterministe ?
const e = await obtenirPeriodes();
console.log("\ndeterministe :", JSON.stringify(d.periodes) === JSON.stringify(e.periodes) ? "oui" : "NON");
// une periode prise doit etre refusee
const p0 = d.periodes[0];
console.log("libre sur une periode prise :", estLibre(d.periodes, p0.debut, p0.fin), "(attendu false)");
// chevauchement partiel
const veille = new Date(new Date(p0.debut+"T00:00:00Z").getTime()-2*86400000).toISOString().slice(0,10);
console.log("libre a cheval sur le debut  :", estLibre(d.periodes, veille, p0.fin), "(attendu false)");
// juste avant : doit etre libre si rien d'autre
console.log("libre juste avant            :", estLibre(d.periodes, veille, p0.debut), "(attendu true si rien d'autre)");
// taux d'occupation par saison
let haute=0, basse=0;
for (const p of d.periodes) { const m = +p.debut.slice(5,7); (m<=4||m===12 ? haute : basse, m<=4||m===12) ? haute++ : basse++; }
console.log("\nsemaines prises — haute saison :", haute, "| basse saison :", basse);
