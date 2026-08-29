/* =========================================================================
   Disponibilités — synchronisation iCal (Airbnb, Booking.com, Abritel…)
   =========================================================================
   Chaque plateforme publie un calendrier au format iCalendar (RFC 5545)
   qui liste les périodes déjà réservées. On les récupère, on les fusionne,
   et on renvoie un JSON que le calendrier du site sait lire.

   POUR PASSER EN RÉEL — rien à réécrire, il suffit de définir les variables
   d'environnement dans Netlify (Site settings → Environment variables) :

     ICAL_AIRBNB   = https://www.airbnb.fr/calendar/ical/XXXX.ics?s=…
     ICAL_BOOKING  = https://admin.booking.com/hotel/hoteladmin/ical.html?t=…

   Sans ces variables, la fonction répond avec un jeu de démonstration
   déterministe (le même jour affiche toujours le même état) et le signale
   par "mode": "demonstration".
   ========================================================================= */

const CACHE_S = 900;          // 15 min : les plateformes ne veulent pas plus

/* ---- Analyse iCalendar ------------------------------------------------- */
function deplier(txt) {
  // RFC 5545 : une ligne peut être coupée et reprise avec une espace ou une
  // tabulation en tête. On recolle avant toute analyse.
  return txt.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function versDate(v) {
  // Accepte 20260214 et 20260214T150000Z ; on ne garde que le jour.
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function analyserIcal(txt, source) {
  const out = [];
  const blocs = deplier(txt).split("BEGIN:VEVENT").slice(1);
  for (const b of blocs) {
    const corps = b.split("END:VEVENT")[0];
    const d = /^DTSTART[^:]*:(.+)$/m.exec(corps);
    const f = /^DTEND[^:]*:(.+)$/m.exec(corps);
    if (!d || !f) continue;
    const debut = versDate(d[1]), fin = versDate(f[1]);
    if (!debut || !fin) continue;
    const resume = (/^SUMMARY[^:]*:(.+)$/m.exec(corps) || [, ""])[1].trim();
    // Airbnb publie aussi les blocages du propriétaire : on les traite pareil.
    out.push({ debut, fin, source, motif: /not available|indisponible/i.test(resume)
                                          ? "bloque" : "reserve" });
  }
  return out;
}

/* ---- Démonstration ------------------------------------------------------
   Occupation corrélée par semaine : une villa se loue par blocs de sept
   nuits. Des tirages indépendants jour par jour rendraient tout séjour
   impossible et le calendrier n'aurait aucun sens.                        */
function empreinte(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function demo() {
  const out = [], base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() - base.getUTCDay() + 6);   // prochain samedi

  // Taux volontairement modérés : une villa très demandée reste réservable,
  // sinon le calendrier ne montre plus rien. On impose aussi une semaine
  // libre après chaque location de deux semaines, pour éviter que les
  // périodes contiguës ne fusionnent en un seul bloc de plusieurs mois.
  let occupeJusqua = -1;
  for (let s = 0; s < 52; s++) {
    if (s <= occupeJusqua) continue;
    const debut = new Date(base);
    debut.setUTCDate(debut.getUTCDate() + s * 7);
    const mois = debut.getUTCMonth();                           // 0 = janvier
    const haute = mois <= 3 || mois === 11;                     // déc → avril
    if (empreinte("alizea-s" + s) > (haute ? 0.55 : 0.26)) continue;

    const semaines = empreinte("alizea-d" + s) > 0.78 ? 2 : 1;
    const fin = new Date(debut);
    fin.setUTCDate(fin.getUTCDate() + semaines * 7);
    out.push({
      debut: debut.toISOString().slice(0, 10),
      fin: fin.toISOString().slice(0, 10),
      source: s % 3 === 0 ? "Booking" : "Airbnb",
      motif: "reserve"
    });
    occupeJusqua = s + semaines;      // au moins une semaine libre ensuite
  }
  return out;
}

/* ---- Fusion ------------------------------------------------------------- */
export function fusionner(periodes) {
  const t = [...periodes].sort((a, b) => a.debut < b.debut ? -1 : 1);
  const out = [];
  for (const p of t) {
    const d = out[out.length - 1];
    if (d && p.debut <= d.fin) {              // chevauchement : on étend
      if (p.fin > d.fin) d.fin = p.fin;
      if (!d.source.includes(p.source)) d.source += " + " + p.source;
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

/** Périodes indisponibles, quelle que soit la source. Utilisé aussi par
    la fonction d'acompte : on ne prend pas d'argent pour une semaine
    déjà louée. */
export async function obtenirPeriodes() {
  const flux = [
    { nom: "Airbnb",  url: process.env.ICAL_AIRBNB },
    { nom: "Booking", url: process.env.ICAL_BOOKING }
  ].filter(f => f.url);
  if (!flux.length) return { mode: "demonstration", periodes: fusionner(demo()), erreurs: [] };

  const erreurs = [];
  let periodes = [];
  await Promise.all(flux.map(async f => {
    try {
      const r = await fetch(f.url, {
        headers: { "user-agent": "villa-alizea/1.0 (synchronisation calendrier)" },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      periodes = periodes.concat(analyserIcal(await r.text(), f.nom));
    } catch (e) {
      erreurs.push({ source: f.nom, erreur: String(e.message || e) });
    }
  }));
  if (erreurs.length === flux.length) return { mode: "indisponible", periodes: [], erreurs };
  return { mode: "reel", periodes: fusionner(periodes), erreurs,
           sources: flux.map(f => f.nom) };
}

/** Vrai si [arrivee, depart[ ne touche aucune période déjà prise. */
export function estLibre(periodes, arrivee, depart) {
  return !periodes.some(p => arrivee < p.fin && depart > p.debut);
}

export default async (req) => {
  const flux = [
    { nom: "Airbnb",  url: process.env.ICAL_AIRBNB },
    { nom: "Booking", url: process.env.ICAL_BOOKING }
  ].filter(f => f.url);

  const entetes = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=60, s-maxage=${CACHE_S}`
  };

  if (!flux.length) {
    return new Response(JSON.stringify({
      mode: "demonstration",
      note: "Aucune URL iCal configurée : définissez ICAL_AIRBNB ou ICAL_BOOKING "
          + "dans les variables d'environnement pour passer en réel.",
      majLe: new Date().toISOString(),
      periodes: fusionner(demo())
    }), { headers: entetes });
  }

  const erreurs = [];
  let periodes = [];
  await Promise.all(flux.map(async f => {
    try {
      const r = await fetch(f.url, {
        headers: { "user-agent": "villa-alizea/1.0 (synchronisation calendrier)" },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      periodes = periodes.concat(analyserIcal(await r.text(), f.nom));
    } catch (e) {
      erreurs.push({ source: f.nom, erreur: String(e.message || e) });
    }
  }));

  // Si toutes les sources échouent, on le dit plutôt que d'afficher un
  // calendrier vide qui laisserait croire que tout est libre.
  if (erreurs.length === flux.length) {
    return new Response(JSON.stringify({
      mode: "indisponible", erreurs,
      note: "Les calendriers sources n'ont pas répondu."
    }), { status: 503, headers: entetes });
  }

  return new Response(JSON.stringify({
    mode: "reel",
    sources: flux.map(f => f.nom),
    erreurs,
    majLe: new Date().toISOString(),
    periodes: fusionner(periodes)
  }), { headers: entetes });
};

export const config = { path: "/api/disponibilites" };
