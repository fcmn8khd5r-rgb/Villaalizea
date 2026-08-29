/* Villa Alizéa — comportements communs. Aucune dépendance. */
(function () {
  "use strict";
  var sobre = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- en-tête : passe en clair une fois qu'on a quitté le hero -------- */
  var entete = document.getElementById("entete");
  var hero   = document.getElementById("hero");
  if (entete) {
    if (hero && "IntersectionObserver" in window) {
      // L'en-tête se pose dès que le bas du hero remonte sous la barre.
      new IntersectionObserver(function (es) {
        entete.classList.toggle("est-pose", !es[0].isIntersecting);
      }, { rootMargin: "-66px 0px 0px 0px", threshold: 0 }).observe(hero);
    } else {
      entete.classList.add("est-pose");
    }
  }

  /* ---- menu plein écran ------------------------------------------------ */
  var burger = document.querySelector(".burger");
  var menu   = document.getElementById("menu");
  if (burger && menu) {
    var ouvrir = function (o) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.toggleAttribute("data-ouvert", o); });
      burger.setAttribute("aria-expanded", String(o));
      document.body.classList.toggle("est-bloque", o);
      if (o) { var a = menu.querySelector("a"); if (a) a.focus(); }
      else { burger.focus(); setTimeout(function () { menu.hidden = true; }, 300); }
    };
    burger.addEventListener("click", function () {
      ouvrir(burger.getAttribute("aria-expanded") !== "true");
    });
    menu.querySelector(".voile__fermer").addEventListener("click", function () { ouvrir(false); });
    menu.addEventListener("click", function (e) { if (e.target.tagName === "A") ouvrir(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.hasAttribute("data-ouvert")) ouvrir(false);
    });
  }

  /* ---- apparitions au défilement --------------------------------------- */
  var cibles = document.querySelectorAll(".revele");
  if (sobre || !("IntersectionObserver" in window)) {
    cibles.forEach(function (e) { e.classList.add("est-vu"); });
  } else {
    var ob = new IntersectionObserver(function (es) {
      es.forEach(function (x, i) {
        if (!x.isIntersecting) return;
        setTimeout(function () { x.target.classList.add("est-vu"); }, i * 70);
        ob.unobserve(x.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    cibles.forEach(function (e) { ob.observe(e); });
  }

  /* ---- formulaire de demande -------------------------------------------
     Envoi en arrière-plan si la fonction serveur répond ; sinon on laisse
     le navigateur poster le formulaire normalement.                       */
  var form = document.getElementById("form-demande");
  var etat = document.getElementById("etat-demande");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bouton = form.querySelector("button[type=submit]");
      bouton.disabled = true;
      if (etat) { etat.textContent = "Envoi…"; etat.style.color = ""; }
      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (etat) {
          etat.textContent = r.j.message || (r.ok ? "Message enregistré." : "Envoi impossible.");
          etat.style.color = r.ok ? "var(--lagon)" : "#A6412F";
        }
        if (r.ok) form.reset();
      })
      .catch(function () {
        if (etat) {
          etat.textContent = "Aucun serveur joignable — le formulaire est inerte sur cette maquette.";
          etat.style.color = "#A6412F";
        }
      })
      .finally(function () { bouton.disabled = false; });
    });
  }
})();
