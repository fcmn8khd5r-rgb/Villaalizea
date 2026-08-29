/* =========================================================================
   Formulaire de demande — envoi du courriel
   =========================================================================
   POUR PASSER EN RÉEL, variables d'environnement Netlify :
     RESEND_API_KEY        = re_...              (https://resend.com)
     COURRIEL_DESTINATION  = proprietaire@...
     COURRIEL_EXPEDITEUR   = site@votre-domaine  (domaine vérifié chez Resend)
   ========================================================================= */

const json = (o, s = 200) => new Response(JSON.stringify(o),
  { status: s, headers: { "content-type": "application/json; charset=utf-8" } });

// Retire les caractères de contrôle : ils permettraient d'injecter des
// en-têtes supplémentaires dans le courriel.
const propre = (v, max = 2000) =>
  String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ message: "Méthode non autorisée." }, 405);

  let d;
  try {
    d = (req.headers.get("content-type") || "").includes("application/json")
      ? await req.json()
      : Object.fromEntries(await req.formData());
  } catch { return json({ message: "Requête illisible." }, 400); }

  const nom      = propre(d.nom, 120);
  const courriel = propre(d.courriel, 160);
  const message  = propre(d.message, 4000);

  if (!nom || !courriel || !message)
    return json({ message: "Nom, courriel et message sont nécessaires." }, 400);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(courriel))
    return json({ message: "Cette adresse de courriel semble incorrecte." }, 400);
  if (propre(d.piege))                                  // pot de miel anti-robot
    return json({ message: "Message enregistré." });

  const corps =
    "Demande depuis le site Villa Alizéa\n\n" +
    `Nom        : ${nom}\n` +
    `Courriel   : ${courriel}\n` +
    `Téléphone  : ${propre(d.telephone, 40) || "—"}\n` +
    `Arrivée    : ${propre(d.arrivee, 10) || "—"}\n` +
    `Départ     : ${propre(d.depart, 10) || "—"}\n` +
    `Voyageurs  : ${propre(d.voyageurs, 3) || "—"}\n\n${message}\n`;

  const api = process.env.RESEND_API_KEY;
  const dest = process.env.COURRIEL_DESTINATION;
  if (!api || !dest) {
    console.log("[demande — mode démonstration]\n" + corps);
    return json({
      mode: "demonstration",
      message: "Demande reçue (maquette : aucun courriel n'a été envoyé)."
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
    return json({ mode: "reel", message: "Votre demande est partie. Réponse sous 24 h." });
  } catch (e) {
    console.error("[demande] envoi impossible :", e);
    return json({ message: "L'envoi a échoué. Écrivez-nous directement par courriel." }, 502);
  }
};

export const config = { path: "/api/demande" };
