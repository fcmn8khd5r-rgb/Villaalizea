#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les blocs répétés des pages, à partir de config/villa.json et
src/manifeste.json.

Un prix, une coordonnée, une distance ou une légende ne s'écrivent qu'à un
seul endroit. `python3 construire.py --verifie` contrôle sans rien écrire.
"""
import json, os, re, sys

RACINE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(RACINE, "config/villa.json"), encoding="utf-8"))
MAN = json.load(open(os.path.join(RACINE, "src/manifeste.json"), encoding="utf-8"))

FINE = " "        # espace fine insécable : milliers, avant € et : ! ? »

PAGES = [("la-villa.html", "La villa"), ("galerie.html", "Galerie"),
         ("l-ile.html", "L'île"), ("le-sejour.html", "Le séjour")]

# Profils des auteurs. La licence Unsplash n'exige pas l'attribution ; on la
# donne quand même, et un lien vérifiable vaut mieux qu'un nom seul.
PROFILS = {
  "Luis J. Corniel": "https://unsplash.com/@luisjcorniel",
  "SPX Clicks": "https://unsplash.com/@spxclicks",
  "Protex Plastering": "https://unsplash.com/@protexplastering",
  "Kath MZ": "https://unsplash.com/@kathmz",
  "Toma Ha": "https://unsplash.com/@toma_ha",
  "The Anam": "https://unsplash.com/@theanamcxr",
  "David Vives": "https://unsplash.com/@davidvives",
  "Nelya T": "https://unsplash.com/@nelyat",
  "Uda Tommo": "https://unsplash.com/@udatommo",
  "Erik Magkekse": "https://unsplash.com/@erikmagkekse",
  "Natural AI": "https://unsplash.com/@naturalai",
  "Pexels": "https://www.pexels.com/",
}

GROUPES = [("sejour", "Séjour et cuisine"), ("cuisine", "Séjour et cuisine"),
           ("chambres", "Chambres"), ("bain", "Salles d'eau"),
           ("exterieur", "Dehors"), ("detail", "Détails")]
ONGLETS = [("tout", "Tout"), ("sejour", "Séjour et cuisine"), ("chambres", "Chambres"),
           ("bain", "Salles d'eau"), ("exterieur", "Dehors"), ("detail", "Détails")]

# Ordre de la mosaïque : on alterne les registres pour ne pas aligner quatre
# chambres de suite.
ORDRE = ["sejour-01", "terrasse-02", "chambre-01", "cuisine-01", "ciel-01", "bain-02",
         "chambre-03", "detail-02", "sejour-02", "terrasse-01", "piscine-01", "chambre-02",
         "bain-01", "cuisine-02", "detail-01", "sejour-03", "terrasse-03", "chambre-04",
         "bureau-01", "detail-03", "chambre-05", "sejour-04", "detail-04"]

PIECES = [
  ("sejour-02", "Le séjour",
   "Soixante mètres carrés sans une cloison, sous un plafond qui monte jusqu'à la panne "
   "faîtière. Les baies coulissent entièrement dans le mur : le séjour et la terrasse "
   "cessent alors d'être deux pièces.",
   ["60 m²", "Plafond cathédrale", "Baies à galandage", "Ventilateurs de plafond"]),
  ("cuisine-01", "La cuisine",
   "Un plan de quatre mètres en béton ciré, une table d'hôte en bois de récupération, et "
   "tout ce qu'il faut pour ne pas sortir dîner : plaque à induction, four, "
   "lave-vaisselle, machine à café et cave à vin.",
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
   "Une pergola, un lit de repos qui reçoit l'ombre l'après-midi, et un bassin de nage de "
   "douze mètres bordé de béton lissé. Au-delà, la pelouse descend jusqu'aux rochers.",
   ["Bassin de 12 m", "Pergola", "Plancha", "Douche extérieure"]),
]

MARQUES = {
  "airbnb":  ("#FF5A5F", "a", "Airbnb"),
  "booking": ("#003580", "B", "Booking.com"),
  "google":  ("#4285F4", "G", "Google"),
}


def euro(n):
    return format(int(n), ",d").replace(",", FINE) + FINE + "€"


# ---------------------------------------------------------------- blocs ----
def bloc_tete(page):
    liens = "".join(
      '\n      <a href="%s"%s>%s</a>' % (f, ' aria-current="page"' if f == page else "", t)
      for f, t in PAGES)
    tiroir = "".join('\n  <a href="%s">%s</a>' % (f, t) for f, t in PAGES)
    return (
      '<a class="evitement" href="#contenu">Aller au contenu</a>\n'
      '<header class="tete">\n'
      '  <a class="marque" href="index.html">%s</a>\n'
      '  <nav class="menu" aria-label="Principale">%s\n'
      '  </nav>\n'
      '  <a class="btn" href="reserver.html"%s>Réserver</a>\n'
      '  <button class="burger" type="button" aria-expanded="false" aria-controls="tiroir"\n'
      '          aria-label="Ouvrir le menu"><i></i></button>\n'
      '</header>\n'
      '<div class="tiroir" id="tiroir" hidden>\n'
      '  <button class="tiroir__x" type="button" aria-label="Fermer le menu">&times;</button>'
      '%s\n  <a href="reserver.html">Réserver</a>\n</div>'
      % (CFG["marque"]["nom"], liens,
         ' aria-current="page"' if page == "reserver.html" else "", tiroir))


def bloc_pied():
    c, b, m = CFG["contact"], CFG["bien"], CFG["marque"]
    return (
      '<footer class="pied">\n'
      '  <div class="page">\n'
      '    <div class="pied__grille">\n'
      '      <div>\n'
      '        <p class="pied__marque">%s</p>\n'
      '        <p style="max-width:36ch; opacity:.82">Meublé de tourisme de %d chambres pour '
      '%d voyageurs, aux Terres Basses, à Saint-Martin.</p>\n'
      '        <p style="opacity:.82">N° de déclaration : %s</p>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h3>Contact</h3>\n'
      '        <ul>\n'
      '          <li><a href="tel:%s">%s</a></li>\n'
      '          <li><a href="mailto:%s">%s</a></li>\n'
      '          <li style="opacity:.82">%s</li>\n'
      '        </ul>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h3>Le site</h3>\n'
      '        <ul>\n'
      '          <li><a href="la-villa.html">La villa</a></li>\n'
      '          <li><a href="galerie.html">Galerie</a></li>\n'
      '          <li><a href="l-ile.html">L\'île</a></li>\n'
      '          <li><a href="le-sejour.html">Le séjour</a></li>\n'
      '          <li><a href="reserver.html">Réserver</a></li>\n'
      '          <li><a href="mentions.html">Mentions légales</a></li>\n'
      '        </ul>\n'
      '      </div>\n'
      '    </div>\n'
      '    <p class="fictif"><strong>Site de démonstration.</strong> La Villa Alizéa est une '
      'propriété fictive : le nom, les textes, les tarifs, les avis et le numéro de '
      'déclaration ont été inventés pour cette maquette, et les photographies proviennent de '
      'banques d\'images libres de droits. Le détail figure dans les '
      '<a href="mentions.html">mentions légales</a>. Aucun établissement réel n\'est représenté.</p>\n'
      '    <div class="pied__bas">\n'
      '      <span>© 2026 %s — maquette</span>\n'
      '      <span><a href="mentions.html">Mentions légales</a> · '
      '<a href="mentions.html#credits">Crédits photo</a></span>\n'
      '    </div>\n'
      '  </div>\n'
      '</footer>'
      % (m["nom"], b["chambres"], b["voyageurs"], b["enregistrement"],
         c["telephoneLien"], c["telephone"], c["courriel"], c["courriel"], c["adresse"],
         m["nom"]))


def _img(cle, taille="v", classe="", ratio="", anim=True, large=False):
    f = MAN[cle]
    suff = "g" if large else taille
    src2 = ('\n      <source type="image/avif" srcset="assets/img/%s-g.avif" media="(min-width:820px)">'
            % cle) if large else ""
    return (
      '<div class="cadre %s"%s>\n'
      '    <picture>%s\n'
      '      <source type="image/avif" srcset="assets/img/%s-%s.avif">\n'
      '      <img src="assets/img/%s-%s.webp" alt="%s" loading="lazy" decoding="async"\n'
      '           style="background:url(%s) center/cover">\n'
      '    </picture>\n'
      '  </div>' % (ratio + (" " + classe if classe else ""),
                    ' data-anim="volet"' if anim else "",
                    src2, cle, suff, cle, suff, f["piece"], f["lqip"]))


def bloc_pieces():
    out = []
    for i, (cle, titre, texte, tags) in enumerate(PIECES):
        li = "".join('<li>%s</li>' % t for t in tags)
        vue = _img(cle, ratio="cadre--4-3", large=True)
        bloc = (
          '<article class="duo%s" style="margin-bottom:clamp(3rem,7vw,5.5rem)">\n'
          '  %s\n'
          '  <div data-anim>\n'
          '    <p class="oeil">%02d</p>\n'
          '    <h3>%s</h3>\n'
          '    <p class="mince">%s</p>\n'
          '    <ul class="etiquettes">%s</ul>\n'
          '  </div>\n'
          '</article>' % (" duo--inverse" if i % 2 else "", vue, i + 1, titre, texte, li))
        out.append(bloc)
    return "\n".join(out)


def bloc_galerie():
    out = []
    for cle in ORDRE:
        f = MAN.get(cle)
        if not f:
            continue
        w = 640
        h = round(f["h"] * w / f["w"])
        out.append(
          '<figure data-groupe="%s" data-anim>\n'
          '  <a href="assets/img/%s-g.webp" data-cle="%s">\n'
          '    <picture>\n'
          '      <source type="image/avif" srcset="assets/img/%s-v.avif">\n'
          '      <img src="assets/img/%s-v.webp" alt="%s" width="%d" height="%d"\n'
          '           loading="lazy" decoding="async"\n'
          '           style="background:url(%s) center/cover">\n'
          '    </picture>\n'
          '    <figcaption>%s</figcaption>\n'
          '  </a>\n'
          '</figure>' % (f["groupe"], cle, cle, cle, cle, f["piece"], w, h, f["lqip"], f["piece"]))
    return "\n".join(out)


def bloc_onglets():
    return "".join(
      '<button type="button" class="onglet%s" data-filtre="%s">%s</button>\n'
      % (" est-actif" if c == "tout" else "", c, t) for c, t in ONGLETS)


def bloc_apercu():
    """Six vues sur l'accueil, chacune menant à la galerie complète."""
    choix = ["sejour-01", "terrasse-02", "chambre-01", "bain-02", "cuisine-01", "detail-02"]
    out = []
    for c in choix:
        f = MAN[c]
        out.append(
          '<a class="apercu__item" href="galerie.html" data-anim="volet"\n'
          '   aria-label="%s — voir la galerie">\n'
          '  <picture>\n'
          '    <source type="image/avif" srcset="assets/img/%s-v.avif">\n'
          '    <img src="assets/img/%s-v.webp" alt="%s" loading="lazy" decoding="async"\n'
          '         style="background:url(%s) center/cover">\n'
          '  </picture>\n'
          '</a>' % (f["piece"], c, c, f["piece"], f["lqip"]))
    return "\n".join(out)


def bloc_ile():
    out = []
    for i, l in enumerate(CFG["ile"]):
        f = MAN.get(l["cle"])
        if not f:
            continue
        media = ""
        if l.get("video"):
            media = (
              '<div class="cadre cadre--4-3" data-anim="volet">\n'
              '    <video data-auto muted loop playsinline preload="none"\n'
              '           poster="assets/img/%s-g.webp" style="width:100%%; aspect-ratio:4/3; object-fit:cover"\n'
              '           aria-label="Baie Longue, vue du ciel">\n'
              '      <source src="assets/video/baie-longue-720.mp4" type="video/mp4"\n'
              '              media="(max-width: 700px)">\n'
              '      <source src="assets/video/baie-longue.mp4" type="video/mp4">\n'
              '    </video>\n'
              '  </div>' % l["cle"])
        else:
            media = _img(l["cle"], ratio="cadre--4-3", large=True)
        trajets = (
          '<dl class="trajets">'
          '<div><dt>Distance</dt><dd>%s km</dd></div>'
          '<div><dt>À pied</dt><dd>%s</dd></div>'
          '<div><dt>En voiture</dt><dd>%s</dd></div>'
          '</dl>' % (str(l["km"]).replace(".", ","), l["pied"], l["voiture"]))
        out.append(
          '<article class="duo%s lieu">\n'
          '  %s\n'
          '  <div data-anim>\n'
          '    <p class="oeil">%s</p>\n'
          '    <h3>%s</h3>\n'
          '    <p class="mince">%s</p>\n'
          '    %s\n'
          '  </div>\n'
          '</article>' % (" duo--inverse" if i % 2 else "", media,
                          l["sousTitre"], l["nom"], l["texte"], trajets))
    return "\n".join(out)


def _etoiles(note, sur=5):
    n = round(note * 5 / sur)
    return ('<span class="etoiles" aria-hidden="true">%s%s</span>'
            '<span class="vh">%s sur %s</span>'
            % ("★" * n, "☆" * (5 - n), str(note).replace(".", ","), sur))


def bloc_avis(limite=None):
    a = CFG["avis"]
    liste = a["liste"][:limite] if limite else a["liste"]
    cartes = []
    for v in liste:
        coul, lettre, nom = MARQUES[v["source"]]
        sur = v.get("sur", 5)
        cartes.append(
          '<article class="avis" data-anim>\n'
          '  <div class="avis__tete">\n'
          '    <span class="marque-pf" style="--pf:%s" aria-hidden="true">%s</span>\n'
          '    <span class="avis__source">%s</span>\n'
          '    <span class="avis__date">%s</span>\n'
          '  </div>\n'
          '  <p class="avis__note">%s <b>%s/%d</b></p>\n'
          '  <p class="avis__texte">%s</p>\n'
          '  <p class="avis__auteur">%s</p>\n'
          '</article>' % (coul, lettre, nom, v["date"], _etoiles(v["note"], sur),
                          str(v["note"]).replace(".", ","), sur, v["texte"], v["auteur"]))
    return "\n".join(cartes)


def bloc_avis_tete():
    a = CFG["avis"]
    pf = "".join(
      '<div class="pf"><span class="marque-pf" style="--pf:%s" aria-hidden="true">%s</span>'
      '<span><b>%s</b>/%d<small>%d avis sur %s</small></span></div>'
      % (MARQUES[p["cle"]][0], MARQUES[p["cle"]][1],
         str(p["note"]).replace(".", ","), p.get("sur", 5), p["nb"], p["nom"])
      for p in a["plateformes"])
    return ('<div class="avis-tete" data-anim>\n'
            '  <p class="avis-note"><b data-compte="%s" data-decimales="1">%s</b>'
            '<span>sur 5</span></p>\n'
            '  <div class="pf-liste">%s</div>\n'
            '</div>' % (a["note"], str(a["note"]).replace(".", ","), pf))


def bloc_tarifs():
    t = CFG["tarifs"]
    cartes = []
    for s in t["saisons"]:
        mini = s.get("nuitsMini", t["nuitsMini"])
        cartes.append(
          '<div class="tarif%s" data-anim>\n'
          '  <p class="oeil">%s</p>\n'
          '  <p class="tarif__prix">%s<small>/ semaine</small></p>\n'
          '  <p class="tarif__nom">%s</p>\n'
          '  <p class="tarif__mini">%d nuits minimum</p>\n'
          '</div>' % (" tarif--fort" if s["cle"] == "haute" else "",
                      s["periode"], euro(s["prix"]), s["nom"], mini))
    return '<div class="tarifs">\n%s\n</div>' % "\n".join(cartes)


def bloc_conditions():
    t, b = CFG["tarifs"], CFG["bien"]
    tx = t["taxeSejour"]
    return (
      '<table class="table" data-anim>\n'
      '  <caption class="vh">Conditions tarifaires</caption>\n'
      '  <thead><tr><th scope="col">Poste</th><th scope="col">Montant</th></tr></thead>\n'
      '  <tbody>\n'
      '    <tr><td>Acompte à la réservation</td><td>%d %% du séjour</td></tr>\n'
      '    <tr><td>Solde</td><td>30 jours avant l\'arrivée</td></tr>\n'
      '    <tr><td>Ménage de fin de séjour</td><td>%s</td></tr>\n'
      '    <tr><td>Dépôt de garantie (empreinte, non débitée)</td><td>%s</td></tr>\n'
      '    <tr><td>Taxe de séjour</td><td>%d %% du prix de la nuitée, '
      'plafonnée à %s par personne et par nuit</td></tr>\n'
      '    <tr><td>Capacité maximale</td><td>%d voyageurs</td></tr>\n'
      '    <tr><td>Transfert depuis l\'aéroport</td><td>%s, %s</td></tr>\n'
      '  </tbody>\n'
      '</table>\n'
      '<p class="note" style="margin-top:1.6rem" data-anim>Meublé de tourisme %s, déclaré sous '
      'le numéro <strong>%s</strong>. Le taux de la taxe de séjour est fixé par la Collectivité '
      'de Saint-Martin : %s</p>'
      % (t["acomptePourcent"], euro(t["menage"]), euro(t["cautionDepot"]),
         tx["taux"], ("%.2f" % tx["plafondParPersonneParNuit"]).replace(".", ",") + FINE + "€",
         b["voyageurs"], CFG["acces"]["voiture"], CFG["acces"]["note"],
         b["classement"], b["enregistrement"], tx["note"]))


def bloc_credits():
    par = {}
    for cle in ORDRE + [k for k in MAN if k not in ORDRE]:
        f = MAN.get(cle)
        if not f:
            continue
        par.setdefault((f["auteur"], f["licence"]), []).append(f)
    out = ['<table class="table">',
           '  <caption class="vh">Provenance des photographies</caption>',
           '  <thead><tr><th scope="col">Auteur</th><th scope="col">Vues</th>'
           '<th scope="col">Licence</th></tr></thead>', '  <tbody>']
    for (auteur, licence), images in sorted(par.items()):
        lien = PROFILS.get(auteur, "")
        nom = ('<a href="%s" rel="noopener">%s</a>' % (lien, auteur)) if lien else auteur
        legendes = ", ".join(sorted({f["piece"] for f in images}))
        out.append('    <tr><td>%s</td><td style="text-align:left">%s <em>(%d)</em></td>'
                   '<td>%s</td></tr>' % (nom, legendes, len(images), licence))
    out += ['  </tbody>', '</table>']
    return "\n".join(out)


def ecrire_credits_js():
    d = {c: "Photo : %s — licence %s" % (MAN[c]["auteur"], MAN[c]["licence"])
         for c in ORDRE if c in MAN}
    chemin = os.path.join(RACINE, "js", "credits.js")
    contenu = ("/* GÉNÉRÉ par construire.py — ne pas modifier à la main.\n"
               "   Crédits affichés sous chaque photo de la visionneuse. */\n"
               "window.ALIZEA_CREDITS = %s;\n" % json.dumps(d, ensure_ascii=False, indent=1))
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if contenu != ancien:
        open(chemin, "w", encoding="utf-8").write(contenu)
        return True
    return False


BLOCS = {
  "PIED": lambda page: bloc_pied(),
  "TETE": bloc_tete,
  "PIECES": lambda page: bloc_pieces(),
  "GALERIE": lambda page: bloc_galerie(),
  "ONGLETS": lambda page: bloc_onglets(),
  "ILE": lambda page: bloc_ile(),
  "AVIS": lambda page: bloc_avis(),
  "AVIS3": lambda page: bloc_avis(3),
  "AVISTETE": lambda page: bloc_avis_tete(),
  "APERCU": lambda page: bloc_apercu(),
  "TARIFS": lambda page: bloc_tarifs(),
  "CONDITIONS": lambda page: bloc_conditions(),
  "CREDITS": lambda page: bloc_credits(),
}


def appliquer(chemin, verifie=False):
    nom = os.path.basename(chemin)
    s = ancien = open(chemin, encoding="utf-8").read()
    touche = []
    for bloc, fn in BLOCS.items():
        motif = re.compile(r"(<!-- %s:debut -->).*?(<!-- %s:fin -->)" % (bloc, bloc), re.S)
        if not motif.search(s):
            continue
        s, n = motif.subn(lambda mo: mo.group(1) + "\n" + fn(nom) + "\n" + mo.group(2), s)
        if n != 1:
            raise SystemExit("%s : repère %s introuvable ou en double — "
                             "le générateur ne peut pas écrire." % (nom, bloc))
        touche.append(bloc)
    if s != ancien and not verifie:
        open(chemin, "w", encoding="utf-8").write(s)
    return touche, s != ancien


def main():
    verifie = "--verifie" in sys.argv
    for p in sorted(f for f in os.listdir(RACINE) if f.endswith(".html")):
        touche, change = appliquer(os.path.join(RACINE, p), verifie)
        if touche:
            print("%-20s %s%s" % (p, ", ".join(touche), "  (modifié)" if change else "  (à jour)"))
    if not verifie and ecrire_credits_js():
        print("%-20s réécrit" % "js/credits.js")
    manque = [c for c in ORDRE if c not in MAN]
    print("\n%d vues dans la galerie, %d lieux sur la page de l'île."
          % (len([c for c in ORDRE if c in MAN]), len(CFG["ile"])))
    if manque:
        print("ABSENTES du manifeste :", ", ".join(manque))


if __name__ == "__main__":
    main()
