# -*- coding: utf-8 -*-
"""Etalonnage unique du site.

Deux etapes, dans cet ordre :
  1. alignement statistique de chaque image vers la reference (le lot Corniel),
     canal par canal, a force partielle : c'est ce qui raccorde des sources
     qui ne partaient pas du meme point ;
  2. courbe creative commune : legere desaturation, courbe en S, noirs releves
     en mat, hautes lumieres rechauffees.

Le resultat est INTEGRE aux fichiers produits : le rendu ne depend pas du
navigateur et il n'y a pas de double correction en CSS.
"""
from PIL import Image, ImageEnhance
import numpy as np

# Statistiques cibles (moyenne, ecart-type) par canal, mesurees sur le lot
# Corniel. Renseignees par src/mesurer.py.
CIBLE = None


def stats(im):
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    return a.reshape(-1, 3).mean(0), a.reshape(-1, 3).std(0)


def aligner(im, cible, force=0.55):
    """Rapproche l'image de la cible sans l'y ecraser."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    m, s = a.reshape(-1, 3).mean(0), a.reshape(-1, 3).std(0)
    mc, sc = cible
    s = np.where(s < 1e-3, 1e-3, s)
    gain = np.clip(sc / s, 0.75, 1.35)          # jamais de contraste violent
    plein = (a - m) * gain + mc
    out = a + (plein - a) * force
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def _courbe(x, force):
    t = x / 255.0
    s = t * t * (3 - 2 * t)                      # smoothstep
    return t + (s - t) * 0.45 * force


def creative(im, force=1.0):
    im = ImageEnhance.Color(im).enhance(1 - 0.10 * force)
    def canal(gamma, lift, gain):
        return [min(255, int(255 * ((_courbe(i, force) ** gamma) * gain
                                    + lift * (1 - _courbe(i, force)))))
                for i in range(256)]
    r = canal(0.96, 0.055 * force, 1.000)
    g = canal(1.00, 0.052 * force, 0.995)
    b = canal(1.06, 0.062 * force, 0.985)        # ombres legerement froides
    return im.point(r + g + b)


def etalonner(im, cible=None, force_align=0.55, force=1.0):
    im = im.convert("RGB")
    if cible is not None:
        im = aligner(im, cible, force_align)
    return creative(im, force)
