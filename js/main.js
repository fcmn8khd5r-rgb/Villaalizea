/* =========================================================================
   Villa Alizéa — comportements communs
   Animations reprises de la démonstration Villa Damencourt : montée des
   blocs à l'entrée dans le champ, révélation des images par volet,
   compteurs. Aucune dépendance.
   ========================================================================= */
(function () {
  "use strict";

/* ---- langue -------------------------------------------------------------
   La page dit dans quelle langue elle est ; les textes viennent de
   js/textes.js, engendré par construire.py. `tx` remplace {0}, {1}… par les
   valeurs passées, et retombe sur la clé si un texte manque — mieux vaut un
   mot brut qu'un trou. */
var LG = document.documentElement.lang === "en" ? "en" : "fr";
var TX = (window.ALIZEA_TEXTES || {})[LG] || {};
function tx(cle) {
  var s = TX[cle];
  if (s === undefined) return cle;
  for (var i = 1; i < arguments.length; i++)
    s = s.split("{" + (i - 1) + "}").join(arguments[i]);
  return s;
}

  var sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- en-tête : passe en clair une fois le hero quitté ---------------- */
  var tete = document.querySelector(".tete");
  var hero = document.getElementById("hero");
  if (tete) {
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        tete.classList.toggle("est-posee", !es[0].isIntersecting);
      }, { rootMargin: "-82px 0px 0px 0px", threshold: 0 }).observe(hero);
    } else {
      tete.classList.add("est-posee");
    }
  }

  /* ---- menu plein écran ------------------------------------------------ */
  var burger = document.querySelector(".burger");
  var tiroir = document.getElementById("tiroir");
  if (burger && tiroir) {
    var basculer = function (o) {
      tiroir.hidden = false;
      burger.setAttribute("aria-expanded", String(o));
      document.body.classList.toggle("bloque", o);
      // Le focus doit attendre DEUX trames : la feuille de style garde le
      // tiroir invisible tant que `data-ouvert` n'est pas posé, et la
      // transition ne bascule la visibilité qu'à la trame suivante. Demandé
      // trop tôt, le focus est refusé sans erreur — et la tabulation
      // continuait derrière le tiroir ouvert.
      requestAnimationFrame(function () {
        tiroir.toggleAttribute("data-ouvert", o);
        if (o) requestAnimationFrame(function () {
          var a = tiroir.querySelector("a");
          if (a) a.focus();
        });
      });
      if (!o) { burger.focus(); setTimeout(function () { tiroir.hidden = true; }, 400); }
    };
    burger.addEventListener("click", function () {
      basculer(burger.getAttribute("aria-expanded") !== "true");
    });
    tiroir.querySelector(".tiroir__x").addEventListener("click", function () { basculer(false); });
    tiroir.addEventListener("click", function (e) { if (e.target.tagName === "A") basculer(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && tiroir.hasAttribute("data-ouvert")) basculer(false);
    });
  }

  /* ---- apparitions au défilement --------------------------------------- */
  var cibles = document.querySelectorAll("[data-anim]");
  if (sobre || !("IntersectionObserver" in window)) {
    cibles.forEach(function (e) { e.classList.add("vu"); });
  } else {
    var vh = window.innerHeight || 800;
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (!x.isIntersecting) return;
        x.target.classList.add("vu");
        obs.unobserve(x.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    cibles.forEach(function (e) {
      // Ce qui est déjà passé sous le pli est révélé sans attendre.
      if (e.getBoundingClientRect().top < vh * 0.92) e.classList.add("vu");
      else obs.observe(e);
    });
  }

  /* ---- compteurs -------------------------------------------------------
     Le nombre monte de zéro à sa valeur à l'entrée dans le champ. La valeur
     est écrite dans le HTML : elle reste juste sans JavaScript. */
  var compteurs = document.querySelectorAll("[data-compte]");
  var format = function (v, d) {
    return v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  if (compteurs.length) {
    var animer = function (el) {
      var cible = parseFloat(el.getAttribute("data-compte"));
      var deci = (el.getAttribute("data-decimales") || "0") | 0;
      var duree = 1300, t0 = null;
      requestAnimationFrame(function pas(ts) {
        if (t0 === null) t0 = ts;                  // sinon ts - t0 vaut NaN
        var k = Math.min(1, (ts - t0) / duree);
        el.textContent = format(cible * (1 - Math.pow(1 - k, 3)), deci);
        if (k < 1) requestAnimationFrame(pas);
        else el.textContent = format(cible, deci);
      });
    };
    if (sobre || !("IntersectionObserver" in window)) {
      compteurs.forEach(function (el) {
        el.textContent = format(parseFloat(el.getAttribute("data-compte")),
                                (el.getAttribute("data-decimales") || "0") | 0);
      });
    } else {
      var oc = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          if (!x.isIntersecting) return;
          animer(x.target); oc.unobserve(x.target);
        });
      }, { threshold: 0.4 });
      compteurs.forEach(function (el) { oc.observe(el); });
    }
  }

  /* ---- vidéos : lecture seulement quand elles sont à l'écran ------------ */
  var videos = document.querySelectorAll("video[data-auto]");
  if (videos.length && "IntersectionObserver" in window && !sobre) {
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var v = x.target;
        if (x.isIntersecting) { v.muted = true; var p = v.play(); if (p) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { vo.observe(v); });
  }

  /* ---- formulaires ------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("form[data-envoi]"), function (form) {
    var etat = form.querySelector("[data-etat]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bouton = form.querySelector("button[type=submit]");
      if (bouton) bouton.disabled = true;
      if (etat) { etat.textContent = "Envoi…"; etat.style.color = ""; }
      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (etat) {
          etat.textContent = r.j.message
            || (r.ok ? tx("message_enregistre")
                     : (LG === "en" ? "Could not send." : "Envoi impossible."));
          etat.style.color = r.ok ? "var(--accent)" : "#9C3A28";
        }
        if (r.ok) form.reset();
      })
      .catch(function () {
        if (etat) {
          etat.textContent = "Aucun serveur joignable — le formulaire est inerte sur cette maquette.";
          etat.style.color = "#9C3A28";
        }
      })
      .finally(function () { if (bouton) bouton.disabled = false; });
    });
  });
})();
