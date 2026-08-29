/* =========================================================================
   Villa Alizéa — avis Google
   Le navigateur n'appelle jamais Google directement : la clé d'API resterait
   visible dans le code de la page. Il interroge /api/avis, qui la détient.
   Si la fonction ne répond pas, la section garde son contenu de secours
   plutôt que d'afficher un trou.
   ========================================================================= */
(function () {
  "use strict";
  var liste = document.getElementById("avis-liste");
  var zone  = document.getElementById("avis-zone");
  if (!liste || !zone) return;

  function echapper(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function etoiles(n) {
    var pleines = Math.round(n || 0);
    return '<span class="etoiles" aria-hidden="true">' +
           "★★★★★".slice(0, pleines) + "☆☆☆☆☆".slice(0, 5 - pleines) +
           '</span><span class="vh">' + n + " sur 5</span>";
  }

  function initiales(nom) {
    return String(nom).trim().split(/\s+/).slice(0, 2)
      .map(function (m) { return m[0]; }).join("").toUpperCase();
  }

  fetch("/api/avis", { headers: { accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      if (!d.avis || !d.avis.length) return;

      zone.querySelector(".note").textContent =
        (d.note != null ? String(d.note).replace(".", ",") : "—");
      var tete = zone.querySelector(".avis-tete span:nth-child(2)");
      if (tete) {
        tete.innerHTML = etoiles(d.note) +
          '<br><small style="color:var(--encre-doux)">sur ' + (d.total || 0) + " avis Google</small>";
      }

      liste.innerHTML = d.avis.map(function (a) {
        return '<article class="avis">' +
          '<div class="avis__tete">' +
            '<span class="avis__rond" aria-hidden="true">' + echapper(initiales(a.auteur)) + "</span>" +
            "<span><span class=\"avis__nom\">" + echapper(a.auteur) + "</span><br>" +
            '<span class="avis__date">' + echapper(a.quand) + "</span></span>" +
          "</div>" +
          etoiles(a.note) +
          "<p style=\"margin-top:.6rem\">" + echapper(a.texte) + "</p>" +
        "</article>";
      }).join("");

      var source = zone.querySelector(".avis-source");
      if (!source) return;
      if (d.mode === "demonstration") {
        source.textContent = "Démonstration : avis d'exemple. Une fois la fiche Google "
                           + "de l'établissement reliée, ce sont les vrais avis qui s'affichent.";
      } else if (d.mode === "repli") {
        source.textContent = "Les avis Google n'ont pas pu être rafraîchis — affichage de la "
                           + "dernière version connue.";
      } else if (d.lien) {
        source.innerHTML = 'Avis publiés sur la <a href="' + echapper(d.lien) +
                           '" rel="noopener">fiche Google de l\'établissement</a>.';
      }
    })
    .catch(function () {
      var source = zone.querySelector(".avis-source");
      if (source) source.textContent = "Les avis n'ont pas pu être chargés.";
    });
})();
