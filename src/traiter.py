# -*- coding: utf-8 -*-
"""Fabrique les images du site a partir de src/orig/.

Chaque photo sort etalonnee, en AVIF (principal) et WebP (repli), a deux
largeurs, plus une miniature floue encodee en base64 servant de fond pendant
le chargement. Rien n'est corrige en CSS : tout est dans les fichiers.
"""
import base64, io, json, os, sys, csv
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from etalonnage import etalonner

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG   = os.path.join(RACINE, "src", "orig")
SORTIE = os.path.join(RACINE, "assets", "img")

# Largeurs produites : la grille et la visionneuse.
LARGEURS = {"v": 640, "g": 1600}
QUAL     = {"avif": {"quality": 52, "speed": 4}, "webp": {"quality": 74, "method": 6}}

# Force de l'alignement selon l'origine : le lot de reference bouge a peine,
# les sources exterieures sont ramenees plus fermement.
FORCE = {"Luis J. Corniel": 0.22, "SPX Clicks": 0.58, "Protex Plastering": 0.55,
         "Kath MZ": 0.60, "Toma Ha": 0.58,
         # Les vues aeriennes sont ramenees moins fort : leur turquoise est
         # l'interet du plan, l'ecraser vers le creme le rendrait terne.
         "Pexels — vue aérienne": 0.34}


def flou_base64(im, largeur=20):
    p = im.copy()
    p.thumbnail((largeur, largeur))
    p = p.filter(ImageFilter.GaussianBlur(1.2))
    b = io.BytesIO(); p.save(b, "WEBP", quality=42)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()


def traiter(cle, auteur, cible):
    src = os.path.join(ORIG, cle + ".jpg")
    if not os.path.exists(src):
        return None
    im = Image.open(src).convert("RGB")
    im = etalonner(im, cible, force_align=FORCE.get(auteur, 0.55))
    fiche = {"lqip": flou_base64(im), "w": im.width, "h": im.height}
    poids = 0
    for suff, larg in LARGEURS.items():
        c = im.copy()
        if c.width > larg:
            c = c.resize((larg, round(c.height * larg / c.width)), Image.LANCZOS)
        for ext, opts in QUAL.items():
            chemin = os.path.join(SORTIE, "%s-%s.%s" % (cle, suff, ext))
            c.save(chemin, **opts)
            poids += os.path.getsize(chemin)
    fiche["poids"] = poids
    return fiche


def main():
    os.makedirs(SORTIE, exist_ok=True)
    cible_j = json.load(open(os.path.join(RACINE, "src", "cible.json")))
    import numpy as np
    cible = (np.array(cible_j["moyenne"], dtype="float32"),
             np.array(cible_j["ecart"], dtype="float32"))
    lignes = list(csv.DictReader(open(os.path.join(RACINE, "src", "sources.tsv")),
                                 delimiter="\t"))
    manifeste, total = {}, 0
    for l in lignes:
        cle = (l.get("cle") or "").strip()
        if not cle:
            continue
        f = traiter(cle, l["auteur"].strip(), cible)
        if not f:
            print("  absent :", cle); continue
        f.update(auteur=l["auteur"].strip(), licence=l["licence"].strip(),
                 piece=l["piece"].strip(), ident=l["ident"].strip())
        manifeste[cle] = f
        total += f["poids"]
        print("  %-12s %6.1f Ko  %s" % (cle, f["poids"] / 1024, f["piece"]))
    json.dump(manifeste, open(os.path.join(RACINE, "src", "manifeste.json"), "w"),
              ensure_ascii=False, indent=1)
    print("\n%d images — %.1f Mo au total (4 fichiers chacune)"
          % (len(manifeste), total / 1048576))


if __name__ == "__main__":
    main()
