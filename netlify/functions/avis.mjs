/* =========================================================================
   Avis Google — via l'API Places (New)
   =========================================================================
   La clé d'API ne doit JAMAIS partir dans le navigateur : n'importe qui
   pourrait s'en servir et la facture serait pour le propriétaire. Elle reste
   donc ici, côté serveur, et le navigateur n'appelle que cette fonction.

   POUR PASSER EN RÉEL, dans les variables d'environnement Netlify :
     GOOGLE_MAPS_API_KEY = AIza...     (API « Places API (New) » activée)
     GOOGLE_PLACE_ID     = ChIJ...     (identifiant de la fiche établissement)

   Google ne renvoie que cinq avis par fiche : c'est une limite de l'API,
   pas du site.
   ========================================================================= */

const DEMO = {
  note: 4.9, total: 38,
  avis: [
    { auteur: "Camille R.", note: 5, quand: "il y a 3 semaines",
      texte: "La maison est encore plus ouverte que sur les photos. On a pris tous les "
           + "petits déjeuners sur la terrasse, avec le bruit de la houle en fond. "
           + "Baie Longue est à cinq minutes à pied et on n'y a jamais croisé personne." },
    { auteur: "Thomas & Léa", note: 5, quand: "il y a 2 mois",
      texte: "Quatre chambres vraiment indépendantes, ce qui change tout quand on part "
           + "à deux couples avec des enfants. Accueil impeccable, et le ménage de fin "
           + "de séjour évite les discussions." },
    { auteur: "Marie-Claude D.", note: 5, quand: "il y a 3 mois",
      texte: "Nous cherchions du calme sans être coupés de tout : les Terres Basses sont "
           + "parfaites pour ça. Marigot en dix minutes pour le marché du samedi." },
    { auteur: "Julien P.", note: 4, quand: "il y a 4 mois",
      texte: "Très belle villa, bien tenue. Un bémol honnête : la climatisation de la "
           + "chambre du fond est un peu bruyante la nuit. Les propriétaires nous ont dit "
           + "qu'elle serait remplacée." },
    { auteur: "Sophie & Marc", note: 5, quand: "il y a 5 mois",
      texte: "Le bassin de nage est un vrai bassin, pas une baignoire. On y a fait des "
           + "longueurs tous les matins. On reviendra." }
  ]
};

const entetes = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300, s-maxage=21600"     // 6 h côté CDN
};

export default async () => {
  const cle = process.env.GOOGLE_MAPS_API_KEY;
  const fiche = process.env.GOOGLE_PLACE_ID;

  if (!cle || !fiche) {
    return new Response(JSON.stringify({
      mode: "demonstration",
      noteTechnique: "Définissez GOOGLE_MAPS_API_KEY et GOOGLE_PLACE_ID pour afficher "
                   + "les avis réels de la fiche Google.",
      ...DEMO
    }), { headers: entetes });
  }

  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(fiche)}`, {
      headers: {
        "X-Goog-Api-Key": cle,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
        "Accept-Language": "fr"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 180));
    const d = await r.json();

    return new Response(JSON.stringify({
      mode: "reel",
      note: d.rating ?? null,
      total: d.userRatingCount ?? 0,
      lien: d.googleMapsUri || null,
      avis: (d.reviews || []).map(a => ({
        auteur: a.authorAttribution?.displayName || "Voyageur",
        photo:  a.authorAttribution?.photoUri || null,
        note:   a.rating,
        quand:  a.relativePublishTimeDescription || "",
        texte:  a.originalText?.text || a.text?.text || ""
      }))
    }), { headers: entetes });

  } catch (e) {
    // On renvoie le jeu de démonstration plutôt qu'une section vide : mieux
    // vaut un contenu daté qu'un trou dans la page.
    return new Response(JSON.stringify({
      mode: "repli", erreur: String(e.message || e), ...DEMO
    }), { headers: entetes });
  }
};

export const config = { path: "/api/avis" };
