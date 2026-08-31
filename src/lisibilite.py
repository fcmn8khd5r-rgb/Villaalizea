# -*- coding: utf-8 -*-
"""Vérifie le contraste du texte du hero sur TOUTES les images de la séquence.

Le texte est blanc. On calcule la luminance du fond sous chaque ligne, on
lui applique l'opacité de l'écran à cette hauteur, et on en tire le rapport
de contraste WCAG. Le sur-titre, en petites capitales, exige 4,5:1 ;
le grand titre se contente de 3:1.
"""
import glob, sys
import numpy as np
from PIL import Image

# Profil de l'écran : (hauteur depuis le bas en %, opacité du noir)
ECRAN = [(0, .70), (26, .66), (46, .57), (62, .33), (74, .09), (84, 0)]

# Lignes de texte : (nom, bas en % de hauteur, haut en %, gauche %, droite %, ratio exigé)
LIGNES = [("sur-titre",   44, 49, 2, 52, 4.5),
          ("titre",       30, 44, 2, 62, 3.0),
          ("phrase",      18, 29, 2, 62, 4.5),
          ("bouton",       9, 17, 2, 34, 4.5)]


def opacite(h):
    for i in range(len(ECRAN) - 1):
        a, oa = ECRAN[i]; b, ob = ECRAN[i + 1]
        if a <= h <= b:
            return oa + (ob - oa) * (h - a) / (b - a)
    return 0.0


def lum(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def controler(prefixe, nom):
    fs = sorted(glob.glob("assets/hero/%s[0-9][0-9][0-9].avif" % prefixe))
    if not fs:
        return
    print("  %s — %d images" % (nom, len(fs)))
    for lib, bas, haut, g, d, exige in LIGNES:
        pire = 0.0
        for f in fs:
            a = np.asarray(Image.open(f).convert("L"), dtype="float32")
            h, w = a.shape
            z = a[int(h * (1 - haut / 100)):int(h * (1 - bas / 100)),
                  int(w * g / 100):int(w * d / 100)]
            # on prend le 95e centile : ce sont les points clairs qui gênent
            fond = float(np.percentile(z, 95))
            o = opacite((bas + haut) / 2)
            r = 1.05 / (lum(fond * (1 - o)) + 0.05)
            pire = r if pire == 0 else min(pire, r)
        etat = "ok" if pire >= exige else "INSUFFISANT"
        print("     %-10s écran %.0f %%  →  %4.1f:1  (exigé %.1f)  %s"
              % (lib, opacite((bas + haut) / 2) * 100, pire, exige, etat))


if __name__ == "__main__":
    controler("l", "bureau 16/9")
    controler("p", "mobile 3/4")
