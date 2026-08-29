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

export default async (req) => {
  if (req.method !== "POST") return json({ message: "Méthode non autorisée." }, 405);

  // Sans JavaScript, le navigateur poste le formulaire lui-même : on le
  // reconnaît au type de contenu, et on lui répond par une redirection
  // plutôt que par du JSON brut à l'écran.
  const brut = !(req.headers.get("content-type") || "").includes("application/json");
  const origine = new URL(req.url).origin;
  const rendre = (ok, o, statut = 200) =>
    brut ? Response.redirect(origine + "/merci.html" + (ok ? "" : "?erreur=1"), 303)
         : json(o, statut);

  let d;
  try {
    d = brut ? Object.fromEntries(await req.formData()) : await req.json();
  } catch { return rendre(false, { message: "Requête illisible." }, 400); }

  const nom      = propre(d.nom, 120);
  const courriel = propre(d.courriel, 160);
  const message  = propre(d.message, 4000);

  if (!nom || !courriel || !message)
    return rendre(false, { message: "Nom, courriel et message sont nécessaires." }, 400);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(courriel))
    return rendre(false, { message: "Cette adresse de courriel semble incorrecte." }, 400);
  if (propre(d.piege))                                  // pot de miel anti-robot
    return rendre(true, { message: "Message enregistré." });

  const corps =
    "Demande depuis la démonstration Villa Alizéa\n\n" +
    `Nom        : ${nom}\n` +
    `Courriel   : ${courriel}\n` +
    `Téléphone  : ${propre(d.telephone, 40) || "—"}\n` +
    `Arrivée    : ${propre(d.arrivee, 10) || "—"}\n` +
    `Départ     : ${propre(d.depart, 10) || "—"}\n` +
    `Voyageurs  : ${propre(d.voyageurs, 3) || "—"}\n\n${message}\n`;

  const api = process.env.RESEND_API_KEY;
  const dest = process.env.COURRIEL_DESTINATION || DESTINATION;
  if (!api) {
    console.log("[demande — mode démonstration]\n" + corps);
    return rendre(true, {
      mode: "demonstration",
      message: "Demande reçue. Sur cette maquette, aucun courriel n'est encore envoyé : "
             + "il manque la clé du service d'envoi."
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
      message: "Votre message est parti. Réponse sous 24 h." });
  } catch (e) {
    console.error("[demande] envoi impossible :", e);
    return rendre(false,
      { message: "L'envoi a échoué. Écrivez-nous directement par courriel." }, 502);
  }
};

export const config = { path: "/api/demande" };
