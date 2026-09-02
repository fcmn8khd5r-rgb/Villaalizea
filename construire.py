#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les blocs répétés des pages, à partir de config/villa.json et
src/manifeste.json.

Un prix, une coordonnée, une distance ou une légende ne s'écrivent qu'à un
seul endroit. `python3 construire.py --verifie` contrôle sans rien écrire.
"""
import hashlib
import json, os, re, sys

RACINE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(RACINE, "config/villa.json"), encoding="utf-8"))
MAN = json.load(open(os.path.join(RACINE, "src/manifeste.json"), encoding="utf-8"))

# ------------------------------------------------------------- bilingue ----
# Le français vit à la racine, l'anglais sous /en/. C'est la racine qu'on
# partage aux propriétaires francophones : s'ils atterrissaient en anglais,
# la démonstration manquerait sa cible. L'anglais n'en est pas moins un site
# entier — mêmes pages, mêmes blocs, indexé séparément.
LANGUES = ("fr", "en")

# Les légendes des images vivent dans src/manifeste.json, que src/traiter.py
# réécrit à chaque traitement d'images : on ne les traduit pas là, mais à côté.
_leg = os.path.join(RACINE, "config/legendes-en.json")
LEGENDES_EN = json.load(open(_leg, encoding="utf-8")) if os.path.exists(_leg) else {}


def T(v, lg):
    """Résout un champ éventuellement bilingue.

    Un champ traduit s'écrit {"fr": …, "en": …} ; tout le reste — une URL, un
    nombre, une couleur — traverse sans être touché. Le français sert de repli
    tant qu'une traduction manque, ce qui vaut mieux qu'un trou dans la page."""
    if isinstance(v, dict) and "fr" in v:
        return v.get(lg) or v["fr"]
    return v


def legende(cle, lg):
    """Légende d'une image, traduite si on l'a."""
    fr = MAN[cle]["piece"]
    return LEGENDES_EN.get(cle, fr) if lg == "en" else fr


def lien(nom, lg):
    """Adresse absolue d'une page dans une langue donnée.

    Absolue, et non relative : les pages anglaises vivent un cran plus bas et
    un chemin relatif y désignerait autre chose."""
    base = "/" if lg == "fr" else "/en/"
    return base if nom == "index.html" else base + nom

FINE = " "        # espace fine insécable : milliers, avant € et : ! ? »

PAGES = {
  "fr": [("la-villa.html", "La villa"), ("galerie.html", "Galerie"),
         ("l-ile.html", "L'île"), ("le-sejour.html", "Le séjour")],
  "en": [("la-villa.html", "The villa"), ("galerie.html", "Gallery"),
         ("l-ile.html", "The island"), ("le-sejour.html", "Your stay")],
}

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

GROUPES = [("sejour",    {"fr": "Séjour et cuisine", "en": "Living and kitchen"}),
           ("cuisine",   {"fr": "Séjour et cuisine", "en": "Living and kitchen"}),
           ("chambres",  {"fr": "Chambres",          "en": "Bedrooms"}),
           ("bain",      {"fr": "Salles d'eau",      "en": "Bathrooms"}),
           ("exterieur", {"fr": "Dehors",            "en": "Outdoors"}),
           ("detail",    {"fr": "Détails",           "en": "Details"})]
ONGLETS = [("tout",      {"fr": "Tout",            "en": "All"}),
           ("sejour",    {"fr": "Séjour et cuisine", "en": "Living and kitchen"}),
           ("chambres",  {"fr": "Chambres",          "en": "Bedrooms"}),
           ("bain",      {"fr": "Salles d'eau",      "en": "Bathrooms"}),
           ("exterieur", {"fr": "Dehors",            "en": "Outdoors"}),
           ("detail",    {"fr": "Détails",           "en": "Details"})]

# Ordre de la mosaïque : on alterne les registres pour ne pas aligner quatre
# chambres de suite.
# La galerie ne montre plus aucune vue aérienne : celle qui s'y trouvait
# était une villa blanche à piscine, qui n'est pas celle des intérieurs. Une
# galerie intitulée « la maison » ne peut pas montrer une autre maison.
ORDRE = ["sejour-01", "terrasse-02", "chambre-01", "cuisine-01", "bain-02",
         "chambre-03", "detail-02", "sejour-02", "terrasse-01", "piscine-01", "chambre-02",
         "bain-01", "cuisine-02", "detail-01", "sejour-03", "terrasse-03", "chambre-04",
         "bureau-01", "detail-03", "chambre-05", "sejour-04", "detail-04"]

PIECES = [
  ("sejour-02",
   {"fr": "Le séjour",
    "en": "The living room"},
   {"fr": "Soixante mètres carrés sans une cloison, sous un plafond qui monte jusqu'à la "
          "panne faîtière. Les baies coulissent entièrement dans le mur : le séjour et la "
          "terrasse cessent alors d'être deux pièces.",
    "en": "Sixty square metres without a single partition, under a ceiling that climbs to "
          "the ridge beam. The glass doors slide away into the wall, and the living room "
          "and the terrace stop being two rooms."},
   {"fr": ["60 m²", "Plafond cathédrale", "Baies à galandage", "Ventilateurs de plafond"],
    "en": ["645 sq ft", "Cathedral ceiling", "Pocket glass doors", "Ceiling fans"]}),

  ("cuisine-01",
   {"fr": "La cuisine",
    "en": "The kitchen"},
   {"fr": "Un plan de quatre mètres en béton ciré, une table d'hôte en bois de récupération, "
          "et tout ce qu'il faut pour ne pas sortir dîner : plaque à induction, four, "
          "lave-vaisselle, machine à café et cave à vin.",
    "en": "Four metres of polished concrete worktop, a long table built from reclaimed wood, "
          "and everything you need to skip the restaurant: induction hob, oven, dishwasher, "
          "coffee machine and wine fridge."},
   {"fr": ["Table de 10 couverts", "Induction", "Lave-vaisselle", "Cave à vin"],
    "en": ["Seats 10", "Induction hob", "Dishwasher", "Wine fridge"]}),

  ("chambre-03",
   {"fr": "Les chambres",
    "en": "The bedrooms"},
   {"fr": "Quatre chambres de plain-pied, toutes avec climatisation réversible et "
          "moustiquaire. Trois en lit double, la quatrième en lits jumeaux séparables — "
          "c'est celle que choisissent les familles.",
    "en": "Four bedrooms, all on one level, each with air conditioning and mosquito "
          "screens. Three have a double bed; the fourth has twin beds that separate — "
          "the one families always take."},
   {"fr": ["4 chambres", "8 couchages", "Climatisation", "Moustiquaires"],
    "en": ["4 bedrooms", "Sleeps 8", "Air conditioning", "Mosquito screens"]}),

  ("bain-02",
   {"fr": "Les salles d'eau",
    "en": "The bathrooms"},
   {"fr": "Trois salles d'eau en enduit à la chaux, douches à l'italienne et robinetterie "
          "bronze. L'eau chaude vient du solaire — il y en a toute la journée, sans y penser.",
    "en": "Three bathrooms in lime plaster, with walk-in showers and bronze fittings. The "
          "hot water is solar — there is enough all day, and you never think about it."},
   {"fr": ["3 salles d'eau", "Douches à l'italienne", "Eau chaude solaire", "Linge fourni"],
    "en": ["3 bathrooms", "Walk-in showers", "Solar hot water", "Linen provided"]}),

  ("terrasse-01",
   {"fr": "La terrasse et le bassin",
    "en": "The terrace and the pool"},
   {"fr": "Une pergola, un lit de repos qui reçoit l'ombre l'après-midi, et un bassin de "
          "nage de douze mètres bordé de béton lissé. Au-delà, le jardin de sable et de "
          "cocotiers.",
    "en": "A pergola, a day bed that falls into shade through the afternoon, and a "
          "twelve-metre lap pool edged in smooth concrete. Beyond it, the garden of sand "
          "and coconut palms."},
   {"fr": ["Bassin de 12 m", "Pergola", "Plancha", "Douche extérieure"],
    "en": ["12 m lap pool", "Pergola", "Plancha grill", "Outdoor shower"]}),
]

MARQUES = {
  "airbnb":  ("#FF5A5F", "a", "Airbnb"),
  "booking": ("#003580", "B", "Booking.com"),
  "google":  ("#4285F4", "G", "Google"),
}


def euro(n, lg="fr"):
    """Le français écrit « 3 000 € », l'anglais « €3,000 ».

    Ce n'est pas un détail de forme : un séparateur de milliers qui n'est pas
    celui du lecteur se lit de travers, et un symbole placé du mauvais côté
    signale aussitôt une traduction faite à moitié."""
    if lg == "en":
        return "€" + format(int(n), ",d")
    return format(int(n), ",d").replace(",", FINE) + FINE + "€"


# ---------------------------------------------------------------- blocs ----
# Tout libellé visible passe par TXT : c'est le seul endroit où une phrase de
# l'interface s'écrit, et elle s'y écrit dans les deux langues à la fois. Une
# clé qui n'aurait qu'un français reste affichable — T() retombe dessus.
TXT = {
  "aller_contenu":  {"fr": "Aller au contenu",        "en": "Skip to content"},
  "bandeau_long":   {"fr": "Site de démonstration — la Villa Alizéa n'existe pas",
                     "en": "Demonstration site — Villa Alizéa does not exist"},
  "bandeau_court":  {"fr": "Démonstration — cette villa n'existe pas",
                     "en": "Demonstration — this villa does not exist"},
  "reserver":       {"fr": "Réserver",                "en": "Book"},
  "menu_principal": {"fr": "Principale",              "en": "Main"},
  "ouvrir_menu":    {"fr": "Ouvrir le menu",          "en": "Open menu"},
  "fermer_menu":    {"fr": "Fermer le menu",          "en": "Close menu"},
  "autre_langue":   {"fr": "English",                 "en": "Français"},
  "autre_langue_court": {"fr": "EN",                  "en": "FR"},
  "lire_en":        {"fr": "Read this page in English",
                     "en": "Lire cette page en français"},
  "contact":        {"fr": "Contact",                 "en": "Contact"},
  "le_site":        {"fr": "Le site",                 "en": "The site"},
  "mentions":       {"fr": "Mentions légales",        "en": "Legal notice"},
  "credits_photo":  {"fr": "Crédits photo",           "en": "Photo credits"},
  "maquette":       {"fr": "maquette",                "en": "demonstration"},
  "pied_resume":    {"fr": "Meublé de tourisme de %d chambres pour %d voyageurs, aux Terres "
                           "Basses, à Saint-Martin.",
                     "en": "A registered %d-bedroom holiday rental for %d guests, in Terres "
                           "Basses, Saint-Martin."},
  "pied_declaration": {"fr": "N° de déclaration : %s", "en": "Registration no.: %s"},
  "fictif":         {"fr": "<strong>Site de démonstration.</strong> La Villa Alizéa est une "
                           "propriété fictive : le nom, les textes, les tarifs, les avis et le "
                           "numéro de déclaration ont été inventés pour cette maquette, et les "
                           "photographies proviennent de banques d'images libres de droits. Le "
                           "détail figure dans les <a href=\"%s\">mentions légales</a>. Aucun "
                           "établissement réel n'est représenté.",
                     "en": "<strong>Demonstration site.</strong> Villa Alizéa is a fictional "
                           "property: the name, the texts, the rates, the reviews and the "
                           "registration number were invented for this mock-up, and the "
                           "photographs come from royalty-free image libraries. The detail is "
                           "set out in the <a href=\"%s\">legal notice</a>. No real "
                           "establishment is depicted."},
  "signature":      {"fr": "Site de démonstration réalisé par",
                     "en": "Demonstration site built by"},
  "voir_galerie":   {"fr": "%s — voir la galerie",    "en": "%s — see the gallery"},
  "vue_ciel":       {"fr": "Baie Longue, vue du ciel","en": "Baie Longue, from the air"},
  "distance":       {"fr": "Distance",                "en": "Distance"},
  "a_pied":         {"fr": "À pied",                  "en": "On foot"},
  "en_voiture":     {"fr": "En voiture",              "en": "By car"},
  "sur_cinq":       {"fr": "sur 5",                   "en": "out of 5"},
  "avis_sur":       {"fr": "%d avis sur %s",          "en": "%d reviews on %s"},
  "par_semaine":    {"fr": "/ semaine",               "en": "/ week"},
  "nuits_mini":     {"fr": "%d nuits minimum",        "en": "%d nights minimum"},
  "cond_titre":     {"fr": "Conditions tarifaires",   "en": "Rates and conditions"},
  "cond_poste":     {"fr": "Poste",                   "en": "Item"},
  "cond_montant":   {"fr": "Montant",                 "en": "Amount"},
  "cond_acompte":   {"fr": "Acompte à la réservation","en": "Deposit on booking"},
  "cond_acompte_v": {"fr": "%d %% du séjour",         "en": "%d%% of the stay"},
  "cond_solde":     {"fr": "Solde",                   "en": "Balance"},
  "cond_solde_v":   {"fr": "30 jours avant l'arrivée","en": "30 days before arrival"},
  "cond_menage":    {"fr": "Ménage de fin de séjour", "en": "End-of-stay cleaning"},
  "cond_caution":   {"fr": "Dépôt de garantie (empreinte, non débitée)",
                     "en": "Security deposit (pre-authorisation, not charged)"},
  "cond_taxe":      {"fr": "Taxe de séjour",          "en": "Tourist tax"},
  "cond_taxe_v":    {"fr": "%d %% du prix de la nuitée, plafonnée à %s par personne et par nuit",
                     "en": "%d%% of the nightly rate, capped at %s per person per night"},
  "cond_capacite":  {"fr": "Capacité maximale",       "en": "Maximum occupancy"},
  "cond_capacite_v":{"fr": "%d voyageurs",            "en": "%d guests"},
  "cond_transfert": {"fr": "Transfert depuis l'aéroport", "en": "Transfer from the airport"},
  "cond_note":      {"fr": "Meublé de tourisme %s, déclaré sous le numéro <strong>%s</strong>. "
                           "Le taux de la taxe de séjour est fixé par la Collectivité de "
                           "Saint-Martin : %s",
                     "en": "A registered holiday rental, classified %s, under number "
                           "<strong>%s</strong>. The tourist-tax rate is set by the Collectivité "
                           "de Saint-Martin: %s"},
  "cred_titre":     {"fr": "Provenance des photographies", "en": "Where the photographs come from"},
  "cred_auteur":    {"fr": "Auteur",                  "en": "Photographer"},
  "cred_vues":      {"fr": "Vues",                    "en": "Views"},
  "cred_licence":   {"fr": "Licence",                 "en": "Licence"},
  "ed_titre":       {"fr": "Identité de l'éditeur",   "en": "Publisher"},
  "ed_editeur":     {"fr": "Éditeur",                 "en": "Publisher"},
  "ed_responsable": {"fr": "Responsable de la publication", "en": "Responsible for publication"},
  "ed_adresse":     {"fr": "Adresse",                 "en": "Address"},
  "ed_courriel":    {"fr": "Courriel",                "en": "Email"},
  "ed_telephone":   {"fr": "Téléphone",               "en": "Telephone"},
  "ed_site":        {"fr": "Site",                    "en": "Website"},
  "ed_siren_vide":  {"fr": "Immatriculation en cours","en": "Registration in progress"},
  "ed_hebergement": {"fr": "Hébergement",             "en": "Hosting"},
}


def t(cle, lg):
    return T(TXT[cle], lg)


def bloc_tete(page, lg):
    autre = "en" if lg == "fr" else "fr"
    liens = "".join(
      '\n      <a href="%s"%s>%s</a>'
      % (lien(f, lg), ' aria-current="page"' if f == page else "", nom)
      for f, nom in PAGES[lg])
    tiroir = "".join('\n  <a href="%s">%s</a>' % (lien(f, lg), nom) for f, nom in PAGES[lg])
    return (
      '<a class="evitement" href="#contenu">%s</a>\n'
      '<header class="tete">\n'
      '  <a class="bandeau" href="%s">\n'
      '    <span class="bandeau__long">%s</span>\n'
      '    <span class="bandeau__court">%s</span>\n'
      '  </a>\n'
      '  <div class="tete__barre">\n'
      '    <a class="marque" href="%s">%s</a>\n'
      '    <nav class="menu" aria-label="%s">%s\n'
      '    </nav>\n'
      '    <a class="langue" href="%s" hreflang="%s" lang="%s" aria-label="%s">%s</a>\n'
      '    <a class="btn" href="%s"%s>%s</a>\n'
      '    <button class="burger" type="button" aria-expanded="false" aria-controls="tiroir"\n'
      '            aria-label="%s"><i></i></button>\n'
      '  </div>\n'
      '</header>\n'
      '<div class="tiroir" id="tiroir" hidden>\n'
      '  <button class="tiroir__x" type="button" aria-label="%s">&times;</button>'
      '%s\n  <a href="%s">%s</a>\n'
      '  <a class="tiroir__langue" href="%s" hreflang="%s" lang="%s">%s</a>\n</div>'
      % (t("aller_contenu", lg),
         lien("mentions.html", lg), t("bandeau_long", lg), t("bandeau_court", lg),
         lien("index.html", lg), CFG["marque"]["nom"],
         t("menu_principal", lg), liens,
         lien(page, autre), autre, autre, t("lire_en", lg), t("autre_langue_court", lg),
         lien("reserver.html", lg),
         ' aria-current="page"' if page == "reserver.html" else "", t("reserver", lg),
         t("ouvrir_menu", lg), t("fermer_menu", lg), tiroir,
         lien("reserver.html", lg), t("reserver", lg),
         lien(page, autre), autre, autre, t("autre_langue", lg)))


def bloc_pied(page, lg):
    c, b, m = CFG["contact"], CFG["bien"], CFG["marque"]
    E = CFG["editeur"]
    pages = "".join('\n          <li><a href="%s">%s</a></li>' % (lien(f, lg), nom)
                    for f, nom in PAGES[lg])
    return (
      '<footer class="pied">\n'
      '  <div class="page">\n'
      '    <div class="pied__grille">\n'
      '      <div>\n'
      '        <p class="pied__marque">%s</p>\n'
      '        <p style="max-width:36ch; opacity:.82">%s</p>\n'
      '        <p style="opacity:.82">%s</p>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h2>%s</h2>\n'
      '        <ul>\n'
      '          <li><a href="tel:%s">%s</a></li>\n'
      '          <li><a href="mailto:%s">%s</a></li>\n'
      '          <li style="opacity:.82">%s</li>\n'
      '        </ul>\n'
      '      </div>\n'
      '      <div>\n'
      '        <h2>%s</h2>\n'
      '        <ul>%s\n'
      '          <li><a href="%s">%s</a></li>\n'
      '          <li><a href="%s">%s</a></li>\n'
      '        </ul>\n'
      '      </div>\n'
      '    </div>\n'
      '    <p class="fictif">%s</p>\n'
      '    <p class="pied__signature">%s '
      '<a href="%s" rel="noopener">%s</a> — '
      '<a href="mailto:%s">%s</a> · <a href="tel:%s">%s</a></p>\n'
      '    <div class="pied__bas">\n'
      '      <span>© 2026 %s — %s</span>\n'
      '      <span><a href="%s">%s</a> · '
      '<a href="%s#credits">%s</a></span>\n'
      '    </div>\n'
      '  </div>\n'
      '</footer>'
      % (m["nom"],
         t("pied_resume", lg) % (b["chambres"], b["voyageurs"]),
         t("pied_declaration", lg) % b["enregistrement"],
         t("contact", lg),
         c["telephoneLien"], c["telephone"], c["courriel"], c["courriel"], T(c["adresse"], lg),
         t("le_site", lg), pages,
         lien("reserver.html", lg), t("reserver", lg),
         lien("mentions.html", lg), t("mentions", lg),
         t("fictif", lg) % lien("mentions.html", lg),
         t("signature", lg),
         E["site"], E["studio"], E["courriel"], E["courriel"],
         E["telephoneLien"], E["telephone"],
         m["nom"], t("maquette", lg),
         lien("mentions.html", lg), t("mentions", lg),
         lien("mentions.html", lg), t("credits_photo", lg)))


def _img(cle, lg, taille="v", classe="", ratio="", anim=True, large=False):
    f = MAN[cle]
    suff = "g" if large else taille
    alt = legende(cle, lg)
    src2 = ('\n      <source type="image/avif" srcset="/assets/img/%s-g.avif" media="(min-width:820px)">'
            % cle) if large else ""
    return (
      '<div class="cadre %s"%s>\n'
      '    <picture>%s\n'
      '      <source type="image/avif" srcset="/assets/img/%s-%s.avif">\n'
      '      <img src="/assets/img/%s-%s.webp" alt="%s" width="%d" height="%d"\n'
      '           loading="lazy" decoding="async"\n'
      '           style="background:url(%s) center/cover">\n'
      '    </picture>\n'
      '  </div>' % (ratio + (" " + classe if classe else ""),
                    ' data-anim="volet"' if anim else "",
                    src2, cle, suff, cle, suff, alt,
                    f["w"], f["h"], f["lqip"]))


def bloc_pieces(lg):
    out = []
    for i, (cle, titre, texte, tags) in enumerate(PIECES):
        li = "".join('<li>%s</li>' % x for x in T(tags, lg))
        vue = _img(cle, lg, ratio="cadre--4-3", large=True)
        out.append(
          '<article class="duo%s" style="margin-bottom:clamp(3rem,7vw,5.5rem)">\n'
          '  %s\n'
          '  <div data-anim>\n'
          '    <p class="oeil">%02d</p>\n'
          '    <h2 class="titre-bloc">%s</h2>\n'
          '    <p class="mince">%s</p>\n'
          '    <ul class="etiquettes">%s</ul>\n'
          '  </div>\n'
          '</article>' % (" duo--inverse" if i % 2 else "", vue, i + 1,
                          T(titre, lg), T(texte, lg), li))
    return "\n".join(out)


def bloc_galerie(lg):
    out = []
    for cle in ORDRE:
        f = MAN.get(cle)
        if not f:
            continue
        w = 640
        h = round(f["h"] * w / f["w"])
        leg = legende(cle, lg)
        out.append(
          '<figure data-groupe="%s" data-anim>\n'
          '  <a href="/assets/img/%s-g.webp" data-cle="%s">\n'
          '    <picture>\n'
          '      <source type="image/avif" srcset="/assets/img/%s-v.avif">\n'
          '      <img src="/assets/img/%s-v.webp" alt="%s" width="%d" height="%d"\n'
          '           loading="lazy" decoding="async"\n'
          '           style="background:url(%s) center/cover">\n'
          '    </picture>\n'
          '    <figcaption>%s</figcaption>\n'
          '  </a>\n'
          '</figure>' % (f["groupe"], cle, cle, cle, cle, leg, w, h, f["lqip"], leg))
    return "\n".join(out)


def bloc_onglets(lg):
    return "".join(
      '<button type="button" class="onglet%s" data-filtre="%s">%s</button>\n'
      % (" est-actif" if c == "tout" else "", c, T(nom, lg)) for c, nom in ONGLETS)


def bloc_apercu(lg):
    """Six vues sur l'accueil, chacune menant à la galerie complète."""
    choix = ["sejour-01", "terrasse-02", "chambre-01", "bain-02", "cuisine-01", "detail-02"]
    out = []
    for c in choix:
        f = MAN[c]
        leg = legende(c, lg)
        out.append(
          '<a class="apercu__item" href="%s" data-anim="volet"\n'
          '   aria-label="%s">\n'
          '  <picture>\n'
          '    <source type="image/avif" srcset="/assets/img/%s-v.avif">\n'
          '    <img src="/assets/img/%s-v.webp" alt="%s" width="%d" height="%d"\n'
          '         loading="lazy" decoding="async"\n'
          '         style="background:url(%s) center/cover">\n'
          '  </picture>\n'
          '</a>' % (lien("galerie.html", lg), t("voir_galerie", lg) % leg,
                    c, c, leg, f["w"], f["h"], f["lqip"]))
    return "\n".join(out)


def bloc_ile(lg):
    out = []
    for i, l in enumerate(CFG["ile"]):
        f = MAN.get(l["cle"])
        if not f:
            continue
        if l.get("video"):
            media = (
              '<div class="cadre cadre--4-3" data-anim="volet">\n'
              '    <video data-auto muted loop playsinline preload="none"\n'
              '           poster="/assets/img/%s-g.webp" style="width:100%%; aspect-ratio:4/3; object-fit:cover"\n'
              '           aria-label="%s">\n'
              '      <source src="/assets/video/baie-longue-720.mp4" type="video/mp4"\n'
              '              media="(max-width: 700px)">\n'
              '      <source src="/assets/video/baie-longue.mp4" type="video/mp4">\n'
              '    </video>\n'
              '  </div>' % (l["cle"], t("vue_ciel", lg)))
        else:
            media = _img(l["cle"], lg, ratio="cadre--4-3", large=True)
        km = str(l["km"]).replace(".", ",") if lg == "fr" else str(l["km"])
        trajets = (
          '<dl class="trajets">'
          '<div><dt>%s</dt><dd>%s km</dd></div>'
          '<div><dt>%s</dt><dd>%s</dd></div>'
          '<div><dt>%s</dt><dd>%s</dd></div>'
          '</dl>' % (t("distance", lg), km,
                     t("a_pied", lg), T(l["pied"], lg),
                     t("en_voiture", lg), T(l["voiture"], lg)))
        out.append(
          '<article class="duo%s lieu">\n'
          '  %s\n'
          '  <div data-anim>\n'
          '    <p class="oeil">%s</p>\n'
          '    <h2 class="titre-bloc">%s</h2>\n'
          '    <p class="mince">%s</p>\n'
          '    %s\n'
          '  </div>\n'
          '</article>' % (" duo--inverse" if i % 2 else "", media,
                          T(l["sousTitre"], lg), T(l["nom"], lg), T(l["texte"], lg), trajets))
    return "\n".join(out)


def _etoiles(note, lg, sur=5):
    n = round(note * 5 / sur)
    aff = str(note).replace(".", ",") if lg == "fr" else str(note)
    return ('<span class="etoiles" aria-hidden="true">%s%s</span>'
            '<span class="vh">%s / %s</span>'
            % ("★" * n, "☆" * (5 - n), aff, sur))


def bloc_avis(lg, limite=None):
    a = CFG["avis"]
    liste = a["liste"][:limite] if limite else a["liste"]
    cartes = []
    for v in liste:
        coul, lettre, nom = MARQUES[v["source"]]
        sur = v.get("sur", 5)
        note = str(v["note"]).replace(".", ",") if lg == "fr" else str(v["note"])
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
          '</article>' % (coul, lettre, nom, T(v["date"], lg), _etoiles(v["note"], lg, sur),
                          note, sur, T(v["texte"], lg), v["auteur"]))
    return "\n".join(cartes)


def bloc_avis_tete(lg):
    a = CFG["avis"]
    pf = "".join(
      '<div class="pf"><span class="marque-pf" style="--pf:%s" aria-hidden="true">%s</span>'
      '<span><b>%s</b>/%d<small>%s</small></span></div>'
      % (MARQUES[p["cle"]][0], MARQUES[p["cle"]][1],
         str(p["note"]).replace(".", ",") if lg == "fr" else str(p["note"]),
         p.get("sur", 5), t("avis_sur", lg) % (p["nb"], p["nom"]))
      for p in a["plateformes"])
    note = str(a["note"]).replace(".", ",") if lg == "fr" else str(a["note"])
    return ('<div class="avis-tete" data-anim>\n'
            '  <p class="avis-note"><b data-compte="%s" data-decimales="1">%s</b>'
            '<span>%s</span></p>\n'
            '  <div class="pf-liste">%s</div>\n'
            '</div>' % (a["note"], note, t("sur_cinq", lg), pf))


def bloc_tarifs(lg):
    tf = CFG["tarifs"]
    cartes = []
    for s in tf["saisons"]:
        mini = s.get("nuitsMini", tf["nuitsMini"])
        cartes.append(
          '<div class="tarif%s" data-anim>\n'
          '  <p class="oeil">%s</p>\n'
          '  <p class="tarif__prix">%s<small>%s</small></p>\n'
          '  <p class="tarif__nom">%s</p>\n'
          '  <p class="tarif__mini">%s</p>\n'
          '</div>' % (" tarif--fort" if s["cle"] == "haute" else "",
                      T(s["periode"], lg), euro(s["prix"], lg), t("par_semaine", lg),
                      T(s["nom"], lg), t("nuits_mini", lg) % mini))
    return '<div class="tarifs">\n%s\n</div>' % "\n".join(cartes)


def bloc_conditions(lg):
    tf, b = CFG["tarifs"], CFG["bien"]
    tx = tf["taxeSejour"]
    plafond = ("%.2f" % tx["plafondParPersonneParNuit"])
    plafond = (plafond.replace(".", ",") + FINE + "€") if lg == "fr" else ("€" + plafond)
    return (
      '<table class="table" data-anim>\n'
      '  <caption class="vh">%s</caption>\n'
      '  <thead><tr><th scope="col">%s</th><th scope="col">%s</th></tr></thead>\n'
      '  <tbody>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s, %s</td></tr>\n'
      '  </tbody>\n'
      '</table>\n'
      '<p class="note" style="margin-top:1.6rem" data-anim>%s</p>'
      % (t("cond_titre", lg), t("cond_poste", lg), t("cond_montant", lg),
         t("cond_acompte", lg), t("cond_acompte_v", lg) % tf["acomptePourcent"],
         t("cond_solde", lg), t("cond_solde_v", lg),
         t("cond_menage", lg), euro(tf["menage"], lg),
         t("cond_caution", lg), euro(tf["cautionDepot"], lg),
         t("cond_taxe", lg), t("cond_taxe_v", lg) % (tx["taux"], plafond),
         t("cond_capacite", lg), t("cond_capacite_v", lg) % b["voyageurs"],
         t("cond_transfert", lg), T(CFG["acces"]["voiture"], lg), T(CFG["acces"]["note"], lg),
         t("cond_note", lg) % (T(b["classement"], lg), b["enregistrement"], T(tx["note"], lg))))


def bloc_credits(lg):
    par = {}
    for cle in ORDRE + [k for k in MAN if k not in ORDRE]:
        f = MAN.get(cle)
        if not f:
            continue
        par.setdefault((f["auteur"], f["licence"]), []).append(cle)
    out = ['<table class="table">',
           '  <caption class="vh">%s</caption>' % t("cred_titre", lg),
           '  <thead><tr><th scope="col">%s</th><th scope="col">%s</th>'
           '<th scope="col">%s</th></tr></thead>'
           % (t("cred_auteur", lg), t("cred_vues", lg), t("cred_licence", lg)),
           '  <tbody>']
    for (auteur, licence), cles in sorted(par.items()):
        url = PROFILS.get(auteur, "")
        nom = ('<a href="%s" rel="noopener">%s</a>' % (url, auteur)) if url else auteur
        legendes = ", ".join(sorted({legende(c, lg) for c in cles}))
        out.append('    <tr><td>%s</td><td style="text-align:left">%s <em>(%d)</em></td>'
                   '<td>%s</td></tr>' % (nom, legendes, len(cles), licence))
    out += ['  </tbody>', '</table>']
    return "\n".join(out)


def ecrire_hero_js():
    """Expose au navigateur ce que la fabrication a réellement produit.

    Le nombre d'images et leur poids moyen étaient écrits en dur dans
    js/hero.js : au premier changement de cadence, les deux divergeaient en
    silence. Ils sont désormais lus depuis src/hero.json."""
    chemin_src = os.path.join(RACINE, "src", "hero.json")
    if not os.path.exists(chemin_src):
        return False
    h = json.load(open(chemin_src, encoding="utf-8"))
    d = {c: {"n": v["n"], "poids": round(v["poids"] / v["n"])} for c, v in h.items()}

    # EMPREINTE DE LA SEQUENCE, ajoutee a l'adresse de chaque image.
    #
    # netlify.toml declare tout /assets/ « immutable » pour un an. C'est le bon
    # reglage pour des fichiers dont l'adresse change quand le contenu change —
    # ce qui etait vrai du CSS et du JS, versionnes par empreinte, mais FAUX de
    # la sequence du hero : ses images gardaient la meme adresse d'une
    # fabrication a l'autre. Un recadrage refait etait donc bien deploye, et
    # jamais recu : le navigateur de qui avait deja vu le site servait ses
    # copies pendant un an, sans meme revalider — c'est ce que « immutable »
    # lui demande.
    #
    # L'empreinte porte sur la fiche ET sur la premiere image de chaque profil :
    # la fiche seule ne bougerait pas si un recadrage laissait le poids total
    # inchange.
    graine = open(chemin_src, "rb").read()
    for c in sorted(h):
        img = os.path.join(RACINE, "assets", "hero", "%s000.avif" % c)
        if os.path.exists(img):
            graine += open(img, "rb").read()
    d["v"] = hashlib.sha1(graine).hexdigest()[:8]
    chemin = os.path.join(RACINE, "js", "hero-data.js")
    contenu = ("/* GÉNÉRÉ par construire.py — ne pas modifier à la main.\n"
               "   Nombre d'images de chaque séquence et poids moyen d'une image,\n"
               "   mesurés à la fabrication. */\n"
               "window.ALIZEA_HERO = %s;\n" % json.dumps(d, ensure_ascii=False, indent=1))
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if contenu != ancien:
        open(chemin, "w", encoding="utf-8").write(contenu)
        return True
    return False


# Textes que le navigateur affiche lui-même : calendrier, récapitulatif,
# visionneuse. Ils ne peuvent pas venir du HTML — ils naissent d'un clic.
# Chaque script choisit sa langue sur l'attribut lang de la page.
TEXTES_JS = {
  "mois": {
    "fr": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
           "août", "septembre", "octobre", "novembre", "décembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"]},
  "mois_court": {
    "fr": ["janv", "févr", "mars", "avr", "mai", "juin", "juil",
           "août", "sept", "oct", "nov", "déc"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
           "Aug", "Sep", "Oct", "Nov", "Dec"]},
  "jours": {
    "fr": [["L", "lundi"], ["M", "mardi"], ["M", "mercredi"], ["J", "jeudi"],
           ["V", "vendredi"], ["S", "samedi"], ["D", "dimanche"]],
    "en": [["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"],
           ["F", "Friday"], ["S", "Saturday"], ["S", "Sunday"]]},
  "locale":            {"fr": "fr-FR", "en": "en-GB"},
  "reserve":           {"fr": ", réservé", "en": ", booked"},
  "cal_erreur":        {"fr": "Les disponibilités n'ont pas pu être chargées. Écrivez-nous "
                              "pour vérifier les dates.",
                        "en": "Availability could not be loaded. Write to us and we will "
                              "confirm the dates."},
  "cal_synchro":       {"fr": "Synchronisé avec {0} — dernière mise à jour {1}.",
                        "en": "Synchronised with {0} — last updated {1}."},
  "cal_demo":          {"fr": "Démonstration : disponibilités simulées. Une fois les adresses "
                              "iCal d'Airbnb et de Booking renseignées, ce calendrier devient "
                              "le vrai.",
                        "en": "Demonstration: availability is simulated. Once the Airbnb and "
                              "Booking iCal addresses are set, this calendar becomes the real "
                              "one."},
  "choisir_dates":     {"fr": "Choisissez vos dates dans le calendrier.",
                        "en": "Choose your dates in the calendar."},
  "choisir_depart":    {"fr": "Choisissez maintenant la date de départ.",
                        "en": "Now choose the departure date."},
  "nuits_saison_une":  {"fr": "{0} nuits en {1}", "en": "{0} nights in {1}"},
  "nuits_saison_mix":  {"fr": "{0} nuits · {1}",  "en": "{0} nights · {1}"},
  "nuits_part":        {"fr": "{0} en {1}",       "en": "{0} in {1}"},
  "menage":            {"fr": "Ménage de fin de séjour", "en": "End-of-stay cleaning"},
  "taxe":              {"fr": "Taxe de séjour · {0} pers.", "en": "Tourist tax · {0} guests"},
  "total":             {"fr": "Total du séjour", "en": "Total for the stay"},
  "acompte":           {"fr": "Acompte à régler ({0} % hors taxe de séjour)",
                        "en": "Deposit due ({0}% excluding tourist tax)"},
  "solde":             {"fr": "Solde à 30 jours de l'arrivée",
                        "en": "Balance due 30 days before arrival"},
  "enregistrement":    {"fr": "Enregistrement…", "en": "Saving…"},
  "verification":      {"fr": "Vérification des dates et du montant…",
                        "en": "Checking the dates and the amount…"},
  "indisponible":      {"fr": "Réservation indisponible.", "en": "Booking unavailable."},
  "demo_paiement":     {"fr": "Démonstration : aucun paiement n'est demandé.",
                        "en": "Demonstration: no payment is taken."},
  "paiement_annule":   {"fr": "Paiement annulé — aucun montant n'a été débité.",
                        "en": "Payment cancelled — nothing was charged."},
  "arrivee":           {"fr": "Arrivée", "en": "Arrival"},
  "depart":            {"fr": "Départ",  "en": "Departure"},
  "duree":             {"fr": "Durée",   "en": "Length"},
  "nuits":             {"fr": "{0} nuits", "en": "{0} nights"},
  "acompte_regler":    {"fr": "Acompte à régler", "en": "Deposit due"},
  "acompte_regle":     {"fr": "Acompte réglé",    "en": "Deposit paid"},
  "reference":         {"fr": "Référence", "en": "Reference"},
  "resa_enregistree":  {"fr": "Réservation enregistrée", "en": "Booking recorded"},
  "resa_suite":        {"fr": "ici, et les propriétaires reprendraient contact avant l'arrivée.",
                        "en": "here, and the owners would be in touch before your arrival."},
  "recap_erreur":      {"fr": "Le récapitulatif n'a pas pu être chargé.",
                        "en": "The summary could not be loaded."},
  "recap_paiement":    {"fr": " Votre paiement a bien été pris en compte — vous recevrez la "
                              "confirmation par courriel.",
                        "en": " Your payment went through — you will receive confirmation by "
                              "email."},
  "photos_affichees":  {"fr": "{0} photos affichées", "en": "{0} photos shown"},
  "photo_affichee":    {"fr": "{0} photo affichée",   "en": "{0} photo shown"},
  "message_enregistre":{"fr": "Message enregistré.",  "en": "Message recorded."},
}


def ecrire_textes_js():
    """js/textes.js — ce que le navigateur doit pouvoir dire sans recharger.

    Les deux langues y sont, et chaque script prend la sienne : un seul
    fichier, mis en cache une fois, plutôt qu'une requête par langue."""
    d = {lg: {c: T(v, lg) for c, v in TEXTES_JS.items()} for lg in LANGUES}
    chemin = os.path.join(RACINE, "js", "textes.js")
    contenu = ("/* GÉNÉRÉ par construire.py — ne pas modifier à la main.\n"
               "   Textes affichés par le navigateur, dans les deux langues.\n"
               "   La source est le dictionnaire TEXTES_JS de construire.py. */\n"
               "window.ALIZEA_TEXTES = %s;\n" % json.dumps(d, ensure_ascii=False, indent=1))
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if contenu != ancien:
        open(chemin, "w", encoding="utf-8").write(contenu)
        return True
    return False


def ecrire_credits_js():
    """Crédit affiché sous chaque photo de la visionneuse, dans les deux langues.

    La visionneuse choisit la sienne à partir de l'attribut lang de la page."""
    modele = {"fr": "Photo : %s — licence %s", "en": "Photo: %s — %s licence"}
    d = {lg: {c: modele[lg] % (MAN[c]["auteur"], MAN[c]["licence"])
              for c in ORDRE if c in MAN} for lg in LANGUES}
    chemin = os.path.join(RACINE, "js", "credits.js")
    contenu = ("/* GÉNÉRÉ par construire.py — ne pas modifier à la main.\n"
               "   Crédits affichés sous chaque photo de la visionneuse. */\n"
               "window.ALIZEA_CREDITS = %s;\n" % json.dumps(d, ensure_ascii=False, indent=1))
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if contenu != ancien:
        open(chemin, "w", encoding="utf-8").write(contenu)
        return True
    return False


def bloc_editeur(lg):
    """Identité de l'éditeur — obligation légale, et non décor.
    La villa est fictive ; l'éditeur du site, lui, est réel."""
    e = CFG["editeur"]; h = e["hebergeur"]
    siren = e["siren"].strip()
    ligne_siren = '<tr><td>SIREN</td><td>%s</td></tr>' % (siren or t("ed_siren_vide", lg))
    return (
      '<table class="table">\n'
      '  <caption class="vh">%s</caption>\n'
      '  <tbody>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td>%s</td></tr>\n'
      '    <tr><td>%s</td><td><a href="mailto:%s">%s</a></td></tr>\n'
      '    <tr><td>%s</td><td><a href="tel:%s">%s</a></td></tr>\n'
      '    <tr><td>%s</td><td><a href="%s" rel="noopener">%s</a></td></tr>\n'
      '    %s\n'
      '  </tbody>\n'
      '</table>\n'
      '<h3>%s</h3>\n'
      '<p class="mince">%s — %s — <a href="%s" rel="noopener">%s</a></p>'
      % (t("ed_titre", lg),
         t("ed_editeur", lg), e["studio"],
         t("ed_responsable", lg), e["responsable"],
         t("ed_adresse", lg), e["adresse"],
         t("ed_courriel", lg), e["courriel"], e["courriel"],
         t("ed_telephone", lg), e["telephoneLien"], e["telephone"],
         t("ed_site", lg), e["site"], e["siteAffiche"],
         ligne_siren,
         t("ed_hebergement", lg),
         h["nom"], h["adresse"], h["site"], h["site"].replace("https://", "")))


BLOCS = {
  "EDITEUR":    lambda page, lg: bloc_editeur(lg),
  "PIED":       bloc_pied,
  "TETE":       bloc_tete,
  "PIECES":     lambda page, lg: bloc_pieces(lg),
  "GALERIE":    lambda page, lg: bloc_galerie(lg),
  "ONGLETS":    lambda page, lg: bloc_onglets(lg),
  "ILE":        lambda page, lg: bloc_ile(lg),
  "AVIS":       lambda page, lg: bloc_avis(lg),
  "AVIS3":      lambda page, lg: bloc_avis(lg, 3),
  "AVISTETE":   lambda page, lg: bloc_avis_tete(lg),
  "APERCU":     lambda page, lg: bloc_apercu(lg),
  "TARIFS":     lambda page, lg: bloc_tarifs(lg),
  "CONDITIONS": lambda page, lg: bloc_conditions(lg),
  "CREDITS":    lambda page, lg: bloc_credits(lg),
}

SANS_INDEX = {"confirmation.html", "merci.html"}


def meta_page(nom, s, lg):
    site = CFG["site"]["url"].rstrip("/")
    titre = (re.search(r"<title>(.*?)</title>", s, re.S) or [None, ""])[1].strip()
    desc = (re.search(r'name="description"\s+content="([^"]*)"', s) or [None, ""])[1]
    url = site + lien(nom, lg)
    apercu = site + "/" + CFG["site"]["apercu"]
    locales = {"fr": "fr_FR", "en": "en_GB"}
    autre = "en" if lg == "fr" else "fr"
    m = ['<link rel="canonical" href="%s">' % url]
    # hreflang : c'est ce qui dit aux moteurs que les deux pages sont la même,
    # dans deux langues, et non deux pages concurrentes. Sans lui, elles se
    # font de l'ombre. x-default désigne la version servie à défaut de mieux.
    if nom not in SANS_INDEX:
        for l in LANGUES:
            m.append('<link rel="alternate" hreflang="%s" href="%s%s">'
                     % (l, site, lien(nom, l)))
        m.append('<link rel="alternate" hreflang="x-default" href="%s%s">'
                 % (site, lien(nom, "fr")))
    m += ['<meta property="og:type" content="website">',
          '<meta property="og:site_name" content="%s">' % CFG["marque"]["nom"],
          '<meta property="og:locale" content="%s">' % locales[lg],
          '<meta property="og:locale:alternate" content="%s">' % locales[autre],
          '<meta property="og:url" content="%s">' % url,
          '<meta property="og:title" content="%s">' % titre,
          '<meta property="og:image" content="%s">' % apercu,
          '<meta name="twitter:card" content="summary_large_image">']
    if desc:
        m.insert(len(m) - 2, '<meta property="og:description" content="%s">' % desc)
    if nom in SANS_INDEX:
        m.append('<meta name="robots" content="noindex, nofollow">')
    return "\n".join(m)


def injecter_meta(nom, s, lg):
    """Remplace le bloc de métadonnées, ou le pose s'il n'existe pas."""
    bloc = "<!-- META:debut -->\n" + meta_page(nom, s, lg) + "\n<!-- META:fin -->"
    motif = re.compile(r"<!-- META:debut -->.*?<!-- META:fin -->", re.S)
    if motif.search(s):
        return motif.sub(lambda _: bloc, s)
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', "", s)
    s = re.sub(r'\s*<link rel="alternate"[^>]*>', "", s)
    s = re.sub(r'\s*<meta property="og:[^>]*>', "", s)
    s = re.sub(r'\s*<meta name="robots"[^>]*>', "", s)
    return s.replace('<link rel="stylesheet" href="/css/style.css',
                     bloc + '\n<link rel="stylesheet" href="/css/style.css', 1)


def pages_de(lg):
    """Les pages d'une langue, telles qu'elles existent sur le disque."""
    d = RACINE if lg == "fr" else os.path.join(RACINE, "en")
    if not os.path.isdir(d):
        return []
    return sorted(f for f in os.listdir(d) if f.endswith(".html")
                  and f != "essai-replis.html")


def ecrire_indexation():
    """robots.txt et sitemap.xml, dérivés des pages des deux langues."""
    site = CFG["site"]["url"].rstrip("/")
    robots = ("User-agent: *\n"
              "Allow: /\n"
              "Disallow: /confirmation.html\n"
              "Disallow: /merci.html\n"
              "Disallow: /en/confirmation.html\n"
              "Disallow: /en/merci.html\n"
              "Disallow: /api/\n\n"
              "Sitemap: %s/sitemap.xml\n" % site)
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
              '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for lg in LANGUES:
        for f in pages_de(lg):
            if f in SANS_INDEX or f == "404.html":
                continue
            u = site + lien(f, lg)
            prio = "1.0" if f == "index.html" else (
                   "0.9" if f in ("galerie.html", "reserver.html") else "0.7")
            # Chaque URL déclare ses variantes : c'est la forme que Google
            # attend dans un plan de site bilingue.
            alt = "".join(
              '\n    <xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>'
              % (l, site, lien(f, l)) for l in LANGUES)
            lignes.append('  <url><loc>%s</loc><priority>%s</priority>%s\n  </url>'
                          % (u, prio, alt))
    lignes.append("</urlset>")
    ecrit = []
    for nom, contenu in (("robots.txt", robots), ("sitemap.xml", "\n".join(lignes) + "\n")):
        c = os.path.join(RACINE, nom)
        ancien = open(c, encoding="utf-8").read() if os.path.exists(c) else ""
        if contenu != ancien:
            open(c, "w", encoding="utf-8").write(contenu); ecrit.append(nom)
    return ecrit


def appliquer(chemin, verifie=False):
    nom = os.path.basename(chemin)
    # La langue se lit dans le chemin : les pages anglaises vivent sous en/.
    lg = "en" if os.path.basename(os.path.dirname(chemin)) == "en" else "fr"
    s = ancien = open(chemin, encoding="utf-8").read()
    touche = []
    for bloc, fn in BLOCS.items():
        motif = re.compile(r"(<!-- %s:debut -->).*?(<!-- %s:fin -->)" % (bloc, bloc), re.S)
        if not motif.search(s):
            continue
        s, n = motif.subn(lambda mo: mo.group(1) + "\n" + fn(nom, lg) + "\n" + mo.group(2), s)
        if n != 1:
            raise SystemExit("%s : repère %s introuvable ou en double — "
                             "le générateur ne peut pas écrire." % (nom, bloc))
        touche.append(bloc)
    if nom not in ("essai-replis.html",):
        s2 = injecter_meta(nom, s, lg)
        if s2 != s:
            touche.append("META")
            s = s2
    if s != ancien and not verifie:
        open(chemin, "w", encoding="utf-8").write(s)
    return touche, s != ancien


def versionner(chemin, verifie=False):
    """Recale le ?v= de chaque CSS et JS local sur le CONTENU du fichier.

    Le numero etait ecrit a la main, page par page. Consequence inevitable :
    apres une retouche de css/style.css, index.html passait a v=19 pendant que
    les neuf autres pages restaient a v=11 — et un visiteur qui revenait
    recevait l'ancienne feuille sur tout le site sauf l'accueil.

    Ici la version est l'empreinte du fichier : elle change quand, et
    seulement quand, le fichier change, et elle est la meme partout."""
    s = open(chemin, encoding="utf-8").read()
    avant = s

    def remplacer(m):
        actif = m.group("f")
        reel = os.path.join(RACINE, actif)
        if not os.path.exists(reel):
            return m.group(0)
        h = hashlib.sha1(open(reel, "rb").read()).hexdigest()[:8]
        return '%s="/%s?v=%s"' % (m.group("a"), actif, h)

    s = re.sub(r'(?P<a>href|src)="/?(?P<f>(?:css|js)/[A-Za-z0-9._-]+\.(?:css|js|mjs))(?:\?v=[^"]*)?"',
               remplacer, s)
    # Les affiches du hero aussi. Elles vivent sous /assets/, que netlify.toml
    # declare « immutable » pour un an : sans empreinte dans l'adresse, une
    # affiche refaite ne serait jamais rechargee par qui a deja vu le site.
    s = re.sub(r'(?P<a>href|src)="/?(?P<f>assets/hero/affiche-[a-z]+\.(?:avif|webp|jpg))(?:\?v=[^"]*)?"',
               remplacer, s)
    if s != avant and not verifie:
        open(chemin, "w", encoding="utf-8").write(s)
    return s != avant


def main():
    verifie = "--verifie" in sys.argv
    for lg in LANGUES:
        base = RACINE if lg == "fr" else os.path.join(RACINE, lg)
        if not os.path.isdir(base):
            continue
        fichiers = sorted(f for f in os.listdir(base) if f.endswith(".html"))
        if lg != "fr" and fichiers:
            print("-- %s --" % lg)
        for f in fichiers:
            chemin = os.path.join(base, f)
            touche, change = appliquer(chemin, verifie)
            rev = versionner(chemin, verifie)
            if touche or rev:
                print("%-20s %s%s%s" % (f, ", ".join(touche) or "—",
                                        "  (modifié)" if change else "  (à jour)",
                                        "  versions recalées" if rev else ""))
    if not verifie:
        if ecrire_credits_js():
            print("%-20s réécrit" % "js/credits.js")
        if ecrire_hero_js():
            print("%-20s réécrit" % "js/hero-data.js")
        if ecrire_textes_js():
            print("%-20s réécrit" % "js/textes.js")
        for f in ecrire_indexation():
            print("%-20s réécrit" % f)
    manque = [c for c in ORDRE if c not in MAN]
    fr, en = len(pages_de("fr")), len(pages_de("en"))
    print("\n%d vues dans la galerie, %d lieux sur la page de l'île."
          % (len([c for c in ORDRE if c in MAN]), len(CFG["ile"])))
    print("%d pages en français, %d en anglais." % (fr, en))
    if fr != en:
        print("ATTENTION : les deux langues n'ont pas le même nombre de pages.")
    if manque:
        print("ABSENTES du manifeste :", ", ".join(manque))


if __name__ == "__main__":
    main()
