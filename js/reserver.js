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
import { calculer } from "./tarifs.mjs";

const $ = s => document.querySelector(s);
const jour = d => d.toISOString().slice(0, 10);
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août",
              "septembre","octobre","novembre","décembre"];
const JOURS = ["L","M","M","J","V","S","D"];
const euro = n => n.toLocaleString("fr-FR", { style:"currency", currency:"EUR",
                                              maximumFractionDigits: 2 });
const enLettres = s => {
  const d = new Date(s + "T00:00:00Z");
  return d.getUTCDate() + " " + MOIS[d.getUTCMonth()].slice(0,4) + ". " + d.getUTCFullYear();
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
    const r = await fetch("/api/disponibilites", { headers: { accept: "application/json" } });
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
    $("#cal-source").textContent =
      "Les disponibilités n'ont pas pu être chargées. Écrivez-nous pour vérifier les dates.";
    $("#cal-source").style.color = "#9C3A28";
  } finally {
    cal.setAttribute("aria-busy", "false");
    rendre();
  }
}

function majSource(d) {
  const e = $("#cal-source");
  if (d.mode === "reel") {
    const q = d.majLe ? new Date(d.majLe).toLocaleString("fr-FR",
                        { dateStyle:"short", timeStyle:"short" }) : "";
    e.textContent = `Synchronisé avec ${etat.source} — dernière mise à jour ${q}.`;
  } else if (d.mode === "demonstration") {
    e.textContent = "Démonstration : disponibilités simulées. Une fois les adresses iCal "
                  + "d'Airbnb et de Booking renseignées, ce calendrier devient le vrai.";
  }
}

/* ---- règles de sélection -------------------------------------------------- */
const estPrise = s => etat.prises.has(s);

/** Une date d'arrivée est possible si la nuit n'est pas déjà prise. */
function arriveePossible(s) {
  return !estPrise(s) && s >= jour(new Date());
}

/** Un départ est possible s'il suit l'arrivée et qu'aucune nuit entre les
    deux n'est prise : on ne doit pas pouvoir enjamber une réservation. */
function departPossible(s) {
  if (!etat.arrivee || s <= etat.arrivee) return false;
  for (let c = new Date(etat.arrivee + "T00:00:00Z"); jour(c) < s; c.setUTCDate(c.getUTCDate() + 1))
    if (estPrise(jour(c))) return false;
  return true;
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
           + ` aria-label="${n} ${MOIS[mo]} ${an}${pris ? ", réservé" : ""}">${n}</button></td>`;
    if ((decalage + n) % 7 === 0) cases += "</tr><tr>";
  }

  return `<div class="mois"><h3>${MOIS[mo]} ${an}</h3><table>`
       + `<thead><tr>${JOURS.map(j => `<th scope="col"><abbr title="${j}">${j}</abbr></th>`).join("")}</tr></thead>`
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
      + (etat.arrivee ? "Choisissez maintenant la date de départ."
                      : "Choisissez vos dates dans le calendrier.") + "</p>";
    payer.disabled = true;
    return;
  }

  const p = calculer(etat.arrivee, etat.depart, +$("#r-voyageurs").value);
  if (p.erreur) {
    zone.innerHTML = `<p class="recap__erreur">${p.erreur}</p>`;
    payer.disabled = true;
    return;
  }

  // Le détail par saison n'a d'intérêt que si le séjour est à cheval sur
  // plusieurs : sinon on répète « 7 nuits · 7 nuits en basse saison ».
  const parts = Object.entries(p.detailSaisons);
  const libelle = parts.length > 1
    ? `${p.nuits} nuits · ` + parts.map(([n, v]) => `${v} en ${n.toLowerCase()}`).join(", ")
    : `${p.nuits} nuits en ${parts[0][0].toLowerCase()}`;
  zone.innerHTML =
      `<div class="ligne"><span>${libelle}</span><span>${euro(p.sejour)}</span></div>`
    + `<div class="ligne"><span>Ménage de fin de séjour</span><span>${euro(p.menage)}</span></div>`
    + `<div class="ligne"><span>Taxe de séjour · ${p.voyageurs} pers.</span><span>${euro(p.taxe)}</span></div>`
    + `<div class="ligne ligne--total"><span>Total du séjour</span><span>${euro(p.total)}</span></div>`
    + `<div class="ligne ligne--acompte"><span>Acompte à régler (30 %)</span><span>${euro(p.acompte)}</span></div>`
    + `<div class="ligne"><span>Solde à 30 jours de l'arrivée</span><span>${euro(p.solde)}</span></div>`;
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
  b.disabled = true; note.style.color = ""; note.textContent = "Ouverture du paiement…";
  try {
    const r = await fetch("/api/acompte", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        arrivee: etat.arrivee, depart: etat.depart,
        voyageurs: +$("#r-voyageurs").value
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || "Paiement indisponible.");
    if (d.mode === "demonstration") {
      // Le calcul, la vérification de disponibilité et l'appel serveur sont
      // ceux de la production. Seule manque la clé qui ouvre la page Stripe.
      note.textContent = "Maquette : aucune clé Stripe n'est configurée. "
                       + "Renseignez STRIPE_SECRET_KEY (clé sk_test_…) pour "
                       + "ouvrir le vrai paiement en bac à sable.";
    }
    location.href = d.url;
  } catch (e) {
    note.style.color = "#9C3A28";
    note.textContent = e.message;
    b.disabled = false;
  }
});

/* ---- démarrage ------------------------------------------------------------ */
const n = new Date();
etat.mois = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
if (new URLSearchParams(location.search).get("annule")) {
  $("#r-note").textContent = "Paiement annulé — aucun montant n'a été débité.";
}
charger();
