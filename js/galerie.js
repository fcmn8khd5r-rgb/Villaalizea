/* =========================================================================
   Villa Alizéa — galerie : filtres et visionneuse
   Navigation au clavier (flèches, Début, Fin, Échap) et au doigt (glissement
   horizontal pour changer, vertical pour fermer). Sans JavaScript, chaque
   vignette reste un lien vers la photo en grand : la galerie fonctionne.
   ========================================================================= */
(function () {
  "use strict";
  var grille = document.getElementById("galerie");
  var visio  = document.getElementById("visio");
  if (!grille) return;

  /* ---- filtres ---------------------------------------------------------- */
  var figures = Array.prototype.slice.call(grille.querySelectorAll("figure"));
  var onglets = Array.prototype.slice.call(document.querySelectorAll(".onglet"));
  var etat    = document.getElementById("galerie-etat");

  function filtrer(groupe) {
    var n = 0;
    figures.forEach(function (f) {
      var ok = groupe === "tout" || f.getAttribute("data-groupe") === groupe ||
               (groupe === "sejour" && f.getAttribute("data-groupe") === "cuisine");
      f.hidden = !ok;
      if (ok) n++;
    });
    onglets.forEach(function (b) {
      b.classList.toggle("est-actif", b.getAttribute("data-filtre") === groupe);
    });
    if (etat) etat.textContent = n + (n > 1 ? " photos affichées" : " photo affichée");
    construire();
  }
  onglets.forEach(function (b) {
    b.addEventListener("click", function () { filtrer(b.getAttribute("data-filtre")); });
  });

  /* ---- visionneuse ------------------------------------------------------ */
  if (!visio) return;
  var scene   = document.getElementById("visio-scene");
  var legende = document.getElementById("visio-legende");
  var compte  = document.getElementById("visio-compte");
  var credit  = document.getElementById("visio-credit");
  var vues = [], index = 0, rendeur = null;

  function construire() {
    // La visionneuse ne parcourt que ce qui est affiché : filtrer la grille
    // filtre aussi la navigation, sinon la flèche mènerait à une photo cachée.
    vues = figures.filter(function (f) { return !f.hidden; }).map(function (f) {
      var a = f.querySelector("a[data-cle]"), img = f.querySelector("img");
      return {
        lien: a,
        cle: a.getAttribute("data-cle"),
        avif: "assets/img/" + a.getAttribute("data-cle") + "-g.avif",
        webp: a.getAttribute("href"),
        alt: img ? img.alt : "",
        legende: (f.querySelector("figcaption") || {}).textContent || "",
        fond: img ? img.style.background : ""
      };
    });
  }
  construire();

  function precharger(i) {
    [i - 1, i + 1].forEach(function (k) {
      if (k < 0 || k >= vues.length) return;
      var e = new Image(); e.decoding = "async"; e.src = vues[k].avif;
    });
  }

  function afficher(i) {
    if (!vues.length) return;
    index = (i + vues.length) % vues.length;
    var v = vues[index];
    scene.innerHTML =
      '<picture>' +
        '<source type="image/avif" srcset="' + v.avif + '">' +
        '<img src="' + v.webp + '" alt="' + v.alt.replace(/"/g, "&quot;") + '"' +
             ' style="background:' + v.fond + '">' +
      "</picture>";
    legende.textContent = v.legende;
    compte.textContent  = (index + 1) + " / " + vues.length;
    credit.textContent  = (window.ALIZEA_CREDITS && window.ALIZEA_CREDITS[v.cle]) || "";
    precharger(index);
  }

  function ouvrir(i, source) {
    rendeur = source || null;
    visio.hidden = false;
    afficher(i);
    document.body.classList.add("bloque");
    // Le focus doit venir APRES data-ouvert : tant que l'attribut n'est pas
    // posé, la feuille de style laisse la visionneuse en visibility:hidden,
    // et un navigateur refuse de donner le focus à un élément invisible. La
    // demande partait donc dans le vide, le focus restait sur la vignette
    // cliquée, et la tabulation continuait derrière la boîte de dialogue.
    // DEUX trames, et c'est nécessaire. La feuille de style garde la
    // visionneuse en `visibility:hidden` tant que `data-ouvert` n'est pas
    // posé, et la transition ne bascule la visibilité qu'à la trame SUIVANTE.
    // Un navigateur refusant le focus sur un élément invisible, la demande
    // partait dans le vide : le focus restait sur la vignette cliquée et la
    // tabulation continuait derrière la boîte de dialogue. Vérifié en traçant
    // la valeur calculée de `visibility` trame par trame.
    requestAnimationFrame(function () {
      visio.setAttribute("data-ouvert", "");
      requestAnimationFrame(function () { visio.querySelector(".visio__x").focus(); });
    });
  }

  function fermer() {
    visio.removeAttribute("data-ouvert");
    document.body.classList.remove("bloque");
    setTimeout(function () { visio.hidden = true; scene.innerHTML = ""; }, 320);
    if (rendeur) rendeur.focus();
  }

  grille.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-cle]");
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // ouvrir dans un onglet
    e.preventDefault();
    var i = vues.findIndex(function (v) { return v.lien === a; });
    if (i >= 0) ouvrir(i, a);
  });

  visio.querySelector(".visio__x").addEventListener("click", fermer);
  visio.querySelector(".visio__fl--p").addEventListener("click", function () { afficher(index - 1); });
  visio.querySelector(".visio__fl--s").addEventListener("click", function () { afficher(index + 1); });
  visio.addEventListener("click", function (e) {
    if (e.target === visio || e.target.classList.contains("visio__scene")) fermer();
  });

  document.addEventListener("keydown", function (e) {
    if (visio.hidden) return;
    var t = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in t) { e.preventDefault(); afficher(index + t[e.key]); }
    else if (e.key === "Escape") { e.preventDefault(); fermer(); }
    else if (e.key === "Home")   { e.preventDefault(); afficher(0); }
    else if (e.key === "End")    { e.preventDefault(); afficher(vues.length - 1); }
    else if (e.key === "Tab")    { piegerTabulation(e); }
  });

  function piegerTabulation(e) {
    var f = visio.querySelectorAll("button");
    var premier = f[0], dernier = f[f.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  /* ---- doigt ------------------------------------------------------------
     Glissement horizontal pour changer de photo, vertical pour fermer. On ne
     préempte le geste qu'une fois la direction établie, pour ne pas bloquer
     le défilement de la page par erreur. */
  var x0 = 0, y0 = 0, sens = null;
  scene.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { sens = "ignore"; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; sens = null;
  }, { passive: true });

  scene.addEventListener("touchmove", function (e) {
    if (sens === "ignore" || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (sens === null && Math.abs(dx) + Math.abs(dy) > 12) {
      sens = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (sens === "h") {
      var img = scene.querySelector("img");
      if (img) {
        img.style.transform = "translateX(" + dx * 0.35 + "px)";
        img.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 500));
      }
    }
  }, { passive: true });

  scene.addEventListener("touchend", function (e) {
    if (sens === "ignore") { sens = null; return; }
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    var img = scene.querySelector("img");
    if (img) { img.style.transform = ""; img.style.opacity = ""; }
    if (sens === "h" && Math.abs(dx) > 55) afficher(index + (dx < 0 ? 1 : -1));
    else if (sens === "v" && dy > 90) fermer();
    sens = null;
  }, { passive: true });
})();
