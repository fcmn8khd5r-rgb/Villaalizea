/* =========================================================================
   Villa Alizéa — récapitulatif après réservation
   Deux chemins : une vraie session Stripe (?session=cs_…), dont on demande
   le détail au serveur, ou le parcours de démonstration (?demo=1).
   ========================================================================= */
(function () {
  "use strict";
  var zone = document.getElementById("resume");
  if (!zone) return;

  var p = new URLSearchParams(location.search);
  var euro = function (n) {
    var v = Number(n);
    return isFinite(v) ? v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—";
  };
  var enLettres = function (s) {
    if (!s) return "—";
    return new Date(s + "T00:00:00Z").toLocaleDateString("fr-FR",
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
      ligne("Arrivée", "<strong>" + enLettres(d.arrivee) + "</strong>") +
      ligne("Départ", "<strong>" + enLettres(d.depart) + "</strong>") +
      (d.nuits ? ligne("Durée", d.nuits + " nuits") : "") +
      ligne("Voyageurs", d.voyageurs || "—");
    if (d.total) html += ligne("Total du séjour", euro(d.total), "ligne--total");
    html += ligne(simule ? "Acompte à régler" : "Acompte réglé",
                  euro(d.acompte), "ligne--acompte");
    if (d.solde) html += ligne("Solde à 30 jours de l'arrivée", euro(d.solde));
    if (d.reference) html += ligne("Référence", "<strong>" + d.reference + "</strong>");
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
    if (oe) oe.textContent = "Réservation enregistrée";
    var c = document.getElementById("confirmation-courriel");
    if (c) {
      c.textContent = "Sur un site en service, un courriel de confirmation partirait " +
                      "ici, et les propriétaires reprendraient contact avant l'arrivée.";
    }
    return;
  }

  /* ---- vraie session Stripe --------------------------------------------- */
  var s = p.get("session");
  if (!s) { zone.innerHTML = '<p class="recap__vide">Aucune réservation à afficher.</p>'; return; }

  fetch("/api/acompte?session=" + encodeURIComponent(s))
    .then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.message); return j; });
    })
    .then(afficher)
    .catch(function (e) {
      zone.innerHTML = '<p class="recap__erreur">' +
        (e.message || "Le récapitulatif n'a pas pu être chargé.") +
        " Votre paiement a bien été pris en compte — vous recevrez la confirmation par courriel.</p>";
    });
})();
