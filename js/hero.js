/* =========================================================================
   Villa Alizéa — la caméra pilotée au défilement
   =========================================================================
   Le hero n'est pas une vidéo : c'est une séquence d'images. Une vidéo
   « scrubbée » bloque sur Safari mobile, qui ne sait chercher que les
   images clés ; tout encoder en images clés triplerait le poids.

   FLUIDITÉ — ce qui a été corrigé
   La première version répartissait 32 images sur les 13 s du plan, soit
   2,4 images par seconde : l'écart entre deux images voisines valait environ
   cinq fois l'écart natif de la vidéo, et l'œil voyait la succession.
   On garde désormais un segment COURT échantillonné dense — 3,5 s à
   20 images/s, 70 images — ce qui ramène cet écart à ×1,37 le natif.
   Un fondu entre images voisines achève de lisser.

   LIAISON — entrée et sortie
   Une caméra ne démarre pas d'un coup. La course reçoit un profil de
   vitesse trapézoïdal : accélération, plateau, décélération. Aux deux
   extrémités la vitesse est NULLE, si bien qu'on ne perçoit ni le départ
   ni l'arrêt. Le titre se retire pendant la mise en route, l'image se
   rapproche légèrement, et le hero se dissout dans la page à la sortie.

   REPLIS, dans cet ordre
     1. pas de JavaScript      → l'image d'affiche reste, en plein écran ;
     2. animations réduites,
        économiseur de données,
        connexion 2G/3G        → aucun octet de séquence n'est chargé ;
     3. échec de chargement    → on garde ce qui est arrivé, sans casser.
   ========================================================================= */
(function () {
  "use strict";

  var hero    = document.getElementById("hero");
  var course  = document.getElementById("course");
  var pile    = document.getElementById("pile");
  var texte   = document.getElementById("hero-texte");
  var voile   = document.getElementById("hero-voile");
  var sortie  = document.getElementById("hero-sortie");
  var curseur = document.getElementById("curseur");
  var jauge   = document.getElementById("jauge");
  var affiche = document.getElementById("hero-affiche");
  if (!hero || !course || !pile) return;

  /* ---- faut-il charger la séquence ? ----------------------------------- */
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
     est rognée en haut et en bas et la maison sort du cadre. */
  var mqPortrait = window.matchMedia("(orientation: portrait), (max-width: 699px)");
  var portrait = mqPortrait.matches;
  var PROFIL = portrait ? { p: "p", n: 70, course: "300vh" }
                        : { p: "l", n: 70, course: "340vh" };
  course.style.setProperty("--course", PROFIL.course);

  var url = function (i) {
    return "assets/hero/" + PROFIL.p + String(i).padStart(3, "0") + ".avif";
  };

  /* ---- le canvas -------------------------------------------------------- */
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
    peindre(progression(), true);
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
        if (arrivees === 1) { dimensionner(); hero.classList.add("hero--prete"); }
        ok();
      };
      e.onerror = function () { ok(); };   // une image manquante ne casse rien
      e.src = url(i);
    });
  }

  function vagues() {
    var chaine = Promise.resolve();
    [4, 2, 1].forEach(function (pas) {
      chaine = chaine.then(function () {
        var lot = [];
        for (var i = 0; i < PROFIL.n; i += pas) if (!img[i]) lot.push(i);
        return Promise.all(lot.map(charger));
      });
    });
    chaine.then(function () {
      if (arrivees === 0) { figer("chargement-impossible"); return; }
      if (jauge) jauge.style.opacity = "0";
    });
  }

  /* ---- profil de vitesse ------------------------------------------------
     Une caméra accélère, tient sa vitesse, puis ralentit. On applique donc
     à la course une vitesse nulle aux deux bouts : le mouvement s'installe
     et s'éteint sans que le visiteur perçoive de bascule.

       vitesse(u) = adoucie(u / A)          sur les A premiers pour cent
                    1                       au milieu
                    adoucie((1 - u) / A)    sur les A derniers

     La position affichée est l'intégrale normalisée de cette vitesse.   */
  var A = 0.22;                                    // part consacrée aux liaisons
  var AIRE = 1 - A;                                // intégrale totale de la vitesse

  function primitive(u) {                          // ∫ (3u² − 2u³) du
    return u * u * u - u * u * u * u / 2;
  }

  function position(p) {
    var i;
    if (p < A)          i = A * primitive(p / A);
    else if (p > 1 - A) i = AIRE - A * primitive((1 - p) / A);
    else                i = A * 0.5 + (p - A);
    return Math.min(1, Math.max(0, i / AIRE));
  }

  /* ---- rendu ------------------------------------------------------------ */
  function proche(i) {                             // image chargée la plus proche
    if (pret[i]) return i;
    for (var d = 1; d < PROFIL.n; d++) {
      if (pret[i - d]) return i - d;
      if (pret[i + d]) return i + d;
    }
    return -1;
  }

  function couvrir(e, zoom) {                      // équivalent de object-fit: cover
    var rc = cnv.width / cnv.height, ri = e.naturalWidth / e.naturalHeight, w, h;
    if (ri > rc) { h = cnv.height; w = h * ri; } else { w = cnv.width; h = w / ri; }
    w *= zoom; h *= zoom;
    return [(cnv.width - w) / 2, (cnv.height - h) / 2, w, h];
  }

  function poser(e, alpha, zoom) {
    if (!e) return;
    var c = couvrir(e, zoom);
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

  var derI = -1, derFrac = -1, derP = -1;
  function peindre(p, force) {
    /* --- la séquence, au profil de vitesse --- */
    var q = position(p);
    var exact = q * (PROFIL.n - 1);
    var i = Math.floor(exact), frac = exact - i;
    if (i >= PROFIL.n - 1) { i = PROFIL.n - 1; frac = 0; }

    /* --- rapprochement léger pendant la mise en route ---
       L'image entre légèrement rapprochée et se pose à 1 : le mouvement
       paraît naître du plan fixe au lieu de s'y substituer.
       Le rapprochement suit la MÊME courbe adoucie que la séquence. Sans
       cela il variait le plus vite au tout début, et l'entrée bougeait plus
       que le milieu — l'inverse de l'effet recherché. */
    var uz = Math.min(1, p / 0.30);
    var zoom = 1 + 0.032 * (1 - uz * uz * (3 - 2 * uz));
    // L'affiche suit exactement le même rapprochement, sinon le relais de
    // l'une vers l'autre se verrait comme un saut d'échelle.
    if (affiche) affiche.style.transform = "scale(" + zoom.toFixed(4) + ")";

    if (force || i !== derI || Math.abs(frac - derFrac) > 0.015 ||
        Math.abs(p - derP) > 0.004) {
      derI = i; derFrac = frac; derP = p;
      var a = proche(i);
      if (a >= 0) {
        poser(img[a], 1, zoom);
        if (frac > 0.01) {                         // fondu vers l'image suivante
          var b = proche(i + 1);
          if (b >= 0 && b !== a) poser(img[b], frac, zoom);
        }
      }
    }

    /* --- liaison d'entrée : le titre se retire, le voile s'allège --- */
    if (texte) {
      var s = Math.min(1, p / 0.17);               // 0 → 1 sur les 17 premiers %
      var d = s * s * (3 - 2 * s);
      texte.style.opacity = String(1 - d);
      texte.style.transform = "translate3d(0," + (-34 * d) + "px,0)";
      texte.style.pointerEvents = d > 0.6 ? "none" : "";
    }
    if (voile) voile.style.opacity = String(1 - 0.55 * Math.min(1, p / 0.3));

    /* --- liaison de sortie : le hero se dissout dans la page --- */
    if (sortie) {
      var t = Math.max(0, (p - 0.87) / 0.13);
      sortie.style.opacity = String(t * t);
    }

    if (curseur) curseur.style.transform = "translateY(" + (p * 79) + "px)";
  }

  /* ---- boucle ----------------------------------------------------------- */
  var tourne = false;
  function surDefilement() {
    if (tourne) return;
    tourne = true;
    requestAnimationFrame(function () { peindre(progression()); tourne = false; });
  }

  var actif = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { actif = es[0].isIntersecting; }, { threshold: 0 })
      .observe(course);
  }
  window.addEventListener("scroll", function () { if (actif) surDefilement(); }, { passive: true });
  window.addEventListener("resize", dimensionner);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", dimensionner);

  // Une rotation change le cadrage attendu : on recharge plutôt que de
  // mélanger deux séquences aux proportions différentes.
  mqPortrait.addEventListener("change", function (e) {
    if ((e.matches ? "p" : "l") !== PROFIL.p) location.reload();
  });

  dimensionner();
  peindre(progression(), true);
  vagues();
})();
