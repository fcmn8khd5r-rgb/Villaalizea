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
     animations réduites,
     économiseur de données         → aucun octet de séquence n'est chargé ;
     débit mesuré trop faible       → on s'arrête après une image de sonde ;
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
  var ecran   = document.getElementById("hero-ecran");
  if (!hero || !course || !pile) return;

  /* ---- faut-il charger la séquence ? -----------------------------------
     Une seule chose bloque sans discussion : l'économiseur de données. C'est
     une INTENTION exprimée par le visiteur, pas une mesure — elle se
     respecte telle quelle.

     Tout le reste est estimation, et l'estimation du navigateur n'est pas
     fiable. Sur cette machine, sans aucun réseau, `navigator.connection` a
     annoncé tour à tour « 3g à 1,3 Mb/s » puis « 2g à 0,25 Mb/s ». Prendre
     une décision définitive là-dessus, c'est couper l'effet chez des gens
     dont la connexion va très bien.

     On SONDE donc : une image d'abord, on mesure le débit réellement obtenu,
     et on décide. Sur une vraie 2G le verdict tombe après ~26 Ko, ce qui est
     un coût acceptable pour ne pas se tromper. La vérification est refaite
     après le premier paquet, au cas où le débit s'effondrerait ensuite. */
  var co = navigator.connection || {};
  var lent = co.saveData === true;
  var sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Au-delà de cette attente estimée pour la séquence entière, on renonce.
  var ATTENTE_MAX = 10;   // secondes

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
  // Le nombre d'images et leur poids viennent de la fabrication, via
  // js/hero-data.js : écrits en dur ici, ils divergeaient en silence au
  // premier changement de cadence.
  var DATA = (window.ALIZEA_HERO || {});
  var cle = mqPortrait.matches ? "p" : "l";
  var d = DATA[cle] || { n: 70, poids: 30000 };
  var PROFIL = { p: cle, n: d.n, course: mqPortrait.matches ? "300vh" : "340vh" };
  var POIDS_IMAGE = d.poids;   // octets, mesuré à la fabrication
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

  /** Débit réellement obtenu sur les images déjà arrivées, en octets/s.
      Renvoie 0 si la mesure n'est pas exploitable. */
  function debitMesure(depuis) {
    if (!window.performance || !performance.getEntriesByType) return 0;
    var octets = 0;
    performance.getEntriesByType("resource").forEach(function (r) {
      if (!/\/assets\/hero\/[lp]\d{3}\.avif$/.test(r.name)) return;
      octets += r.transferSize || r.encodedBodySize || 0;
    });
    var duree = (performance.now() - depuis) / 1000;
    return duree > 0.05 && octets > 0 ? octets / duree : 0;
  }

  function precharger() {
    if (jauge) jauge.hidden = false;
    var i = 0, depart = performance.now(), renonce = false;

    /** Le débit constaté permet-il de finir dans un délai acceptable ? */
    function tropLent() {
      var debit = debitMesure(depart);
      if (!debit) return false;                 // mesure inexploitable : on continue
      return POIDS_IMAGE * (PROFIL.n - i) / debit > ATTENTE_MAX;
    }

    // Sonde : une image, puis verdict. Sur une vraie 2G on s'arrête ici.
    return charger(i++).then(function () {
      if (tropLent()) { renonce = true; figer("connexion-lente"); return false; }
      // Ensuite par paquets : lancer cent soixante-quinze requêtes d'un coup
      // saturerait la file du navigateur et retarderait le reste de la page.
      function paquet() {
        var lot = [];
        for (var k = 0; k < 8 && i < PROFIL.n; k++, i++) lot.push(charger(i));
        return Promise.all(lot).then(function () {
          if (!renonce && tropLent()) { renonce = true; figer("connexion-lente"); }
          return (i < PROFIL.n && !renonce) ? paquet() : null;
        });
      }
      return paquet().then(function () { return !renonce; });
    });
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

    // Liaison d'entrée : le titre se retire, les voiles s'allègent.
    var s = Math.min(1, p / 0.17), d = s * s * (3 - 2 * s);
    if (texte) {
      texte.style.opacity = String(1 - d);
      texte.style.transform = "translate3d(0," + (-34 * d) + "px,0)";
      texte.style.pointerEvents = d > 0.6 ? "none" : "";
    }
    // L'écran de lisibilité n'existe que pour le texte : une fois celui-ci
    // parti, le garder revient à assombrir l'image pour rien — et c'est
    // justement dans la seconde moitié que le plan a le plus à montrer.
    if (ecran) {
      var e = Math.min(1, p / 0.24);
      ecran.style.opacity = String(1 - e * e * (3 - 2 * e));
    }
    if (voile) voile.style.opacity = String(1 - 0.55 * Math.min(1, p / 0.32));
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
    var ecart = cible - courant;
    if (Math.abs(ecart) < 0.0003) { courant = cible; peindre(courant); anime = false; return; }
    // Approche plus douce qu'avant (0,20) : les à-coups d'un pavé tactile
    // se dissolvent sur davantage d'images d'écran.
    courant += ecart * 0.15;
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

  precharger().then(function (complet) {
    if (!complet) return;                       // renoncé faute de débit
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
