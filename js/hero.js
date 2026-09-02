/* ==========================================================================
   Le hero : une caméra que le lecteur pilote.

   Trois partis pris tiennent tout le fichier.

   1. Une séquence d'images, pas une vidéo. Safari mobile ne sait pas se
      déplacer image par image dans un fichier vidéo : il ne s'arrête que sur
      les images-clés, et le déplacement devient une suite de sauts. Une pile
      d'images fixes se parcourt exactement, au prix de la mémoire — d'où le
      profil portrait volontairement petit (voir src/hero.py).

   2. Rien ne se lit tout seul. La position vient du défilement, jamais d'une
      horloge. À l'arrêt, on ne se fige pas net : un ressort amorti continue
      la course quelques dixièmes de seconde, comme une caméra qui s'arrête.

   3. Rien ne démarre avant que tout soit là. Charger pendant que l'on fait
      défiler produit exactement le à-coup que l'on cherche à éviter : tant
      que la séquence n'est pas complète, le hero reste une image fixe et la
      page garde une hauteur d'un écran.
   ========================================================================== */
(function () {
  "use strict";

  var sec = document.getElementById("hero");
  if (!sec) return;

  var pile     = document.getElementById("pile");
  var affiche  = document.getElementById("hero-affiche");
  var texte    = document.getElementById("hero-texte");
  var ecran    = document.getElementById("hero-ecran");
  var voile    = document.getElementById("hero-voile");
  var sortie   = document.getElementById("hero-sortie");
  var jauge    = document.getElementById("jauge");
  var curseur  = document.getElementById("curseur");

  /* Repli : le hero devient une affiche, la page reprend une hauteur normale.
     Appelé pour toute raison — réseau, mémoire, préférence système, panne.

     Le code est posé en `data-repli` sur la section : c'est inspectable, donc
     vérifiable, là où une ligne de console ne l'est pas. essai-replis.html
     le relit pour contrôler chacun des cas. */
  function figer(code, raison) {
    sec.classList.add("hero--fixe");
    sec.classList.remove("hero--prete");
    sec.setAttribute("data-repli", code);
    if (jauge) jauge.hidden = true;
    if (window.console && raison) console.info("hero : image fixe (" + raison + ")");
  }

  var doux = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (doux.matches) return figer("animations-reduites", "mouvement réduit demandé");

  /* Seul le mode « économiseur de données » interdit d'emblée. Tout le reste
     — type de réseau annoncé, débit estimé — s'est révélé faux trop souvent
     pour décider à sa place : on mesure plus bas, sur une vraie image. */
  var co = navigator.connection || navigator.webkitConnection;
  if (co && co.saveData) return figer("connexion-lente", "économiseur de données actif");

  /* js/hero-data.js est écrit par construire.py à partir de ce que la
     fabrication a réellement produit : nombre d'images et poids moyen. Rien
     n'est recopié ici, sans quoi les deux divergent au premier changement
     de cadence. */
  var COMPTES  = window.ALIZEA_HERO || {};
  var portrait = window.matchMedia("(max-width:699px), (orientation:portrait)").matches;
  var profil   = portrait ? "p" : "l";
  var fiche    = COMPTES[profil] || {};
  var N        = fiche.n | 0;
  var POIDS    = fiche.poids | 0;
  if (N < 8 || !POIDS) return figer("sequence-absente", "séquence absente");

  /* La sequence n'existe qu'en AVIF : produire 315 WebP de plus doublerait
     le depot sans rien changer a ce qui transite. On ne teste donc pas le
     format — la premiere image sert deja de sonde, et si elle echoue le hero
     retombe sur l'affiche, qui est servie par <picture> avec un repli WebP.

     (Le test habituel, canvas.toDataURL("image/avif"), mesure la capacite a
     ENCODER de l'AVIF : Chrome sait le decoder mais pas l'encoder, et repond
     donc non a la mauvaise question.) */
  function url(i) {
    /* Absolue depuis la racine : les pages anglaises vivent sous /en/, et une
       adresse relative y désignerait /en/assets/hero/… — la séquence ne se
       chargeait pas, et le hero retombait en image fixe sans rien signaler. */
    return "/assets/hero/" + profil + String(i).padStart(3, "0") + ".avif";
  }

  /* ---------------------------------------------------------------- toile */
  var toile = document.createElement("canvas");
  toile.className = "hero__toile";
  toile.setAttribute("aria-hidden", "true");
  pile.appendChild(toile);
  var ctx = toile.getContext("2d", { alpha: false });

  var dpr = 1, larg = 0, haut = 0;
  function dimensionner() {
    dpr  = Math.min(window.devicePixelRatio || 1, portrait ? 2 : 1.6);
    larg = pile.clientWidth;
    haut = pile.clientHeight;
    toile.width  = Math.round(larg * dpr);
    toile.height = Math.round(haut * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessine = -1;
  }

  /* ------------------------------------------------------- préchargement */
  var images = new Array(N), prets = 0, abandon = false;
  var ATTENTE_MAX = 10;                       /* secondes que l'on s'autorise */

  function charger(i) {
    return new Promise(function (ok, non) {
      var im = new Image();
      im.decoding = "async";
      im.onload  = function () { images[i] = im; ok(im); };
      im.onerror = non;
      im.src = url(i);
    });
  }

  function progres() {
    prets++;
    if (jauge) jauge.style.setProperty("--part", (prets / N).toFixed(3));
  }

  /* Nombre de requêtes menées de front.

     Il valait six — une règle héritée de HTTP/1.1, où les navigateurs
     n'ouvraient pas plus de six connexions par domaine. Elle est FAUSSE
     depuis HTTP/2, que servent Netlify et tous les hébergeurs modernes :
     les requêtes y sont multiplexées sur une seule connexion, et les
     brider ne fait que sérialiser ce qui pourrait être simultané.

     Cela ne se voit pas en développement, où la latence est nulle. Sur le
     vrai réseau elle domine tout : chaque image demande environ 300 ms
     d'aller-retour, et six voies ne peuvent donc en tirer que vingt par
     seconde. Mesuré sur le site en ligne, sur soixante images réelles :

         6 voies  → 18,5 s pour la séquence   (au-delà du budget : abandon)
        12 voies  →  4,7 s
        24 voies  →  3,7 s
        40 voies  →  1,5 s

     Le hero se repliait donc à chaque visite, sur tous les appareils, pour
     une limite qui ne protégeait plus rien. Vingt-quatre laisse une marge
     confortable sans saturer une connexion mobile. */
  var VOIES = 24;

  /* ------------------------------------------------------- préchargement

     Le débit se jugeait autrefois sur une seule image, chronométrée depuis
     avant la toute première requête. Deux erreurs s'y cumulaient : ce temps
     contenait l'établissement de la connexion et, sur un CDN, le premier
     accès à l'objet dans la région — de la latence, pas du débit ; et la
     projection supposait un chargement séquentiel alors que six voies
     s'ouvrent juste après. Le poids par image se simplifiant, la condition
     se réduisait à « la première image arrive-t-elle en moins de dix
     secondes divisées par le nombre d'images », soit 38 ms sur le profil
     bureau. Un aller-retour vers un CDN en demande trente à cent cinquante :
     le repli tombait presque à chaque première visite, et jamais à la
     seconde, le cache aidant.

     On ne juge donc plus une fois, on juge en continu. Mais la mesure
     continue s'est révélée fausse elle aussi, et pour une raison plus
     profonde : ELLE COMMENÇAIT PENDANT QUE LA PAGE SE CHARGEAIT ENCORE.
     Les images de la séquence partagent alors la liaison avec le document,
     la feuille de style, les polices et l'affiche du hero — et le navigateur
     les sert en dernier, car une image créée par script est de priorité
     basse. Le débit relevé décrit donc la CONCURRENCE, pas la liaison.

     Mesuré sur le site en ligne, profil portrait, mêmes 24 voies :

         pendant le chargement de la page →  53 Ko/s   (repli déclenché)
         page au repos, même liaison      → 373 Ko/s   (2,95 s en tout)

     Sept fois moins. Le premier chiffre était ensuite extrapolé à toute la
     séquence, ce qui annonçait quinze secondes de plus et faisait tomber le
     repli — sur tous les appareils, à chaque première visite. C'est la même
     erreur que le test effectiveType retiré plus haut : décider sur un
     échantillon qui ne décrit pas le régime établi.

     On attend donc que la page ait fini de charger avant de juger, et l'on
     ne mesure que ce qui arrive APRÈS ce moment-là. Le chargement de la
     séquence, lui, n'attend pas : il démarre tout de suite, seul le verdict
     est différé. Ce qui est jugé est alors la liaison seule, et la question
     posée est la bonne : « au rythme observé, combien de temps reste-t-il ? » */
  function precharger() {
    if (jauge) jauge.hidden = false;

    return charger(0).then(function () {
      progres();

      var recues  = 0;
      var suivant = 1;
      var arret   = null;

      /* Repère du régime établi : l'instant où la page a fini de charger, et
         le nombre d'images déjà reçues à ce moment. Tout ce qui précède est
         écarté de la mesure. */
      var t0 = 0, recues0 = 0;
      var poser = function () { t0 = performance.now(); recues0 = recues; };
      if (document.readyState === "complete") poser();
      else addEventListener("load", poser, { once: true });

      function file() {
        if (arret) return Promise.reject(arret);
        if (suivant >= N) return Promise.resolve();
        var i = suivant++;
        return charger(i).then(function () {
          progres();
          recues++;
          if (!t0) return;                       /* la page charge encore */
          var sec = (performance.now() - t0) / 1000;
          var vues = recues - recues0;
          /* Une vague complète de voies et une seconde et demie au moins :
             en deçà, la mesure décrit la montée en débit, pas la liaison. */
          if (vues >= VOIES && sec > 1.5) {
            var debit = vues * POIDS / sec;
            var reste = (N - 1 - recues) * POIDS / debit;
            /* Le temps qui RESTE, et non le temps total : ce qui a été
               téléchargé pendant que la page se chargeait est acquis, le
               décompter une seconde fois punirait une page riche. */
            if (reste > ATTENTE_MAX) {
              abandon = true;
              arret = new Error("débit mesuré " + Math.round(debit / 1024)
                              + " Ko/s, " + Math.round(reste) + " s encore nécessaires");
              throw arret;
            }
          }
        }).then(file);
      }

      var voies = [];
      for (var v = 0; v < VOIES; v++) voies.push(file());

      /* Filet. Une image suspendue ne répond ni par onload ni par onerror :
         sans échéance, le hero attendrait sans fin, jauge à l'écran. */
      var echeance = new Promise(function (_, non) {
        setTimeout(function () {
          if (arret) return;
          abandon = true;
          non(new Error("séquence incomplète après " + (ATTENTE_MAX * 2) + " s"));
        }, ATTENTE_MAX * 2000);
      });
      return Promise.race([Promise.all(voies), echeance]);
    });
  }

  /* -------------------------------------------------- profil de vitesse
     La position affichée est l'intégrale d'une vitesse qui monte, tient un
     plateau, puis redescend : la caméra ne s'arrête pas net à la fin.

     LES DEUX BOUTS NE SONT PAS SYMÉTRIQUES, et c'est le point important.
     Une montée douce des deux côtés paraissait la bonne idée ; mesurée, elle
     était désastreuse. Avec une montée sur 22 % de la course, les 60 premiers
     pixels de défilement n'avançaient que de DEUX images sur 162 : le premier
     geste — celui qui décide de l'impression — ne montrait quasiment rien, et
     le hero passait pour immobile.

     Il n'y a d'ailleurs aucune raison d'adoucir l'entrée : avant le premier
     geste l'image est déjà à l'arrêt sur son premier plan, il n'y a pas de
     rupture à masquer. La sortie, elle, en a besoin — le hero s'y efface
     pendant que la page suivante monte. D'où 4 % à l'entrée, 16 % à la
     sortie : les 60 premiers pixels avancent maintenant de vingt-cinq images. */
  var A_DEBUT = 0.04, A_FIN = 0.16, PAS = 512, TABLE = new Float32Array(PAS + 1);
  (function () {
    var somme = 0, i, u, s, v;
    for (i = 0; i <= PAS; i++) {
      u = i / PAS;
      if (u < A_DEBUT)        { s = u / A_DEBUT;     v = s * s * (3 - 2 * s); }
      else if (u > 1 - A_FIN) { s = (1 - u) / A_FIN; v = s * s * (3 - 2 * s); }
      else                      v = 1;
      somme += v;
      TABLE[i] = somme;
    }
    for (i = 0; i <= PAS; i++) TABLE[i] /= somme;
  })();

  function position(p) {
    var x = p * PAS, i = Math.floor(x), f = x - i;
    if (i >= PAS) return 1;
    return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * f;
  }

  /* ------------------------------------------------------------- peinture */
  var dessine = -1;

  function couvrir(im) {
    var r = Math.max(larg / im.naturalWidth, haut / im.naturalHeight);
    var w = im.naturalWidth * r, h = im.naturalHeight * r;
    return [(larg - w) / 2, (haut - h) / 2, w, h];
  }

  function peindre(pos) {
    var x = pos * (N - 1), i = Math.floor(x), f = x - i, b;
    if (i > N - 1) { i = N - 1; f = 0; }
    var a = images[i];
    if (!a) return;
    var g = couvrir(a);
    ctx.drawImage(a, g[0], g[1], g[2], g[3]);
    if (f > 0.004 && (b = images[i + 1])) {
      ctx.globalAlpha = f;
      g = couvrir(b);
      ctx.drawImage(b, g[0], g[1], g[2], g[3]);
      ctx.globalAlpha = 1;
    }
    dessine = pos;
  }

  /* --------------------------------------------------------- habillage */
  function habiller(p) {
    /* Le texte se retire tôt : il a été lu, il ne doit pas barrer l'image. */
    var t = Math.min(1, p / 0.26);
    texte.style.opacity   = String(1 - t);
    texte.style.transform = "translate3d(0," + (-26 * t).toFixed(1) + "px,0)";
    texte.style.visibility = t >= 1 ? "hidden" : "visible";

    /* Le rideau sombre s'efface sur la même courbe que le texte qu'il sert :
       le garder à pleine force une fois le texte parti assombrit pour rien. */
    if (ecran) ecran.style.opacity = String(1 - t);
    if (voile) voile.style.opacity = String(0.5 - 0.32 * Math.min(1, p / 0.4));

    /* Sortie : le hero se dissout dans la couleur de la page. */
    if (sortie) sortie.style.opacity = String(Math.max(0, (p - 0.88) / 0.12));

    if (curseur) curseur.style.transform = "translateY(" + (p * 79).toFixed(1) + "px)";

  }

  /* ------------------------------------------------ ressort et parallaxe
     RAIDEUR et AMORTI sont choisis au bord du régime critique (ζ ≈ 1) :
     la course se prolonge d'environ une demi-seconde après l'arrêt du
     doigt, sans jamais repartir en arrière — un dépassement, ici, se verrait
     comme un tremblement de la caméra.

     J'ai cru un temps que l'amortissement était le levier de fluidité :
     un cran de molette fait avancer la séquence de quatre-vingt-huit images,
     et si le ressort les traversait trop vite, l'écran n'en afficherait
     qu'une poignée. Simulation faite, c'est faux — ce réglage en affiche
     déjà 39, et l'adoucir jusqu'à 0,022 n'en donne que 41. Le ressort n'est
     pas le goulot, et on garde donc le réglage le plus vif.

     Le vrai goulot est ailleurs, et il n'a pas de solution gratuite : le pas
     de temps entre deux images AFFICHEES vaut (durée du segment x fraction
     parcourue) / 39. Il ne se réduit qu'en réduisant la fraction parcourue
     par geste — c'est-à-dire en allongeant la course, donc en faisant moins
     bouger la scène. Fluidité et amplitude sont le MEME reglage, pris par
     ses deux bouts. */
  var RAIDEUR = 0.11, AMORTI = 0.34, TIC = 1000 / 60;

  var cible = 0, courant = 0, vitesse = 0;
  var souris = 0, sourisLisse = 0;
  var dernier = 0, reste = 0, tourne = false;

  function mesurer() {
    var boite = sec.getBoundingClientRect();
    var course = sec.offsetHeight - window.innerHeight;
    if (course <= 0) return 0;
    return Math.min(1, Math.max(0, -boite.top / course));
  }

  function pas() {
    vitesse += (cible - courant) * RAIDEUR;
    vitesse *= AMORTI;
    courant += vitesse;
    sourisLisse += (souris - sourisLisse) * 0.06;
  }

  function boucle(t) {
    if (!tourne) return;
    var dt = dernier ? Math.min(80, t - dernier) : TIC;
    dernier = t;
    reste += dt;
    var tours = 0;
    while (reste >= TIC && tours < 6) { pas(); reste -= TIC; tours++; }
    if (reste > TIC) reste = TIC;

    var pos = position(courant);
    if (Math.abs(pos - dessine) > 0.0004) peindre(pos);
    habiller(courant);
    toile.style.setProperty("--par", (sourisLisse * 1.15).toFixed(3) + "%");
    requestAnimationFrame(boucle);
  }

  function surDefilement() { cible = mesurer(); }

  /* ------------------------------------------------------------ démarrage */
  function activer() {
    if (jauge) jauge.hidden = true;

    /* La hauteur de course fixe la VITESSE : c'est elle qui décide de combien
       la scène avance pour un geste donné. Elle était de 340 vh, soit une
       douzaine de pixels de défilement par image — le mouvement s'y diluait
       au point qu'on ne voyait presque plus rien bouger. Réduite à ~160 vh,
       la même séquence est traversée près de trois fois plus vite.

       Ce levier ne coûte rien : l'écart entre deux images affichées ne change
       pas, donc la fluidité non plus. On les parcourt seulement plus vite.

       Elle ne dépend plus du nombre d'images : les deux profils en ont
       désormais autant, et surtout la bonne question n'est pas « combien
       d'images ? » mais « combien de défilement le hero occupe-t-il ? ».
       150 vh, soit un demi-écran de défilement utile. Raccourcie exprès :
       c'est ce qui fait avancer les bateaux vite sous un geste ordinaire. */
    var piste = sec.querySelector(".hero__course");
    if (piste) piste.style.setProperty("--course", "150vh");

    dimensionner();
    sec.classList.add("hero--prete");

    /* Si la personne a déjà quitté le haut de la page pendant le chargement,
       animer la caméra sous ses yeux serait un mouvement qu'elle n'a pas
       demandé : on se cale sur sa position réelle, sans transition. */
    cible = courant = mesurer();
    peindre(position(courant));
    habiller(courant);

    addEventListener("scroll", surDefilement, { passive: true });
    addEventListener("resize", function () { dimensionner(); cible = mesurer(); },
                     { passive: true });

    /* Effet de souris : un glissement horizontal de l'image d'un peu plus
       d'un pour cent. Assez pour que l'image réponde, trop peu pour qu'on
       sache dire pourquoi. Sur écran tactile, il n'existe pas. */
    if (!portrait && matchMedia("(hover:hover) and (pointer:fine)").matches) {
      addEventListener("pointermove", function (e) {
        souris = (e.clientX / window.innerWidth - 0.5) * 2;
      }, { passive: true });
      addEventListener("pointerleave", function () { souris = 0; }, { passive: true });
    }

    tourne = true;
    requestAnimationFrame(boucle);
  }

  doux.addEventListener("change", function (e) {
    if (e.matches) { tourne = false; figer("animations-reduites", "mouvement réduit demandé"); }
  });

  precharger().then(activer).catch(function (e) {
    figer(abandon ? "debit-insuffisant" : "chargement-impossible",
          abandon ? e.message : "séquence indisponible");
  });
})();
