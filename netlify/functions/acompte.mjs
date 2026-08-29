/* =========================================================================
   Acompte en ligne — Stripe Checkout
   =========================================================================
   Trois règles tenues ici, et elles comptent plus que le reste du site :

   1. Le montant n'est JAMAIS reçu du navigateur. Il est recalculé à partir
      des seules dates et du nombre de voyageurs (voir js/tarifs.mjs). Sinon
      il suffirait d'ouvrir les outils de développement pour payer un euro.
   2. La disponibilité est revérifiée avant d'ouvrir le paiement : on
      n'encaisse pas un acompte pour une semaine déjà louée ailleurs.
   3. Aucun numéro de carte ne transite par ce site. Stripe héberge la page
      de paiement ; c'est la condition de la conformité PCI DSS.

   POUR PASSER EN RÉEL, variables d'environnement Netlify :
     STRIPE_SECRET_KEY = sk_test_... puis sk_live_... le jour de la mise en
                         production. La clé secrète ne doit jamais figurer
                         dans le dépôt ni dans une page.
   ========================================================================= */

// Même fichier que celui chargé par le navigateur : le prix affiché et le
// prix facturé ne peuvent pas diverger.
import { calculer } from "../../js/tarifs.mjs";
import { obtenirPeriodes, estLibre } from "./disponibilites.mjs";

const json = (o, s = 200) => new Response(JSON.stringify(o),
  { status: s, headers: { "content-type": "application/json; charset=utf-8" } });

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export default async (req) => {
  // GET ?session=cs_... : la page de confirmation demande le détail de la
  // session réglée. On ne renvoie que ce qui est utile à l'affichage.
  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("session");
    const cle = process.env.STRIPE_SECRET_KEY;
    if (!id) return json({ message: "Session manquante." }, 400);
    if (!cle) return json({ message: "Aucune clé Stripe configurée." }, 501);
    try {
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions/"
                            + encodeURIComponent(id),
                            { headers: { authorization: `Bearer ${cle}` },
                              signal: AbortSignal.timeout(9000) });
      const s = await r.json();
      if (!r.ok) throw new Error(s?.error?.message || ("HTTP " + r.status));
      if (s.payment_status !== "paid")
        return json({ message: "Ce paiement n'est pas abouti." }, 409);
      const m = s.metadata || {};
      return json({
        arrivee: m.arrivee, depart: m.depart, voyageurs: m.voyageurs,
        total: Number(m.total_sejour) || null,
        solde: Number(m.solde_du) || null,
        acompte: (s.amount_total || 0) / 100,
        reference: String(s.id).slice(-10).toUpperCase()
      });
    } catch (e) {
      console.error("[acompte] lecture session :", e);
      return json({ message: "Récapitulatif indisponible." }, 502);
    }
  }

  if (req.method !== "POST") return json({ message: "Méthode non autorisée." }, 405);

  let d;
  try { d = await req.json(); }
  catch { return json({ message: "Requête illisible." }, 400); }

  const arrivee = String(d.arrivee || "");
  const depart  = String(d.depart  || "");
  if (!JOUR.test(arrivee) || !JOUR.test(depart))
    return json({ message: "Dates manquantes ou mal formées." }, 400);

  // ---- 1. le prix, recalculé ici ----------------------------------------
  const p = calculer(arrivee, depart, d.voyageurs);
  if (p.erreur) return json({ message: p.erreur }, 400);

  // ---- 2. la disponibilité, revérifiée ----------------------------------
  const dispo = await obtenirPeriodes();
  if (dispo.mode === "indisponible")
    return json({ message: "Impossible de vérifier les disponibilités pour l'instant. "
                         + "Réessayez dans un moment ou écrivez-nous." }, 503);
  if (!estLibre(dispo.periodes, arrivee, depart))
    return json({ message: "Ces dates viennent d'être prises. Le calendrier est à jour." }, 409);

  const origine = new URL(req.url).origin;
  const cle = process.env.STRIPE_SECRET_KEY;

  // ---- Mode démonstration ------------------------------------------------
  // Sans clé Stripe, le parcours se termine sur une confirmation de
  // démonstration. Tout ce qui précède est déjà le chemin réel : le prix a
  // été recalculé ici, la disponibilité revérifiée. Il ne manque que
  // l'ouverture de la page de paiement — voir plus bas.
  if (!cle) {
    const q = new URLSearchParams({
      demo: "1", arrivee, depart,
      voyageurs: String(p.voyageurs),
      acompte: p.acompte.toFixed(2),
      total: p.total.toFixed(2),
      solde: p.solde.toFixed(2),
      nuits: String(p.nuits)
    });
    return json({
      mode: "demonstration",
      message: "Paiement simulé : cette maquette n'encaisse rien.",
      detail: p,
      url: `${origine}/confirmation.html?${q}`
    });
  }

  // ---- Mode réel : création d'une session Stripe Checkout ----------------
  const champs = {
    mode: "payment",
    "payment_method_types[0]": "card",
    success_url: `${origine}/confirmation.html?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/reserver.html?annule=1`,
    locale: "fr",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(p.acompteCentimes),
    "line_items[0][price_data][product_data][name]":
      `Acompte ${p.nuits} nuits — Villa Alizéa`,
    "line_items[0][price_data][product_data][description]":
      `Du ${arrivee} au ${depart}, ${p.voyageurs} voyageurs. `
      + `Séjour ${p.total.toFixed(2)} € — acompte ${p.acompte.toFixed(2)} €, `
      + `solde ${p.solde.toFixed(2)} € à 30 jours de l'arrivée.`,
    "metadata[arrivee]": arrivee,
    "metadata[depart]": depart,
    "metadata[voyageurs]": String(p.voyageurs),
    "metadata[total_sejour]": p.total.toFixed(2),
    "metadata[solde_du]": p.solde.toFixed(2)
  };
  if (d.courriel && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(d.courriel)))
    champs.customer_email = String(d.courriel);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cle}`,
        "content-type": "application/x-www-form-urlencoded",
        // Rejoue sans risque de double débit si le réseau coupe.
        "idempotency-key": `alizea-${arrivee}-${depart}-${p.voyageurs}-${p.acompteCentimes}`
      },
      body: new URLSearchParams(champs),
      signal: AbortSignal.timeout(10000)
    });
    const s = await r.json();
    if (!r.ok) throw new Error(s?.error?.message || ("HTTP " + r.status));
    return json({
      mode: cle.startsWith("sk_live") ? "reel" : "test",
      detail: p, url: s.url, session: s.id
    });
  } catch (e) {
    console.error("[acompte] Stripe :", e);
    return json({ message: "Le paiement n'a pas pu être ouvert. "
                         + "Aucun montant n'a été débité." }, 502);
  }
};

export const config = { path: "/api/acompte" };
