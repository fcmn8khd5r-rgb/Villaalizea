#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere les blocs repetitifs des pages a partir de config/villa.json et
src/manifeste.json.

Un prix, une coordonnee ou une legende ne s'ecrivent qu'a un seul endroit.
`python3 construire.py --verifie` controle sans rien ecrire.
"""
import json, os, re, sys

RACINE = os.path.dirname(os.path.abspath(__file__))
CFG  = json.load(open(os.path.join(RACINE, "config/villa.json"), encoding="utf-8"))
MAN  = json.load(open(os.path.join(RACINE, "src/manifeste.json"), encoding="utf-8"))

# Ordre d'affichage de la galerie : on alterne les registres pour que la
# mosaique ne presente pas quatre chambres a la suite.
ORDRE = ["sejour-01","terrasse-02","chambre-01","cuisine-01","ciel-01","bain-02",
         "chambre-03","detail-02","sejour-02","terrasse-01","ciel-04","chambre-02",
         "bain-01","cuisine-02","detail-01","sejour-03","terrasse-03","chambre-04",
         "ciel-02","bureau-01","detail-03","chambre-05","sejour-04","ciel-03",
         "detail-04","plage-01","ciel-05"]

PIECES = [
  ("sejour-02", "Le séjour",
   "Soixante mètres carrés sans une cloison, sous un plafond qui monte jusqu'à la panne "
   "faîtière. Les baies coulissent entièrement dans le mur\u202f: le séjour et la terrasse "
   "cessent alors d'être deux pièces.",
   ["60 m²", "Plafond cathédrale", "Baies à galandage", "Ventilateurs de plafond"]),
  ("cuisine-01", "La cuisine",
   "Un plan de quatre mètres en béton ciré, une table d'hôte en bois de récupération, et "
   "tout ce qu'il faut pour ne pas sortir dîner\u202f: plaque à induction, four, lave-vaisselle, "
   "machine à café et cave à vin.",
   ["Table de 10 couverts", "Induction", "Lave-vaisselle", "Cave à vin"]),
  ("chambre-03", "Les chambres",
   "Quatre chambres de plain-pied, toutes avec climatisation réversible et moustiquaire. "
   "Trois en lit double, la quatrième en lits jumeaux séparables — c'est celle que "
   "choisissent les familles.",
   ["4 chambres", "8 couchages", "Climatisation", "Moustiquaires"]),
  ("bain-02", "Les salles d'eau",
   "Trois salles d'eau en enduit à la chaux, douches à l'italienne et robinetterie bronze. "
   "L'eau chaude vient du solaire — il y en a toute la journée, sans y penser.",
   ["3 salles d'eau", "Douches à l'italienne", "Eau chaude solaire", "Linge fourni"]),
  ("terrasse-01", "La terrasse et le bassin",
   "Une pergola, un lit de repos qui reçoit l'ombre l'après-midi, et un bassin de nage "
   "de douze mètres bordé de béton lissé. Au-delà, la pelouse descend jusqu'aux rochers.",
   ["Bassin de 12 m", "Pergola", "Plancha", "Douche extérieure"]),
]


# Profils des auteurs : la licence Unsplash n'exige pas l'attribution, mais
# on la donne — et un lien vérifiable vaut mieux qu'un nom seul.
PROFILS = {
  "Luis J. Corniel":       "https://unsplash.com/@luisjcorniel",
  "SPX Clicks":            "https://unsplash.com/@spxclicks",
  "Protex Plastering":     "https://unsplash.com/@protexplastering",
  "Kath MZ":               "https://unsplash.com/@kathmz",
  "Toma Ha":               "https://unsplash.com/@toma_ha",
  "Pexels — vue aérienne": "https://www.pexels.com/",
}
# Les plans aériens viennent de vidéos : on renvoie vers la vidéo source.
VIDEOS = {"ciel-01": "17404328", "ciel-02": "31931883", "ciel-03": "37841349",
          "ciel-04": "37957946", "ciel-05": "38094658"}


FINE = "\u202f"        # espace fine insécable : séparateur de milliers et
                       # espace avant le symbole monétaire, en typographie française


def euro(n):
    return format(int(n), ",d").replace(",", FINE) + FINE + "€"


def bloc_galerie():
    out = []
    for cle in ORDRE:
        f = MAN.get(cle)
        if not f:
            continue
        w = 640
        h = round(f["h"] * w / f["w"])
        out.append(
          '<figure>\n'
          '  <a href="assets/img/{c}-g.webp" data-cle="{c}">\n'
          '    <picture>\n'
          '      <source type="image/avif" srcset="assets/img/{c}-v.avif">\n'
          '      <img src="assets/img/{c}-v.webp" alt="{a}" width="{w}" height="{h}"\n'
          '           loading="lazy" decoding="async"\n'
          '           style="background:url({l}) center/cover">\n'
          '    </picture>\n'
          '    <figcaption>{p}</figcaption>\n'
          '  </a>\n'
          '</figure>'.format(c=cle, a=f["piece"], w=w, h=h, l=f["lqip"], p=f["piece"]))
    return "\n".join(out)


def bloc_pieces():
    out = []
    for cle, titre, texte, tags in PIECES:
        f = MAN.get(cle)
        if not f:
            continue
        li = "".join("<li>%s</li>" % t for t in tags)
        out.append(
          '<article class="piece revele">\n'
          '  <div class="piece__vue">\n'
          '    <picture>\n'
          '      <source type="image/avif" srcset="assets/img/{c}-g.avif" media="(min-width:761px)">\n'
          '      <source type="image/avif" srcset="assets/img/{c}-v.avif">\n'
          '      <img src="assets/img/{c}-v.webp" alt="{t}" loading="lazy" decoding="async"\n'
          '           style="background:url({l}) center/cover">\n'
          '    </picture>\n'
          '  </div>\n'
          '  <div>\n'
          '    <h3>{t}</h3>\n'
          '    <p>{x}</p>\n'
          '    <ul>{li}</ul>\n'
          '  </div>\n'
          '</article>'.format(c=cle, t=titre, x=texte, li=li, l=f["lqip"]))
    return "\n".join(out)


def bloc_tarifs():
    t = CFG["tarifs"]
    cartes = []
    for i, s in enumerate(t["saisons"]):
        fort = ' tarif--fort' if s["cle"] == "haute" else ''
        mini = s.get("nuitsMini", t["nuitsMini"])
        cartes.append(
          '<div class="tarif{f} revele">\n'
          '  <p class="tarif__periode">{p}</p>\n'
          '  <p class="tarif__prix">{x}<small> / semaine</small></p>\n'
          '  <p style="margin:.2rem 0 0; font-size:.85rem; opacity:.75">{n} — {m} nuits minimum</p>\n'
          '</div>'.format(f=fort, p=s["periode"], x=euro(s["prix"]), n=s["nom"], m=mini))
    return '<div class="tarifs">\n%s\n</div>' % "\n".join(cartes)


def bloc_conditions():
    t, b = CFG["tarifs"], CFG["bien"]
    tx = t["taxeSejour"]
    return (
      '<table class="tableau revele">\n'
      '  <caption class="vh">Conditions tarifaires</caption>\n'
      '  <thead><tr><th scope="col">Poste</th><th scope="col">Montant</th></tr></thead>\n'
      '  <tbody>\n'
      '    <tr><td>Acompte à la réservation</td><td>{a} % du séjour</td></tr>\n'
      '    <tr><td>Solde</td><td>30 jours avant l\'arrivée</td></tr>\n'
      '    <tr><td>Ménage de fin de séjour</td><td>{m}</td></tr>\n'
      '    <tr><td>Dépôt de garantie (empreinte, non débitée)</td><td>{c}</td></tr>\n'
      '    <tr><td>Taxe de séjour</td><td>{t} % du prix de la nuitée, '
      'plafonnée à {p} par personne et par nuit</td></tr>\n'
      '    <tr><td>Capacité maximale</td><td>{v} voyageurs</td></tr>\n'
      '  </tbody>\n'
      '</table>\n'
      '<p class="avertissement" style="margin-top:1.5rem">\n'
      '  Meublé de tourisme {cl}, déclaré sous le numéro <strong>{e}</strong>. '
      'Le taux de la taxe de séjour est fixé par la Collectivité de Saint-Martin&nbsp;: '
      '{note}\n'
      '</p>'.format(a=t["acomptePourcent"], m=euro(t["menage"]), c=euro(t["cautionDepot"]),
                    t=tx["taux"], p=("%.2f €" % tx["plafondParPersonneParNuit"]).replace(".", ","),
                    v=b["voyageurs"], cl=b["classement"], e=b["enregistrement"],
                    note=tx["note"]))


def bloc_pied():
    c, b, m = CFG["contact"], CFG["bien"], CFG["marque"]
    return (
      '<footer class="pied">\n'
      '  <div class="page">\n'
      '    <div class="pied__grille">\n'
      '      <div>\n'
      '        <h3>{n}</h3>\n'
      '        <p style="max-width:38ch; opacity:.8">Meublé de tourisme de {ch} chambres '
      'pour {v} voyageurs, aux Terres Basses, à Saint-Martin.</p>\n'
      '        <p style="opacity:.8">N° de déclaration&nbsp;: {e}</p>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h3>Contact</h3>\n'
      '        <ul>\n'
      '          <li><a href="tel:{tl}">{t}</a></li>\n'
      '          <li><a href="mailto:{cm}">{cm}</a></li>\n'
      '          <li style="opacity:.8">{ad}</li>\n'
      '        </ul>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h3>Le site</h3>\n'
      '        <ul>\n'
      '          <li><a href="index.html#maison">La maison</a></li>\n'
      '          <li><a href="index.html#galerie">Galerie</a></li>\n'
      '          <li><a href="reserver.html">Disponibilités et réservation</a></li>\n'
      '          <li><a href="mentions.html">Mentions légales et crédits</a></li>\n'
      '        </ul>\n'
      '      </div>\n'
      '    </div>\n'
      '    <p class="mention-fictif">\n'
      '      <strong>Site de démonstration.</strong> La Villa Alizéa est une propriété '
      'fictive&nbsp;: le nom, les textes, les tarifs et le numéro de déclaration ont été '
      'inventés pour cette maquette, et les photographies proviennent de banques d\'images '
      'libres de droits — le détail figure dans les '
      '<a href="mentions.html">mentions légales</a>. Aucun établissement réel n\'est représenté.\n'
      '    </p>\n'
      '    <div class="pied__bas">\n'
      '      <span>© 2026 {n} — maquette</span>\n'
      '      <span><a href="mentions.html">Mentions légales</a> · '
      '<a href="mentions.html#credits">Crédits photo</a></span>\n'
      '    </div>\n'
      '  </div>\n'
      '</footer>'.format(n=m["nom"], ch=b["chambres"], v=b["voyageurs"], e=b["enregistrement"],
                         t=c["telephone"], tl=c["telephoneLien"], cm=c["courriel"],
                         ad=c["adresse"]))


def _lien(cle, f):
    if cle in VIDEOS:
        return "https://www.pexels.com/video/x-%s/" % VIDEOS[cle]
    return PROFILS.get(f["auteur"], "")


def bloc_credits():
    """Regroupe les images par auteur : plus lisible qu'une liste de 27 lignes."""
    par_auteur = {}
    for cle in ORDRE + [k for k in MAN if k not in ORDRE]:
        f = MAN.get(cle)
        if not f:
            continue
        par_auteur.setdefault((f["auteur"], f["licence"]), []).append((cle, f))
    out = ['<table class="tableau">',
           '  <caption class="vh">Provenance des photographies</caption>',
           '  <thead><tr><th scope="col">Auteur</th><th scope="col">Vues</th>'
           '<th scope="col">Licence</th></tr></thead>', '  <tbody>']
    for (auteur, licence), images in sorted(par_auteur.items()):
        lien = PROFILS.get(auteur, "")
        nom = ('<a href="%s" rel="noopener">%s</a>' % (lien, auteur)) if lien else auteur
        legendes = ", ".join(sorted({f["piece"] for _, f in images}))
        out.append('    <tr><td>%s</td><td style="text-align:left">%s <em>(%d)</em></td>'
                   '<td>%s</td></tr>' % (nom, legendes, len(images), licence))
    out += ['  </tbody>', '</table>']
    return "\n".join(out)


def ecrire_credits_js():
    """Légendes de crédit affichées sous chaque photo de la visionneuse."""
    d = {}
    for cle in ORDRE:
        f = MAN.get(cle)
        if f:
            d[cle] = "Photo : %s — licence %s" % (f["auteur"], f["licence"])
    chemin = os.path.join(RACINE, "js", "credits.js")
    contenu = ("/* GÉNÉRÉ par construire.py — ne pas modifier à la main.\n"
               "   Crédits affichés sous chaque photo de la visionneuse. */\n"
               "window.ALIZEA_CREDITS = %s;\n"
               % json.dumps(d, ensure_ascii=False, indent=1))
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if contenu != ancien:
        open(chemin, "w", encoding="utf-8").write(contenu)
        return True
    return False


BLOCS = {"GALERIE": bloc_galerie, "PIECES": bloc_pieces, "TARIFS": bloc_tarifs,
         "CONDITIONS": bloc_conditions, "PIED": bloc_pied, "CREDITS": bloc_credits}


def appliquer(chemin, verifie=False):
    s = ancien = open(chemin, encoding="utf-8").read()
    touche = []
    for nom, fn in BLOCS.items():
        motif = re.compile(r"(<!-- %s:debut -->).*?(<!-- %s:fin -->)" % (nom, nom), re.S)
        if not motif.search(s):
            continue
        s, n = motif.subn(lambda mo: mo.group(1) + "\n" + fn() + "\n" + mo.group(2), s)
        if n != 1:
            raise SystemExit("%s : repère %s introuvable ou en double — "
                             "le générateur ne peut pas écrire." % (chemin, nom))
        touche.append(nom)
    if s != ancien and not verifie:
        open(chemin, "w", encoding="utf-8").write(s)
    return touche, s != ancien


def main():
    verifie = "--verifie" in sys.argv
    pages = [f for f in sorted(os.listdir(RACINE)) if f.endswith(".html")]
    for p in pages:
        touche, change = appliquer(os.path.join(RACINE, p), verifie)
        if touche:
            print("%-16s %s%s" % (p, ", ".join(touche), "  (modifié)" if change else "  (à jour)"))
    if ecrire_credits_js():
        print("%-16s réécrit" % "js/credits.js")
    print("\n%d images dans la galerie." % len([c for c in ORDRE if c in MAN]))
    manque = [c for c in ORDRE if c not in MAN]
    if manque:
        print("ABSENTES du manifeste :", ", ".join(manque))


if __name__ == "__main__":
    main()
