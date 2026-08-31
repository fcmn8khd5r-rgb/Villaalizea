# -*- coding: utf-8 -*-
"""Mesure le mouvement PROPRE d'une scene, camera deduite.

Un plan peut beaucoup changer d'une image a l'autre sans qu'aucun element ne
bouge : il suffit que la camera se deplace. C'est le cas d'un survol de
cocoteraie par temps calme — le decor defile, mais les palmes sont figees.

On separe donc les deux :
  1. corrélation de phase sur l'image entiere -> le deplacement GLOBAL, qui
     est celui de la camera ;
  2. on recale la seconde image de ce deplacement, puis on mesure ce qui
     reste de difference. Ce residu, c'est ce qui a bouge tout seul : les
     palmes dans l'alize, l'ecume, le clapot.

Le rapport residu / total dit lequel des deux domine.
"""
import os, shutil, subprocess, sys
import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")
L, FPS, DUREE = 384, 15, 10


def _decalage(a, b):
    """Deplacement global de a vers b, au sous-pixel.

    Le sous-pixel n'est pas un raffinement de confort : sur du feuillage, une
    demi-image de decalage non compensee laisse un residu enorme et ferait
    passer un plan fige pour un plan tres anime."""
    fen = np.hanning(a.shape[0])[:, None] * np.hanning(a.shape[1])[None, :]
    fa, fb = np.fft.fft2(a * fen), np.fft.fft2(b * fen)
    r = fa * np.conj(fb)
    r /= np.abs(r) + 1e-9
    c = np.real(np.fft.ifft2(r))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    dy = dx = tot = 0.0
    for u in (-1, 0, 1):
        for v in (-1, 0, 1):
            p = max(c[(iy + u) % c.shape[0], (ix + v) % c.shape[1]], 0)
            dy += p * u; dx += p * v; tot += p
    if tot > 0:
        dy /= tot; dx /= tot
    x, y = ix + dx, iy + dy
    if x > a.shape[1] / 2: x -= a.shape[1]
    if y > a.shape[0] / 2: y -= a.shape[0]
    return x, y


def _translater(im, dx, dy):
    """Decale une image d'un vecteur quelconque, par rampe de phase."""
    h, w = im.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    ph = np.exp(-2j * np.pi * (fx * dx + fy * dy))
    return np.real(np.fft.ifft2(np.fft.fft2(im) * ph))


def _ecart(a, b):
    return float(np.mean(np.abs(a - b))) / 2.55


def _recale(a, b, dx, dy):
    """Ramene b dans le repere de a, puis rogne les bords ou la rampe de
    phase replie l'image."""
    m = int(np.ceil(max(abs(dx), abs(dy)))) + 6
    h, w = a.shape
    if 2 * m >= min(h, w):
        return None, None
    # _decalage rend l'OPPOSE du deplacement applique (verifie sur cas
    # synthetique) : on recale donc b de (+dx, +dy).
    bb = _translater(b, dx, dy)
    return a[m:h - m, m:w - m], bb[m:h - m, m:w - m]


def source(x):
    if os.path.exists(x):
        return x
    r = subprocess.run(["curl", "-sI", "--max-time", "40", "-A", UA, "-o", "/dev/null",
                        "-w", "%{redirect_url}",
                        "https://www.pexels.com/download/video/%s/" % x],
                       capture_output=True, text=True)
    return r.stdout.strip()


def analyser(chemin, debut=0.0, duree=DUREE):
    tmp = "/tmp/anim-%d" % abs(hash(chemin))
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    subprocess.run([FF, "-rw_timeout", "25000000", "-nostdin", "-y", "-v", "error",
                    "-ss", str(debut), "-t", str(duree), "-i", chemin,
                    "-vf", "fps=%d,scale=%d:-2" % (FPS, L),
                    os.path.join(tmp, "f%03d.png")], stdin=subprocess.DEVNULL)
    fs = sorted(os.listdir(tmp))
    ims = [np.asarray(Image.open(os.path.join(tmp, f)).convert("L"), "float32") for f in fs]
    shutil.rmtree(tmp, ignore_errors=True)
    if len(ims) < 4:
        return None
    tot, res, cam = [], [], []
    cales = [ims[0]]                       # la suite ramenee dans un repere fixe
    dxc = dyc = 0.0
    for i in range(len(ims) - 1):
        a, b = ims[i], ims[i + 1]
        tot.append(_ecart(a, b))
        dx, dy = _decalage(a, b)
        cam.append(float((dx * dx + dy * dy) ** 0.5))
        ra, rb = _recale(a, b, dx, dy)
        res.append(_ecart(ra, rb) if ra is not None else _ecart(a, b))
        dxc += dx; dyc += dy
        cales.append(_translater(b, dxc, dyc))

    # --- Le tremblement -----------------------------------------------------
    # Le residu ci-dessus ne suffit pas : sur un travelling en sous-bois il
    # capte surtout la PARALLAXE — les troncs qui se croisent — et pas le vent.
    # Or la parallaxe est un mouvement LISSE, tandis qu'une palme dans l'alize
    # ou une vague qui casse OSCILLE. On mesure donc l'acceleration temporelle,
    # |I(t-1) - 2 I(t) + I(t+1)| : tout ce qui avance regulierement s'y annule,
    # seul ce qui change de sens y survit.
    m = 8
    h, w = cales[0].shape
    sec = []
    for i in range(1, len(cales) - 1):
        u = cales[i - 1][m:h - m, m:w - m]
        v = cales[i][m:h - m, m:w - m]
        z = cales[i + 1][m:h - m, m:w - m]
        sec.append(float(np.mean(np.abs(u - 2 * v + z))) / 2.55)

    return {"n": len(ims), "total": float(np.mean(tot)),
            "propre": float(np.mean(res)), "camera_px": float(np.mean(cam)),
            "secousse": float(np.mean(sec)) if sec else 0.0,
            "part": float(np.mean(res)) / max(float(np.mean(tot)), 1e-6)}


if __name__ == "__main__":
    for x in sys.argv[1:]:
        u = source(x)
        if not u:
            print("  %-22s introuvable" % os.path.basename(x)); continue
        r = analyser(u)
        if not r:
            print("  %-22s illisible" % os.path.basename(x)); continue
        print("  %-22s total %5.2f | résidu %5.2f | TREMBLEMENT %5.2f | caméra %4.1f px/img"
              % (os.path.basename(x).replace(".mp4", ""),
                 r["total"], r["propre"], r["secousse"], r["camera_px"]), flush=True)
