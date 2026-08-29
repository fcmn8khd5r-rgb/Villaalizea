/* Villa Alizéa — récapitulatif après paiement.
   Deux chemins : une vraie session Stripe (?session=cs_…), dont on demande
   le détail au serveur, ou le parcours simulé de la maquette (?demo=1). */
(function () {
  "use strict";
  var zone = document.getElementById("resume");
  if (!zone) return;
  var p = new URLSearchParams(location.search);
  var euro = function (n) {
    return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  };
  var enLettres = function (s) {
    if (!s) return "—";
    return new Date(s + "T00:00:00Z").toLocaleDateString("fr-FR",
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  };
  function afficher(d, note) {
    zone.innerHTML =
      '<div class="ligne"><span>Arrivée</span><strong>' + enLettres(d.arrivee) + "</strong></div>" +
      '<div class="ligne"><span>Départ</span><strong>' + enLettres(d.depart) + "</strong></div>" +
      '<div class="ligne"><span>Voyageurs</span><strong>' + (d.voyageurs || "—") + "</strong></div>" +
      (d.total ? '<div class="ligne ligne--total"><span>Total du séjour</span><span>' +
                 euro(d.total) + "</span></div>" : "") +
      '<div class="ligne ligne--acompte"><span>Acompte réglé</span><span>' +
        euro(d.acompte) + "</span></div>" +
      (d.solde ? '<div class="ligne"><span>Solde à 30 jours de l\'arrivée</span><span>' +
                 euro(d.solde) + "</span></div>" : "") +
      (d.reference ? '<div class="ligne"><span>Référence</span><strong>' +
                     d.reference + "</strong></div>" : "") +
      (note ? '<p class="recap__vide" style="margin-top:1rem">' + note + "</p>" : "");
  }

  if (p.get("demo")) {
    afficher({
      arrivee: p.get("arrivee"), depart: p.get("depart"),
      voyageurs: p.get("voyageurs"), acompte: p.get("acompte")
    }, "Maquette : aucun paiement n'a réellement eu lieu. Avec une clé Stripe "
      + "configurée, cette page affiche le détail de la session réglée.");
    return;
  }

  var s = p.get("session");
  if (!s) { zone.innerHTML = '<p class="recap__vide">Aucune réservation à afficher.</p>'; return; }

  fetch("/api/acompte?session=" + encodeURIComponent(s))
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message); return j; }); })
    .then(function (d) { afficher(d); })
    .catch(function (e) {
      zone.innerHTML = '<p class="recap__erreur">' +
        (e.message || "Le récapitulatif n'a pas pu être chargé.") +
        " Votre paiement a bien été pris en compte — vous recevrez la confirmation par courriel.</p>";
    });
})();
