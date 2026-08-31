/* =========================================================================
   Calcul du prix — partagé entre le serveur et le navigateur.
   =========================================================================
   Ce fichier est chargé des DEUX côtés : par le navigateur pour afficher le
   détail en direct, et par la fonction d'acompte pour établir le montant
   réellement facturé. Un seul jeu de règles, donc aucune divergence possible
   entre ce que le visiteur lit et ce qu'il paie.

   Le serveur recalcule toujours : le prix venu du navigateur n'est jamais
   pris pour argent comptant, sinon il suffirait de modifier la page.
   ========================================================================= */

export const CONFIG = {
  nuitsMini: 5,
  acomptePourcent: 30,
  menage: 350,
  voyageursMax: 8,
  saisons: [
    { cle: "fetes", nom: { fr: "Fêtes de fin d'année", en: "Festive season" },
      prix: 12500, nuitsMini: 14,
      plages: [["12-20", "12-31"], ["01-01", "01-05"]] },
    { cle: "haute", nom: { fr: "Haute saison", en: "High season" }, prix: 7800,
      plages: [["12-15", "12-19"], ["01-06", "04-15"]] },
    { cle: "basse", nom: { fr: "Basse saison", en: "Low season" }, prix: 4200,
      plages: [["04-16", "12-14"]] }
  ],
  taxe: { taux: 0.05, plafondParPersonneParNuit: 4.30 }
};

const jour = d => d.toISOString().slice(0, 10);

/* Ce module tourne des deux côtés : il ne peut donc pas lire `document` pour
   savoir dans quelle langue répondre. La langue lui est passée — par la page
   côté navigateur, par la requête côté serveur — et le français sert de
   repli. Les refus partent d'ici : c'est le seul endroit qui sait pourquoi
   une demande est irrecevable, il doit savoir le dire dans les deux langues. */
export const nomSaison = (s, lg = "fr") =>
  (s.nom && typeof s.nom === "object") ? (s.nom[lg] || s.nom.fr) : s.nom;

const MESSAGES = {
  fr: {
    illisible: "Dates illisibles.",
    ordre:     "Le départ doit suivre l'arrivée.",
    trop_long: "Séjour trop long pour une réservation en ligne.",
    capacite:  n => `La villa accueille 1 à ${n} voyageurs.`,
    passee:    "La date d'arrivée est passée.",
    mini:      n => `Séjour minimum de ${n} nuits sur cette période.`
  },
  en: {
    illisible: "Those dates cannot be read.",
    ordre:     "The departure must come after the arrival.",
    trop_long: "That stay is too long to book online.",
    capacite:  n => `The villa sleeps 1 to ${n} guests.`,
    passee:    "That arrival date has already passed.",
    mini:      n => `A minimum stay of ${n} nights applies to these dates.`
  }
};
const msg = lg => MESSAGES[lg] || MESSAGES.fr;

/** Durée minimale applicable à un séjour, en nuits.
 *
 *  Exportée parce que le CALENDRIER en a besoin autant que le calcul : sans
 *  elle, il proposait des dates d'arrivée d'où aucun séjour valide ne pouvait
 *  partir, et le visiteur tombait sur un refus après avoir choisi. La règle
 *  vit ici, une seule fois, comme les prix. */
export function nuitsMinimum(arrivee, nuits = 1) {
  const a = new Date(arrivee + "T00:00:00Z");
  let mini = CONFIG.nuitsMini;
  for (let i = 0; i < Math.max(1, nuits); i++) {
    const n = new Date(a); n.setUTCDate(n.getUTCDate() + i);
    const s = saisonDu(n);
    mini = Math.max(mini, s.nuitsMini || CONFIG.nuitsMini);
  }
  return mini;
}

export function saisonDu(date) {
  const md = jour(date).slice(5);              // "MM-JJ"
  for (const s of CONFIG.saisons) {            // l'ordre compte : fêtes d'abord
    for (const [a, b] of s.plages) if (md >= a && md <= b) return s;
  }
  return CONFIG.saisons[CONFIG.saisons.length - 1];
}

/** Renvoie le détail chiffré, ou { erreur } si la demande est irrecevable. */
export function calculer(arrivee, depart, voyageurs, lg = "fr") {
  const M = msg(lg);
  const a = new Date(arrivee + "T00:00:00Z"), d = new Date(depart + "T00:00:00Z");
  if (isNaN(a) || isNaN(d)) return { erreur: M.illisible };
  const nuits = Math.round((d - a) / 86400000);
  if (nuits < 1) return { erreur: M.ordre };
  if (nuits > 90) return { erreur: M.trop_long };

  const v = Math.round(Number(voyageurs) || 0);
  if (v < 1 || v > CONFIG.voyageursMax)
    return { erreur: M.capacite(CONFIG.voyageursMax) };

  const aujourdhui = new Date(); aujourdhui.setUTCHours(0, 0, 0, 0);
  if (a < aujourdhui) return { erreur: M.passee };

  // Prix nuit par nuit : un séjour à cheval sur deux saisons est facturé au
  // prorata réel, pas au tarif de la date d'arrivée.
  let sejour = 0, mini = CONFIG.nuitsMini;
  const parSaison = {};
  for (let i = 0; i < nuits; i++) {
    const n = new Date(a); n.setUTCDate(n.getUTCDate() + i);
    const s = saisonDu(n);
    const prixNuit = s.prix / 7;
    sejour += prixNuit;
    mini = Math.max(mini, s.nuitsMini || CONFIG.nuitsMini);
    const nomS = nomSaison(s, lg);
    parSaison[nomS] = (parSaison[nomS] || 0) + 1;
  }
  if (nuits < mini)
    return { erreur: M.mini(mini) };

  sejour = Math.round(sejour * 100) / 100;
  const prixNuitMoyen = sejour / nuits;
  const taxeParNuit = Math.min(prixNuitMoyen / v * CONFIG.taxe.taux,
                               CONFIG.taxe.plafondParPersonneParNuit);
  const taxe    = Math.round(taxeParNuit * v * nuits * 100) / 100;
  const total   = Math.round((sejour + CONFIG.menage + taxe) * 100) / 100;
  const acompte = Math.round((sejour + CONFIG.menage) * CONFIG.acomptePourcent) / 100;

  return {
    nuits, voyageurs: v, arrivee, depart,
    detailSaisons: parSaison,
    sejour, menage: CONFIG.menage, taxe, total,
    acompte, solde: Math.round((total - acompte) * 100) / 100,
    acompteCentimes: Math.round(acompte * 100)
  };
}
