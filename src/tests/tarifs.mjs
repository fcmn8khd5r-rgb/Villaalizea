import { calculer, saisonDu } from '../../js/tarifs.mjs';
const an = new Date().getUTCFullYear() + 1;
console.log("--- saisons ---");
for (const md of ["01-20","03-10","04-15","04-16","07-04","12-14","12-15","12-22","01-03"])
  console.log("  ", md, "->", saisonDu(new Date(`${an}-${md}T00:00:00Z`)).nom);
console.log("\n--- calculs ---");
const cas = [
  [`${an}-07-04`, `${an}-07-11`, 6, "basse, 7 nuits"],
  [`${an}-02-14`, `${an}-02-21`, 8, "haute, 7 nuits"],
  [`${an}-12-20`, `${an+1}-01-03`, 8, "fetes, 14 nuits"],
  [`${an}-04-12`, `${an}-04-19`, 4, "a cheval haute/basse"],
  [`${an}-07-04`, `${an}-07-07`, 4, "trop court -> refus"],
  [`${an}-12-22`, `${an}-12-27`, 4, "fetes trop court -> refus"],
  [`${an}-07-04`, `${an}-07-11`, 12, "trop de voyageurs -> refus"],
  ["2020-01-01", "2020-01-10", 4, "date passee -> refus"],
];
for (const [a,d,v,nom] of cas) {
  const r = calculer(a,d,v);
  if (r.erreur) { console.log(`  ${nom.padEnd(28)} REFUS : ${r.erreur}`); continue; }
  console.log(`  ${nom.padEnd(28)} ${r.nuits}n  sejour ${r.sejour.toFixed(2)}  taxe ${r.taxe.toFixed(2)}  total ${r.total.toFixed(2)}  acompte ${r.acompte.toFixed(2)}`);
}
