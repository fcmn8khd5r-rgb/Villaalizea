/* =========================================================================
   Villa Alizéa — visionneuse
   Navigation au clavier (flèches, Début, Fin, Échap) et au doigt (glissement
   horizontal). Sans JavaScript, chaque vignette reste un lien vers la photo
   en grand : la galerie fonctionne quand même.
   ========================================================================= */
(function () {
  "use strict";
  var grille = document.getElementById("galerie");
  var visio  = document.getElementById("visio");
  if (!grille || !visio) return;

  var liens   = Array.prototype.slice.call(grille.querySelectorAll("a[data-cle]"));
  if (!liens.length) return;
  var scene   = document.getElementById("visio-scene");
  var legende = document.getElementById("visio-legende");
  var compte  = document.getElementById("visio-compte");
  var credit  = document.getElementById("visio-credit");
  var index = 0, rendeur = null;

  var vues = liens.map(function (a) {
    var img = a.querySelector("img");
    return {
      cle: a.getAttribute("data-cle"),
      avif: "assets/img/" + a.getAttribute("data-cle") + "-g.avif",
      webp: a.getAttribute("href"),
      alt: img ? img.alt : "",
      legende: (a.querySelector("figcaption") || {}).textContent || "",
      fond: img ? img.style.background : ""
    };
  });

  /* Précharge discrètement les voisines : le passage d'une photo à l'autre
     doit être instantané, mais on ne télécharge pas les 27 d'un coup. */
  function precharger(i) {
    [i - 1, i + 1].forEach(function (k) {
      if (k < 0 || k >= vues.length) return;
      var e = new Image(); e.decoding = "async"; e.src = vues[k].avif;
    });
  }

  function afficher(i, immediat) {
    index = (i + vues.length) % vues.length;
    var v = vues[index];
    scene.innerHTML =
      '<picture>' +
        '<source type="image/avif" srcset="' + v.avif + '">' +
        '<img src="' + v.webp + '" alt="' + v.alt.replace(/"/g, "&quot;") + '"' +
             ' style="background:' + v.fond + '">' +
      '</picture>';
    legende.textContent = v.legende;
    compte.textContent  = (index + 1) + " / " + vues.length;
    credit.textContent  = (window.ALIZEA_CREDITS && window.ALIZEA_CREDITS[v.cle]) || "";
    if (!immediat) precharger(index);
  }

  function ouvrir(i, source) {
    rendeur = source || null;
    visio.hidden = false;
    afficher(i);
    requestAnimationFrame(function () { visio.setAttribute("data-ouvert", ""); });
    document.body.classList.add("est-bloque");
    visio.querySelector(".visio__x").focus();
  }

  function fermer() {
    visio.removeAttribute("data-ouvert");
    document.body.classList.remove("est-bloque");
    setTimeout(function () { visio.hidden = true; scene.innerHTML = ""; }, 300);
    if (rendeur) rendeur.focus();
  }

  liens.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;  // clic « ouvrir dans un onglet »
      e.preventDefault();
      ouvrir(i, a);
    });
  });

  visio.querySelector(".visio__x").addEventListener("click", fermer);
  visio.querySelector(".visio__fl--p").addEventListener("click", function () { afficher(index - 1); });
  visio.querySelector(".visio__fl--s").addEventListener("click", function () { afficher(index + 1); });
  visio.addEventListener("click", function (e) {
    if (e.target === visio || e.target.classList.contains("visio__scene")) fermer();
  });

  /* ---- clavier ---------------------------------------------------------- */
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
     Glissement horizontal pour changer de photo, vertical pour fermer.
     On ne préempte le geste qu'une fois la direction établie, pour ne pas
     bloquer le défilement de la page par erreur.                          */
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
      if (img) { img.style.transform = "translateX(" + dx * 0.35 + "px)"; img.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 500)); }
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
