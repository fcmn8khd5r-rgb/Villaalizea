# -*- coding: utf-8 -*-
"""Mesure l'ecart entre images consecutives d'une video.

Une sequence defilee parait continue quand une image differe peu de la
suivante. On mesure donc l'ecart absolu moyen (EAM) entre images voisines,
en pourcentage de l'echelle des gris. La reference est l'EAM a la cadence
native de la video : c'est le maximum de fluidite que la source permet.
Echantillonner moins souvent multiplie cet ecart — c'est ce facteur qui
fait voir les sauts.
"""
import subprocess, sys, os, shutil
import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()
L = 384


def suite(video, debut, duree, fps):
    tmp = "/tmp/mvt"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", str(debut),
                    "-t", str(duree), "-i", video,
                    "-vf", "fps=%s,scale=%d:-1" % (fps, L),
                    os.path.join(tmp, "f%04d.png")], check=True)
    return [np.asarray(Image.open(os.path.join(tmp, f)).convert("L"), dtype=np.float32)
            for f in sorted(os.listdir(tmp))]


def eam(video, debut, duree, fps):
    ims = suite(video, debut, duree, fps)
    if len(ims) < 2:
        return None
    d = [float(np.mean(np.abs(ims[i] - ims[i + 1]))) / 2.55 for i in range(len(ims) - 1)]
    return {"n": len(ims), "moyen": float(np.mean(d)), "p90": float(np.percentile(d, 90))}


if __name__ == "__main__":
    v, debut, duree = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    ref = eam(v, debut, duree, "30")
    print("  cadence   images   ecart moyen   x natif")
    for fps in (30, 20, 15, 12, 10, 8, 6, 4, 3):
        r = eam(v, debut, duree, str(fps))
        if not r: continue
        print("  %5s fps  %5d      %5.2f %%      x%.1f"
              % (fps, r["n"], r["moyen"], r["moyen"] / ref["moyen"]))
