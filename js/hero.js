/* =========================================================================
   Villa Alizéa — la caméra pilotée au défilement
   =========================================================================
   Le hero n'est pas une vidéo mais une séquence d'images : une vidéo
   « scrubbée » bloque sur Safari mobile, qui ne sait chercher que les
   images clés, et tout encoder en images clés triplerait le poids.

   TROIS CAUSES DE SACCADE, ET LEUR REMÈDE
   1. Chargement progressif pendant le pilotage. Tant que les vagues 2 et 3
      arrivaient, l'affichage retombait sur l'image chargée la plus proche
      et sautait de quatre en quatre. On charge donc TOUTE la séquence
      avant d'activer l'effet ; jusque-là, l'affiche fixe reste, et le hero
      garde une hauteur d'écran — le visiteur ne défile pas dans le vide.
   2. Position d'image calquée sur la position de défilement. Une molette
      ou un pavé tactile envoient des sauts irréguliers, que l'image
      reproduisait tels quels. La position visée est désormais LISSÉE :
      l'image rejoint la cible par approche exponentielle, ce qui absorbe
      les à-coups sans introduire de retard perceptible.
   3. Seuil de redessin trop grossier, qui avalait les variations fines.
      Pendant l'animation, on redessine à chaque image.

   REPLIS
     pas de JavaScript              → l'affiche reste, en plein écran ;
     animations réduites, 2G,
     économiseur de données,
     3G sous 1,4 Mb/s               → aucun octet de séquence n'est chargé ;
     préchargement incomplet        → l'affiche reste, sans rien casser.
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

  /* ---- faut-il charger la séquence ? -----------------------------------
     L'économiseur de données et la 2G ferment la porte sans discussion.
     Pour la 3G, l'étiquette seule ne suffit pas : elle couvre une bande
     très large. On consulte donc le débit estimé. */
  var co = navigator.connection || {};
  var debit = typeof co.downlink === "number" ? co.downlink : 10;
  var lent = co.saveData === true ||
             /^(slow-)?2g$/.test(co.effectiveType || "") ||
             (co.effectiveType === "3g" && debit < 1.4);
  var sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function figer(raison) {
    hero.classList.add("hero--fixe");
    hero.setAttribute("data-repli", raison);
    if (jauge) jauge.hidden = true;
  }
  if (lent || sobre) { figer(sobre ? "animations-reduites" : "connexion-lente"); return; }

  /* ---- profil : large 16/9 ou portrait 3/4 -----------------------------
     Le choix se fait sur l'ORIENTATION, pas sur la largeur : une fenêtre
     étroite mais paysage doit recevoir le cadrage large. */
  var mqPortrait = window.matchMedia("(orientation: portrait), (max-width: 699px)");
  var PROFIL = mqPortrait.matches ? { p: "p", n: 70, course: "300vh" }
                                  : { p: "l", n: 70, course: "340vh" };
  var url = function (i) {
    return "assets/hero/" + PROFIL.p + String(i).padStart(3, "0") + ".avif";
  };

  /* ---- la toile --------------------------------------------------------- */
  var cnv = document.createElement("canvas");
  cnv.className = "hero__toile";
  pile.appendChild(cnv);
  var ctx = cnv.getContext("2d", { alpha: false });
  var img = new Array(PROFIL.n);
  var prete = false;

  function dimensionner() {
    var r = Math.min(window.devicePixelRatio || 1, 2);
    var l = pile.clientWidth, h = pile.clientHeight;
    if (!l || !h) return;
    cnv.width = Math.round(l * r); cnv.height = Math.round(h * r);
    cnv.style.width = l + "px";    cnv.style.height = h + "px";
    if (prete) peindre(courant, true);
  }

  /* ---- préchargement complet, puis activation --------------------------- */
  var arrivees = 0, echecs = 0;

  function charger(i) {
    return new Promise(function (ok) {
      var e = new Image();
      e.decoding = "async";
      e.onload  = function () { img[i] = e; compter(); ok(); };
      e.onerror = function () { echecs++;   compter(); ok(); };
      e.src = url(i);
    });
  }

  function compter() {
    arrivees++;
    if (jauge) jauge.style.setProperty("--part", (arrivees / PROFIL.n * 100) + "%");
  }

  function precharger() {
    if (jauge) jauge.hidden = false;
    // Par petits paquets : lancer soixante-dix requêtes d'un coup sature la
    // file du navigateur et retarde tout le reste de la page.
    var i = 0;
    function paquet() {
      var lot = [];
      for (var k = 0; k < 8 && i < PROFIL.n; k++, i++) lot.push(charger(i));
      return Promise.all(lot).then(function () {
        return i < PROFIL.n ? paquet() : null;
      });
    }
    return paquet();
  }

  /* ---- profil de vitesse ------------------------------------------------
     Une caméra accélère, tient sa vitesse, puis ralentit. La course reçoit
     donc une vitesse nulle aux deux bouts : le mouvement s'installe et
     s'éteint sans que le visiteur perçoive de bascule. La position affichée
     est l'intégrale normalisée de cette vitesse. */
  var A = 0.22, AIRE = 1 - A;
  var primitive = function (u) { return u * u * u - u * u * u * u / 2; };

  function position(p) {
    var i;
    if (p < A)          i = A * primitive(p / A);
    else if (p > 1 - A) i = AIRE - A * primitive((1 - p) / A);
    else                i = A * 0.5 + (p - A);
    return Math.min(1, Math.max(0, i / AIRE));
  }

  /* ---- rendu ------------------------------------------------------------ */
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

  function proche(i) {                             // filet de sécurité
    if (img[i]) return i;
    for (var d = 1; d < PROFIL.n; d++) {
      if (img[i - d]) return i - d;
      if (img[i + d]) return i + d;
    }
    return -1;
  }

  function progression() {
    var r = course.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -r.top / total));
  }

  function peindre(p) {
    var exact = position(p) * (PROFIL.n - 1);
    var i = Math.floor(exact), frac = exact - i;
    if (i >= PROFIL.n - 1) { i = PROFIL.n - 1; frac = 0; }

    // Rapprochement léger pendant la mise en route, sur la même courbe
    // adoucie que la séquence : sans cela il variait le plus vite au tout
    // début et l'entrée bougeait plus que le milieu.
    var uz = Math.min(1, p / 0.30);
    var zoom = 1 + 0.032 * (1 - uz * uz * (3 - 2 * uz));
    if (affiche) affiche.style.transform = "scale(" + zoom.toFixed(4) + ")";

    var a = proche(i);
    if (a >= 0) {
      poser(img[a], 1, zoom);
      if (frac > 0.004) {                          // fondu vers l'image suivante
        var b = proche(i + 1);
        if (b >= 0 && b !== a) poser(img[b], frac, zoom);
      }
    }

    // Liaison d'entrée : le titre se retire, le voile s'allège.
    if (texte) {
      var s = Math.min(1, p / 0.17), d = s * s * (3 - 2 * s);
      texte.style.opacity = String(1 - d);
      texte.style.transform = "translate3d(0," + (-34 * d) + "px,0)";
      texte.style.pointerEvents = d > 0.6 ? "none" : "";
    }
    if (voile) voile.style.opacity = String(1 - 0.45 * Math.min(1, p / 0.3));
    // Liaison de sortie : le hero se dissout dans la couleur de la page.
    if (sortie) {
      var t = Math.max(0, (p - 0.87) / 0.13);
      sortie.style.opacity = String(t * t);
    }
    if (curseur) curseur.style.transform = "translateY(" + (p * 79) + "px)";
  }

  /* ---- lissage de la progression ----------------------------------------
     La cible vient du défilement, la valeur affichée la rejoint par
     approche exponentielle. C'est ce qui absorbe les à-coups d'une molette
     ou d'un pavé tactile sans introduire de retard perceptible. */
  var cible = 0, courant = 0, anime = false;

  function boucle() {
    var d = cible - courant;
    if (Math.abs(d) < 0.0003) { courant = cible; peindre(courant); anime = false; return; }
    courant += d * 0.20;
    peindre(courant);
    requestAnimationFrame(boucle);
  }

  function relancer() {
    if (anime) return;
    anime = true;
    requestAnimationFrame(boucle);
  }

  var actif = true;
  function surDefilement() {
    if (!prete || !actif) return;
    cible = progression();
    relancer();
  }

  /* ---- activation -------------------------------------------------------- */
  function activer() {
    prete = true;
    course.style.setProperty("--course", PROFIL.course);
    hero.classList.add("hero--prete");
    if (jauge) jauge.hidden = true;
    dimensionner();
    cible = courant = progression();
    peindre(courant);
  }

  precharger().then(function () {
    if (echecs > PROFIL.n * 0.15) { figer("chargement-incomplet"); return; }
    // On n'allonge la page que si le visiteur est encore en haut : sinon on
    // décalerait le contenu sous ses yeux. S'il remonte, on activera alors.
    if (window.scrollY < 40) { activer(); return; }
    if (jauge) jauge.hidden = true;
    var guet = function () {
      if (window.scrollY < 40) {
        window.removeEventListener("scroll", guet);
        activer();
      }
    };
    window.addEventListener("scroll", guet, { passive: true });
  });

  window.addEventListener("scroll", surDefilement, { passive: true });
  window.addEventListener("resize", dimensionner);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", dimensionner);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { actif = es[0].isIntersecting; }, { threshold: 0 })
      .observe(course);
  }
  // Une rotation change le cadrage attendu : on recharge plutôt que de
  // mélanger deux séquences aux proportions différentes.
  mqPortrait.addEventListener("change", function (e) {
    if ((e.matches ? "p" : "l") !== PROFIL.p) location.reload();
  });
})();
