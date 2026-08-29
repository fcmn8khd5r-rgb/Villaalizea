# -*- coding: utf-8 -*-
"""Classe le mouvement d'un plan : travelling, panoramique ou zoom.

On découpe l'image en quatre quadrants, on estime le déplacement de chacun
par corrélation de phase, puis on décompose les quatre vecteurs en :
  - translation  : la composante commune (travelling ou panoramique) ;
  - divergence   : l'écartement radial (positif = la scène grandit, donc
                   rapprochement ; négatif = recul, donc dézoom).

C'est ce qui permet de savoir si un plan RECULE — ce qu'aucune lecture de
titre ne dit — sans le regarder image par image.
"""
import os, shutil, subprocess, sys
import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()
L = 512


def suite(video, debut, duree, fps):
    tmp = "/tmp/typemvt"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", str(debut),
                    "-t", str(duree), "-i", video,
                    "-vf", "fps=%s,scale=%d:-1" % (fps, L),
                    os.path.join(tmp, "f%03d.png")], check=True)
    return [np.asarray(Image.open(os.path.join(tmp, f)).convert("L"), "float32")
            for f in sorted(os.listdir(tmp))]


def _decalage(a, b):
    """Corrélation de phase avec raffinement au sous-pixel (barycentre 3x3)."""
    fen = np.hanning(a.shape[0])[:, None] * np.hanning(a.shape[1])[None, :]
    fa, fb = np.fft.fft2(a * fen), np.fft.fft2(b * fen)
    r = fa * np.conj(fb)
    r /= np.abs(r) + 1e-9
    c = np.real(np.fft.ifft2(r))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    # barycentre local pour la précision sous-pixel
    dy = dx = 0.0
    tot = 0.0
    for u in (-1, 0, 1):
        for v in (-1, 0, 1):
            p = max(c[(iy + u) % c.shape[0], (ix + v) % c.shape[1]], 0)
            dy += p * u; dx += p * v; tot += p
    if tot > 0:
        dy /= tot; dx /= tot
    y = iy + dy; x = ix + dx
    if x > a.shape[1] / 2: x -= a.shape[1]
    if y > a.shape[0] / 2: y -= a.shape[0]
    return x, y


def analyse(video, debut, duree, fps=4):
    ims = suite(video, debut, duree, fps)
    if len(ims) < 2:
        return None
    h, w = ims[0].shape
    quad = [(0, 0), (0, w // 2), (h // 2, 0), (h // 2, w // 2)]
    # centre de chaque quadrant, relatif au centre de l'image
    cen = [((qx + w // 4) - w / 2, (qy + h // 4) - h / 2) for qy, qx in quad]
    trs, divs = [], []
    for i in range(len(ims) - 1):
        vs = []
        for (qy, qx) in quad:
            a = ims[i][qy:qy + h // 2, qx:qx + w // 2]
            b = ims[i + 1][qy:qy + h // 2, qx:qx + w // 2]
            vs.append(_decalage(a, b))
        vs = np.array(vs)
        tr = vs.mean(0)                       # composante commune
        res = vs - tr                         # ce qui reste après translation
        # projection radiale : positive si la scène s'écarte du centre
        d = np.mean([np.dot(res[k], cen[k]) / (np.hypot(*cen[k]) + 1e-9)
                     for k in range(4)])
        trs.append(np.hypot(*tr)); divs.append(d)
    n = len(divs)
    return {"images": len(ims),
            "translation": float(np.mean(trs)),
            "divergence": float(np.mean(divs)),
            "divergence_cumul": float(np.sum(divs)),
            "constance": float(np.mean(np.sign(divs) == np.sign(np.mean(divs))))}


def etiquette(r):
    if r is None:
        return "—"
    d, t = r["divergence"], r["translation"]
    if abs(d) > 0.30 and r["constance"] > 0.75:
        sens = "RAPPROCHEMENT" if d > 0 else "RECUL (dézoom)"
        return "%s%s" % (sens, " + travelling" if t > 2 * abs(d) else "")
    if t > 0.6:
        return "travelling / panoramique"
    return "quasi fixe"


if __name__ == "__main__":
    v, debut, duree = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    r = analyse(v, debut, duree)
    print("  translation %5.2f px/img | divergence %+5.2f (cumul %+6.1f, constance %.0f%%)  → %s"
          % (r["translation"], r["divergence"], r["divergence_cumul"],
             r["constance"] * 100, etiquette(r)))
