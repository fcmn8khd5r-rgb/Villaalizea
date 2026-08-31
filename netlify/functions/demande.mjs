/* =========================================================================
   Formulaire de demande — envoi du courriel
   =========================================================================
   La destination est celle de l'ÉDITEUR du site, pas de la villa fictive :
   un propriétaire séduit par la démonstration écrit au studio qui l'a faite.

   POUR PASSER EN RÉEL, une seule variable est indispensable :
     RESEND_API_KEY        = re_...              (https://resend.com, offre gratuite)
   Facultatives :
     COURRIEL_DESTINATION  = pour dérouter ailleurs que l'adresse par défaut
     COURRIEL_EXPEDITEUR   = site@votre-domaine  (domaine vérifié chez Resend)
   ========================================================================= */

const DESTINATION = "contact@studiomathysbocage.fr";

const json = (o, s = 200) => new Response(JSON.stringify(o),
  { status: s, headers: { "content-type": "application/json; charset=utf-8" } });

// Retire les caractères de contrôle : ils permettraient d'injecter des
// en-têtes supplémentaires dans le courriel.
const propre = (v, max = 2000) =>
  String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

/* Le site est bilingue : un refus renvoyé en français à quelqu'un qui lit
   l'anglais est une impasse. La langue vient du formulaire (champ caché) ou
   de la requête ; le français sert de repli. */
const MESSAGES = {
  fr: {
    methode:   "Méthode non autorisée.",
    illisible: "Requête illisible.",
    manquant:  "Nom, courriel et message sont nécessaires.",
    courriel:  "Cette adresse de courriel semble incorrecte.",
    enregistre:"Message enregistré.",
    demo:      "Demande reçue. Sur cette maquette, aucun courriel n'est encore envoyé : "
             + "il manque la clé du service d'envoi.",
    parti:     "Votre message est parti. Réponse sous 24 h.",
    echec:     "L'envoi a échoué. Écrivez-nous directement par courriel."
  },
  en: {
    methode:   "Method not allowed.",
    illisible: "That request could not be read.",
    manquant:  "Name, email and message are required.",
    courriel:  "That email address does not look right.",
    enregistre:"Message recorded.",
    demo:      "Enquiry received. On this mock-up no email is sent yet: the sending "
             + "service key is missing.",
    parti:     "Your message is on its way. We reply within 24 hours.",
    echec:     "Sending failed. Please write to us by email directly."
  }
};
const langueDe = v => (String(v || "").toLowerCase().startsWith("en") ? "en" : "fr");

export default async (req) => {
  // Avant même d'avoir lu le corps, on ne connaît la langue que par l'adresse
  // ou l'en-tête : cela suffit pour le seul refus possible à ce stade.
  const url0 = new URL(req.url);
  const venuDeEn =
       langueDe(url0.searchParams.get("langue")) === "en"
    || (req.headers.get("referer") || "").includes("/en/");
  let M = MESSAGES[venuDeEn ? "en" : "fr"];
  if (req.method !== "POST") return json({ message: M.methode }, 405);

  // Sans JavaScript, le navigateur poste le formulaire lui-même : on le
  // reconnaît au type de contenu, et on lui répond par une redirection
  // plutôt que par du JSON brut à l'écran.
  const brut = !(req.headers.get("content-type") || "").includes("application/json");
  const origine = url0.origin;
  // La page de remerciement existe dans les deux langues : renvoyer un
  // anglophone sur la française serait un faux pas au dernier moment.
  let prefixe = "";
  const rendre = (ok, o, statut = 200) =>
    brut ? Response.redirect(origine + prefixe + "/merci.html" + (ok ? "" : "?erreur=1"), 303)
         : json(o, statut);

  let d;
  try {
    d = brut ? Object.fromEntries(await req.formData()) : await req.json();
  } catch { return rendre(false, { message: M.illisible }, 400); }

  // La langue déclarée par le formulaire fait foi : elle dit ce que le
  // visiteur lisait au moment d'écrire.
  const lg = d.langue ? langueDe(d.langue) : (venuDeEn ? "en" : "fr");
  M = MESSAGES[lg];
  prefixe = lg === "en" ? "/en" : "";

  const nom      = propre(d.nom, 120);
  const courriel = propre(d.courriel, 160);
  const message  = propre(d.message, 4000);

  if (!nom || !courriel || !message)
    return rendre(false, { message: M.manquant }, 400);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(courriel))
    return rendre(false, { message: M.courriel }, 400);
  if (propre(d.piege))                                  // pot de miel anti-robot
    return rendre(true, { message: M.enregistre });

  const corps =
    "Demande depuis la démonstration Villa Alizéa\n\n" +
    `Nom        : ${nom}\n` +
    `Courriel   : ${courriel}\n` +
    `Téléphone  : ${propre(d.telephone, 40) || "—"}\n` +
    `Arrivée    : ${propre(d.arrivee, 10) || "—"}\n` +
    `Départ     : ${propre(d.depart, 10) || "—"}\n` +
    `Voyageurs  : ${propre(d.voyageurs, 3) || "—"}\n` +
    `Langue     : ${lg}\n\n${message}\n`;

  const api = process.env.RESEND_API_KEY;
  const dest = process.env.COURRIEL_DESTINATION || DESTINATION;
  if (!api) {
    console.log("[demande — mode démonstration]\n" + corps);
    return rendre(true, {
      mode: "demonstration",
      message: M.demo
    });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${api}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.COURRIEL_EXPEDITEUR || "site@villa-alizea.example",
        to: [dest], reply_to: courriel,
        subject: `Demande — ${nom}`, text: corps
      }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    return rendre(true, { mode: "reel",
      message: M.parti });
  } catch (e) {
    console.error("[demande] envoi impossible :", e);
    return rendre(false,
      { message: M.echec }, 502);
  }
};

export const config = { path: "/api/demande" };
