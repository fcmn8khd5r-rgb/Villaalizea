/* =========================================================================
   Villa Alizéa — récapitulatif après réservation
   Deux chemins : une vraie session Stripe (?session=cs_…), dont on demande
   le détail au serveur, ou le parcours de démonstration (?demo=1).
   ========================================================================= */
(function () {
  "use strict";

/* ---- langue -------------------------------------------------------------
   La page dit dans quelle langue elle est ; les textes viennent de
   js/textes.js, engendré par construire.py. `tx` remplace {0}, {1}… par les
   valeurs passées, et retombe sur la clé si un texte manque — mieux vaut un
   mot brut qu'un trou. */
var LG = document.documentElement.lang === "en" ? "en" : "fr";
var TX = (window.ALIZEA_TEXTES || {})[LG] || {};
function tx(cle) {
  var s = TX[cle];
  if (s === undefined) return cle;
  for (var i = 1; i < arguments.length; i++)
    s = s.split("{" + (i - 1) + "}").join(arguments[i]);
  return s;
}

  var zone = document.getElementById("resume");
  if (!zone) return;

  var p = new URLSearchParams(location.search);
  var euro = function (n) {
    var v = Number(n);
    return isFinite(v)
      ? v.toLocaleString(tx("locale"), { style: "currency", currency: "EUR" }) : "—";
  };
  var enLettres = function (s) {
    if (!s) return "—";
    return new Date(s + "T00:00:00Z").toLocaleDateString(tx("locale"),
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  };
  var ligne = function (lib, val, classe) {
    return '<div class="ligne' + (classe ? " " + classe : "") + '"><span>' + lib +
           "</span><span>" + val + "</span></div>";
  };

  // En démonstration, rien n'a été encaissé : les libellés ne doivent pas
  // affirmer le contraire, même si la mention le précise juste au-dessus.
  var simule = !!p.get("demo");

  function afficher(d) {
    var html =
      ligne(tx("arrivee"), "<strong>" + enLettres(d.arrivee) + "</strong>") +
      ligne(tx("depart"), "<strong>" + enLettres(d.depart) + "</strong>") +
      (d.nuits ? ligne(tx("duree"), tx("nuits", d.nuits)) : "") +
      ligne(LG === "en" ? "Guests" : "Voyageurs", d.voyageurs || "—");
    if (d.total) html += ligne(tx("total"), euro(d.total), "ligne--total");
    html += ligne(simule ? tx("acompte_regler") : tx("acompte_regle"),
                  euro(d.acompte), "ligne--acompte");
    if (d.solde) html += ligne(tx("solde"), euro(d.solde));
    if (d.reference) html += ligne(tx("reference"), "<strong>" + d.reference + "</strong>");
    zone.innerHTML = html;
  }

  /* ---- parcours de démonstration ---------------------------------------- */
  if (p.get("demo")) {
    afficher({
      arrivee: p.get("arrivee"), depart: p.get("depart"), nuits: p.get("nuits"),
      voyageurs: p.get("voyageurs"), acompte: p.get("acompte"),
      total: p.get("total"), solde: p.get("solde")
    });
    var m = document.getElementById("mention-demo");
    if (m) m.hidden = false;
    // Le prospect doit voir la page telle qu'un client la verrait : on ne
    // récrit pas le titre, la mention discrète fait le travail. Seul le
    // sur-titre est neutralisé, car il affirmait un encaissement.
    var oe = document.getElementById("confirmation-oeil");
    if (oe) oe.textContent = tx("resa_enregistree");
    var c = document.getElementById("confirmation-courriel");
    if (c) {
      c.textContent = (LG === "en"
        ? "On a live site, a confirmation email would go out from "
        : "Sur un site en service, un courriel de confirmation partirait ") + tx("resa_suite");
    }
    return;
  }

  /* ---- vraie session Stripe --------------------------------------------- */
  var s = p.get("session");
  if (!s) {
    zone.innerHTML = '<p class="recap__vide">' +
      (LG === "en" ? "No booking to show." : "Aucune réservation à afficher.") + '</p>';
    return;
  }

  fetch("/api/acompte?langue=" + LG + "&session=" + encodeURIComponent(s))
    .then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.message); return j; });
    })
    .then(afficher)
    .catch(function (e) {
      zone.innerHTML = '<p class="recap__erreur">' +
        (e.message || tx("recap_erreur")) + tx("recap_paiement") + "</p>";
    });
})();
