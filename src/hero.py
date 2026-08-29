# -*- coding: utf-8 -*-
"""Fabrique la sequence d'images du hero pilote au defilement.

Une video scrubbee au doigt bloque sur mobile : Safari ne sait chercher que
les images cles, et tout encoder en images cles triple le poids. On sert donc
une SEQUENCE d'images, chargee par vagues : d'abord une passe grossiere qui
rend le pilotage immediat, puis les images intermediaires en arriere-plan.

Deux cadrages : 16/9 pour les grands ecrans, 3/4 pour le portrait mobile,
afin que la maison reste dans le cadre au lieu d'etre rognee.
"""
import json, os, subprocess, sys, shutil
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from etalonnage import etalonner
import numpy as np

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC    = os.path.join(RACINE, "src", "orig", "vid-31931883.mp4")
SORTIE = os.path.join(RACINE, "assets", "hero")
FF     = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()

# (nom, nb d'images, largeur, hauteur, qualite AVIF)
# Budgets tenus : large 32 x 43 Ko = 1,35 Mo ; portrait 16 x 26 Ko = 0,40 Mo.
# Mesures dans src/budget.md ; ne pas augmenter sans refaire les mesures.
PROFILS = [("l", 32, 1200, 675, 32),      # large  : 16/9
           ("p", 16,  640, 854, 32)]      # portrait mobile : 3/4


def extraire(n):
    tmp = "/tmp/hero-brut"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-i", SRC,
                    "-vf", "fps=%f" % (n / 13.3), "-frames:v", str(n + 2),
                    os.path.join(tmp, "b%04d.png")], check=True)
    return sorted(os.listdir(tmp))[:n], tmp


def main():
    os.makedirs(SORTIE, exist_ok=True)
    c = json.load(open(os.path.join(RACINE, "src", "cible.json")))
    cible = (np.array(c["moyenne"], "float32"), np.array(c["ecart"], "float32"))
    fiche = {}
    for nom, n, lw, lh, q in PROFILS:
        noms, tmp = extraire(n)
        poids = 0
        for i, f in enumerate(noms):
            im = Image.open(os.path.join(tmp, f)).convert("RGB")
            # recadrage centre au bon rapport, puis mise a l'echelle
            r_cible, r = lw / lh, im.width / im.height
            if r > r_cible:
                w = round(im.height * r_cible)
                im = im.crop(((im.width - w) // 2, 0, (im.width - w) // 2 + w, im.height))
            else:
                h = round(im.width / r_cible)
                im = im.crop((0, (im.height - h) // 2, im.width, (im.height - h) // 2 + h))
            im = im.resize((lw, lh), Image.LANCZOS)
            im = etalonner(im, cible, force_align=0.62)
            p = os.path.join(SORTIE, "%s%03d.avif" % (nom, i))
            im.save(p, quality=q, speed=4)
            poids += os.path.getsize(p)
            if i == 0:                      # image d'affiche = repli sans JS
                im.save(os.path.join(SORTIE, "affiche-%s.avif" % nom), quality=62, speed=3)
                im.save(os.path.join(SORTIE, "affiche-%s.webp" % nom), quality=80, method=6)
        fiche[nom] = {"n": n, "w": lw, "h": lh, "poids": poids}
        print("%s : %d images, %.0f Ko (%.1f Ko/image)" % (nom, n, poids/1024, poids/1024/n))
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(fiche, open(os.path.join(RACINE, "src", "hero.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
