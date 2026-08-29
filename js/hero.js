/* =========================================================================
   Villa Alizéa — la caméra pilotée au défilement
   =========================================================================
   Le hero n'est pas une vidéo : c'est une séquence d'images. Une vidéo
   scrubbée bloque sur Safari mobile, qui ne sait chercher que les images
   clés ; tout encoder en images clés triplerait le poids.

   Le principe : une longue zone de défilement, un cadre collant, et une
   progression 0 → 1 qui choisit l'image. Entre deux images voisines, un
   fondu — c'est lui qui donne le continu avec seulement 16 vues sur mobile.

   Trois replis, dans cet ordre :
     1. pas de JavaScript      → l'image d'affiche reste, en plein écran ;
     2. moins d'animations,
        économiseur de données,
        connexion 2G/3G        → aucun octet de séquence n'est chargé ;
     3. échec de chargement    → on garde ce qui est arrivé, sans casser.
   ========================================================================= */
(function () {
  "use strict";

  var hero    = document.getElementById("hero");
  var course  = document.getElementById("course");
  var pile    = document.getElementById("pile");
  var curseur = document.getElementById("curseur");
  var jauge   = document.getElementById("jauge");
  if (!hero || !course || !pile) return;

  /* ---- décider si l'on charge la séquence ------------------------------ */
  var co = navigator.connection || {};
  var lent = co.saveData === true ||
             /^(slow-)?2g$/.test(co.effectiveType || "") ||
             co.effectiveType === "3g";
  var sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function figer(raison) {
    hero.classList.add("hero--fixe");
    hero.setAttribute("data-repli", raison);
    if (jauge) jauge.style.display = "none";
  }
  if (lent || sobre) { figer(sobre ? "animations-reduites" : "connexion-lente"); return; }

  /* ---- profil : large 16/9 ou portrait 3/4 -----------------------------
     Le choix se fait sur l'ORIENTATION, pas sur la largeur : une fenêtre
     étroite mais paysage doit recevoir le cadrage large, sinon l'image 3/4
     est rognée en haut et en bas et la maison sort du cadre. En dessous de
     700 px on garde le portrait de toute façon — c'est un téléphone, et la
     séquence y est trois fois plus légère. */
  var mqPortrait = window.matchMedia("(orientation: portrait), (max-width: 699px)");
  var portrait = mqPortrait.matches;
  var PROFIL = portrait ? { p: "p", n: 16, w: 640,  h: 854, course: "260vh" }
                        : { p: "l", n: 32, w: 1200, h: 675, course: "340vh" };
  course.style.setProperty("--course", PROFIL.course);

  function url(i) {
    return "assets/hero/" + PROFIL.p + String(i).padStart(3, "0") + ".avif";
  }

  /* ---- le canvas ------------------------------------------------------- */
  var cnv = document.createElement("canvas");
  cnv.className = "hero__toile";
  pile.appendChild(cnv);
  var ctx = cnv.getContext("2d", { alpha: false });

  function dimensionner() {
    var r = Math.min(window.devicePixelRatio || 1, 2);
    var l = pile.clientWidth, h = pile.clientHeight;
    if (!l || !h) return;
    cnv.width = Math.round(l * r); cnv.height = Math.round(h * r);
    cnv.style.width = l + "px";    cnv.style.height = h + "px";
    dessiner(progression(), true);
  }

  /* ---- chargement par vagues -------------------------------------------
     Vague 1 : une image sur quatre — le pilotage répond tout de suite.
     Vagues suivantes : on comble les trous, en arrière-plan.             */
  var img = new Array(PROFIL.n), pret = new Array(PROFIL.n).fill(false), arrivees = 0;

  function charger(i) {
    return new Promise(function (ok) {
      if (img[i]) return ok();
      var e = new Image();
      e.decoding = "async";
      e.onload = function () {
        img[i] = e; pret[i] = true; arrivees++;
        if (jauge) jauge.style.width = (arrivees / PROFIL.n * 100) + "%";
        if (arrivees === 1) { dimensionner(); }
        ok();
      };
      e.onerror = function () { ok(); };   // une image manquante ne casse rien
      e.src = url(i);
    });
  }

  function vagues() {
    var pas = [4, 2, 1], chaine = Promise.resolve();
    pas.forEach(function (p) {
      chaine = chaine.then(function () {
        var lot = [];
        for (var i = 0; i < PROFIL.n; i += p) if (!img[i]) lot.push(i);
        return Promise.all(lot.map(charger));
      });
    });
    chaine.then(function () {
      if (arrivees === 0) { figer("chargement-impossible"); return; }
      if (jauge) { jauge.style.opacity = "0"; }
    });
  }

  /* ---- rendu ------------------------------------------------------------ */
  function proche(i) {                       // image chargée la plus proche
    if (pret[i]) return i;
    for (var d = 1; d < PROFIL.n; d++) {
      if (pret[i - d]) return i - d;
      if (pret[i + d]) return i + d;
    }
    return -1;
  }

  function couvrir(e) {                      // équivalent de object-fit: cover
    var rc = cnv.width / cnv.height, ri = e.naturalWidth / e.naturalHeight, w, h;
    if (ri > rc) { h = cnv.height; w = h * ri; } else { w = cnv.width; h = w / ri; }
    return [(cnv.width - w) / 2, (cnv.height - h) / 2, w, h];
  }

  function poser(e, alpha) {
    if (!e) return;
    var c = couvrir(e);
    ctx.globalAlpha = alpha;
    ctx.drawImage(e, c[0], c[1], c[2], c[3]);
    ctx.globalAlpha = 1;
  }

  function progression() {
    var r = course.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -r.top / total));
  }

  var dernier = -1, dernierFrac = -1;
  function dessiner(p, force) {
    var exact = p * (PROFIL.n - 1);
    var i = Math.floor(exact), frac = exact - i;
    if (i >= PROFIL.n - 1) { i = PROFIL.n - 1; frac = 0; }
    if (!force && i === dernier && Math.abs(frac - dernierFrac) < 0.02) return;
    dernier = i; dernierFrac = frac;

    var a = proche(i);
    if (a < 0) return;
    poser(img[a], 1);
    if (frac > 0.01) {                       // fondu vers l'image suivante
      var b = proche(i + 1);
      if (b >= 0 && b !== a) poser(img[b], frac);
    }
    if (curseur) curseur.style.transform = "translateY(" + (p * 79) + "px)";
  }

  /* ---- boucle ----------------------------------------------------------- */
  var tourne = false;
  function surDefilement() {
    if (tourne) return;
    tourne = true;
    requestAnimationFrame(function () { dessiner(progression()); tourne = false; });
  }

  // On ne calcule que lorsque le hero est à l'écran.
  var actif = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { actif = es[0].isIntersecting; }, { threshold: 0 })
      .observe(course);
  }
  window.addEventListener("scroll", function () { if (actif) surDefilement(); }, { passive: true });
  window.addEventListener("resize", dimensionner);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", dimensionner);

  // Si l'orientation change au point de changer de profil, on recharge la
  // page plutôt que de mélanger deux cadrages.
  // Une rotation de l'appareil change le cadrage attendu : on recharge plutôt
  // que de mélanger deux séquences aux proportions différentes.
  mqPortrait.addEventListener("change", function (e) {
    if ((e.matches ? "p" : "l") !== PROFIL.p) location.reload();
  });

  dimensionner();
  vagues();
})();
