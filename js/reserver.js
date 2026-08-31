/* =========================================================================
   Villa Alizéa — calendrier des disponibilités et acompte
   =========================================================================
   Le calendrier lit /api/disponibilites, qui agrège les flux iCal d'Airbnb
   et de Booking. Le prix est calculé avec js/tarifs.mjs — le même fichier
   que celui qu'utilise le serveur pour établir le montant réellement
   facturé, de sorte que l'affiché et le facturé ne peuvent pas diverger.

   Sans JavaScript, cette page reste utile : les tarifs, les conditions et
   les coordonnées sont dans le HTML, et un encart renvoie vers le
   formulaire de demande.
   ========================================================================= */
import { calculer, nuitsMinimum, CONFIG } from "./tarifs.mjs";

const $ = s => document.querySelector(s);
const jour = d => d.toISOString().slice(0, 10);
/* La page dit sa langue ; les textes viennent de js/textes.js. `tx` retombe
   sur la clé si un texte manque — mieux vaut un mot brut qu'un trou. */
const LG = document.documentElement.lang === "en" ? "en" : "fr";
const TX = (window.ALIZEA_TEXTES || {})[LG] || {};
const tx = (cle, ...v) => {
  let s = TX[cle];
  if (s === undefined) return cle;
  v.forEach((x, i) => { s = s.split("{" + i + "}").join(x); });
  return s;
};
const MOIS  = TX.mois  || ["janvier","février","mars","avril","mai","juin","juillet",
                           "août","septembre","octobre","novembre","décembre"];
const MOIS_C = TX.mois_court || MOIS;
const JOURS = TX.jours || [["L","lundi"],["M","mardi"],["M","mercredi"],["J","jeudi"],
                           ["V","vendredi"],["S","samedi"],["D","dimanche"]];
const LOCALE = TX.locale || "fr-FR";
const euro = n => n.toLocaleString(LOCALE, { style:"currency", currency:"EUR",
                                             maximumFractionDigits: 2 });
const enLettres = s => {
  const d = new Date(s + "T00:00:00Z");
  return LG === "en"
    ? MOIS_C[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear()
    : d.getUTCDate() + " " + MOIS_C[d.getUTCMonth()] + ". " + d.getUTCFullYear();
};

const etat = {
  periodes: [],          // périodes indisponibles, venues du serveur
  prises: new Set(),     // nuits indisponibles, pour un test O(1)
  mois: null,            // premier mois affiché
  arrivee: null,
  depart: null,
  survol: null,
  mode: "",
  source: ""
};

/* ---- chargement des disponibilités -------------------------------------- */
async function charger() {
  const cal = $("#cal");
  try {
    const r = await fetch("/api/disponibilites?langue=" + LG,
                          { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    etat.periodes = d.periodes || [];
    etat.mode = d.mode || "";
    etat.source = (d.sources || []).join(" et ");
    // On déplie en nuits : le test « cette nuit est-elle prise ? » doit être
    // immédiat, il est fait des centaines de fois au rendu.
    for (const p of etat.periodes) {
      for (let c = new Date(p.debut + "T00:00:00Z"); jour(c) < p.fin; c.setUTCDate(c.getUTCDate() + 1))
        etat.prises.add(jour(c));
    }
    majSource(d);
  } catch (e) {
    etat.mode = "erreur";
    $("#cal-source").textContent = tx("cal_erreur");
    $("#cal-source").style.color = "#9C3A28";
  } finally {
    cal.setAttribute("aria-busy", "false");
    etat.mois = premierMoisUtile(etat.mois);
    rendre();
  }
}

/* Le calendrier s'ouvrait sur le mois courant quel qu'il soit. Le 31 août, on
   tombait sur une grille où trente jours sur trente et un étaient barrés — et
   sur téléphone, où un seul mois tient à l'écran, le visiteur n'avait à peu
   près rien à choisir avant d'avoir pensé à cliquer sur la flèche.

   On ouvre donc sur le premier mois qui offre de quoi travailler. Le seuil de
   trois arrivées est un jugement, pas un calcul : assez bas pour ne jamais
   sauter un mois réellement utilisable, assez haut pour ne pas s'arrêter sur
   une grille qui a l'air morte. À défaut, on retient le premier mois offrant
   une seule arrivée, puis le mois courant. La flèche arrière reste active :
   rien n'est caché, seul le point d'entrée change. */
function arriveesDuMois(m) {
  const fin = moisSuivant(m, 1);
  let n = 0;
  for (const c = new Date(m); c < fin; c.setUTCDate(c.getUTCDate() + 1))
    if (arriveePossible(jour(c))) n++;
  return n;
}

function premierMoisUtile(depart) {
  const limite = moisSuivant(depart, 16);
  let repli = null;
  for (let m = new Date(depart); m < limite; m = moisSuivant(m, 1)) {
    const n = arriveesDuMois(m);
    if (n >= 3) return m;
    if (n > 0 && !repli) repli = m;
  }
  return repli || depart;
}

function majSource(d) {
  const e = $("#cal-source");
  if (d.mode === "reel") {
    const q = d.majLe ? new Date(d.majLe).toLocaleString(LOCALE,
                        { dateStyle:"short", timeStyle:"short" }) : "";
    e.textContent = tx("cal_synchro", etat.source, q);
  } else if (d.mode === "demonstration") {
    e.textContent = tx("cal_demo");
  }
}

/* ---- règles de sélection -------------------------------------------------- */
const estPrise = s => etat.prises.has(s);

/** Une date d'arrivée est possible si la nuit n'est pas déjà prise. */
/** Nombre de nuits libres d'affilée à partir de s (0 si s est déjà pris). */
function nuitsLibres(s) {
  let n = 0;
  const c = new Date(s + "T00:00:00Z");
  while (n < 400 && !estPrise(jour(c))) { n++; c.setUTCDate(c.getUTCDate() + 1); }
  return n;
}

/** Une arrivée n'est proposée que si un séjour VALIDE peut y commencer.
 *
 *  Sans cette condition, le calendrier ouvrait des impasses : la veille d'une
 *  réservation était cliquable, et le visiteur découvrait le refus « séjour
 *  minimum de 5 nuits » seulement après avoir choisi ses deux dates. Un
 *  calendrier ne doit jamais proposer ce qu'il refusera ensuite. */
function arriveePossible(s) {
  if (estPrise(s) || s < jour(new Date())) return false;
  const libres = nuitsLibres(s);
  return libres >= nuitsMinimum(s, libres);
}

/** Un départ est possible s'il suit l'arrivée et qu'aucune nuit entre les
    deux n'est prise : on ne doit pas pouvoir enjamber une réservation. */
function departPossible(s) {
  if (!etat.arrivee || s <= etat.arrivee) return false;
  for (let c = new Date(etat.arrivee + "T00:00:00Z"); jour(c) < s; c.setUTCDate(c.getUTCDate() + 1))
    if (estPrise(jour(c))) return false;
  // Même raison que pour l'arrivée : ne pas proposer un départ qui sera refusé.
  const nuits = Math.round((new Date(s) - new Date(etat.arrivee)) / 86400000);
  return nuits >= nuitsMinimum(etat.arrivee, nuits);
}

/* ---- rendu ---------------------------------------------------------------- */
function moisSuivant(d, n) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function rendreMois(premier) {
  const an = premier.getUTCFullYear(), mo = premier.getUTCMonth();
  const debut = new Date(Date.UTC(an, mo, 1));
  const nb = new Date(Date.UTC(an, mo + 1, 0)).getUTCDate();
  const decalage = (debut.getUTCDay() + 6) % 7;          // semaine commençant lundi
  const aujourdhui = jour(new Date());

  let cases = "";
  for (let i = 0; i < decalage; i++) cases += '<td><span class="jour jour--vide"></span></td>';

  for (let n = 1; n <= nb; n++) {
    const d = new Date(Date.UTC(an, mo, n));
    const s = jour(d);
    const pris = estPrise(s);
    const possible = etat.arrivee && !etat.depart ? departPossible(s) : arriveePossible(s);

    const cls = ["jour"];
    if (pris) cls.push("jour--pris");
    if (s === aujourdhui) cls.push("jour--aujourdhui");
    if (s === etat.arrivee || s === etat.depart) cls.push("jour--bord");
    if (s === etat.arrivee) cls.push("jour--debut");
    if (s === etat.depart) cls.push("jour--fin");

    const borne = etat.depart || (etat.arrivee && etat.survol > etat.arrivee ? etat.survol : null);
    if (etat.arrivee && borne && s > etat.arrivee && s < borne) cls.push("jour--entre");

    cases += `<td><button type="button" class="${cls.join(" ")}" data-j="${s}"`
           + `${possible ? "" : " disabled"}`
           + ` aria-label="${n} ${MOIS[mo]} ${an}${pris ? tx("reserve") : ""}">${n}</button></td>`;
    if ((decalage + n) % 7 === 0) cases += "</tr><tr>";
  }

  return `<div class="mois"><h3>${MOIS[mo]} ${an}</h3><table>`
       + `<thead><tr>${JOURS.map(([c, n]) =>
             `<th scope="col"><abbr title="${n}">${c}</abbr></th>`).join("")}</tr></thead>`
       + `<tbody><tr>${cases}</tr></tbody></table></div>`;
}

function rendre() {
  // Même seuil que la feuille de style : sous cette largeur, la grille
  // .cal__mois repasse sur une colonne et un second mois serait illisible.
  const large = window.matchMedia("(min-width: 780px)").matches;
  const html = rendreMois(etat.mois) + (large ? rendreMois(moisSuivant(etat.mois, 1)) : "");
  $("#cal-mois").innerHTML = html;
  const fin = large ? moisSuivant(etat.mois, 1) : etat.mois;
  $("#cal-titre").textContent = etat.mois.getUTCMonth() === fin.getUTCMonth()
    ? `${MOIS[etat.mois.getUTCMonth()]} ${etat.mois.getUTCFullYear()}`
    : `${MOIS[etat.mois.getUTCMonth()]} – ${MOIS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;

  const debutMois = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  $("#cal-prec").disabled = etat.mois <= debutMois;
  $("#cal-suiv").disabled = etat.mois >= moisSuivant(debutMois, 16);
  majRecap();
}

/* ---- récapitulatif -------------------------------------------------------- */
function majRecap() {
  $("#r-arrivee").textContent = etat.arrivee ? enLettres(etat.arrivee) : "—";
  $("#r-depart").textContent  = etat.depart  ? enLettres(etat.depart)  : "—";
  const zone = $("#r-detail"), payer = $("#r-payer");

  if (!etat.arrivee || !etat.depart) {
    zone.innerHTML = '<p class="recap__vide">'
      + tx(etat.arrivee ? "choisir_depart" : "choisir_dates") + "</p>";
    payer.disabled = true;
    return;
  }

  const p = calculer(etat.arrivee, etat.depart, +$("#r-voyageurs").value, LG);
  if (p.erreur) {
    zone.innerHTML = `<p class="recap__erreur">${p.erreur}</p>`;
    payer.disabled = true;
    return;
  }

  // Le détail par saison n'a d'intérêt que si le séjour est à cheval sur
  // plusieurs : sinon on répète « 7 nuits · 7 nuits en basse saison ».
  const parts = Object.entries(p.detailSaisons);
  const bas = n => LG === "en" ? n.toLowerCase() : n.toLowerCase();
  const libelle = parts.length > 1
    ? tx("nuits_saison_mix", p.nuits,
         parts.map(([n, v]) => tx("nuits_part", v, bas(n))).join(", "))
    : tx("nuits_saison_une", p.nuits, bas(parts[0][0]));
  zone.innerHTML =
      `<div class="ligne"><span>${libelle}</span><span>${euro(p.sejour)}</span></div>`
    + `<div class="ligne"><span>${tx("menage")}</span><span>${euro(p.menage)}</span></div>`
    + `<div class="ligne"><span>${tx("taxe", p.voyageurs)}</span><span>${euro(p.taxe)}</span></div>`
    + `<div class="ligne ligne--total"><span>${tx("total")}</span><span>${euro(p.total)}</span></div>`
    + `<div class="ligne ligne--acompte"><span>${tx("acompte", CONFIG.acomptePourcent)}</span><span>${euro(p.acompte)}</span></div>`
    + `<div class="ligne"><span>${tx("solde")}</span><span>${euro(p.solde)}</span></div>`;
  payer.disabled = false;
  $("#r-note").textContent = "";
}

/* ---- interactions --------------------------------------------------------- */
function choisir(s) {
  if (!etat.arrivee || etat.depart) {          // (re)commence une sélection
    etat.arrivee = s; etat.depart = null;
  } else if (s <= etat.arrivee) {
    etat.arrivee = s;
  } else {
    etat.depart = s;
  }
  etat.survol = null;
  rendre();
}

$("#cal-mois").addEventListener("click", e => {
  const b = e.target.closest(".jour"); if (!b || b.disabled) return;
  choisir(b.dataset.j);
});
$("#cal-mois").addEventListener("mouseover", e => {
  const b = e.target.closest(".jour");
  if (!b || !etat.arrivee || etat.depart) return;
  if (etat.survol !== b.dataset.j) { etat.survol = b.dataset.j; rendre(); }
});
$("#cal-prec").addEventListener("click", () => { etat.mois = moisSuivant(etat.mois, -1); rendre(); });
$("#cal-suiv").addEventListener("click", () => { etat.mois = moisSuivant(etat.mois,  1); rendre(); });
$("#r-voyageurs").addEventListener("change", majRecap);
window.addEventListener("resize", () => rendre());

// Navigation au clavier dans la grille, comme dans un vrai sélecteur de dates.
$("#cal-mois").addEventListener("keydown", e => {
  const pas = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 }[e.key];
  if (!pas) return;
  const b = e.target.closest(".jour"); if (!b) return;
  e.preventDefault();
  const d = new Date(b.dataset.j + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + pas);
  if (d < etat.mois) { etat.mois = moisSuivant(etat.mois, -1); rendre(); }
  else if (d >= moisSuivant(etat.mois, 2)) { etat.mois = moisSuivant(etat.mois, 1); rendre(); }
  const cible = document.querySelector(`.jour[data-j="${jour(d)}"]`);
  if (cible) cible.focus();
});

/* ---- acompte -------------------------------------------------------------- */
$("#r-payer").addEventListener("click", async () => {
  const b = $("#r-payer"), note = $("#r-note");
  const libelle = b.textContent;
  b.disabled = true; note.style.color = "";
  b.textContent = tx("enregistrement");
  note.textContent = tx("verification");
  try {
    const r = await fetch("/api/acompte", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        arrivee: etat.arrivee, depart: etat.depart,
        voyageurs: +$("#r-voyageurs").value, langue: LG
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || tx("indisponible"));

    // En mode réel, d.url mène à la page de paiement hébergée par Stripe.
    // En démonstration, elle mène directement à la confirmation : le prix a
    // déjà été recalculé côté serveur et la disponibilité revérifiée.
    if (d.mode === "demonstration") {
      note.textContent = tx("demo_paiement");
      // Une courte pause : sans elle le passage est si brusque qu'on ne voit
      // pas qu'une vérification a eu lieu.
      await new Promise(res => setTimeout(res, 600));
    }
    location.href = d.url;
  } catch (e) {
    note.style.color = "#9C3A28";
    note.textContent = e.message;
    b.disabled = false;
    b.textContent = libelle;
  }
});

/* ---- démarrage ------------------------------------------------------------ */
const n = new Date();
etat.mois = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
if (new URLSearchParams(location.search).get("annule")) {
  $("#r-note").textContent = tx("paiement_annule");
}
charger();
